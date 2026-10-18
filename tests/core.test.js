import test from 'node:test';
import assert from 'node:assert/strict';
import {newRoom,addPlayer,publicState,terminalCommand,intrusionInput,gameAction,tick,movePlayer} from '../shared/core.js';
import {STATIONS,blocked,slide} from '../shared/layout.js';
import {NIGHT_MS,QUOTAS,visitor} from '../shared/campaign.js';
const roomWithPlayer=()=>{const room=newRoom('TEST01');addPlayer(room,'p1','Runner');gameAction(room,'p1','start');return room;};
test('a new hideout has four targets and five folders per target',()=>{
  const room=roomWithPlayer();
  assert.equal(Object.keys(room.targets).length,4);
  for(const target of Object.values(room.targets))assert.equal(Object.keys(target.folders).length,5);
  assert.equal(room.bank,185);assert.equal(room.players.p1.name,'Runner');
});
test('help lists all useful commands, including cd scrape FOLDER',()=>{
  const room=roomWithPlayer(),res=terminalCommand(room,'p1','help');
  assert.match(res.text,/connect NAME/);assert.match(res.text,/cd scrape FOLDER/);
  assert.match(res.text,/scrape \[FOLDER\]/);
});
test('terminal can navigate, read files and scrape a directory',()=>{
  const room=roomWithPlayer();
  assert.match(terminalCommand(room,'p1','targets').text,/NOVA-17/);
  assert.match(terminalCommand(room,'p1','connect NOVA-17').text,/CONNECTION ESTABLISHED/);
  assert.match(terminalCommand(room,'p1','ls').text,/finances/);
  assert.match(terminalCommand(room,'p1','cd finances').text,/finances/);
  assert.match(terminalCommand(room,'p1','cat budget.txt').text,/Quarterly budget/);
  const scan=terminalCommand(room,'p1','scrape');
  assert.match(scan.text,/REC-[A-Z0-9]+-[A-Z0-9]+/);
  assert.ok(room.scans===1);
});
test('decoy codes cannot be sold and valid discoveries increase only the shared bank',()=>{
  const room=roomWithPlayer();terminalCommand(room,'p1','connect NOVA-17');terminalCommand(room,'p1','scrape finances');
  const valid=Object.keys(room.records).find(code=>room.records[code].discovered && room.records[code].kind==='CARD');
  assert.ok(valid);
  assert.match(gameAction(room,'p1','market:verify',{code:'REF-99999'}).text,/NOT RECOGNIZED/);
  assert.match(gameAction(room,'p1','market:verify',{code:valid}).text,/VALID PAYMENT/);
  const before=room.bank,payout=room.records[valid].value;
  gameAction(room,'p1','market:sell',{code:valid});
  assert.equal(room.bank,before+payout);
  gameAction(room,'p1','market:sell',{code:valid});
  assert.equal(room.bank,before+payout);
});
test('routine scanning stays quiet; training retains arrow defense',()=>{
  const room=roomWithPlayer();
  terminalCommand(room,'p1','connect NOVA-17');
  for(const folder of ['finances','documents','backups'])terminalCommand(room,'p1','scrape '+folder);
  assert.equal(room.intrusions.p1,undefined);terminalCommand(room,'p1','training');
  const {sequence}=room.intrusions.p1;
  assert.ok(sequence.length>=6);
  const starting=room.bank;
  for(const key of sequence)intrusionInput(room,'p1',key);
  assert.equal(room.intrusions.p1,undefined);
  assert.equal(room.bank,starting);
});
test('wrong input drains a bounded fraction; wallet vault reduces loss',()=>{
  const room=roomWithPlayer();room.bank=1000;terminalCommand(room,'p1','training');
  const wrong=room.intrusions.p1.sequence[0]==='ArrowUp'?'ArrowDown':'ArrowUp';
  const answer=intrusionInput(room,'p1',wrong);
  assert.equal(answer.ok,false);assert.equal(room.bank,820);
  room.upgrades.push('vault');terminalCommand(room,'p1','training');
  const secondWrong=room.intrusions.p1.sequence[0]==='ArrowUp'?'ArrowDown':'ArrowUp';
  intrusionInput(room,'p1',secondWrong);
  assert.equal(room.bank,770);
});
test('timed-out intrusion damages the wallet and does not fire twice',()=>{
  const room=roomWithPlayer();room.bank=500;terminalCommand(room,'p1','training');
  room.intrusions.p1.expires=1;tick(room,Date.now());assert.equal(room.bank,410);
  tick(room,Date.now());assert.equal(room.bank,410);
});

