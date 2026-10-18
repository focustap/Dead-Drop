import {test,expect} from '@playwright/test';
import {createApp} from '../../server/index.js';
import {visitor} from '../../shared/campaign.js';

test('walk, inspect a courier, grow at the tent, carry, pack and deliver through the chute',async({page})=>{
  test.setTimeout(120000);
  const game=createApp();await new Promise(r=>game.http.listen(0,'127.0.0.1',r));
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto('/');await page.locator('#serverUrl').fill('http://127.0.0.1:'+game.http.address().port);await page.locator('#createRoom').click();
    await expect(page.locator('#lobby')).toBeHidden();if(await page.locator('#guide').isVisible())await page.locator('#guideOkay').click();
    const room=[...game.rooms.values()][0],id=Object.keys(room.players)[0];room.nextEvent=Infinity;
    let yaw=0,pitch=0;
    const lock=async()=>{if(!await page.evaluate(()=>!!document.pointerLockElement)){await page.locator('#scene canvas').click({position:{x:500,y:400}});await page.waitForFunction(()=>!!document.pointerLockElement);}};
    const aim=async(x,z,lookPitch=0)=>{
      await lock();const p=room.players[id],next=Math.atan2(-(x-p.x),-(z-p.z));
      await page.evaluate(({dx,dy})=>document.dispatchEvent(new MouseEvent('mousemove',{movementX:dx,movementY:dy,bubbles:true})),{dx:(yaw-next)/.0021,dy:(pitch-lookPitch)/.0021});yaw=next;pitch=lookPitch;
      await page.waitForTimeout(100);
    };
    const walk=async(x,z)=>{
      const end=Date.now()+12000;
      while(Math.hypot(room.players[id].x-x,room.players[id].z-z)>.24){
        if(Date.now()>end)throw Error('Walk stuck at '+JSON.stringify(room.players[id])+' aiming at '+x+','+z);
        await aim(x,z);await page.keyboard.down('w');await page.waitForTimeout(Math.min(300,Math.max(70,Math.hypot(room.players[id].x-x,room.players[id].z-z)/2.8*650)));await page.keyboard.up('w');await page.waitForTimeout(90);
      }
    };
    const interact=async(x,z,label)=>{await aim(x,z,-.25);await expect(page.locator('#prompt')).toContainText(label);await page.keyboard.press('e');};
    await lock();await page.keyboard.press('e');await expect(page.locator('#panel')).toBeVisible();
    await page.locator('[data-tab="browser"]').click();await page.locator('[data-buy="seeds"]').click();await expect.poll(()=>room.pending.length).toBe(1);await page.keyboard.press('Escape');
    await walk(3.85,-.75);await walk(3.85,-1.5);
    // Set the visitor's elapsed travel time; all pickup actions still use the normal network path.
    room.door=visitor('courier',Date.now()-8000,'door');room.pending[0].arrives=Date.now()-1;
    await interact(4.08,-1.6,'PEEPHOLE');await expect(page.locator('#surveillance')).toHaveAttribute('data-view','peephole');
    await expect(page.locator('#surveillancePresence')).toContainText('taped parcel');await page.screenshot({path:'test-results/peephole.png'});
    await page.locator('#openDoorView').click();await expect.poll(()=>room.inventory.seeds).toBe(2);await page.keyboard.press('Escape');
    await walk(3.85,.6);await walk(2.45,.7);await walk(2.45,2.4);await interact(3.1,2.4,'GROW TENT');
    await expect(page.locator('#station')).toBeVisible();await page.locator('[data-action="garden:soil"]').click();await expect.poll(()=>room.garden.soil).toBe(true);
    await page.locator('[data-action="garden:plant"]').click();await page.locator('[data-action="garden:water"]').click();await expect.poll(()=>room.garden.moisture).toBeGreaterThan(95);
    room.garden.growth=100;await page.waitForTimeout(300);await page.screenshot({path:'test-results/garden.png'});
    await page.locator('[data-action="garden:harvest"]').click();await expect.poll(()=>room.players[id].carrying).toBe(3);await page.keyboard.press('Escape');
    await walk(.6,2.3);await interact(.6,2.9,'PACK HARVEST');await page.locator('[data-action="pack:deposit"]').click();await page.locator('[data-action="pack:seal"]').click();await expect.poll(()=>room.inventory.packages).toBe(1);await page.keyboard.press('Escape');
    await walk(.6,1.1);await walk(-3.85,1.1);
    room.alley=visitor('buyer',Date.now()-8000,'alley');await interact(-4.03,1.15,'DEAD DROP');await expect.poll(()=>room.ledger.deliveries).toBe(210);
    expect(room.inventory.packages).toBe(0);expect(errors).toEqual([]);
  }finally{await page.close();await game.close();}
});
