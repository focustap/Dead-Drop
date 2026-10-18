import test from 'node:test';
import assert from 'node:assert/strict';
import {newRoom,addPlayer,gameAction,tick,movePlayer,publicState,beginIntrusion,terminalCommand} from '../shared/core.js';
import {startEncounter,THREATS} from '../shared/horror.js';
import {STATIONS,slide} from '../shared/layout.js';
import {visitorMotion,turnToward} from '../shared/npc.js';
import {visitor} from '../shared/campaign.js';
const setup=t=>{let now=Date.now();t.mock.method(Date,'now',()=>now);const r=newRoom();addPlayer(r,'a','A');addPlayer(r,'b','B');gameAction(r,'a','start');r.nextEvent=Infinity;r.horror.recoveryUntil=0;return {r,get now(){return now;},advance(ms){now+=ms;tick(r,now);}};};
const stand=(r,key,id='a')=>Object.assign(r.players[id],STATIONS[key]);
test('NPC route headings match approach and departure, with shortest smooth turns',()=>{
  const v=visitor('courier',1000,'door');
  for(const hall of [true,false]){
    const a=visitorMotion(v,2000,hall),b=visitorMotion(v,2500,hall);
    assert.ok(Math.sign(b.z-a.z)===Math.sign(-Math.cos(a.yaw)));
    const c=visitorMotion(v,v.leaveAt+1000,hall),d=visitorMotion(v,v.leaveAt+1500,hall);
    assert.ok(Math.sign(d.z-c.z)===Math.sign(-Math.cos(c.yaw)));
    assert.equal(visitorMotion(v,v.waitAt+100,hall).stride,0);
  }
  assert.ok(turnToward(0,Math.PI,.016)>0&&turnToward(0,Math.PI,.016)<Math.PI);
  assert.ok(Math.abs(turnToward(3.13,-3.13,.02)-3.13)<.01);
});
test('locked door prevents timed breach; unlocked breach charges the crew only once',t=>{
  const c=setup(t),{r}=c;assert.equal(startEncounter(r,'door',c.now),true);c.advance(17000);assert.equal(r.bank,185);assert.equal(r.players.a.scare,undefined);
  stand(r,'door');gameAction(r,'a','door:unlock');c.advance(250);assert.ok(r.players.a.scare);assert.ok(r.players.b.scare);const bank=r.bank;assert.ok(bank<185);c.advance(500);assert.equal(r.bank,bank);assert.equal(r.horror.locked,true);
});
test('window ignores the lock, hiding protects each player for the full hunt',t=>{
  const c=setup(t),{r}=c;startEncounter(r,'window',c.now);stand(r,'hide');assert.equal(gameAction(r,'a','hide:enter').ok,true);r.players.b.carrying=3;
  const before={...r.players.a};movePlayer(r,'a',{x:0,z:0,yaw:1},c.now+1000);assert.equal(r.players.a.x,before.x);
  c.advance(12100);assert.equal(r.players.a.scare,undefined);assert.ok(r.players.b.scare);assert.equal(r.players.b.carrying,0);
  c.advance(9000);assert.equal(r.horror.active.kind,'window');c.advance(1000);assert.equal(r.horror.active,null);assert.equal(gameAction(r,'a','hide:leave').ok,true);
  assert.equal(startEncounter(r,'hall',c.now),false);
});
test('leaving hiding early is dangerous; all hidden crew survive without losing funds',t=>{
  const c=setup(t),{r}=c;for(const id of ['a','b']){stand(r,'hide',id);gameAction(r,id,'hide:enter');}startEncounter(r,'window',c.now);c.advance(13000);assert.equal(r.bank,185);
  gameAction(r,'a','hide:leave');c.advance(250);assert.ok(r.players.a.scare);assert.equal(r.players.b.scare,undefined);
});
test('hallway entry, safe return, relocated breaker and patrol attack are authoritative',t=>{
  const c=setup(t),{r}=c;r.environment.power=false;stand(r,'door');assert.equal(gameAction(r,'a','hall:enter').ok,false);gameAction(r,'a','door:unlock');assert.equal(gameAction(r,'a','hall:enter').ok,true);assert.equal(r.players.a.zone,'hall');
  assert.equal(gameAction(r,'a','breaker:reset').ok,false);stand(r,'breaker');assert.equal(gameAction(r,'a','breaker:reset').ok,true);
  const wall=slide({x:6,z:0},{x:30,z:0},'hall');assert.ok(wall.x<=8.5);
  startEncounter(r,'hall',c.now);stand(r,'return');assert.equal(gameAction(r,'a','hall:return').ok,true);c.advance(12500);assert.equal(r.players.a.scare,undefined);
  stand(r,'door');gameAction(r,'a','door:unlock');gameAction(r,'a','hall:enter');c.advance(250);assert.ok(r.players.a.scare);assert.equal(r.players.a.zone,'apartment');assert.equal(r.players.b.scare,undefined);
});
test('major encounters cannot overlap hacks and recovery is enforced',t=>{
  const c=setup(t),{r}=c;r.nextHack=0;assert.equal(beginIntrusion(r,'a'),true);assert.equal(startEncounter(r,'window',c.now),false);assert.equal(beginIntrusion(r,'b'),false);
  r.intrusions={};assert.equal(beginIntrusion(r,'a'),false);assert.equal(startEncounter(r,'window',c.now),true);assert.equal(beginIntrusion(r,'a',true),false);
  c.advance(23000);assert.equal(startEncounter(r,'door',c.now),false);c.advance(31000);assert.equal(startEncounter(r,'hall',c.now),true);
});
function connect(r,type){const target=Object.values(r.remoteTargets).find(t=>t.type===type);assert.equal(gameAction(r,'a','remote:start',{id:target.id}).ok,true);const s=r.remoteSessions.a;for(const port of [...s.route])assert.equal(gameAction(r,'a','remote:route',{port}).ok,true);return target;}
test('remote archive requires circuit, documents, decoded seal, extraction and one shared sale',t=>{
  const {r}=setup(t),target=connect(r,'archive');assert.equal(gameAction(r,'b','remote:start',{id:target.id}).ok,false);
  gameAction(r,'a','remote:folder',{folder:'vault'});gameAction(r,'a','remote:read',{file:'payload.arc'});assert.equal(gameAction(r,'a','remote:extract').ok,false);
  gameAction(r,'a','remote:solve',{answer:target.solution});assert.equal(gameAction(r,'a','remote:extract').ok,true);assert.equal(r.ledger.contracts,0);
  assert.equal(gameAction(r,'b','remote:sell',{id:target.id}).ok,true);assert.equal(gameAction(r,'a','remote:sell',{id:target.id}).ok,false);assert.equal(r.ledger.contracts,target.payout);
  assert.equal(gameAction(r,'a','remote:start',{id:target.id}).ok,false);
});
test('investigation decoys add trace, correct evidence pays; solution data stays server-side',t=>{
  const {r}=setup(t),target=connect(r,'investigation');gameAction(r,'a','remote:folder',{folder:'vault'});gameAction(r,'a','remote:read',{file:'manifest-copy.dat'});assert.equal(gameAction(r,'a','remote:extract').ok,false);
  gameAction(r,'a','remote:read',{file:target.valuable.split('/')[1]});assert.equal(gameAction(r,'a','remote:extract').ok,true);
  const state=publicState(r,'b');assert.equal(state.remoteTargets,undefined);assert.equal(state.remoteSessions,undefined);assert.equal(state.remoteSession,null);assert.ok(!JSON.stringify(state.remoteListings).includes(target.solution));
});
test('trace job reconstructs several files; failed puzzles burn after three guesses',t=>{
  const {r}=setup(t),target=connect(r,'trace');gameAction(r,'a','remote:folder',{folder:'logs'});assert.equal(publicState(r,'a').remoteSession.files.length,3);
  for(let i=0;i<3;i++)assert.equal(gameAction(r,'a','remote:solve',{answer:'wrong'}).ok,false);assert.equal(r.remoteSessions.a,undefined);assert.equal(target.burned,true);assert.equal(gameAction(r,'b','remote:start',{id:target.id}).ok,false);
});
test('remote lease pauses for physical danger and power loss, but expires during ordinary play',t=>{
  const c=setup(t),{r}=c;connect(r,'trace');const original=r.remoteSessions.a.expires;startEncounter(r,'echo',c.now);c.advance(4000);assert.equal(r.remoteSessions.a.expires,original+4000);
  r.horror.active=null;r.environment.power=false;c.advance(10000);assert.equal(r.remoteSessions.a.expires,original+14000);r.environment.power=true;c.advance(100000);assert.equal(r.remoteSessions.a,undefined);
});
test('inherited remote ids cannot corrupt money, and scrape cooldown prevents spam',t=>{
  const {r}=setup(t);for(const id of ['__proto__','constructor','toString'])for(const action of ['remote:start','remote:sell'])assert.equal(gameAction(r,'a',action,{id}).ok,false);
  assert.equal(r.bank,185);terminalCommand(r,'a','connect NOVA-17');terminalCommand(r,'a','scrape finances');assert.match(terminalCommand(r,'a','scrape backups').text,/cooling/);assert.equal(r.scans,1);
  assert.equal(THREATS.length,8);
});
