import {test,expect} from '@playwright/test';
import {createApp} from '../../server/index.js';
import {finishNight} from '../../shared/campaign.js';
import {STATIONS} from '../../shared/layout.js';
async function host(page,game){
 await page.goto('/');await page.locator('#serverUrl').fill('http://127.0.0.1:'+game.http.address().port);await page.locator('#createRoom').click();await expect(page.locator('#lobby')).toBeHidden();await page.locator('#quality').selectOption('low');await page.locator('#guideOkay').click();
 const room=[...game.rooms.values()][0];room.nextEvent=Infinity;room.nightEnds=Date.now()+600000;room.stalkerUsed=true;return room;
}
async function computer(page){await expect(page.locator('#prompt')).toContainText('WORKSTATION');await page.keyboard.press('e');await expect(page.locator('#panel')).toBeVisible();await page.locator('[data-tab="browser"]').click();}

test('exchange charts trade shared shares and online receivers negotiate a scheduled stock reservation',async({page})=>{
 test.setTimeout(90000);const game=createApp();await new Promise(r=>game.http.listen(0,'127.0.0.1',r));const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  const r=await host(page,game);r.bank=1200;r.inventory.packages=2;await computer(page);await page.locator('#address').fill('exchange.onion');await page.locator('#addressForm button').click();await expect(page.locator('.stock')).toHaveCount(6);
  const chart=page.locator('[data-chart="GW"]');await chart.focus();await page.keyboard.press('ArrowLeft');await expect(page.locator('[data-quote="GW"]')).toContainText('$');await page.locator('#shares-GW').fill('2');await page.locator('[data-trade="GW"] button[value="buy"]').click();await expect.poll(()=>r.exchange.holdings.GW?.quantity).toBe(2);await page.screenshot({path:'test-results/exchange.png'});
  await page.locator('[data-site="sales"]').click();await page.locator('#listedQuantity').fill('2');await page.locator('#listStock button').click();const buyer=r.sales.buyers.find(b=>b.quantity===1);const newPrice=buyer.offer+15;
  await page.locator(`#offer-${buyer.id}`).fill(String(newPrice));await page.locator(`#message-${buyer.id}`).fill('Make it this and I can have it ready tonight.');await page.locator(`[data-counter="${buyer.id}"] button`).click();await expect(page.locator(`[data-accept="${buyer.id}"]`)).toContainText('$'+newPrice);await page.locator(`[data-accept="${buyer.id}"]`).click();await expect.poll(()=>r.sales.deals.length).toBe(1);await expect(page.locator('.ahPickup')).toContainText('SCHEDULED');await page.screenshot({path:'test-results/negotiation.png'});
  expect(r.sales.deals[0].price).toBe(newPrice);expect(r.inventory.packages).toBe(2);expect(errors).toEqual([]);
 }finally{await page.close();await game.close();}
});

test('remote OS opens desktop apps, drags windows, uses context actions and shows a live owner cursor',async({page})=>{
 test.setTimeout(120000);const game=createApp();await new Promise(r=>game.http.listen(0,'127.0.0.1',r));const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  const r=await host(page,game);for(const t of Object.values(r.remoteTargets))t.activeOwner=false;await computer(page);await page.locator('[data-site="contracts"]').click();await page.locator('[data-remote-target]').first().click();
  await expect(page.locator('.circuit')).toBeVisible();const ports=await page.locator('[data-port]').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.port,n:parseInt(n.textContent)})).sort((a,b)=>a.n-b.n));for(const p of ports)await page.locator(`[data-port="${p.id}"]`).click();
  await expect(page.locator('.desktopSurface')).toBeVisible();await page.locator('[data-desktop-app="notes"]').dblclick();await expect(page.locator('.stickyNote')).toBeVisible();await page.locator('[data-close-window="notes"]').click();await page.locator('[data-desktop-app="downloads"]').dblclick();await expect(page.locator('[data-file="invoice.tmp"]')).toBeVisible();await page.locator('[data-file="invoice.tmp"]').dblclick();await expect(page.locator('.remoteDocument')).toContainText('Incomplete download');
  const win=page.locator('[data-window="reader"]'),handle=win.locator('.windowHandle'),before=await win.boundingBox();await handle.focus();await page.keyboard.press('ArrowDown');await expect.poll(async()=>(await win.boundingBox())?.y??before.y).toBeGreaterThan(before.y);
  const grip=await handle.boundingBox();await page.mouse.move(grip.x+45,grip.y+12);await page.mouse.down();await expect(page.locator('.desktopSurface')).toHaveAttribute('data-dragging','true');const bankDuringDrag=r.bank;r.bank++;await expect(page.locator('#bank')).toHaveText('$'+(bankDuringDrag+1).toLocaleString());await page.mouse.move(grip.x+75,grip.y+42,{steps:5});await page.mouse.up();await expect.poll(async()=>(await win.boundingBox())?.x??before.x).toBeGreaterThan(before.x);
  await page.locator('.remoteDocument').click({button:'right'});await expect(page.locator('.desktopContext')).toBeVisible();const oldBank=r.bank;r.bank++;await expect(page.locator('#bank')).toHaveText('$'+(oldBank+1).toLocaleString());await expect(page.locator('.desktopContext')).toBeVisible();await page.locator('[data-context="collect"]').click();await expect(page.locator('.recoveryBundle')).toContainText('1 COPIES');
  const s=Object.values(r.remoteSessions)[0],target=r.remoteTargets[s.target];target.activeOwner=true;target.desktopAt=s.desktopAt=Date.now()-5000;
  // Hold the visual fixture in its active phase on slow software-rendered runners.
  // Mechanics tests separately verify the real owner cycle and immutable epoch.
  const ownerPulse=setInterval(()=>{target.desktopAt=Date.now()-5000;},200);
  try{await expect(page.locator('.ownerStatus')).toContainText('OWNER ACTIVE');await expect(page.locator('.ownerCursor')).toBeVisible();await expect(page.locator('.ownerWindow')).toBeVisible();await page.screenshot({path:'test-results/remote-desktop.png'});}finally{clearInterval(ownerPulse);}expect(errors).toEqual([]);
 }finally{await page.close();await game.close();}
});

