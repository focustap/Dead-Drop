import test from 'node:test';
import assert from 'node:assert/strict';
import {newRoom,addPlayer,gameAction,tick,schedulePowerOutage} from '../shared/core.js';
import {startEncounter} from '../shared/horror.js';
import {STATIONS} from '../shared/layout.js';

function setup(t){
  let now=Date.now();
  t.mock.method(Date,'now',()=>now);
  const r=newRoom();
  addPlayer(r,'a','A');addPlayer(r,'b','B');
  gameAction(r,'a','start');r.nextEvent=Infinity;r.horror.recoveryUntil=0;
  return {r,get now(){return now;},advance(ms){now+=ms;tick(r,now);}};
}
function nearDoor(r,id='a'){Object.assign(r.players[id],STATIONS.door,{zone:'apartment'});}

test('a genuine door intruder must be actively braced even when the resting bolt is closed',t=>{
  const c=setup(t),r=c.r;
  assert.equal(r.horror.locked,true);
  assert.equal(startEncounter(r,'door',c.now),true);
  c.advance(16500);
  assert.equal(r.phase,'breach');
  assert.equal(r.players.a.scare.kind,'door');
  assert.equal(r.players.b.scare.kind,'door');
  assert.equal(r.players.a.scare.until-r.players.a.scare.start,2500);
  assert.equal(gameAction(r,'a','door:brace').ok,false);
  c.advance(2600);
  assert.equal(r.phase,'lost');
  assert.ok(r.summary&&r.summary.day===1);
  assert.match(r.reason,/Locksmith/);
});

test('manual brace resolves the threat without fatal damage and keeps the crew alive',t=>{
  const c=setup(t),r=c.r;
  assert.equal(startEncounter(r,'door',c.now),true);
  nearDoor(r);
  c.advance(9000);
  assert.equal(gameAction(r,'a','door:brace').ok,true);
  assert.equal(r.horror.active,null);
  c.advance(22000);
  assert.equal(r.phase,'night');
  assert.equal(r.players.a.scare,undefined);
  assert.equal(r.players.b.scare,undefined);
});

test('manually securing the bolt during warning is valid defense; unlocking cancels it',t=>{
  const c=setup(t),r=c.r;
  assert.equal(startEncounter(r,'door',c.now),true);
  nearDoor(r);
  assert.equal(gameAction(r,'a','door:unlock').ok,true);
  assert.equal(gameAction(r,'a','door:lock').ok,true);
  assert.equal(r.horror.active.braced,true);
  c.advance(17000);
  assert.equal(r.phase,'night');
  c.advance(5000);
  assert.equal(r.horror.active,null);
});

test('peephole scare blocks hallway entry with exact warning and frees the exit after it clears',t=>{
  const c=setup(t),r=c.r;
  nearDoor(r);
  assert.equal(gameAction(r,'a','door:unlock').ok,true);
  r.horror.peep={id:92,kind:'face',start:c.now,revealAt:c.now,ends:c.now+8000};
  const unsafe=gameAction(r,'a','hall:enter');
  assert.equal(unsafe.ok,false);
  assert.equal(unsafe.text,"I wouldn't go outside right now...");
  assert.equal(r.players.a.zone,'apartment');
  c.advance(8100);
  assert.equal(r.horror.peep,null);
  const safe=gameAction(r,'a','hall:enter');
  assert.equal(safe.ok,true);
  assert.equal(r.players.a.zone,'hall');
});

test('outages have a grace period, rare roll requirement and a long cooldown',t=>{
  const c=setup(t),r=c.r,now=c.now;
  r.environment.nextOutageAt=now+60000;
  assert.equal(schedulePowerOutage(r,now+10000,0),false);
  assert.equal(r.environment.warning,null);
  assert.equal(schedulePowerOutage(r,now+60001,.26),false);
  assert.equal(r.environment.warning,null);
  assert.equal(schedulePowerOutage(r,now+60002,.10),true);
  assert.equal(r.environment.warning.at,now+72002);
  const next=r.environment.nextOutageAt;
  assert.equal(next,now+360002);
  assert.equal(schedulePowerOutage(r,now+70000,.01),false);
  assert.equal(r.environment.nextOutageAt,next);
  c.advance(73000);
  assert.equal(r.environment.power,false);
  r.environment.power=true;
  assert.equal(schedulePowerOutage(r,now+80000,.01),false);
  assert.equal(r.environment.warning,null);
  assert.equal(schedulePowerOutage(r,next,.02),true);
  assert.ok(r.environment.warning);
});
