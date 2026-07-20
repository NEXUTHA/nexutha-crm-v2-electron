#!/usr/bin/env node
// 台帳 L-01: ライセンス署名鍵の管理キット
//
//   node tools/key.js status          鍵の有無とバックアップ状況を見る
//   node tools/key.js init            鍵をはじめて作る
//   node tools/key.js rotate          鍵を作り直す（漏れたとき・定期交換）
//   node tools/key.js backup          USB等へ暗号化バックアップを書き出す
//   node tools/key.js restore <file>  バックアップから復元する（Mac買い替え時）
//
// ★設計上の約束: このツールは秘密鍵を画面にもログにも一切表示しない。
//   秘密鍵はキーチェーンと暗号化バックアップファイルの中だけに存在する。
//   （2026-07-20: 秘密鍵を表示する手順が事故を招いたため、表示機能を全廃した）

'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const SERVICE = 'nexutha-license-signing';
const ACCOUNT = 'nexutha';
const STATE = path.join(__dirname, '.key-state.json');
const SEC = '/usr/bin/security';

// ── キーチェーン操作（値は決して返さない/表示しない） ─────────────────

function keyExists() {
  try {
    execFileSync(SEC, ['find-generic-password', '-s', SERVICE, '-a', ACCOUNT], { stdio: 'ignore' });
    return true;
  } catch (e) { return false; }
}

// 内部利用のみ。呼び出し側は絶対に表示しないこと。
function readPrivateB64() {
  return execFileSync(SEC, ['find-generic-password', '-s', SERVICE, '-a', ACCOUNT, '-w'],
    { encoding: 'utf8' }).trim();
}

function writePrivateB64(b64) {
  execFileSync(SEC, ['add-generic-password', '-s', SERVICE, '-a', ACCOUNT, '-w', b64, '-U'],
    { stdio: 'ignore' });
}

function deleteKey() {
  try {
    execFileSync(SEC, ['delete-generic-password', '-s', SERVICE, '-a', ACCOUNT], { stdio: 'ignore' });
  } catch (e) { /* 無ければ何もしない */ }
}

function publicKeyB64FromPrivate(privB64) {
  const priv = crypto.createPrivateKey({
    key: Buffer.from(privB64, 'base64'), format: 'der', type: 'pkcs8',
  });
  return crypto.createPublicKey(priv).export({ type: 'spki', format: 'der' }).toString('base64');
}

// ── 状態ファイル（メタ情報のみ。鍵の値は入れない） ───────────────────

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch (e) { return {}; }
}
function saveState(s) {
  fs.writeFileSync(STATE, JSON.stringify(s, null, 2) + '\n', 'utf8');
}

// ── パスフレーズ入力（画面に出さない） ──────────────────────────────

function promptHidden(question) {
  process.stdout.write(question);
  let input = '';
  try {
    execFileSync('/bin/stty', ['-echo'], { stdio: ['inherit', 'inherit', 'inherit'] });
    const fd = fs.openSync('/dev/tty', 'rs');
    const buf = Buffer.alloc(1);
    while (true) {
      const n = fs.readSync(fd, buf, 0, 1, null);
      if (n === 0) break;
      const code = buf[0];
      if (code === 0x0a || code === 0x0d) break;                   // Enter
      if (code === 0x03) { throw new Error('中断されました'); }      // Ctrl-C
      if (code === 0x7f || code === 0x08) {                        // Backspace
        input = input.slice(0, -1);
        continue;
      }
      input += buf.toString('utf8');
    }
    fs.closeSync(fd);
  } finally {
    try { execFileSync('/bin/stty', ['echo'], { stdio: ['inherit', 'inherit', 'inherit'] }); } catch (e) {}
    process.stdout.write('\n');
  }
  return input;
}

// ── 暗号化 / 復号（AES-256-GCM + scrypt） ───────────────────────────

function encrypt(plainB64, passphrase) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  // maxmem を明示しないと N=2^15 が Node の既定上限(32MB)に触れて実行時エラーになる
  const key = crypto.scryptSync(passphrase, salt, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(plainB64, 'utf8'), c.final()]);
  return {
    format: 'nexutha-license-key-backup',
    version: 1,
    kdf: { name: 'scrypt', N: 2 ** 15, r: 8, p: 1, salt: salt.toString('base64') },
    cipher: 'aes-256-gcm',
    iv: iv.toString('base64'),
    data: enc.toString('base64'),
    tag: c.getAuthTag().toString('base64'),
    createdAt: new Date().toISOString(),
    host: os.hostname(),
  };
}

function decrypt(obj, passphrase) {
  const key = crypto.scryptSync(passphrase, Buffer.from(obj.kdf.salt, 'base64'), 32,
    { N: obj.kdf.N, r: obj.kdf.r, p: obj.kdf.p, maxmem: 64 * 1024 * 1024 });
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(obj.iv, 'base64'));
  d.setAuthTag(Buffer.from(obj.tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(obj.data, 'base64')), d.final()]).toString('utf8');
}

