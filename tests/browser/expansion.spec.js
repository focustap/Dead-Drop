import {test,expect} from '@playwright/test';
import {createApp} from '../../server/index.js';
import {startEncounter} from '../../shared/horror.js';

test('survival site and remote archive can be investigated, extracted and sold through the OS',async({page})=>{
  test.setTimeout(150000);
  const game=createApp();await new Promise(r=>game.http.listen(0,'127.0.0.1',r));
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto('/');await page.locator('#serverUrl').fill('http://127.0.0.1:'+game.http.address().port);await page.locator('#createRoom').click();
    await expect(page.locator('#lobby')).toBeHidden();await page.locator('#quality').selectOption('low');await page.locator('#guideOkay').click();
    const room=[...game.rooms.values()][0];room.nextEvent=Infinity;
    await expect(page.locator('#prompt')).toContainText('WORKSTATION');await page.keyboard.press('e');await expect(page.locator('#panel')).toBeVisible();
    await page.locator('[data-tab="browser"]').click();await page.locator('#address').fill('threats.onion');await page.locator('#addressForm button').click();
    await expect(page.locator('.threatNotes article')).toHaveCount(8);await expect(page.locator('.website')).toContainText('The Glass Walker');await page.screenshot({path:'test-results/threats-guide.png'});
    await page.locator('[data-site="contracts"]').click();await page.locator('[data-remote-target]').first().click();await expect(page.locator('.circuit')).toBeVisible();
    const ports=await page.locator('[data-port]').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.port,value:parseInt(n.textContent)})).sort((a,b)=>a.value-b.value));
    for(const p of ports)await page.locator('[data-port="'+p.id+'"]').click();
    await expect(page.locator('.fileExplorer')).toBeVisible();
    await page.locator('[data-folder="mail"]').click();await page.locator('[data-file="key-memo.txt"]').click();
    await expect(page.locator('.remoteDocument pre')).toContainText('rotation +');
    const memo=await page.locator('.remoteDocument pre').textContent(),shift=Number(memo.match(/rotation \+(\d+)/)[1]);
    await page.locator('[data-folder="logs"]').click();await page.locator('[data-file="seal.txt"]').click();
    await expect(page.locator('.remoteDocument pre')).toContainText('ENCODED SEAL:');
    const cipher=(await page.locator('.remoteDocument pre').textContent()).split(': ')[1];
    const answer=[...cipher].map(c=>String.fromCharCode(65+(c.charCodeAt(0)-65-shift+26)%26)).join('');
    await page.locator('#remoteAnswer').fill(answer);await page.locator('#remoteSolve button').click();await expect(page.locator('#remoteSolve button')).toHaveText('SEAL OPEN');
    await page.locator('[data-folder="vault"]').click();await page.locator('[data-file="payload.arc"]').click();await expect(page.locator('.remoteDocument pre')).toContainText('Encrypted recovery payload');await page.screenshot({path:'test-results/remote-files.png'});
    await page.locator('[data-remote="extract"]').click();await expect(page.locator('.remoteEmpty')).toBeVisible();
    await page.locator('[data-tab="market"]').click();await page.locator('[data-evidence]').click();await expect(page.locator('[data-evidence]')).toHaveText('SOLD');expect(room.ledger.contracts).toBe(240);expect(errors).toEqual([]);
  }finally{await page.close();await game.close();}
});

test('a window encounter interrupts the computer with a visible personal scare',async({page})=>{
  test.setTimeout(70000);
  const game=createApp();await new Promise(r=>game.http.listen(0,'127.0.0.1',r));
  try{
    await page.goto('/');await page.locator('#serverUrl').fill('http://127.0.0.1:'+game.http.address().port);await page.locator('#createRoom').click();await expect(page.locator('#lobby')).toBeHidden();await page.locator('#quality').selectOption('low');await page.locator('#guideOkay').click();
    const room=[...game.rooms.values()][0];room.nextEvent=Infinity;room.horror.recoveryUntil=0;
    await expect(page.locator('#prompt')).toContainText('WORKSTATION');await page.keyboard.press('e');await expect(page.locator('#panel')).toBeVisible();
    startEncounter(room,'window');await expect(page.locator('#horrorStatus')).toContainText('TAPPING');
    room.horror.active.attackAt=Date.now()-1;room.horror.active.ends=Date.now()+10000;
    await expect(page.locator('#scareShade')).toBeVisible();await expect(page.locator('#panel')).toBeHidden();await page.screenshot({path:'test-results/window-scare.png'});
    expect(room.ledger.losses).toBeGreaterThan(0);
  }finally{await page.close();await game.close();}
});
