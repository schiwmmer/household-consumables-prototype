import pkg from '/Users/Schwimmer/.npm-global/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const BASE = 'https://schiwmmer.github.io/household-consumables-prototype/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1' });

const log = {};

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

/* 1. 首页首卡 */
log.home = await page.evaluate(() => {
  let c = document.querySelector('.tile');
  const r = c?.getBoundingClientRect();
  const bn = document.querySelector('#s0 .bn');
  return {
    firstCardTop: r?.top, firstCardTxt: c?.textContent?.trim()?.slice(0, 20),
    bnBottom: bn?.getBoundingClientRect()?.bottom, vpH: window.innerHeight
  };
});

/* 2. 底 tab 点录入（应跳 s6） */
await page.evaluate(() => {
  const s = document.querySelector('.screen.active');
  s.querySelector('.bn .it:nth-child(2)')?.click();
});
await page.waitForTimeout(400);
log.tabToTpl = await page.evaluate(() => ({
  active: document.querySelector('.screen.active')?.id,
  stepBtns: document.querySelectorAll('.step-btn').length,
  nAdt: document.getElementById('nAdt')?.textContent
}));

/* 3) 点模版卡 selTpl → 验证 active */
await page.evaluate(() => {
  const items = document.querySelectorAll('#tplBox .li');
  items[0]?.click();
});
await page.waitForTimeout(400);
log.selTplActive = await page.evaluate(() => ({
  activeNow: document.querySelector('.screen.active')?.id,
  tplBoxDisp: document.getElementById('tplBox')?.style.display,
  liOn: document.querySelector('#tplBox .li.on')?.textContent?.trim()?.slice(0,4)
}));
// 直接调用 go
await page.evaluate(() => { go(8); });
await page.waitForTimeout(300);
log.go8direct = await page.evaluate(() => ({
  active: document.querySelector('.screen.active')?.id,
  adjCardCount: document.querySelectorAll('#adjList .adj-card').length,
  first3: [...document.querySelectorAll('#adjList .adj-card')].slice(0,3).map(c => ({
    nm: c.querySelector('.nm')?.textContent, v: c.querySelector('input')?.value, d: c.querySelector('.days b')?.textContent
  })),
  last3: [...document.querySelectorAll('#adjList .adj-card')].slice(-3).map(c => ({
    nm: c.querySelector('.nm')?.textContent, v: c.querySelector('input')?.value, d: c.querySelector('.days b')?.textContent
  }))
}));
log.afterStepTitle = await page.evaluate(() => document.querySelector('#s8 .cp-top h2')?.textContent);

/* 4) 通过 stepMem 直接调 —— 不受重渲染影响 */
await page.evaluate(() => { stepMem('bAdt', 1); });
await page.waitForTimeout(300);
await page.evaluate(() => { stepMem('bKid', 1); });
await page.waitForTimeout(300);
log.afterStep = await page.evaluate(() => ({
  title: document.querySelector('#s8 .cp-top h2')?.textContent,
  bAdt: document.getElementById('bAdt')?.textContent,
  bKid: document.getElementById('bKid')?.textContent,
  first5: [...document.querySelectorAll('#adjList .adj-card')].slice(0,5).map(c => ({
    nm: c.querySelector('.nm')?.textContent?.slice(0,6), v: c.querySelector('input')?.value, d: c.querySelector('.days b')?.textContent
  })),
  kid5: [...document.querySelectorAll('#adjList .adj-card')].slice(6,12).map(c => ({
    nm: c.querySelector('.nm')?.textContent?.slice(0,4), v: c.querySelector('input')?.value, d: c.querySelector('.days b')?.textContent
  }))
}));

/* 5) 在第一行按 - 验证 */
await page.evaluate(() => {
  const b = document.querySelector('#adjList .adj-card .stp button');
  if (b) b.click();
});
await page.waitForTimeout(200);
log.afterMinus = await page.evaluate(() => {
  const c = document.querySelector('#adjList .adj-card');
  return { v: c?.querySelector('input')?.value, d: c?.querySelector('.days b')?.textContent };
});

await browser.close();
console.log(JSON.stringify(log, null, 2));
