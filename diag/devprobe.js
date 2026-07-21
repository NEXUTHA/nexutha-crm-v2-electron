const { chromium } = require('playwright');
(async()=>{
  const b=await chromium.launch();const pg=await b.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://127.0.0.1:8791/',{waitUntil:'load',timeout:30000});
  await pg.waitForTimeout(6000);
  const r=await pg.evaluate(()=>{
    const nav=[...document.querySelectorAll('.nav-item')];
    const clickable=nav.filter(el=>{const rc=el.getBoundingClientRect();if(!rc.width)return false;const t=document.elementFromPoint(rc.left+rc.width/2,rc.top+rc.height/2);return t&&(t===el||el.contains(t));});
    const cover=[...document.querySelectorAll('body *')].filter(el=>{const s=getComputedStyle(el);if(s.display==='none'||s.pointerEvents==='none')return false;if(s.position!=='fixed'&&s.position!=='absolute')return false;const r=el.getBoundingClientRect();return r.width>=innerWidth*0.9&&r.height>=innerHeight*0.9;}).map(el=>el.id||el.className);
    return {nav:nav.length,clickable:clickable.length,cover,title:document.title,customers:(window.APP&&window.APP.customers||[]).length};
  });
  console.log('  開発版UI:',JSON.stringify(r));
  console.log('  JS例外:',errs.length, errs.slice(0,2).join(' | '));
  await b.close();
})().catch(e=>{console.error('DEV FAIL:',e.message);process.exit(1)});
