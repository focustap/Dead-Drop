import test from 'node:test';
import assert from 'node:assert/strict';
import {newRoom,addPlayer,gameAction,tick,movePlayer,beginIntrusion,intrusionInput} from '../shared/core.js';
import {finishNight} from '../shared/campaign.js';
import {startEncounter} from '../shared/horror.js';
import {STATIONS} from '../shared/layout.js';
const setup=t=>{let now=Date.now();t.mock.method(Date,'now',()=>now);const r=newRoom();addPlayer(r,'a','A');addPlayer(r,'b','B');gameAction(r,'a','start');r.nextEvent=Infinity;r.nextHack=0;r.horror.recoveryUntil=0;return {r,get now(){return now;},advance(ms){now+=ms;tick(r,now);}};};
test('daily dawn never deducts cash and exact quota payments cannot repeat',t=>{
  const c=setup(t),{r}=c;r.bank=2550;
  for(let i=0;i<3;i++){finishNight(r,c.now);assert.equal(r.bank,i===2?0:2550);assert.equal(finishNight(r,c.now),false);if(i<2)gameAction(r,'a','night:next');}
  assert.equal(r.summary.quotaPaid,2550);assert.equal(r.ledger.expenses,2550);assert.equal(r.settlements[0].paid,true);
  assert.equal(gameAction(r,'a','night:next').ok,true);assert.equal(gameAction(r,'b','night:next').ok,false);assert.equal(r.quota,4550);
});
test('an unaffordable second quota also calls Collector and never wins',t=>{
  const c=setup(t),{r}=c;r.day=6;r.quota=4550;r.bank=4549;finishNight(r,c.now);assert.equal(r.phase,'collector');assert.equal(r.bank,4549);c.advance(3000);assert.equal(r.players.a.scare.kind,'collector');c.advance(4000);assert.equal(r.phase,'lost');
});
test('hacks require an active nearby computer and leaving settles one loss without resetting cooldown',t=>{
  const c=setup(t),{r}=c;assert.equal(beginIntrusion(r,'a'),false);
  assert.equal(gameAction(r,'a','computer:enter').ok,true);assert.equal(beginIntrusion(r,'a'),true);const due=r.nextHack;
  gameAction(r,'a','computer:leave');assert.equal(r.intrusions.a,undefined);assert.equal(r.bank,151);assert.equal(r.nextHack,due);
  gameAction(r,'a','computer:leave');assert.equal(r.bank,151);gameAction(r,'a','computer:enter');assert.equal(beginIntrusion(r,'a'),false);
  assert.equal(intrusionInput(r,'a','ArrowUp').ok,false);assert.equal(r.bank,151);
  for(const where of ['garden','hide','door','curtains','chute','breaker']){Object.assign(r.players.a,STATIONS[where],{computerOpen:false});r.nextHack=0;assert.equal(beginIntrusion(r,'a'),false);}
});
test('movement and hiding close computer activity; manual training cannot run away from a workstation',t=>{
  const c=setup(t),{r}=c;gameAction(r,'a','computer:enter');movePlayer(r,'a',{x:-1,z:-.75,yaw:0},c.now+1000);assert.equal(r.players.a.computerOpen,false);assert.equal(beginIntrusion(r,'a',true),false);
  Object.assign(r.players.a,STATIONS.hide);assert.equal(gameAction(r,'a','computer:enter').ok,false);gameAction(r,'a','hide:enter');assert.equal(beginIntrusion(r,'a'),false);
});
function hold(c,id='a',duration=5000){for(let elapsed=0;elapsed<duration;elapsed+=250){assert.equal(gameAction(c.r,id,'curtain:hold').ok,true);c.advance(250);}}
test('one five-second curtain hold protects everyone and retreats without a payout or penalty',t=>{
  const c=setup(t),{r}=c;startEncounter(r,'window',c.now);Object.assign(r.players.a,STATIONS.curtains);hold(c,'a',4750);assert.notEqual(r.horror.active.phase,'retreating');hold(c,'a',250);
  assert.equal(r.horror.active.phase,'retreating');assert.equal(r.curtains.closed,true);assert.equal(r.bank,185);assert.equal(r.players.b.scare,undefined);
  c.advance(6000);assert.equal(r.horror.active,null);assert.equal(r.players.a.scare,undefined);assert.equal(r.players.b.scare,undefined);
});
test('release resets progress, another player cannot finish a partial hold, and stale inputs expire',t=>{
  const c=setup(t),{r}=c;startEncounter(r,'window',c.now);Object.assign(r.players.a,STATIONS.curtains);Object.assign(r.players.b,STATIONS.curtains);
  hold(c,'a',3000);assert.equal(gameAction(r,'b','curtain:hold').ok,false);gameAction(r,'a','curtain:release');assert.equal(r.curtains,null);
  assert.equal(gameAction(r,'b','curtain:hold').ok,true);assert.equal(r.curtains.started,c.now);c.advance(2100);assert.equal(r.curtains,null);c.advance(4600);assert.equal(r.horror.active.phase,'hunting');assert.ok(r.players.a.scare);
});
test('curtain hold validates physical location and cannot be banked through another station',t=>{
  const c=setup(t),{r}=c;startEncounter(r,'window',c.now);assert.equal(gameAction(r,'a','curtain:hold').ok,false);Object.assign(r.players.a,STATIONS.curtains);gameAction(r,'a','curtain:hold');Object.assign(r.players.a,STATIONS.garden);gameAction(r,'a','garden:light');c.advance(250);assert.equal(r.curtains,null);
});

test('an interrupted hold can be rescued by a fresh full hold before the shortened deadline',t=>{
  const c=setup(t),{r}=c;startEncounter(r,'window',c.now);Object.assign(r.players.a,STATIONS.curtains);Object.assign(r.players.b,STATIONS.curtains);
  hold(c,'a',2000);gameAction(r,'a','curtain:release');hold(c,'b',5000);assert.equal(r.horror.active.phase,'retreating');assert.equal(r.bank,185);
});
