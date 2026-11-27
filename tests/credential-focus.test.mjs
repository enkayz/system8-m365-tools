import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'/home/hermes/projects/system8-m365-dashboard/node_modules/playwright');
test('credential header keyboard focus has at least 3:1 adjacent contrast',async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE||'/home/hermes/projects/system8-m365-dashboard/test-results/playwright-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process']});
 try{
  const page=await browser.newPage();await page.goto(process.env.CREDENTIAL_TOOL_URL||'http://127.0.0.1:3378/tools/credential-coverage/');await page.keyboard.press('Tab');await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').textContent(),'All tools');
  const style=await page.locator('header a').evaluate(e=>({outline:getComputedStyle(e).outlineColor,bg:getComputedStyle(e.parentElement).backgroundColor,kind:getComputedStyle(e).outlineStyle,width:parseFloat(getComputedStyle(e).outlineWidth)}));
  const L=c=>c.match(/\d+/g).slice(0,3).map(Number).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);const a=L(style.outline),b=L(style.bg);assert.ok(style.width>=2&&style.kind==='solid');assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=3);
 }finally{await browser.close();}
});
