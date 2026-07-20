// 台帳 L-01: ライセンスキーの形式定義（発行CLIと検証(main.js)の共有ロジック）
//
// キー = PREFIX + Base32Crockford( ペイロード16バイト + Ed25519署名64バイト )
//   ペイロード: version(1) type(1) issued(2) serial(4) expires(2) reserved(6)
//   日付は 2026-01-01 からの経過日数（expires=0 は無期限）
//
// ★このファイルは秘密情報を一切含まない。秘密鍵はキーチェーンにのみ存在する。

'use strict';

const SCHEME_PREFIX = 'NXTH2-';          // 方式のバージョン。将来別方式を出すときは NXTH3- 等にする
const EPOCH_MS = Date.UTC(2026, 0, 1);   // 2026-01-01
const PAYLOAD_LEN = 16;
const SIG_LEN = 64;

const TYPES = { master: 1, normal: 2, trial: 3 };
const TYPE_NAMES = { 1: 'master', 2: 'normal', 3: 'trial' };

// Crockford Base32（I/L/O/U を除外＝誤読しにくい）
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function toBase32(buf) {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function fromBase32(str) {
  let bits = 0, value = 0;
  const out = [];
  for (const ch of str) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error('ライセンスキーに使えない文字が含まれています: ' + ch);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

// 入力の揺れを吸収する: 小文字・空白・改行・ハイフン、よくある誤読(I→1, L→1, O→0, U→V)
function normalize(input) {
  let s = String(input || '').toUpperCase().replace(/[\s\-_]/g, '');
  if (s.startsWith(SCHEME_PREFIX.replace('-', ''))) s = s.slice(SCHEME_PREFIX.length - 1);
  return s.replace(/I/g, '1').replace(/L/g, '1').replace(/O/g, '0').replace(/U/g, 'V');
}

// 表示用: 5文字ずつハイフン区切り
function format(body) {
  return SCHEME_PREFIX + (body.match(/.{1,5}/g) || []).join('-');
}

function daysFromEpoch(date) {
  return Math.floor((date.getTime() - EPOCH_MS) / 86400000);
}

function dateFromDays(days) {
  return new Date(EPOCH_MS + days * 86400000);
}

function buildPayload({ type, serial, issuedDays, expiresDays }) {
  const b = Buffer.alloc(PAYLOAD_LEN, 0);
  b.writeUInt8(1, 0);                       // version
  b.writeUInt8(TYPES[type], 1);             // type
  b.writeUInt16BE(issuedDays, 2);           // issued
  b.writeUInt32BE(serial, 4);               // serial
  b.writeUInt16BE(expiresDays || 0, 8);     // expires (0=無期限)
  return b;                                 // 10..15 は予備(0)
}

function parsePayload(buf) {
  return {
    version: buf.readUInt8(0),
    typeCode: buf.readUInt8(1),
    type: TYPE_NAMES[buf.readUInt8(1)] || 'unknown',
    issuedDays: buf.readUInt16BE(2),
    serial: buf.readUInt32BE(4),
    expiresDays: buf.readUInt16BE(8),
  };
}

// キー文字列 → { payload, signature, info }。形式不正なら null
function decode(keyString) {
  let body;
  try {
    body = normalize(keyString);
  } catch (e) {
    return null;
  }
  if (body.length < Math.ceil((PAYLOAD_LEN + SIG_LEN) * 8 / 5)) return null;
  let raw;
  try {
    raw = fromBase32(body);
  } catch (e) {
    return null;
  }
  if (raw.length < PAYLOAD_LEN + SIG_LEN) return null;
  const payload = raw.subarray(0, PAYLOAD_LEN);
  const signature = raw.subarray(PAYLOAD_LEN, PAYLOAD_LEN + SIG_LEN);
  return { payload, signature, info: parsePayload(payload) };
}

module.exports = {
  SCHEME_PREFIX, PAYLOAD_LEN, SIG_LEN, TYPES, TYPE_NAMES,
  toBase32, fromBase32, normalize, format,
  daysFromEpoch, dateFromDays,
  buildPayload, parsePayload, decode,
};