const stand=(r,where,id='p1')=>Object.assign(r.players[id],STATIONS[where],{zone:where==='breaker'?'hall':'apartment'});
test('courier supplies have travel time, require proximity, and can only be claimed once',t=>{
  let now=Date.now();t.mock.method(Date,'now',()=>now);const r=roomWithPlayer();
  gameAction(r,'p1','buy',{item:'seeds'});assert.equal(r.inventory.seeds,0);
  assert.equal(gameAction(r,'p1','door:open').ok,false);stand(r,'door');
  assert.equal(gameAction(r,'p1','door:open').ok,false);now+=7000;
  assert.match(gameAction(r,'p1','door:peek').text,/taped parcel/i);
  assert.equal(gameAction(r,'p1','door:open').ok,true);assert.equal(r.inventory.seeds,2);
  assert.equal(gameAction(r,'p1','door:open').ok,false);assert.equal(r.inventory.seeds,2);
});
test('a complete physical crop requires soil, water, power, carrying and a separate table',t=>{
  let now=Date.now();t.mock.method(Date,'now',()=>now);const r=roomWithPlayer();r.inventory.seeds=1;
  assert.equal(gameAction(r,'p1','garden:plant').ok,false);stand(r,'garden');
  assert.equal(gameAction(r,'p1','garden:plant').ok,false);
  gameAction(r,'p1','garden:soil');gameAction(r,'p1','garden:plant');now+=1000;tick(r,now);assert.equal(r.garden.growth,0);
  gameAction(r,'p1','garden:water');r.environment.power=false;now+=1000;tick(r,now);assert.equal(r.garden.growth,0);
  r.environment.power=true;r.nextEvent=Infinity;
  for(let i=0;i<61;i++){now+=1000;tick(r,now);}
  assert.equal(r.garden.growth,100);gameAction(r,'p1','garden:harvest');assert.equal(r.players.p1.carrying,3);
  assert.equal(gameAction(r,'p1','garden:harvest').ok,false);assert.equal(gameAction(r,'p1','pack:deposit').ok,false);
  stand(r,'packaging');gameAction(r,'p1','pack:deposit');gameAction(r,'p1','pack:seal');assert.equal(r.inventory.packages,1);assert.equal(r.inventory.buds,2);
  stand(r,'chute');r.alley=visitor('buyer',now-7000,'alley');const before=r.bank;
  assert.equal(gameAction(r,'p1','alley:drop').ok,true);assert.equal(r.bank,before+210);assert.equal(r.ledger.deliveries,210);
  assert.equal(gameAction(r,'p1','alley:drop').ok,false);
});
test('thieves cost shipments, an intruder costs bounded funds, and bracing has counterplay',()=>{
  const r=roomWithPlayer(),now=Date.now();stand(r,'chute');r.inventory.packages=1;r.alley=visitor('thief',now-7000,'alley');
  gameAction(r,'p1','alley:drop');assert.equal(r.bank,185);assert.equal(r.shipmentsLost,1);
  stand(r,'door');r.door=visitor('intruder',now-7000,'door');gameAction(r,'p1','door:brace');assert.equal(r.bank,185);
  r.door=visitor('intruder',now-7000,'door');gameAction(r,'p1','door:open');assert.equal(r.bank,70);assert.equal(r.environment.power,false);
  r.players.p1.stunnedUntil=0;stand(r,'breaker');gameAction(r,'p1','breaker:reset');assert.equal(r.environment.power,true);
});
test('swept collision prevents tunneling through each prop and bounds movement speed',()=>{
  const r=roomWithPlayer();const start={...r.players.p1};movePlayer(r,'p1',{x:99,z:-99,yaw:1});assert.ok(Math.hypot(r.players.p1.x-start.x,r.players.p1.z-start.z)<1);
  const chair=slide({x:-.95,z:0},{x:-.95,z:-3});assert.ok(chair.z>-1.2);assert.equal(blocked(chair.x,chair.z),false);
  const tent=slide({x:2,z:2.4},{x:5,z:2.4});assert.ok(tent.x<3.125);assert.equal(blocked(tent.x,tent.z),false);
  const wall=slide({x:0,z:0},{x:30,z:0});assert.ok(wall.x<=4.65);
  const before={...r.players.p1};movePlayer(r,'p1',{x:NaN,z:0,yaw:0});assert.deepEqual(r.players.p1,before);
});
test('six nights, two three-night cycles, upgrades and meaningful win/loss',()=>{
  const r=roomWithPlayer();r.upgrades.push('lamp');
  for(let day=1;day<=6;day++){
    r.ledger.hacking=r.quota;r.bank+=r.quota;tick(r,r.nightEnds);assert.equal(r.summary.met,true);assert.equal(r.summary.net,r.quota-(45+day*10));
    assert.equal(r.phase,day===6?'won':'summary');assert.equal(gameAction(r,'p1','market:sell',{code:'x'}).ok,false);
    if(day<6){assert.equal(gameAction(r,'p1','night:next').ok,true);assert.equal(r.quota,QUOTAS[day]);assert.ok(r.upgrades.includes('lamp'));assert.equal(r.nightEnds-Date.now()<=NIGHT_MS,true);}
  }
  assert.equal(r.history.length,6);assert.equal(gameAction(r,'p1','night:next').ok,false);
  const losing=roomWithPlayer();for(let day=1;day<=3;day++){tick(losing,losing.nightEnds);if(day<3)gameAction(losing,'p1','night:next');}
  assert.equal(losing.phase,'lost');assert.equal(losing.bank,0);
});
test('a missed daily quota can be recovered before the cycle deadline',()=>{
  const r=roomWithPlayer();tick(r,r.nightEnds);assert.equal(r.summary.met,false);assert.equal(r.phase,'summary');
  gameAction(r,'p1','night:next');r.ledger.hacking=QUOTAS[0]+QUOTAS[1];tick(r,r.nightEnds);
  gameAction(r,'p1','night:next');r.ledger.deliveries=QUOTAS[2];tick(r,r.nightEnds);assert.equal(r.phase,'summary');assert.equal(r.summary.cycleMet,true);
});
test('recurring targets and contracts stay available, and tiers unlock through progression',()=>{
  const r=roomWithPlayer();r.day=3;tick(r,r.nextTarget);const fresh=Object.keys(r.targets).at(-1);assert.ok(r.targets[fresh].folders['.cache']);
  r.targets[fresh].tier=3;assert.match(terminalCommand(r,'p1','connect '+fresh).text,/decoder required/);
  r.upgrades.push('decoder');assert.match(terminalCommand(r,'p1','connect '+fresh).text,/ESTABLISHED/);
  assert.ok(r.contracts.length>=3);assert.ok(r.orders.length>=3);
  for(let i=0;i<20;i++){r.nightEnds=r.nextTarget+NIGHT_MS;tick(r,r.nextTarget);}
  assert.ok(Object.keys(r.targets).length<=12);assert.ok(r.targets[fresh]);
});
test('contract reservation and completion are atomic across two operators',t=>{
  let now=Date.now();t.mock.method(Date,'now',()=>now);const r=roomWithPlayer();addPlayer(r,'p2','Peer');const job=r.contracts[0];job.type='memory';
  assert.equal(gameAction(r,'p1','contract:start',{id:job.id}).ok,true);assert.equal(gameAction(r,'p2','contract:start',{id:job.id}).ok,false);
  const sequence=[...r.challenges.p1.sequence];assert.equal(gameAction(r,'p1','contract:input',{key:sequence[0]}).ok,false);now+=3100;
  for(const key of sequence)assert.equal(gameAction(r,'p1','contract:input',{key}).ok,true);
  assert.equal(r.ledger.contracts,job.payout);assert.equal(gameAction(r,'p2','contract:start',{id:job.id}).ok,false);
  assert.equal(gameAction(r,'p1','contract:input',{key:sequence[0]}).ok,false);
});
test('carrier intercept uses server time and accepts only the timing window',t=>{
  let now=Date.now();t.mock.method(Date,'now',()=>now);const r=roomWithPlayer();r.contracts[0].type='pulse';
  gameAction(r,'p1','contract:start',{id:r.contracts[0].id});assert.equal(gameAction(r,'p1','contract:input',{time:now+3000}).ok,false);
  r.contracts[1].type='pulse';gameAction(r,'p1','contract:start',{id:r.contracts[1].id});now+=3000;
  assert.equal(gameAction(r,'p1','contract:input').ok,true);assert.equal(r.ledger.contracts,r.contracts[1].payout);
});
test('power warning can be countered and public state keeps personal sessions private',()=>{
  const r=roomWithPlayer();addPlayer(r,'p2','Peer');terminalCommand(r,'p1','connect NOVA-17');
  r.environment.warning={at:Date.now()+1000};stand(r,'breaker');gameAction(r,'p1','breaker:reset');tick(r,Date.now()+1500);assert.equal(r.environment.power,true);
  r.environment.warning={at:1};tick(r);assert.equal(r.environment.power,false);assert.match(terminalCommand(r,'p1','ls').text,/NO POWER/);
  const state=publicState(r,'p2');assert.equal(state.terminal.target,null);assert.equal(state.records,undefined);assert.equal(state.challenges,undefined);
});
test('unknown inherited listings cannot corrupt the shared wallet',()=>{
  const r=roomWithPlayer();for(const item of ['__proto__','constructor','toString'])assert.equal(gameAction(r,'p1','buy',{item}).ok,false);
  assert.equal(r.bank,185);assert.equal(r.ledger.expenses,0);
});
test('crew messages are bounded and become visible to teammates',()=>{
  const r=roomWithPlayer();addPlayer(r,'p2','Peer');
  assert.equal(gameAction(r,'p1','message:send',{text:'Watering the tent'}).ok,true);
  assert.equal(publicState(r,'p2').messages[0].text,'Watering the tent');
  gameAction(r,'p1','message:send',{text:'a'.repeat(1000)});assert.equal(r.messages[0].text.length,160);
});
