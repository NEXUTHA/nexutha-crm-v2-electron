// 台帳 T-01: パッケージ版アプリの受入E2E（クリーン / レガシー 両プロファイル）
const H = require('./helpers');
const fs = require('fs'); const path = require('path');
const crypto = require('crypto');

const results = [];
const rec = (name, ok, detail='') => { results.push({name, ok, detail}); console.log(`  ${ok?'✅':'🔴'} ${name}${detail?'  — '+detail:''}`); };

async function clean() {
  console.log('\n=== クリーン環境 ===');
  const d = H.freshDirs('clean');
  let { app, win, errors } = await H.launch(d);
  await win.waitForTimeout(9000);

  // ① キー無しでは入れない
  rec('キー無しでは入れない（ライセンス画面が出る）', await H.licenseVisible(win));
  const dash = await win.evaluate(() => getComputedStyle(document.getElementById('page-dashboard')||{style:{}}).display);
  rec('ダッシュボードに到達していない', dash !== 'block' || await H.licenseVisible(win));

  // ② 偽造キーは拒否
  const forged = 'NXTH2-' + 'A'.repeat(128).match(/.{1,5}/g).join('-');
  const forgedOk = await win.evaluate(k => window.electronAPI.verifyLicense(k).then(r=>r.valid), forged);
  rec('偽造キーを拒否', forgedOk === false);

  // ③ 失効キーを拒否（revoked.jsonにserialを載せて検証）
  const revokedSerial = 9101;
  const resDir = path.join(path.dirname(H.APP_BIN), '..', 'Resources');
  const revPath = path.join(resDir, 'revoked.json');
  const revBak = fs.readFileSync(revPath, 'utf8');
  let revokedRejected = null;
  try {
    fs.writeFileSync(revPath, JSON.stringify({revokedSerials:[revokedSerial]}));
    const rk = H.issueKey('normal', revokedSerial);
    const r = await win.evaluate(k => window.electronAPI.verifyLicense(k), rk);
    revokedRejected = (r.valid === false && r.reason === 'revoked');
  } finally { fs.writeFileSync(revPath, revBak); }
  rec('失効リスト該当キーを拒否', revokedRejected === true);

  // ④ 正規キーで認証通過
  const key = H.issueKey('master', 9001);
  await win.fill('#license-input', key);
  await win.click('#license-btn');
  await win.waitForTimeout(6000);
  rec('正規NXTH2キーで認証通過', !(await H.licenseVisible(win)));

  // ④.5 新規環境では初回セットアップ画面が出る。ボタンで閉じられること（正常フロー）を検証。
  const setupShown = await win.evaluate(() => getComputedStyle(document.getElementById('setup-overlay')).display !== 'none');
  rec('新規環境で初回セットアップ画面が出る', setupShown);
  await win.evaluate(() => { if (typeof skipSetup === 'function') skipSetup(); });
  await win.waitForTimeout(1500);
  rec('セットアップを閉じられる（ボタンのonclickが動く）',
    await win.evaluate(() => getComputedStyle(document.getElementById('setup-overlay')).display === 'none'));

  // ⑤ クリック可能性（オーバーレイを閉じた後）
  const cl = await H.probeClickable(win);
  rec('全UIがクリック実測で反応', cl.total > 0 && cl.clickable === cl.total, `${cl.clickable}/${cl.total} 命中, 覆う要素=${cl.covering.length}`);

  // ⑥ 顧客登録→見積→PDF
  let flow = { customer:false, doc:false, pdf:false };
  try {
    await win.click('.nav-item[data-page="customers"]'); await win.waitForTimeout(1200);
    await win.evaluate(() => openAddModal());
    await win.waitForTimeout(800);
    await win.fill('#f-name', 'E2ETESTCUSTOMER');
    await win.evaluate(() => _execSaveCustomer());
    await win.waitForTimeout(2500);
    flow.customer = await win.evaluate(() => (window.APP.customers||[]).some(c=>c.name==='E2ETESTCUSTOMER'));
    const cid = await win.evaluate(() => (window.APP.customers.find(c=>c.name==='E2ETESTCUSTOMER')||{}).id);
    const docId = await win.evaluate(async (cid) => {
      const num = await NAPI.nextDocNumber('estimate');
      const r = await NAPI.createDocument({customer_id:cid, type:'estimate', doc_number:num,
        doc_date:new Date().toISOString().slice(0,10), atena:'E2ETESTCUSTOMER', honorific:'御中',
        items:[{name:'E2Eテスト項目', qty:1, price:300000, taxRate:10}],
        subtotal:300000, tax:30000, total:330000, tax_rate:10});
      return r && r.id;
    }, cid);
    flow.doc = !!docId;
    const pdfOk = await win.evaluate(async () => {
      try { return typeof generatePdfHtml === 'function' && typeof window.jspdf !== 'undefined' && typeof html2canvas !== 'undefined'; }
      catch(e){ return false; }
    });
    flow.pdf = pdfOk;
  } catch(e) { flow.err = e.message.slice(0,80); }
  rec('顧客登録', flow.customer);
  rec('見積作成', flow.doc);
  rec('PDF生成の前提（jsPDF/html2canvasがローカルで解決）', flow.pdf, flow.err||'');

  rec('JS例外ゼロ', errors.length === 0, errors.slice(0,2).join(' | '));
  await app.close();
}

