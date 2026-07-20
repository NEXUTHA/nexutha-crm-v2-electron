#!/usr/bin/env node
// 台帳 L-01: ライセンス署名用の鍵ペアを作る（初回に1回だけ実行）
//
//   node tools/keygen.js
//
// ・秘密鍵は macOS キーチェーンに保存する。ファイルにもリポジトリにも書かない。
// ・公開鍵は標準出力に出す。これを main.js に埋め込む（公開鍵なので秘匿不要）。
// ★秘密鍵が漏れると誰でも無限にライセンスを作れる。取り扱いに注意すること。

'use strict';
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const SERVICE = 'nexutha-license-signing';
const ACCOUNT = 'nexutha';

function keychainHas() {
  try {
    execFileSync('/usr/bin/security', ['find-generic-password', '-s', SERVICE, '-a', ACCOUNT],
      { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

if (keychainHas()) {
  console.error('');
  console.error('❌ 署名鍵はすでにキーチェーンに存在します。');
  console.error('');
  console.error('   上書きすると、これまでに発行した全ライセンスキーが無効になります。');
  console.error('   本当に作り直す場合は、先に手動で削除してください:');
  console.error(`     security delete-generic-password -s ${SERVICE} -a ${ACCOUNT}`);
  console.error('');
  process.exit(1);
}

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');

// 秘密鍵(PKCS8/DER)をbase64にしてキーチェーンへ
const privB64 = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');
execFileSync('/usr/bin/security',
  ['add-generic-password', '-s', SERVICE, '-a', ACCOUNT, '-w', privB64, '-U'],
  { stdio: 'ignore' });

// 公開鍵(SPKI/DER)をbase64で表示
const pubB64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');

console.log('');
console.log('✅ 署名鍵を作成し、秘密鍵をキーチェーンに保存しました。');
console.log(`   サービス名: ${SERVICE} / アカウント: ${ACCOUNT}`);
console.log('');
console.log('────────────────────────────────────────────────────────');
console.log('【公開鍵】これを main.js の LICENSE_PUBLIC_KEY_B64 に貼ってください');
console.log('（公開鍵なので、そのまま人に見せても・配布しても問題ありません）');
console.log('');
console.log(pubB64);
console.log('────────────────────────────────────────────────────────');
console.log('');
console.log('⚠️ 次にやること（重要）:');
console.log('  1. 秘密鍵のバックアップを取り、VAULTとは別の場所に物理保管する:');
console.log(`       security find-generic-password -s ${SERVICE} -a ${ACCOUNT} -w`);
console.log('     ↑ この出力を紙に印刷するか、USBメモリに保存して金庫等へ。');
console.log('     ★この値はチャットに貼らないこと。漏れると誰でもライセンスを作れます。');
console.log('  2. 上の公開鍵をアプリに埋め込む');
console.log('  3. node tools/make-license.js --type master  でマスターキーを発行');
console.log('');
