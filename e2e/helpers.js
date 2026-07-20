// 台帳 T-01: パッケージ版アプリのE2E共通処理
const { _electron: electron } = require('playwright');
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const F = require('../tools/license-format');

// 検証対象アプリ。NEXUTHA_APP_BIN で差し替え可能（ドラフト成果物を直接検証するため）
const APP_BIN = process.env.NEXUTHA_APP_BIN || '/Applications/NEXUTHA CRM.app/Contents/MacOS/NEXUTHA CRM';
const SCRATCH = path.join(process.env.HOME, 'NEXUTHA_SCRATCH', 'e2e');

// 実鍵で署名した本物のキーを作る（テスト用。キーチェーンから読むが値は出力しない）
function issueKey(type = 'normal', serial = 9001, days = 0) {
  const b64 = execFileSync('/usr/bin/security',
    ['find-generic-password', '-s', 'nexutha-license-signing', '-a', 'nexutha', '-w'],
    { encoding: 'utf8' }).trim();
  const priv = crypto.createPrivateKey({ key: Buffer.from(b64, 'base64'), format: 'der', type: 'pkcs8' });
  const issued = F.daysFromEpoch(new Date());
  const p = F.buildPayload({ type, serial, issuedDays: issued, expiresDays: days ? issued + days : 0 });
  return F.format(F.toBase32(Buffer.concat([p, crypto.sign(null, p, priv)])));
}

function freshDirs(name) {
  const base = path.join(SCRATCH, name);
  fs.rmSync(base, { recursive: true, force: true });
  const profile = path.join(base, 'profile');
  const data = path.join(base, 'data');
  fs.mkdirSync(profile, { recursive: true });
  fs.mkdirSync(data, { recursive: true });
  return { base, profile, data };
}

async function launch({ profile, data, extraEnv = {} }) {
  const errors = [];
  const app = await electron.launch({
    executablePath: APP_BIN,
    args: [`--user-data-dir=${profile}`],
    env: { ...process.env, NEXUTHA_DATA_DIR: data, ...extraEnv },
    timeout: 90000,
  });
  const win = await app.firstWindow({ timeout: 90000 });
  win.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  win.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  return { app, win, errors };
}

// UIが操作可能か（見えるだけでなく、実際にクリックが届くか）を実測
async function probeClickable(win) {
  return win.evaluate(() => {
    const targets = [...document.querySelectorAll('.nav-item')];
    const results = targets.map(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return { text: el.textContent.trim().slice(0, 10), hit: false };
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { text: el.textContent.trim().slice(0, 10), hit: !!(top && (top === el || el.contains(top) || top.contains(el))) };
    });
    const covering = [...document.querySelectorAll('body *')].filter(el => {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || s.pointerEvents === 'none') return false;
      if (s.position !== 'fixed' && s.position !== 'absolute') return false;
      const r = el.getBoundingClientRect();
      return r.width >= innerWidth * 0.9 && r.height >= innerHeight * 0.9;
    }).map(el => ({ id: el.id, cls: String(el.className).slice(0, 40), z: getComputedStyle(el).zIndex }));
    return { total: results.length, clickable: results.filter(r => r.hit).length, results, covering };
  });
}

const licenseVisible = (win) => win.evaluate(() =>
  getComputedStyle(document.getElementById('license-overlay')).display !== 'none');

module.exports = { issueKey, freshDirs, launch, probeClickable, licenseVisible, APP_BIN, SCRATCH, F };
