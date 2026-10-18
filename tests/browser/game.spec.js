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
test('an intrusion appears on command and accepts the displayed arrow key',async({page})=>{
  await page.goto('/');await page.locator('#solo').click();
  if(await page.locator('#guide').isVisible())await page.locator('#guideOkay').click();
  const v=page.viewportSize();await page.mouse.click(v.width/2,v.height/2);
  await expect(page.locator('#prompt')).toContainText('WORKSTATION',{timeout:15000});
  await page.keyboard.press('e');await expect(page.locator('#panel')).toBeVisible();
  const bank=await page.locator('#bank').textContent();
  await page.locator('#terminalInput').fill('training');await page.keyboard.press('Enter');
  await expect(page.locator('#intrusion')).toBeVisible();
  const symbol=await page.locator('#arrows span.current').textContent();
  const keys={'←':'ArrowLeft','→':'ArrowRight','↑':'ArrowUp','↓':'ArrowDown'};
  await page.keyboard.press(keys[symbol]);
  await expect(page.locator('#arrows span.done')).toHaveCount(1);
  await expect(page.locator('#bank')).toHaveText(bank);
  // Full defense sequence and wallet loss are covered in tests/core.test.js.
});
test('two clients can join the same shared room',async({browser})=>{
  test.setTimeout(95000);
  const a=await browser.newPage(),b=await browser.newPage();
  await a.goto('/');await a.locator('#serverUrl').fill('http://127.0.0.1:3000');await a.locator('#createRoom').click();
  await expect(a.locator('#lobby')).toBeHidden();
  // Exercise the low setting while two software-rendered WebGL clients share a CI runner.
  await a.locator('#quality').selectOption('low');
  const code=await a.locator('#roomCode').textContent();expect(code).toMatch(/^[A-F0-9]{6}$/);
  await b.goto('/');await b.locator('#serverUrl').fill('http://127.0.0.1:3000');await b.locator('#joinCode').fill(code);
  await b.locator('#joinRoom').click();await expect(b.locator('#lobby')).toBeHidden();
  await expect(b.locator('#roomCode')).toHaveText(code);
  await expect(a.locator('#bank')).toHaveText(await b.locator('#bank').textContent());
  await a.close();await b.close();
});

test('browser navigates distinct sites and live CCTV returns to the apartment',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.locator('#solo').click();if(await page.locator('#guide').isVisible())await page.locator('#guideOkay').click();
  const vp=page.viewportSize();await page.mouse.click(vp.width/2,vp.height/2);await page.keyboard.press('e');
  await page.locator('[data-tab="browser"]').click();await expect(page.locator('#address')).toHaveValue('nightjar.onion');
  await expect(page.locator('[data-action^="garden:"]')).toHaveCount(0);
  await page.locator('[data-buy="seeds"]').click();await expect(page.locator('#bank')).toHaveText('$130');
  for(const site of ['contracts','store','messages','rumors','records']){await page.locator('[data-site="'+site+'"]').click();await expect(page.locator('.site-'+site)).toBeVisible();}
  await page.locator('#address').fill('relay.onion');await page.locator('#addressForm button').click();await expect(page.locator('.site-store')).toBeVisible();
  await page.locator('[data-nav="back"]').click();await expect(page.locator('.site-records')).toBeVisible();
  await page.locator('[data-tab="security"]').click();await expect(page.locator('#viewPeephole')).toHaveCount(0);
  await page.locator('#viewAlley').click();await expect(page.locator('#surveillance')).toHaveAttribute('data-view','alley');
  await page.screenshot({path:'test-results/alley.png'});await page.keyboard.press('Escape');await expect(page.locator('#surveillance')).toBeHidden();expect(errors).toEqual([]);
});

test('contracts expose real objectives without instant payouts and quotas reach a real campaign loss',async({page})=>{
  test.setTimeout(95000);
  await page.clock.install();await page.goto('/');await page.locator('#solo').click();if(await page.locator('#guide').isVisible())await page.locator('#guideOkay').click();
  await expect(page.locator('#clock')).toBeVisible();await expect(page.locator('#quota')).toContainText('$2,550');
  const vp=page.viewportSize();await page.mouse.click(vp.width/2,vp.height/2);await expect(page.locator('#prompt')).toContainText('WORKSTATION');await page.keyboard.press('e');await expect.poll(()=>page.evaluate(()=>document.pointerLockElement===null)).toBe(true);await page.locator('[data-tab="browser"]').click();await page.locator('[data-site="contracts"]').click();
  await page.clock.pauseAt(await page.evaluate(()=>Date.now()+500));
  const job=page.locator('.contract').filter({hasText:'Two parcels, one receiver'});await expect(job).toContainText('negotiate');await job.getByRole('button',{name:'ACCEPT',exact:true}).click();await expect(job).toContainText('ACCEPTED BY CREW');await expect(page.locator('#bank')).toHaveText('$185');
  await page.clock.fastForward(240000);await expect(page.locator('#nightSummary')).toBeVisible();await expect(page.locator('#summaryTitle')).toContainText('NIGHT 1');
  await page.locator('#nextNight').click();await expect(page.locator('#day')).toHaveText('2/6');await expect(page.locator('#quota')).toContainText('$2,550');
  await page.clock.fastForward(240000);await page.locator('#nextNight').click();await page.clock.fastForward(240000);
  await expect(page.locator('#nightSummary')).toBeHidden();await expect(page.locator('#horrorStatus')).toContainText('COLLECTOR');await page.clock.fastForward(3000);await expect(page.locator('#scareShade')).toBeVisible();await page.clock.runFor(120);await page.screenshot({path:'test-results/collector.png'});await page.clock.fastForward(4000);
  await expect(page.locator('#summaryTitle')).toHaveText('THE LINE WENT DEAD');await expect(page.locator('#nextNight')).toBeHidden();
  await page.screenshot({path:'test-results/summary.png'});
});

test('missing published app bundle explains why Solo Night cannot start',async({page})=>{
  await page.route('**/app.js',route=>route.abort());
  await page.goto('/');
  await expect(page.locator('#startupError')).toBeVisible({timeout:12000});
  await expect(page.locator('#startupError')).toContainText('GitHub Actions');
});
