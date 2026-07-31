import pkg from '/Users/Schwimmer/.npm-global/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const BASE = 'https://schiwmmer.github.io/household-consumables-prototype/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1' });

const L={};
await page.goto(BASE,{waitUntil:'networkidle'});
await page.waitForTimeout(600);

/* === AC-0: home 首页首卡可见，底 tab 可见 === */
L.home = await page.evaluate(()=>{
  const c=document.querySelector('.tile');
  const r=c?.getBoundingClientRect();
  const bn=document.querySelector('#s0 .bn')?.getBoundingClientRect();
  return {firstCardTop:r?.firstCardTop??r?.top,cardTxt:c?.textContent?.trim()?.slice(0,8),bnVisible:bn&&bn.bottom<=window.innerHeight+1,vpH:window.innerHeight};
});

/* === AC-1: 点商品进详情；subAC: 双拖动条+位置下拉；无 材质重量体积 === */
await page.click('.tile',{timeout:2000}).catch(e=>console.log('no tile',e.message));
await page.waitForTimeout(300);
L.detail = await page.evaluate(()=>({
  hasRange:document.querySelectorAll('.ui-range').length,
  hasLocSelect:!!document.getElementById('locSel'),
  hasMaterial:/材质|重量|体积/.test(document.querySelector('#s1')?.innerHTML??''),
  bodyTitle:document.querySelector('#s1 .dt')?.textContent
}));

/* === AC-2: 拖动条 slide s1 === */
await page.evaluate(()=>{
  const r=document.getElementById('qtyRange');
  const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
  setter.call(r,'15');
  r.dispatchEvent(new Event('input',{bubbles:true}));
});
await page.waitForTimeout(100);
L.qtyDrag = await page.evaluate(()=>document.getElementById('qtyVal')?.textContent);

/* === AC-3: 底导 录入跳 s8；顶部有 👴👨👶 步进器 === */
await page.evaluate(()=>document.querySelector('#s0 .bn .it:nth-child(2)')?.click());
await page.waitForTimeout(500);
L.batchEnter = await page.evaluate(()=>({
  active:document.querySelector('.screen.active')?.id,
  stepBtns:document.querySelectorAll('.step-btn').length,
  bAdt:document.getElementById('bAdt')?.textContent,
  bKid:document.getElementById('bKid')?.textContent,
  cardCount:document.querySelectorAll('#adjList .adj-card').length
}));

/* === AC-4: 改小孩数 → 商品数量动态变化 === */
const babyBefore = await page.evaluate(()=>[...document.querySelectorAll('#adjList .adj-card')].find(c=>c.textContent.includes('纸尿裤'))?.querySelector('input')?.value);
await page.evaluate(()=>stepMem('bKid',1));
await page.waitForTimeout(300);
const babyAfter = await page.evaluate(()=>[...document.querySelectorAll('#adjList .adj-card')].find(c=>c.textContent.includes('纸尿裤'))?.querySelector('input')?.value);
L.dynKidCalc = {babyBefore,babyAfter,bAdt:await page.evaluate(()=>document.getElementById('bAdt')?.textContent),bKid:await page.evaluate(()=>document.getElementById('bKid')?.textContent)};

/* === AC-5: 商品卡片有 +/- 并且可手动微调 === */
await page.evaluate(()=>{
  const firstBtn=[...document.querySelectorAll('#adjList .adj-card .stp button')][0];
  if(firstBtn) firstBtn.click();
});
await page.waitForTimeout(200);
L.adjMan = await page.evaluate(()=>{
  const c=document.querySelector('#adjList .adj-card');
  return {v:c?.querySelector('input')?.value,d:c?.querySelector('.days b')?.textContent};
});

/* === AC-6: 商品是使用天数 days !== 2 === */
L.daysOk = await page.evaluate(()=>{
  const ds=[...document.querySelectorAll('#adjList .adj-card .days b')].slice(0,5).map(e=>e.textContent);
  return {days:ds};
});

await browser.close();
console.log(JSON.stringify(L,null,2));
