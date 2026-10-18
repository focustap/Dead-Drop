import test from 'node:test';
import assert from 'node:assert/strict';
import {newRoom,addPlayer,publicState,terminalCommand,intrusionInput,gameAction,tick,movePlayer} from '../shared/core.js';
const roomWithPlayer=()=>{const room=newRoom('TEST01');addPlayer(room,'p1','Runner');return room;};
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
  assert.match(terminalCommand(room,'p1','connect NOVA-17').text,/CONNECTED/);
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
test('scanning three folders causes an intrusion; correct sequence protects cash',()=>{
  const room=roomWithPlayer();
  terminalCommand(room,'p1','connect NOVA-17');
  for(const folder of ['finances','documents','backups'])terminalCommand(room,'p1','scrape '+folder);
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
test('supplies require an actual door pickup before they appear',()=>{
  const room=roomWithPlayer();
  assert.equal(room.inventory.seeds,0);
  gameAction(room,'p1','buy',{item:'seeds'});
  assert.equal(room.inventory.seeds,0);assert.equal(room.pending.length,1);
  assert.match(gameAction(room,'p1','door:peek').text,/courier/i);
  assert.match(gameAction(room,'p1','door:open').text,/received/i);
  assert.equal(room.inventory.seeds,2);
});
test('garden creates a package and a buyer is required to get paid',()=>{
  const room=roomWithPlayer();room.inventory.seeds=1;
  gameAction(room,'p1','garden:plant');room.inventory.readyAt=1;gameAction(room,'p1','garden:harvest');
  assert.equal(room.inventory.buds,2);
  gameAction(room,'p1','garden:package');assert.equal(room.inventory.packages,1);
  const before=room.bank;room.alley.visitor='thief';
  gameAction(room,'p1','alley:drop');assert.equal(room.bank,before);
  gameAction(room,'p1','garden:package');room.alley.visitor='buyer';
  gameAction(room,'p1','alley:drop');assert.equal(room.bank,before+190);
});
test('player coordinates are bounded and public state hides other players private sessions',()=>{
  const room=roomWithPlayer();addPlayer(room,'p2','Teammate');
  movePlayer(room,'p1',{x:99,z:-99,yaw:3});
  assert.equal(room.players.p1.x,4.15);assert.equal(room.players.p1.z,-3.6);
  terminalCommand(room,'p1','connect NOVA-17');
  assert.equal(publicState(room,'p1').terminal.target,'NOVA-17');
  assert.equal(publicState(room,'p2').terminal.target,null);
  assert.equal(publicState(room,'p2').records,undefined);
  assert.equal(publicState(room,'p2').targets.length,4);
});
