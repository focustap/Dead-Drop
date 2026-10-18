import {test,expect} from '@playwright/test';
test('solo game boots a real WebGL room, and terminal help and market work',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('button',{name:/SOLO NIGHT/})).toBeVisible();
  await expect(page.locator('#startupError')).toBeHidden();
  await page.locator('#solo').click();
  await expect(page.locator('#lobby')).toBeHidden();
  await expect(page.locator('#scene canvas')).toBeVisible();
  if(await page.locator('#guide').isVisible())await page.locator('#guideOkay').click();
  const viewport=page.viewportSize();
  await page.mouse.click(viewport.width/2,viewport.height/2);
  await expect(page.locator('#prompt')).toContainText('WORKSTATION',{timeout:15000});
  await page.keyboard.press('e');
  await expect(page.locator('#panel')).toBeVisible();
  await expect(page.locator('#terminalInput')).toBeVisible();
  await page.locator('#terminalInput').fill('help');await page.keyboard.press('Enter');
  await expect(page.locator('#terminalLog')).toContainText('cd scrape FOLDER');
  await page.locator('#terminalInput').fill('connect NOVA-17');await page.keyboard.press('Enter');
  await expect(page.locator('#terminalLog')).toContainText('CONNECTION ESTABLISHED');
  await page.locator('#terminalInput').fill('cd finances');await page.keyboard.press('Enter');
  await expect(page.locator('#terminalLog')).toContainText('Current directory: /finances');
  await page.locator('#terminalInput').fill('scrape');await page.keyboard.press('Enter');
  await expect(page.locator('#terminalLog')).toContainText('Check possible records');
  const code=(await page.locator('#terminalLog').textContent()).match(/REC-[A-Z0-9]{4}-[A-Z0-9]{4}/)?.[0];
  expect(code).toBeTruthy();
  await page.locator('[data-tab="market"]').click();
  await page.locator('#verifyInput').fill(code);await page.locator('#verifyForm button').click();
  await expect(page.locator('#verifyResult')).toContainText('VALID');
  await page.locator('#sellInput').fill(code);await page.locator('#sellForm button').click();
  await expect(page.locator('#bank')).not.toHaveText('$185');
  expect(errors).toEqual([]);
});
test('an intrusion appears on command, responds to arrows and preserves the wallet',async({page})=>{
  await page.goto('/');await page.locator('#solo').click();
  if(await page.locator('#guide').isVisible())await page.locator('#guideOkay').click();
  const v=page.viewportSize();await page.mouse.click(v.width/2,v.height/2);
  await expect(page.locator('#prompt')).toContainText('WORKSTATION',{timeout:15000});
  await page.keyboard.press('e');await expect(page.locator('#panel')).toBeVisible();
  const bank=await page.locator('#bank').textContent();
  await page.locator('#terminalInput').fill('training');await page.keyboard.press('Enter');
  await expect(page.locator('#intrusion')).toBeVisible();
  const keys={'←':'ArrowLeft','→':'ArrowRight','↑':'ArrowUp','↓':'ArrowDown'};
  const total=await page.locator('#arrows span').count();
  for(let i=0;i<total;i++){
    // Read the active key from the live UI; software-WebGL CI can lag a frame.
    const current=page.locator('#arrows span.current');
    await expect(current).toHaveCount(1);
    const symbol=await current.textContent();
    await page.keyboard.press(keys[symbol]);
    if(i<total-1){
      await expect(page.locator('#arrows span.done')).toHaveCount(i+1);
    }else{
      // The key sometimes lands before the page regains focus on slow CI.
      if(await page.locator('#intrusion').isVisible()){
        const stillCurrent=await page.locator('#arrows span.current').textContent().catch(()=>null);
        if(stillCurrent===symbol)await page.keyboard.press(keys[symbol]);
      }
    }
  }
  await expect(page.locator('#intrusion')).toBeHidden({timeout:15000});
  await expect(page.locator('#bank')).toHaveText(bank);
});
test('two clients can join the same shared room',async({browser})=>{
  test.setTimeout(95000);
  const a=await browser.newPage(),b=await browser.newPage();
  await a.goto('/');await a.locator('#serverUrl').fill('http://127.0.0.1:3000');await a.locator('#createRoom').click();
  await expect(a.locator('#lobby')).toBeHidden();
  const code=await a.locator('#roomCode').textContent();expect(code).toMatch(/^[A-F0-9]{6}$/);
  await b.goto('/');await b.locator('#serverUrl').fill('http://127.0.0.1:3000');await b.locator('#joinCode').fill(code);
  await b.locator('#joinRoom').click();await expect(b.locator('#lobby')).toBeHidden();
  await expect(b.locator('#roomCode')).toHaveText(code);
  await expect(a.locator('#bank')).toHaveText(await b.locator('#bank').textContent());
  await a.close();await b.close();
});

test('rainy CCTV and peephole render real visitor views and close with Escape',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.locator('#solo').click();
  if(await page.locator('#guide').isVisible())await page.locator('#guideOkay').click();
  const vp=page.viewportSize();await page.mouse.click(vp.width/2,vp.height/2);
  await expect(page.locator('#prompt')).toContainText('WORKSTATION',{timeout:15000});
  await page.keyboard.press('e');await expect(page.locator('#panel')).toBeVisible();
  await page.locator('[data-tab="production"]').click();
  await page.locator('[data-buy="seeds"]').click();
  await page.locator('[data-tab="security"]').click();
  await expect(page.locator('#viewAlley')).toBeVisible();
  await expect(page.locator('.camera')).toHaveCount(0);
  await page.locator('#viewAlley').click();
  await expect(page.locator('#surveillance')).toBeVisible();
  await expect(page.locator('#surveillance')).toHaveAttribute('data-view','alley');
  await expect(page.locator('#surveillanceName')).toContainText('BACK ALLEY');
  await expect(page.locator('#scene canvas')).toBeVisible();
  await page.screenshot({path:'test-results/alley-cctv.png'});
  await page.keyboard.press('Escape');
  await expect(page.locator('#surveillance')).toBeHidden();
  await page.keyboard.press('e');await expect(page.locator('#panel')).toBeVisible();
  await page.locator('[data-tab="security"]').click();
  await page.locator('#viewPeephole').click();
  await expect(page.locator('#surveillance')).toBeVisible();
  await expect(page.locator('#surveillance')).toHaveAttribute('data-view','peephole');
  await expect(page.locator('#surveillance')).toHaveAttribute('data-visitor','courier');
  await expect(page.locator('#surveillanceName')).toContainText('PEEPHOLE');
  await page.screenshot({path:'test-results/hallway-peephole.png'});
  await page.locator('#closeSurveillance').click();
  await expect(page.locator('#surveillance')).toBeHidden();
  expect(errors).toEqual([]);
});

test('missing published app bundle explains why Solo Night cannot start',async({page})=>{
  await page.route('**/app.js',route=>route.abort());
  await page.goto('/');
  await expect(page.locator('#startupError')).toBeVisible({timeout:12000});
  await expect(page.locator('#startupError')).toContainText('GitHub Actions');
});