test('successful Collector offer leads to credits or a harder new campaign and accessibility persists',async({page})=>{
 test.setTimeout(80000);const game=createApp();await new Promise(r=>game.http.listen(0,'127.0.0.1',r));const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  const r=await host(page,game);await page.locator('#openGuide').click();await page.locator('#reducedEffects').check();await page.locator('#guideOkay').click();await expect(page.locator('body')).toHaveClass(/reducedEffects/);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('dead-drop-settings')).reducedEffects)).toBe(true);
  r.day=6;r.quota=4550;r.bank=5000;finishNight(r,Date.now());await expect(page.locator('#ending')).toBeVisible();await expect(page.locator('#endingMessage')).toContainText('debt is cleared');r.ending.start=Date.now()-13000;r.ending.offerAt=Date.now()-1;await expect(page.locator('#endingChoices')).toBeVisible();await page.screenshot({path:'test-results/ending-offer.png'});
  await page.locator('[data-ending="continue"]').click();await expect(page.locator('#ending')).toBeHidden();await expect(page.locator('#day')).toHaveText('1/6');expect(r.quota).toBe(3443);
  r.day=6;r.quota=Math.round(4550*1.35);r.bank=r.quota;finishNight(r,Date.now());r.ending.start=Date.now()-13000;r.ending.offerAt=Date.now()-1;await expect(page.locator('#endingChoices')).toBeVisible();await page.locator('[data-ending="leave"]').click();await expect(page.locator('#summaryTitle')).toHaveText('THE CREW GOT OUT');await expect(page.locator('#summaryLedger')).toContainText('focustap');await expect(page.locator('#scareShade')).toBeHidden();expect(errors).toEqual([]);
 }finally{await page.close();await game.close();}
});

test('the actual peephole renders rare corridor faces and the occupied wardrobe has a distinct scare',async({page})=>{
 test.setTimeout(80000);const game=createApp();await new Promise(r=>game.http.listen(0,'127.0.0.1',r));const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  const r=await host(page,game),p=Object.values(r.players)[0];
  const frameBarrier=async()=>{await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.waitForTimeout(100);};
  const aimAt=async(x,z)=>{
    if(!await page.evaluate(()=>!!document.pointerLockElement)){await page.locator('#scene canvas').click({position:{x:600,y:300}});await page.waitForFunction(()=>!!document.pointerLockElement);await frameBarrier();}
    const desired=Math.atan2(-(x-p.x),-(z-p.z));
    for(let attempt=0;attempt<4;attempt++){
      await page.evaluate(dx=>{document.dispatchEvent(new MouseEvent('mousemove',{movementX:dx,movementY:-10000,bubbles:true}));document.dispatchEvent(new MouseEvent('mousemove',{movementX:0,movementY:1.33/.0021,bubbles:true}));},(p.yaw-desired)/.0021);
      await frameBarrier();if(Math.abs(p.yaw-desired)<.015)break;
    }
    await expect.poll(()=>Math.abs(p.yaw-desired)).toBeLessThan(.015);
  };
  Object.assign(p,{x:3.85,z:-1.45});await page.waitForTimeout(600);await aimAt(4.08,-1.45);await expect(page.locator('#prompt')).toContainText('PEEPHOLE');await page.keyboard.press('e');await expect(page.locator('#surveillance')).toHaveAttribute('data-view','peephole');
  r.horror.peep={id:99,kind:'face',start:Date.now(),revealAt:Date.now(),ends:Date.now()+15000};await page.waitForTimeout(500);await page.screenshot({path:'test-results/peephole-face.png'});expect(p.scare).toBeUndefined();await page.keyboard.press('Escape');
  Object.assign(p,{x:-1.8,z:2.3});r.horror.wardrobe={id:100,phase:'occupied',start:Date.now()-10000,entered:Date.now()-2000,until:Date.now()+60000};await page.waitForTimeout(600);await aimAt(-1.8,3.15);await expect(page.locator('#prompt')).toContainText('WARDROBE');await page.keyboard.press('e');await expect(page.locator('#scareShade')).toBeVisible();await page.screenshot({path:'test-results/wardrobe-scare.png'});expect(p.scare.kind).toBe('wardrobe');expect(errors).toEqual([]);
 }finally{await page.close();await game.close();}
});
