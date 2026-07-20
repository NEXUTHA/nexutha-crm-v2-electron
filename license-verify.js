// 台帳 L-01: ライセンスキーのオフライン検証（Electron main プロセスで動く）
//
// ・ネットワークを一切使わない。公開鍵で署名を検証するだけ。
// ・公開鍵は秘密情報ではないので、ここに直接埋め込んでよい。
// ・秘密鍵はこのリポジトリにもアプリにも存在しない（山下さんのキーチェーンのみ）。
//
// 2026-07-20: Supabase(gvaoljanjtgotzjzcfta.supabase.co)へのHTTP照会を廃止。
//   サーバー消滅で全ユーザーが起動不能になったため（台帳 L-01/L-02）。

'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ── 署名検証用の公開鍵（SPKI/DER の base64） ─────────────────────────
// 2026-07-20 に発行。以前の鍵は漏洩したため破棄済み（ローテーション実施）。
const LICENSE_PUBLIC_KEY_B64 =
  'MCowBQYDK2VwAyEARz3lkN1EbvhheIJ8zTFJ9WI+hu4uLwImwPRYGTAqE08=';

const SCHEME_PREFIX = 'NXTH2-';
const EPOCH_MS = Date.UTC(2026, 0, 1);
const PAYLOAD_LEN = 16;
const SIG_LEN = 64;
const TYPE_NAMES = { 1: 'master', 2: 'normal', 3: 'trial' };
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';   // Crockford Base32

let _publicKey = null;
function publicKey() {
  if (!_publicKey) {
    _publicKey = crypto.createPublicKey({
      key: Buffer.from(LICENSE_PUBLIC_KEY_B64, 'base64'), format: 'der', type: 'spki',
    });
  }
  return _publicKey;
}

function fromBase32(str) {
  let bits = 0, value = 0;
  const out = [];
  for (const ch of str) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) return null;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

// 貼り付けの揺れを吸収（小文字・空白・改行・ハイフン・よくある誤読）
function normalize(input) {
  let s = String(input || '').toUpperCase().replace(/[\s\-_]/g, '');
  const p = SCHEME_PREFIX.replace('-', '');
  if (s.startsWith(p)) s = s.slice(p.length);
  return s.replace(/I/g, '1').replace(/L/g, '1').replace(/O/g, '0').replace(/U/g, 'V');
}

// ── 失効リスト（アップデートで配る。v1は空） ─────────────────────────
// ★fail-open: 更新していない端末には失効が届かない。オフライン方式の原理的な限界。
function loadRevoked(baseDir) {
  try {
    const p = path.join(baseDir, 'revoked.json');
    if (!fs.existsSync(p)) return [];
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Array.isArray(j.revokedSerials) ? j.revokedSerials : [];
  } catch (e) {
    return [];   // 読めなければ失効なしとして扱う（正規ユーザーを締め出さない）
  }
}

/**
 * ライセンスキーを検証する。ネットワークは使わない。
 * @returns {{valid:boolean, reason?:string, info?:object}}
 */
function verifyLicense(keyString, opts) {
  const baseDir = (opts && opts.baseDir) || __dirname;
  const body = normalize(keyString);
  if (!body) return { valid: false, reason: 'empty' };

  const raw = fromBase32(body);
  if (!raw || raw.length < PAYLOAD_LEN + SIG_LEN) return { valid: false, reason: 'malformed' };

  const payload = raw.subarray(0, PAYLOAD_LEN);
  const signature = raw.subarray(PAYLOAD_LEN, PAYLOAD_LEN + SIG_LEN);

  let ok = false;
  try {
    ok = crypto.verify(null, payload, publicKey(), signature);
  } catch (e) {
    return { valid: false, reason: 'verify_error' };
  }
  if (!ok) return { valid: false, reason: 'bad_signature' };

  const info = {
    version: payload.readUInt8(0),
    type: TYPE_NAMES[payload.readUInt8(1)] || 'unknown',
    issuedDays: payload.readUInt16BE(2),
    serial: payload.readUInt32BE(4),
    expiresDays: payload.readUInt16BE(8),
  };

  if (info.version !== 1) return { valid: false, reason: 'unsupported_version', info };

  // 失効チェック
  if (loadRevoked(baseDir).includes(info.serial)) {
    return { valid: false, reason: 'revoked', info };
  }

  // 有効期限（0 = 無期限）
  if (info.expiresDays > 0) {
    const today = Math.floor((Date.now() - EPOCH_MS) / 86400000);
    if (today > info.expiresDays) return { valid: false, reason: 'expired', info };
  }

  return { valid: true, info };
}

module.exports = { verifyLicense, LICENSE_PUBLIC_KEY_B64, SCHEME_PREFIX };
