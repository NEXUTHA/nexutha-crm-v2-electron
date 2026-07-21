const H=require('../e2e/helpers');
const fs=require('fs'),path=require('path');
(async()=>{
  const d=H.freshDirs('corrupt');
  // プロファイルにLocal Storageを作り、意図的に壊す
  const lsDir=path.join(d.profile,'Local Storage','leveldb');
  fs.mkdirSync(lsDir,{recursive:true});
  fs.writeFileSync(path.join(lsDir,'CURRENT'),'GARBAGE_NOT_A_MANIFEST\n');
  fs.writeFileSync(path.join(lsDir,'000003.log'),Buffer.from([0xde,0xad,0xbe,0xef,0,1,2,3,255,254]));
  fs.writeFileSync(path.join(lsDir,'MANIFEST-000001'),Buffer.from([0xff,0xff,0xff]));
  const key=H.issueKey('master',9500);
  const {app,win,errors}=await H.launch(d);
  await win.waitForTimeout(9000);
  const alive=await win.evaluate(()=>document.querySelectorAll('body *').length>50).catch(()=>false);
  const lsWorks=await win.evaluate(()=>{try{localStorage.setItem('__t','1');return localStorage.getItem('__t')==='1';}catch(e){return 'ERR:'+e.message;}});
  console.log('  破損Local Storageで起動:',alive?'✅':'🔴');
  console.log('  localStorage書き込み:',lsWorks===true?'✅ 動作（Chromiumが自動再作成）':'🔴 '+lsWorks);
  console.log('  JS例外:',errors.filter(e=>!e.includes("default-src 'none'")).length);
  await app.close();
})().catch(e=>{console.error('FAIL:',e.message);process.exit(1)});
