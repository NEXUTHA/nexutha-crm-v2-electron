const { _electron: electron } = require('playwright');
(async () => {
  const APP = '/Applications/NEXUTHA CRM.app/Contents/MacOS/NEXUTHA CRM';
  const app = await electron.launch({
    executablePath: APP, args: [`--user-data-dir=${process.argv[2]}`], timeout: 60000 });
  const win = await app.firstWindow({ timeout: 60000 });
  await win.waitForTimeout(10000);

  for (const [label, w, h] of [['デスクトップ幅', 1400, 900], ['狭い幅(モバイル判定)', 700, 900]]) {
    await app.evaluate(({BrowserWindow}, [w,h]) => {
      const win = BrowserWindow.getAllWindows()[0]; win.setSize(w,h); }, [w,h]);
    await win.waitForTimeout(1500);
    const r = await win.evaluate(() => {
      const vis = el => el && getComputedStyle(el).display !== 'none';
      const sidebar = document.querySelector('.sidebar');
      const mnav = document.querySelector('.mobile-nav');
      const hdr = document.getElementById('mobile-header');
      // 実際に押せる導線があるか
      const clickable = [...document.querySelectorAll('.nav-item, .mobile-nav-item')]
        .filter(el => {
          if (getComputedStyle(el).display === 'none') return false;
          const rc = el.getBoundingClientRect();
          if (rc.width === 0) return false;
          const hit = document.elementFromPoint(rc.left+rc.width/2, rc.top+rc.height/2);
          return hit && (hit === el || el.contains(hit));
        });
      const mnavItems = [...document.querySelectorAll('.mobile-nav-item')];
      return {
        w: innerWidth, h: innerHeight,
        sidebarVisible: vis(sidebar),
        mobileNavVisible: vis(mnav),
        mobileHeaderVisible: vis(hdr),
        clickableNavCount: clickable.length,
        mobileNavItemCount: mnavItems.length,
        mobileNavHasHandler: mnavItems.map(el => ({
          text: (el.textContent||'').trim().slice(0,8),
          onclick: !!el.getAttribute('onclick'),
          dataMpage: el.getAttribute('data-mpage')
        }))
      };
    });
    console.log(label, JSON.stringify(r, null, 2));
  }
  await app.close();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
