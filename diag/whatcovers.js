const H=require('../e2e/helpers');
(async()=>{
  const d=H.freshDirs('cover');
  const {app,win}=await H.launch(d);
  await win.waitForTimeout(9000);
  const r=await win.evaluate(()=>{
    const ov=[...document.querySelectorAll('body *')].filter(el=>{const s=getComputedStyle(el);if(s.display==='none')return false;const rc=el.getBoundingClientRect();return rc.width>=innerWidth*0.9&&rc.height>=innerHeight*0.9&&(s.position==='fixed'||s.position==='absolute');}).map(el=>({id:el.id,z:getComputedStyle(el).zIndex,pe:getComputedStyle(el).pointerEvents,disp:getComputedStyle(el).display}));
    return {covering:ov, license:getComputedStyle(document.getElementById('license-overlay')).display, setup:getComputedStyle(document.getElementById('setup-overlay')).display, companyName:(window.APP&&window.APP.company&&window.APP.company.name)||'(空)'};
  });
  console.log(JSON.stringify(r,null,2));
  await app.close();
})().catch(e=>{console.error(e.message);process.exit(1)});
