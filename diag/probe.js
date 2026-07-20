const { _electron: electron } = require('playwright');
(async () => {
  const APP = '/Applications/NEXUTHA CRM.app/Contents/MacOS/NEXUTHA CRM';
  const PROFILE = process.argv[2];
  const app = await electron.launch({
    executablePath: APP,
    args: [`--user-data-dir=${PROFILE}`],
    timeout: 60000,
  });
  const errors = [];
  app.on('console', m => { if (m.type()==='error') errors.push('MAIN:'+m.text()); });

  const win = await app.firstWindow({ timeout: 60000 });
  win.on('pageerror', e => errors.push('PAGEERROR: ' + e.message + '\n' + (e.stack||'').split('\n').slice(0,4).join('\n')));
  win.on('console', m => { if (m.type()==='error') errors.push('CONSOLE: '+m.text()); });

  // UIが落ち着くまで待つ
  await win.waitForTimeout(12000);

  const info = await win.evaluate(() => {
    const cx = innerWidth/2, cy = innerHeight/2;
    const top = document.elementFromPoint(cx, cy);
    const describe = (el) => el ? {
      tag: el.tagName, id: el.id, cls: (el.className||'').toString().slice(0,80),
      z: getComputedStyle(el).zIndex, pe: getComputedStyle(el).pointerEvents,
      op: getComputedStyle(el).opacity, disp: getComputedStyle(el).display,
      pos: getComputedStyle(el).position
    } : null;
    // 全画面を覆っている要素を列挙
    const covering = [...document.querySelectorAll('body *')].filter(el => {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') return false;
      if (s.position !== 'fixed' && s.position !== 'absolute') return false;
      const r = el.getBoundingClientRect();
      return r.width >= innerWidth*0.9 && r.height >= innerHeight*0.9;
    }).map(describe);
    // サイドバーの「顧客管理」ボタンの最前面判定
    const nav = document.querySelector('.nav-item[data-page="customers"]') || document.querySelector('.nav-item');
    let navHit = null;
    if (nav) {
      const r = nav.getBoundingClientRect();
      navHit = describe(document.elementFromPoint(r.left + r.width/2, r.top + r.height/2));
    }
    return {
      url: location.href,
      title: document.title,
      centerTop: describe(top),
      covering,
      navTarget: nav ? {rect: nav.getBoundingClientRect().toJSON(), hit: navHit} : null,
      splash: describe(document.getElementById('splash')),
      licenseOverlay: describe(document.getElementById('license-overlay')),
      setupOverlay: describe(document.getElementById('setup-overlay')),
      customersLoaded: (window.APP && window.APP.customers) ? window.APP.customers.length : 'n/a',
      hasShowPage: typeof window.showPage,
      placeholder: (document.getElementById('license-input')||{}).placeholder
    };
  });

  console.log(JSON.stringify({ info, errors }, null, 2));
  await app.close();
})().catch(e => { console.error('PROBE FAILED:', e.message); process.exit(1); });
