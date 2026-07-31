import pkg from '/Users/Schwimmer/.npm-global/lib/node_modules/playwright/index.js';
const { chromium } = pkg;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1' });
await page.goto('https://schiwmmer.github.io/household-consumables-prototype/', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
console.log('HOME active:', await page.evaluate(()=>document.querySelector('.screen.active')?.id));
await page.screenshot({ path: '/Users/Schwimmer/WorkBuddy/囤货/ui/shot_home.png' });
// Go to tpl
await page.evaluate(() => {
  const s = document.querySelector('.screen.active');
  s.querySelector('.bn .it:nth-child(2)')?.click();
});
await page.waitForTimeout(400);
console.log('TPL active:', await page.evaluate(() => document.querySelector('.screen.active')?.id));
console.log('tplGoBtn visible:', await page.evaluate(() => {
  const b = document.getElementById('tplGoBtn');
  return b ? getComputedStyle(b).display : 'noEl';
}));
console.log('tplBox display:', await page.evaluate(() => {
  const b = document.getElementById('tplBox');
  return b ? b.style.display : 'noEl';
}));
await page.screenshot({ path: '/Users/Schwimmer/WorkBuddy/囤货/ui/shot_tpl.png' });
await browser.close();