// ── USB検出 ─────────────────────────────────────────────────────────

function findUsbVolumes() {
  try {
    return fs.readdirSync('/Volumes')
      .filter(n => {
        const p = path.join('/Volumes', n);
        try {
          if (fs.lstatSync(p).isSymbolicLink()) return false;   // "Macintosh HD -> /"
          return fs.statSync(p).isDirectory();
        } catch (e) { return false; }
      });
  } catch (e) { return []; }
}

// ── サブコマンド ────────────────────────────────────────────────────

function cmdStatus() {
  const exists = keyExists();
  const st = loadState();
  console.log('');
  console.log('  署名鍵の状態');
  console.log('  ────────────────────────────────────────');
  console.log(`  鍵の有無     : ${exists ? '✅ あります' : '❌ ありません'}`);
  if (exists) {
    console.log(`  保管場所     : macOSキーチェーン（${SERVICE}）`);
    console.log(`  作成/更新日  : ${st.createdAt ? st.createdAt.slice(0, 10) : '（記録なし）'}`);
    console.log(`  最終バックアップ: ${st.lastBackupAt ? st.lastBackupAt.slice(0, 19).replace('T', ' ') : '⚠️ まだ取っていません'}`);
    if (st.lastBackupPath) console.log(`  保存先       : ${st.lastBackupPath}`);
    if (!st.lastBackupAt) {
      console.log('');
      console.log('  ⚠️ バックアップがありません。Macが壊れると新しいライセンスを');
      console.log('     発行できなくなります。 node tools/key.js backup を実行してください。');
    }
  } else {
    console.log('');
    console.log('  まだ鍵がありません。 node tools/key.js init で作成してください。');
  }
  console.log('');
  console.log('  ※このツールは秘密鍵を画面に表示しません（表示する機能はありません）');
  console.log('');
}

function generateAndStore(label) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  writePrivateB64(privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'));
  const pub = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const st = loadState();
  saveState({ ...st, createdAt: new Date().toISOString(), lastBackupAt: null, lastBackupPath: null });
  console.log('');
  console.log(`✅ ${label}`);
  console.log('   秘密鍵はキーチェーンに保存しました（画面には出しません）。');
  console.log('');
  console.log('────────────────────────────────────────────────────────');
  console.log('【新しい公開鍵】これをアプリに埋め込みます');
  console.log('（公開鍵です。人に見せても・チャットに貼っても安全です）');
  console.log('');
  console.log(pub);
  console.log('────────────────────────────────────────────────────────');
  console.log('');
  console.log('次にやること:');
  console.log('  1. 上の公開鍵をコピーして渡す');
  console.log('  2. node tools/key.js backup  ← USBへ暗号化バックアップ（必ず実施）');
  console.log('  3. node tools/make-license.js --type master  ← マスターキー発行');
  console.log('');
}

function cmdInit() {
  if (keyExists()) {
    console.error('');
    console.error('❌ すでに鍵があります。作り直す場合は rotate を使ってください:');
    console.error('     node tools/key.js rotate');
    console.error('');
    process.exit(1);
  }
  generateAndStore('署名鍵を作成しました');
}

function cmdRotate() {
  console.log('');
  console.log('  ⚠️ 鍵の作り直し（ローテーション）');
  console.log('  ────────────────────────────────────────');
  console.log('  古い鍵は削除され、これまでに発行した全ライセンスキーが無効になります。');
  console.log('  お客様には新しいキーを再発行して送り直す必要があります。');
  console.log('');
  const ans = promptHidden('  実行するには「rotate」と入力してEnter（入力は表示されません）: ');
  if (ans.trim() !== 'rotate') {
    console.log('  中止しました。');
    process.exit(1);
  }
  deleteKey();
  generateAndStore('鍵を作り直しました（古い鍵は削除済み）');
  console.log('⚠️ 旧キーで認証済みのお客様について:');
  console.log('   アプリの「移行フラグ」により、すでに認証済みの端末は使い続けられます。');
  console.log('   ただし再インストールした場合は新しいキーが必要です。');
  console.log('');
}

