import test from 'node:test';
import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
import {createApp} from '../server/index.js';
import {startEncounter} from '../shared/horror.js';
import {STATIONS} from '../shared/layout.js';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
test('four-player shared rewards, full-room protection and authenticated reconnect',async t=>{
  const app=createApp();await new Promise(r=>app.http.listen(0,'127.0.0.1',r));
  const sockets=[];t.after(async()=>{sockets.forEach(s=>s.disconnect());await app.close();});
  const connect=async()=>{const s=io('http://127.0.0.1:'+app.http.address().port,{transports:['websocket'],reconnection:false});sockets.push(s);await new Promise(r=>s.once('connect',r));return s;};
  const a=await connect(),host=await a.emitWithAck('room:create',{name:'One'});assert.equal(host.ok,true);assert.equal(host.state.phase,'night');assert.ok(host.token);
  const peers=[];for(let i=0;i<3;i++){const s=await connect();const joined=await s.emitWithAck('room:join',{code:host.code,name:'Peer'});assert.equal(joined.ok,true);peers.push(s);}
  const fifth=await connect();assert.equal((await fifth.emitWithAck('room:join',{code:host.code})).ok,false);
  const room=app.rooms.get(host.code),record=Object.entries(room.records).find(([,r])=>r.kind==='CARD');record[1].discovered=true;
  const results=await Promise.all([a,peers[0]].map(s=>s.emitWithAck('game:action',{event:'market:sell',payload:{code:record[0]}})));
  assert.equal(results.filter(r=>r.ok).length,1);assert.equal(room.bank,185+record[1].value);
  room.players[host.playerId].carrying=3;a.disconnect();await sleep(50);
  const replacement=await connect();const resumed=await replacement.emitWithAck('room:resume',{token:host.token});
  assert.equal(resumed.ok,true);assert.equal(resumed.playerId,host.playerId);assert.equal(resumed.state.players.find(p=>p.id===host.playerId).carrying,3);
  assert.equal((await fifth.emitWithAck('room:resume',{token:'made-up'})).ok,false);
  assert.equal((await fifth.emitWithAck('room:resume',{token:host.token})).ok,false);
  const position=room.players[host.playerId];
  for(const yaw of [.2,1.2,2.2])replacement.emit('player:move',{x:position.x,z:position.z,yaw});
  await sleep(160);assert.equal(room.players[host.playerId].yaw,2.2,'the last movement in a burst must survive rate limiting');
  const before=room.inventory.seeds;await replacement.emitWithAck('game:action',{event:'buy',payload:{item:'seeds'}});await sleep(45);
  const remoteDoor=await replacement.emitWithAck('game:action',{event:'door:open'});assert.equal(remoteDoor.ok,false);assert.equal(room.inventory.seeds,before);
});

test('co-op remote evidence pays once and hiding survives authenticated reconnection',async t=>{
  const app=createApp();await new Promise(r=>app.http.listen(0,'127.0.0.1',r));const sockets=[];
  t.after(async()=>{sockets.forEach(s=>s.disconnect());await app.close();});
  const connect=async()=>{const s=io('http://127.0.0.1:'+app.http.address().port,{transports:['websocket'],reconnection:false});sockets.push(s);await new Promise(r=>s.once('connect',r));return s;};
  const a=await connect(),host=await a.emitWithAck('room:create',{}),b=await connect(),peer=await b.emitWithAck('room:join',{code:host.code});
  const room=app.rooms.get(host.code),action=(s,event,payload)=>s.emitWithAck('game:action',{event,payload});room.nextEvent=Infinity;
  const target=Object.values(room.remoteTargets).find(t=>t.type==='investigation');
  assert.equal((await action(a,'remote:start',{id:target.id})).ok,true);assert.equal((await action(b,'remote:start',{id:target.id})).ok,false);
  for(const port of [...room.remoteSessions[host.playerId].route])await action(a,'remote:route',{port});
  for(const [folder,file] of [['mail','dispatch.txt'],['logs','audit.txt']]){await action(a,'remote:folder',{folder});await action(a,'remote:read',{file});}
  await sleep(450);
  await action(a,'remote:folder',{folder:'vault'});await action(a,'remote:read',{file:target.valuable.split('/')[1]});assert.equal((await action(a,'remote:extract')).ok,true);
  const sales=await Promise.all([a,b].map(s=>action(s,'remote:sell',{id:target.id})));assert.equal(sales.filter(r=>r.ok).length,1);assert.equal(room.ledger.contracts,target.payout);
  await sleep(350);Object.assign(room.players[host.playerId],STATIONS.hide);assert.equal((await action(a,'hide:enter')).ok,true);
  a.disconnect();await sleep(50);const replacement=await connect(),resumed=await replacement.emitWithAck('room:resume',{token:host.token});assert.equal(resumed.state.players.find(p=>p.id===host.playerId).hidden,true);
  let latest;b.on('state',s=>{latest=s;});room.horror.recoveryUntil=0;startEncounter(room,'window');room.horror.active.attackAt=Date.now()-1;
  await sleep(400);assert.equal(room.players[host.playerId].scare,undefined);assert.equal(room.players[peer.playerId].scare.kind,'window');assert.equal(latest.horror.active.phase,'hunting');
  const bank=room.bank;await sleep(300);assert.equal(room.bank,bank);
});

