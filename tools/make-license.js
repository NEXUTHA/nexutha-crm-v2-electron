#!/usr/bin/env node
// 台帳 L-01: ライセンスキーを発行する
//
//   node tools/make-license.js --type master
//   node tools/make-license.js --type normal --name "〇〇株式会社"
//   node tools/make-license.js --type trial  --name "お試し" --days 30
//
// ・秘密鍵はキーチェーンからのみ読む。ファイルには書かない。
// ・発行のたびに tools/licenses.csv へ追記する（git管理外の発行台帳）。
// ・--name は手元の台帳に記録するだけで、キーには含めない（キーにPIIを入れない設計）。

'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const F = require('./license-format');

const SERVICE = 'nexutha-license-signing';
const ACCOUNT = 'nexutha';
const LEDGER = path.join(__dirname, 'licenses.csv');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const type = arg('type', 'normal');
const name = arg('name', '');
const days = parseInt(arg('days', '0'), 10) || 0;   // 0 = 無期限

if (!F.TYPES[type]) {
  console.error(`❌ --type は master / normal / trial のいずれかです（指定: ${type}）`);
  process.exit(1);
}

// 秘密鍵をキーチェーンから取得
let privateKey;
try {
  const b64 = execFileSync('/usr/bin/security',
    ['find-generic-password', '-s', SERVICE, '-a', ACCOUNT, '-w'],
    { encoding: 'utf8' }).trim();
  privateKey = crypto.createPrivateKey({
    key: Buffer.from(b64, 'base64'), format: 'der', type: 'pkcs8',
  });
} catch (e) {
  console.error('');
  console.error('❌ 署名鍵がキーチェーンに見つかりません。');
  console.error('   先に `node tools/keygen.js` を実行してください。');
  console.error('');
  process.exit(1);
}

// 通し番号 = 台帳の行数 + 1
let serial = 1;
if (fs.existsSync(LEDGER)) {
  const lines = fs.readFileSync(LEDGER, 'utf8').trim().split('\n').filter(Boolean);
  serial = Math.max(1, lines.length); // ヘッダ1行ぶんを差し引いた次の番号
}

const now = new Date();
const issuedDays = F.daysFromEpoch(now);
const expiresDays = days > 0 ? issuedDays + days : 0;

const payload = F.buildPayload({ type, serial, issuedDays, expiresDays });
const signature = crypto.sign(null, payload, privateKey);
const key = F.format(F.toBase32(Buffer.concat([payload, signature])));

// 発行台帳へ追記（git管理外）
if (!fs.existsSync(LEDGER)) {
  fs.writeFileSync(LEDGER, 'serial,type,issued,expires,note\n', 'utf8');
}
const csvNote = '"' + String(name).replace(/"/g, '""') + '"';
const expiresStr = expiresDays ? F.dateFromDays(expiresDays).toISOString().slice(0, 10) : '無期限';
fs.appendFileSync(LEDGER,
  `${serial},${type},${now.toISOString().slice(0, 10)},${expiresStr},${csvNote}\n`, 'utf8');

console.log('');
console.log('✅ ライセンスキーを発行しました');
console.log('────────────────────────────────────────────────────────');
console.log(`  通し番号 : #${serial}`);
console.log(`  種別     : ${type}`);
console.log(`  発行日   : ${now.toISOString().slice(0, 10)}`);
console.log(`  有効期限 : ${expiresStr}`);
if (name) console.log(`  宛先メモ : ${name}（台帳のみ。キーには含まれません）`);
console.log('────────────────────────────────────────────────────────');
console.log('');
console.log(key);
console.log('');
console.log(`  （${key.length}文字。お客様にはコピー＆ペーストで渡してください）`);
console.log(`  発行台帳に追記しました: ${LEDGER}`);
console.log('');
