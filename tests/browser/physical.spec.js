import {test,expect} from '@playwright/test';
import {createApp} from '../../server/index.js';
import {visitor} from '../../shared/campaign.js';
import {startEncounter} from '../../shared/horror.js';

test('walk, inspect a courier, grow at the tent, carry, pack and deliver through the chute',async({page})=>{
  test.setTimeout(300000);
  const game=createApp();await new Promise(r=>game.http.listen(0,'127.0.0.1',r));
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto('/');await page.locator('#serverUrl').fill('http://127.0.0.1:'+game.http.address().port);await page.locator('#createRoom').click();
    await expect(page.locator('#lobby')).toBeHidden();await page.locator('#quality').selectOption('low');if(await page.locator('#guide').isVisible())await page.locator('#guideOkay').click();
    const room=[...game.rooms.values()][0],id=Object.keys(room.players)[0];room.nextEvent=Infinity;
    const frameBarrier=async()=>{
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await page.waitForTimeout(100);
    };
    let lastPitch=null;
    const lock=async()=>{if(!await page.evaluate(()=>!!document.pointerLockElement)){await page.locator('#scene canvas').click({position:{x:500,y:400}});await page.waitForFunction(()=>!!document.pointerLockElement);await frameBarrier();lastPitch=null;}};
    const aim=async(x,z,lookPitch=0)=>{
      await lock();
      const p=room.players[id],next=Math.atan2(-(x-p.x),-(z-p.z));
      if(Math.abs(p.yaw-next)<.015&&lastPitch===lookPitch)return;
      // Read the real yaw: Linux and Windows differ in native pointer recenter events.
      for(let attempt=0;attempt<3;attempt++){
        await page.evaluate(({dx,pitch})=>{
          document.dispatchEvent(new MouseEvent('mousemove',{movementX:dx,movementY:-10000,bubbles:true}));
          document.dispatchEvent(new MouseEvent('mousemove',{movementX:0,movementY:(1.33-pitch)/.0021,bubbles:true}));
        },{dx:(room.players[id].yaw-next)/.0021,pitch:lookPitch});
        await frameBarrier();
        if(Math.abs(room.players[id].yaw-next)<.015)break;
      }
      await expect.poll(()=>Math.abs(room.players[id].yaw-next),{timeout:4000}).toBeLessThan(.015);
      lastPitch=lookPitch;
    };
    const walk=async(x,z)=>{
      const end=Date.now()+45000;
      while(Math.hypot(room.players[id].x-x,room.players[id].z-z)>.32){
        if(Date.now()>end)throw Error('Walk stuck at '+JSON.stringify(room.players[id])+' aiming at '+x+','+z);
        await aim(x,z);
        const frames=Math.hypot(room.players[id].x-x,room.players[id].z-z)>1.8?3:1;
        // Release in the renderer, not after a round trip to the test process. This
        // bounds each step even when software WebGL stalls CDP on a shared runner.
        await page.evaluate(async frames=>{
          document.dispatchEvent(new KeyboardEvent('keydown',{key:'w',code:'KeyW',bubbles:true}));
          for(let i=0;i<frames;i++)await new Promise(resolve=>requestAnimationFrame(resolve));
          document.dispatchEvent(new KeyboardEvent('keyup',{key:'w',code:'KeyW',bubbles:true}));
        },frames);
        await page.waitForTimeout(160);
      }
    };
    const interact=async(x,z,label)=>{await aim(x,z,-.25);await expect(page.locator('#prompt')).toContainText(label);await page.keyboard.press('e');};
    await interact(-.95,-1.9,'WORKSTATION');await expect(page.locator('#panel')).toBeVisible();
    await page.locator('[data-tab="browser"]').click();await page.locator('[data-buy="seeds"]').click();await expect.poll(()=>room.pending.length).toBe(1);await page.keyboard.press('Escape');
    await walk(3.85,-.75);await walk(3.85,-1.5);
    // Set the visitor's elapsed travel time; all pickup actions still use the normal network path.
    room.door=visitor('courier',Date.now()-8000,'door');room.pending[0].arrives=Date.now()-1;
    await interact(4.08,-1.6,'PEEPHOLE');await expect(page.locator('#surveillance')).toHaveAttribute('data-view','peephole');
    await expect(page.locator('#surveillancePresence')).toContainText('taped parcel');await page.screenshot({path:'test-results/peephole.png'});
    await page.locator('#openDoorView').click();await expect.poll(()=>room.inventory.seeds).toBe(2);
    await page.locator('#toggleBolt').click();await page.locator('#enterHall').click();await expect.poll(()=>room.players[id].zone).toBe('hall');
    await walk(8,1);await interact(8.3,1,'FUSE BOX');room.environment.power=false;await page.waitForTimeout(300);await page.locator('[data-action="breaker:reset"]').click();await expect.poll(()=>room.environment.power).toBe(true);await page.screenshot({path:'test-results/hallway-breaker.png'});await page.keyboard.press('Escape');
    await walk(6,-1.45);await interact(5.7,-1.45,'APARTMENT 204');await expect.poll(()=>room.players[id].zone).toBe('apartment');
    await walk(3.85,.6);await walk(2.45,.7);await walk(2.45,2.4);await interact(3.1,2.4,'GROW TENT');
    await expect(page.locator('#station')).toBeVisible();await page.locator('[data-action="garden:soil"]').click();await expect.poll(()=>room.garden.soil).toBe(true);
    await page.locator('[data-action="garden:plant"]').click();await page.locator('[data-action="garden:water"]').click();await expect.poll(()=>room.garden.moisture).toBeGreaterThan(95);
    room.garden.growth=100;await page.waitForTimeout(300);await page.screenshot({path:'test-results/garden.png'});
    await page.locator('[data-action="garden:harvest"]').click();await expect.poll(()=>room.players[id].carrying).toBe(3);await page.keyboard.press('Escape');
    await walk(.6,2.3);await interact(.6,2.9,'PACK HARVEST');await page.locator('[data-action="pack:deposit"]').click();await page.locator('[data-action="pack:seal"]').click();await expect.poll(()=>room.inventory.packages).toBe(1);await page.keyboard.press('Escape');
    await walk(-1.8,2.3);await interact(-1.8,3.15,'WARDROBE');await expect(page.locator('#hiding')).toBeVisible();
    room.horror.recoveryUntil=0;startEncounter(room,'window');room.horror.active.attackAt=Date.now()-1;room.horror.active.ends=Date.now()+2000;
    await expect(page.locator('#hideStatus')).toContainText('FOOTSTEPS');await page.screenshot({path:'test-results/wardrobe.png'});await expect.poll(()=>room.horror.active).toBe(null);expect(room.players[id].scare).toBeUndefined();await page.locator('#leaveHide').click();
    await walk(-1.8,1.1);await walk(-3.85,1.1);
    room.alley=visitor('buyer',Date.now()-8000,'alley');await interact(-4.03,1.15,'DEAD DROP');await expect.poll(()=>room.ledger.deliveries).toBe(210);
    expect(room.inventory.packages).toBe(0);expect(errors).toEqual([]);
  }finally{await page.close();await game.close();}
});