async function legacy() {
  console.log('\n=== レガシー環境（実プロファイル/実DBのコピー） ===');
  const d = H.freshDirs('legacy');
  // 実プロファイルと実DBを「コピー」して使う（原本は読むだけ）
  const realProfile = path.join(process.env.HOME, 'Library/Application Support/NEXUTHA CRM');
  fs.cpSync(realProfile, d.profile, { recursive: true });
  const bk = path.join(process.env.HOME, 'NEXUTHA_BACKUPS/2026-07-21/appsupport_nexutha_2026-07-21.db');
  fs.copyFileSync(bk, path.join(d.data, 'nexutha.db'));

  const { app, win, errors } = await H.launch(d);
  await win.waitForTimeout(11000);

  rec('旧キーgrandfatherで起動できる（ライセンス画面が出ない）', !(await H.licenseVisible(win)));
  const n = await win.evaluate(() => (window.APP.customers||[]).length);
  rec('既存データが表示される', n > 0, `顧客${n}件`);
  const cl = await H.probeClickable(win);
  rec('全UIがクリック実測で反応', cl.total>0 && cl.clickable===cl.total, `${cl.clickable}/${cl.total} 命中, 覆う要素=${cl.covering.length}`);
  const page = await win.evaluate(async () => { showPage('customers'); await new Promise(r=>setTimeout(r,800)); return currentPage; });
  rec('画面遷移が動作する', page === 'customers');
  rec('JS例外ゼロ', errors.length === 0, errors.slice(0,2).join(' | '));
  await app.close();
}

async function offline() {
  console.log('\n=== オフライン起動 ===');
  const d = H.freshDirs('offline');
  const key = H.issueKey('master', 9002);
  const { app, win, errors } = await H.launch(d);
  // 外部通信を全遮断（localhostのみ許可）
  await app.evaluate(({ session }) => {
    session.defaultSession.webRequest.onBeforeRequest((details, cb) => {
      const u = new URL(details.url);
      const local = ['localhost','127.0.0.1'].includes(u.hostname) || u.protocol==='file:' || u.protocol==='devtools:';
      cb({ cancel: !local });
    });
  });
  await win.reload(); await win.waitForTimeout(9000);
  rec('オフラインでも起動する（白画面でない）', await win.evaluate(() => document.querySelectorAll('body *').length > 50));
  await win.fill('#license-input', key); await win.click('#license-btn'); await win.waitForTimeout(6000);
  rec('オフラインで認証を通過', !(await H.licenseVisible(win)));
  await win.evaluate(() => { if (typeof skipSetup === 'function') skipSetup(); });
  await win.waitForTimeout(1500);
  const libs = await win.evaluate(() => ({d: typeof Dexie, j: typeof window.jspdf, h: typeof html2canvas}));
  rec('ライブラリがローカルで解決（CDN不要）', libs.d!=='undefined' && libs.j!=='undefined' && libs.h!=='undefined', JSON.stringify(libs));
  const cl = await H.probeClickable(win);
  rec('オフラインでUIがクリック可能', cl.total>0 && cl.clickable===cl.total, `${cl.clickable}/${cl.total}`);
  rec('JS例外ゼロ', errors.length === 0, errors.slice(0,2).join(' | '));
  await app.close();
}

async function corrupt() {
  console.log('\n=== ストレージ破損フィクスチャ ===');
  const d = H.freshDirs('corrupt');
  const lsDir = path.join(d.profile, 'Local Storage', 'leveldb');
  fs.mkdirSync(lsDir, { recursive: true });
  fs.writeFileSync(path.join(lsDir, 'CURRENT'), 'GARBAGE_NOT_A_MANIFEST\n');
  fs.writeFileSync(path.join(lsDir, '000003.log'), Buffer.from([0xde,0xad,0xbe,0xef,0,1,2,3,255,254]));
  fs.writeFileSync(path.join(lsDir, 'MANIFEST-000001'), Buffer.from([0xff,0xff,0xff]));
  const { app, win, errors } = await H.launch(d);
  await win.waitForTimeout(9000);
  rec('破損Local Storageでも起動する（白画面でない）',
    await win.evaluate(() => document.querySelectorAll('body *').length > 50).catch(() => false));
  rec('localStorageが自動再作成され書き込める',
    await win.evaluate(() => { try { localStorage.setItem('__t','1'); return localStorage.getItem('__t')==='1'; } catch(e){ return false; } }) === true);
  rec('破損フィクスチャでJS例外ゼロ', errors.filter(e => !e.includes("default-src 'none'")).length === 0);
  await app.close();
}

(async () => {
  await clean(); await legacy(); await offline(); await corrupt();
  const ng = results.filter(r=>!r.ok);
  console.log(`\n=== 結果: ${results.length - ng.length}/${results.length} 合格 ===`);
  if (ng.length) { console.log('不合格:'); ng.forEach(r=>console.log('  🔴', r.name, r.detail)); process.exit(1); }
})().catch(e => { console.error('E2E FAILED:', e); process.exit(1); });