function cmdBackup() {
  if (!keyExists()) {
    console.error('\n❌ 鍵がありません。先に node tools/key.js init を実行してください。\n');
    process.exit(1);
  }
  const argDest = process.argv[3];
  let dest = argDest;
  if (!dest) {
    const vols = findUsbVolumes();
    if (vols.length === 1) {
      dest = path.join('/Volumes', vols[0]);
      console.log(`\n  USBを見つけました: ${dest}`);
    } else if (vols.length > 1) {
      console.log('\n  外部ディスクが複数あります。保存先を指定してください:');
      vols.forEach(v => console.log(`     node tools/key.js backup "/Volumes/${v}"`));
      console.log('');
      process.exit(1);
    } else {
      console.error('\n❌ USBメモリ等が見つかりません。');
      console.error('   USBを挿してからもう一度実行するか、保存先を指定してください:');
      console.error('     node tools/key.js backup ~/Desktop\n');
      process.exit(1);
    }
  }
  if (!fs.existsSync(dest)) {
    console.error(`\n❌ 保存先が見つかりません: ${dest}\n`);
    process.exit(1);
  }

  console.log('');
  console.log('  バックアップにはパスフレーズ（合言葉）が必要です。');
  console.log('  ★このパスフレーズは復元時に必要です。必ず紙に書いて、');
  console.log('    USBとは別の場所に保管してください。');
  console.log('    忘れると復元できません（こちらでも復旧できません）。');
  console.log('');
  const p1 = promptHidden('  パスフレーズ（入力は表示されません）: ');
  if (p1.length < 8) {
    console.error('\n❌ 8文字以上にしてください。\n');
    process.exit(1);
  }
  const p2 = promptHidden('  もう一度入力してください: ');
  if (p1 !== p2) {
    console.error('\n❌ 一致しません。最初からやり直してください。\n');
    process.exit(1);
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const file = path.join(dest, `nexutha-license-key-backup-${stamp}.json`);
  const enc = encrypt(readPrivateB64(), p1);
  fs.writeFileSync(file, JSON.stringify(enc, null, 2) + '\n', { mode: 0o600 });

  const st = loadState();
  saveState({ ...st, lastBackupAt: new Date().toISOString(), lastBackupPath: file });

  console.log('');
  console.log('✅ バックアップを書き出しました');
  console.log(`   ${file}`);
  console.log('');
  console.log('   このファイルは暗号化されています。パスフレーズが無ければ開けません。');
  console.log('   ★USBは金庫等に、パスフレーズを書いた紙は別の場所に保管してください。');
  console.log('');
}

function cmdRestore() {
  const file = process.argv[3];
  if (!file) {
    console.error('\n❌ バックアップファイルを指定してください:');
    console.error('     node tools/key.js restore /Volumes/USB/nexutha-license-key-backup-2026-07-20.json\n');
    process.exit(1);
  }
  if (!fs.existsSync(file)) {
    console.error(`\n❌ ファイルが見つかりません: ${file}\n`);
    process.exit(1);
  }
  let obj;
  try {
    obj = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (obj.format !== 'nexutha-license-key-backup') throw new Error('形式が違います');
  } catch (e) {
    console.error(`\n❌ バックアップファイルとして読めません: ${e.message}\n`);
    process.exit(1);
  }
  if (keyExists()) {
    console.log('');
    console.log('  ⚠️ このMacにはすでに鍵があります。復元すると上書きされます。');
    const ans = promptHidden('  続けるには「restore」と入力してEnter（表示されません）: ');
    if (ans.trim() !== 'restore') { console.log('  中止しました。'); process.exit(1); }
  }
  const pass = promptHidden('\n  パスフレーズ（入力は表示されません）: ');
  let priv;
  try {
    priv = decrypt(obj, pass);
  } catch (e) {
    console.error('\n❌ 復号できませんでした。パスフレーズが違うか、ファイルが壊れています。\n');
    process.exit(1);
  }
  // 妥当性チェック（鍵として読めるか）。値は表示しない。
  let pub;
  try { pub = publicKeyB64FromPrivate(priv); }
  catch (e) { console.error('\n❌ 鍵として読めませんでした。\n'); process.exit(1); }

  writePrivateB64(priv);
  saveState({ ...loadState(), createdAt: obj.createdAt || new Date().toISOString(),
    lastBackupAt: obj.createdAt, lastBackupPath: file });

  console.log('');
  console.log('✅ 鍵をキーチェーンに復元しました。');
  console.log('');
  console.log('   参考: この鍵に対応する公開鍵（アプリに埋め込まれているはずの値）');
  console.log('   ' + pub);
  console.log('');
  console.log('   アプリ側の公開鍵と一致していれば、これまでのライセンスキーがそのまま使えます。');
  console.log('');
}

// ── ディスパッチ ────────────────────────────────────────────────────

const cmd = process.argv[2];
try {
  switch (cmd) {
    case 'status': cmdStatus(); break;
    case 'init': cmdInit(); break;
    case 'rotate': cmdRotate(); break;
    case 'backup': cmdBackup(); break;
    case 'restore': cmdRestore(); break;
    default:
      console.log('');
      console.log('  ライセンス署名鍵の管理');
      console.log('  ────────────────────────────────────────');
      console.log('  node tools/key.js status          今の状態を見る');
      console.log('  node tools/key.js init            はじめて鍵を作る');
      console.log('  node tools/key.js rotate          鍵を作り直す（漏れたとき）');
      console.log('  node tools/key.js backup [保存先] USBへ暗号化バックアップ');
      console.log('  node tools/key.js restore <ファイル>  バックアップから復元');
      console.log('');
      console.log('  詳しくは docs/KEY_MANAGEMENT.md をお読みください。');
      console.log('');
  }
} catch (e) {
  console.error('\n❌ ' + e.message + '\n');
  process.exit(1);
}
