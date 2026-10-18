import test from 'node:test';
import assert from 'node:assert/strict';
import {newRoom,addPlayer,gameAction,terminalCommand,tick,publicState} from '../shared/core.js';
const setup=t=>{
  let now=Date.now();t.mock.method(Date,'now',()=>now);
  const room=newRoom();addPlayer(room,'a','A');addPlayer(room,'b','B');gameAction(room,'a','start');
  room.nextEvent=Infinity;room.nextTarget=Infinity;room.horror.recoveryUntil=Infinity;
  for(const id of ['a','b']){assert.equal(gameAction(room,id,'computer:enter').ok,true);terminalCommand(room,id,'connect NOVA-17');}
  return {room,get now(){return now;},advance(ms){now+=ms;tick(room,now);}};
};
test('a scrape cannot reveal records before ten seconds and rejects parallel folder scans',t=>{
  const c=setup(t),{room}=c;
  const res=terminalCommand(room,'a','scrape finances');
  const stamp=room.terminals.a.scan.finishesAt;
  assert.ok(res.scanId);assert.equal(room.scans,0);
  assert.equal(Object.values(room.records).some(r=>r.discovered),false);
  assert.match(terminalCommand(room,'a','scrape documents').text,/SCAN IN PROGRESS/);
  c.advance(9999);assert.equal(room.scans,0);assert.equal(room.terminals.a.lastScan,undefined);
  assert.equal(Object.values(room.records).some(r=>r.discovered),false);
  c.advance(1);assert.equal(room.scans,1);assert.equal(room.terminals.a.scan,null);
  assert.equal(room.terminals.a.lastScan.completedAt,stamp);
  assert.match(room.terminals.a.lastScan.text,/Check possible records/);
  const again=terminalCommand(room,'a','scrape documents');
  assert.ok(again.scanId);assert.notEqual(again.scanId,res.scanId);assert.equal(room.scans,1);
});
test('operators can perform their own concurrent scan without exposing each others private results',t=>{
  const c=setup(t),{room}=c;
  const first=terminalCommand(room,'a','scrape finances'),second=terminalCommand(room,'b','scrape documents');
  assert.ok(first.scanId);assert.ok(second.scanId);
  assert.notEqual(first.scanId,second.scanId);
  assert.notEqual(publicState(room,'a').terminal.scan.id,publicState(room,'b').terminal.scan.id);
  c.advance(10000);assert.equal(room.scans,2);
  assert.notEqual(room.terminals.a.lastScan.id,room.terminals.b.lastScan.id);
});
test('closing the computer cancels the scan and returns no early payout or recovered records',t=>{
  const c=setup(t),{room}=c;
  terminalCommand(room,'a','scrape finances');
  gameAction(room,'a','computer:leave');
  assert.equal(room.terminals.a.scan,null);
  assert.match(room.terminals.a.lastScan.text,/INTERRUPTED/);
  c.advance(10001);
  assert.equal(room.scans,0);
  assert.equal(Object.values(room.records).some(x=>x.discovered),false);
  assert.equal(gameAction(room,'a','computer:enter').ok,true);
  assert.ok(terminalCommand(room,'a','scrape finances').scanId);
});
test('power outages interrupt unfinished scans without granting results',t=>{
  const c=setup(t),{room}=c;terminalCommand(room,'a','scrape backups');
  room.environment.warning={at:c.now+4000};
  c.advance(5000);
  assert.equal(room.environment.power,false);assert.equal(room.terminals.a.scan,null);
  assert.match(room.terminals.a.lastScan.text,/INTERRUPTED/);
  assert.equal(room.scans,0);
  room.environment.power=true;c.advance(8000);
  assert.equal(room.scans,0);
  assert.equal(Object.values(room.records).some(x=>x.discovered),false);
});