test('co-op quota settlement charges once and one curtain holder protects both clients',async t=>{
  const app=createApp();await new Promise(r=>app.http.listen(0,'127.0.0.1',r));const sockets=[];
  t.after(async()=>{sockets.forEach(s=>s.disconnect());await app.close();});
  const connect=async()=>{const s=io('http://127.0.0.1:'+app.http.address().port,{transports:['websocket'],reconnection:false});sockets.push(s);await new Promise(r=>s.once('connect',r));return s;};
  const a=await connect(),host=await a.emitWithAck('room:create',{}),b=await connect(),peer=await b.emitWithAck('room:join',{code:host.code});
  const room=app.rooms.get(host.code),action=(s,event)=>s.emitWithAck('game:action',{event});
  room.nextEvent=Infinity;room.day=3;room.bank=room.quota+500;room.nightEnds=Date.now()+20;await sleep(350);
  assert.equal(room.bank,500);assert.equal(room.summary.quotaPaid,2550);await sleep(300);assert.equal(room.bank,500);
  const advances=await Promise.all([a,b].map(s=>action(s,'night:next')));assert.equal(advances.filter(r=>r.ok).length,1);assert.equal(room.day,4);assert.equal(room.quota,4550);
  room.nextEvent=Infinity;room.horror.recoveryUntil=0;Object.assign(room.players[host.playerId],STATIONS.curtains);Object.assign(room.players[peer.playerId],STATIONS.curtains);
  let latest;b.on('state',s=>{latest=s;});startEncounter(room,'window');assert.equal((await action(a,'curtain:hold')).ok,true);assert.equal((await action(b,'curtain:hold')).ok,false);
  for(let i=0;i<22&&!room.curtains?.closed;i++){await sleep(250);await action(a,'curtain:hold');}
  assert.equal(room.curtains.closed,true);assert.equal(latest.horror.active.phase,'retreating');assert.equal(room.bank,500);assert.equal(room.players[peer.playerId].scare,null);
});

test('co-op trading, negotiated pickup and ending ballot settle atomically and survive reconnect',async t=>{
 const app=createApp();await new Promise(r=>app.http.listen(0,'127.0.0.1',r));const sockets=[];t.after(async()=>{sockets.forEach(s=>s.disconnect());await app.close();});
 const connect=async()=>{const s=io('http://127.0.0.1:'+app.http.address().port,{transports:['websocket'],reconnection:false});sockets.push(s);await new Promise(r=>s.once('connect',r));return s;};
 const a=await connect(),host=await a.emitWithAck('room:create',{}),b=await connect(),peer=await b.emitWithAck('room:join',{code:host.code}),r=app.rooms.get(host.code);r.nextEvent=Infinity;r.bank=1000;
 const action=(s,event,payload={})=>s.emitWithAck('game:action',{event,payload});
 assert.equal((await action(a,'exchange:trade',{symbol:'GW',quantity:2,side:'buy',revision:r.exchange.revision})).ok,true);
 const sells=await Promise.all([a,b].map(s=>action(s,'exchange:trade',{symbol:'GW',quantity:2,side:'sell',revision:r.exchange.revision})));assert.equal(sells.filter(v=>v.ok).length,1);assert.equal(r.exchange.holdings.GW.quantity,0);
 await action(a,'exchange:trade',{symbol:'BV',quantity:1,side:'buy',revision:r.exchange.revision});r.inventory.packages=1;await action(a,'sales:list',{quantity:1});const buyer=r.sales.buyers.find(b=>b.quantity===1);
 const accepts=await Promise.all([a,b].map(s=>action(s,'sales:accept',{id:buyer.id,price:99999})));assert.equal(accepts.filter(v=>v.ok).length,1);const d=r.sales.deals[0];d.arrives=Date.now()-1000;d.leaveAt=Date.now()+30000;
 Object.assign(r.players[host.playerId],STATIONS.chute);Object.assign(r.players[peer.playerId],STATIONS.chute);await sleep(300);const bank=r.bank;
 const drops=await Promise.all([a,b].map(s=>action(s,'alley:drop',{quantity:1})));assert.equal(drops.filter(v=>v.ok).length,1);assert.equal(r.bank,bank+d.price);assert.equal(r.inventory.packages,0);
 a.disconnect();await sleep(50);const replacement=await connect(),resumed=await replacement.emitWithAck('room:resume',{token:host.token});assert.equal(resumed.state.exchange.holdings.BV.quantity,1);assert.equal(resumed.state.sales.deals[0].status,'completed');
 r.day=6;r.quota=4550;r.bank=4550;r.nightEnds=Date.now()-1;await sleep(300);assert.equal(r.phase,'ending');r.ending.offerAt=Date.now()-1;
 await action(replacement,'ending:vote',{choice:'continue'});assert.equal(r.phase,'ending');await action(b,'ending:vote',{choice:'leave'});assert.equal(r.phase,'won');assert.equal(r.bank,0);assert.equal(r.settlements[1].amount,4550);
});
