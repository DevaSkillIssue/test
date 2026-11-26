const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:2000,height:1200},deviceScaleFactor:1});
await p.goto('file://'+__dirname+'/thumbs.html');const el=await p.$('#c');await el.screenshot({path:__dirname+'/contact_sheet.png'});await b.close();})();
