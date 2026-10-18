import test from 'node:test';
import assert from 'node:assert/strict';
import {newRoom,addPlayer,gameAction,tick,publicState} from '../shared/core.js';
import {startEncounter} from '../shared/horror.js';
import {STATIONS} from '../shared/layout.js';
import {finishNight,tickEnding} from '../shared/campaign.js';
const setup=t=>{let now=Date.now();t.mock.method(Date,'now',()=>now);const r=newRoom();addPlayer(r,'a','A');addPlayer(r,'b','B');gameAction(r,'a','start');r.nextEvent=Infinity;return {r,get now(){return now;},advance(ms){now+=ms;tick(r,now);}};};
const act=(r,event,payload={},id='a')=>gameAction(r,id,event,payload);
const stand=(r,key,id='a')=>Object.assign(r.players[id],STATIONS[key],{zone:'apartment'});
const trade=(r,side,quantity=1,symbol='GW')=>act(r,'exchange:trade',{symbol,side,quantity,revision:r.exchange.revision});
function deal(r,now){r.inventory.packages=2;assert.equal(act(r,'sales:list',{quantity:2}).ok,true);const b=r.sales.buyers.find(b=>b.quantity===1);assert.equal(act(r,'sales:accept',{id:b.id}).ok,true);return r.sales.deals.at(-1);}
function mount(r,type){const t=Object.values(r.remoteTargets).find(t=>t.type===type);assert.equal(act(r,'remote:start',{id:t.id}).ok,true);for(const port of [...r.remoteSessions.a.route])assert.equal(act(r,'remote:route',{port}).ok,true);return t;}

test('exchange rejects stale quotes, inherited symbols, bad quantities and short sales without corrupting funds',t=>{
 const {r}=setup(t),bank=r.bank;
 for(const quantity of [-1,0,.5,101,Infinity,NaN])assert.equal(trade(r,'buy',quantity).ok,false);
 for(const symbol of ['__proto__','constructor'])assert.equal(trade(r,'buy',1,symbol).ok,false);
 assert.equal(trade(r,'sell').ok,false);assert.equal(act(r,'exchange:trade',{symbol:'GW',side:'buy',quantity:1,revision:-1}).ok,false);assert.equal(r.bank,bank);
});
test('fees make instant round trips lose money and shares persist through dawn and reconnect snapshots',t=>{
 const c=setup(t),{r}=c;const before=r.bank;assert.equal(trade(r,'buy',2).ok,true);assert.equal(r.exchange.holdings.GW.quantity,2);assert.equal(trade(r,'sell',1).ok,true);assert.equal(trade(r,'sell',2).ok,false);
 const quotes=structuredClone(r.exchange);r.nightEnds=c.now;tick(r,c.now);act(r,'night:next');assert.deepEqual(r.exchange,quotes);assert.equal(publicState(r,'b').exchange.holdings.GW.quantity,1);
 assert.equal(trade(r,'sell').ok,true);assert.ok(r.bank<before);
});
test('market news changes bounded quotes and keeps a bounded history with no client-provided prices',t=>{
 const c=setup(t),{r}=c;t.mock.method(Math,'random',()=>.05);c.advance(10000);assert.equal(r.exchange.revision,1);assert.ok(r.exchange.news.length>1);assert.ok(r.exchange.stocks.GW.price>38);assert.equal(r.exchange.stocks.GW.history.length,2);
 const before=r.bank,price=r.exchange.stocks.GW.price;assert.equal(act(r,'exchange:trade',{symbol:'GW',side:'buy',quantity:1,revision:1,price:0}).ok,true);assert.equal(before-r.bank,Math.ceil(price*1.02));
});
test('economic work needs two distinct quote revisions, surrendering shares and one atomic settlement',t=>{
 const c=setup(t),{r}=c;r.bank=1000;const j=r.contracts.find(j=>j.type==='economic');assert.equal(act(r,'contract:start',{id:j.id}).ok,true);
 assert.equal(trade(r,'buy',1,j.symbol).ok,true);assert.equal(act(r,'contract:deliver',{id:j.id}).ok,false);const cost=r.exchange.stocks[j.symbol].price;c.advance(10000);r.exchange.stocks[j.symbol].price=cost;
 assert.equal(trade(r,'buy',1,j.symbol).ok,true);assert.equal(j.acquired,2);const before=r.bank;assert.equal(act(r,'contract:deliver',{id:j.id},'b').ok,true);assert.equal(r.bank,before+j.acquisitionCost+j.payout);assert.equal(r.exchange.holdings[j.symbol].quantity,0);assert.equal(act(r,'contract:deliver',{id:j.id}).ok,false);
});
test('buyer budgets are private, unreasonable offers exhaust patience and final prices cannot be forged',t=>{
 const {r}=setup(t),b=r.sales.buyers[0];assert.equal(publicState(r,'a').sales.buyers[0].max,undefined);
 const bank=r.bank;for(let i=0;i<6;i++)act(r,'sales:counter',{id:b.id,price:99999,text:'Pay everything'});assert.equal(b.walked,true);assert.equal(act(r,'sales:accept',{id:b.id,price:99999}).ok,false);assert.equal(r.bank,bank);
});
test('negotiated pickup reserves shared stock, lasts thirty seconds, validates quantity and pays once',t=>{
 const c=setup(t),{r}=c,d=deal(r,c.now),bank=r.bank;assert.equal(d.leaveAt-d.arrives,30000);assert.equal(publicState(r,'b').sales.reserved,1);assert.equal(act(r,'sales:list',{quantity:2}).ok,false);
 c.advance(d.arrives-c.now);stand(r,'chute');assert.equal(r.alley.deal,d.id);assert.ok(publicState(r,'a').alley.clue.includes(d.code));assert.equal(act(r,'alley:drop',{quantity:2}).ok,false);assert.equal(r.bank,bank);assert.equal(act(r,'alley:drop',{quantity:1}).ok,true);assert.equal(r.bank,bank+d.price);assert.equal(r.inventory.packages,1);
 act(r,'alley:drop',{quantity:1});assert.equal(r.bank,bank+d.price);
});
test('missed pickups release reservations without paying and random alley visitors never create customers',t=>{
 const c=setup(t),{r}=c,d=deal(r,c.now),bank=r.bank;c.advance(d.leaveAt-c.now+1);assert.equal(d.status,'missed');assert.equal(publicState(r,'a').sales.reserved,0);assert.equal(r.inventory.packages,2);assert.equal(r.bank,bank);
 for(let i=0;i<10;i++){r.alley={visitor:'empty',next:c.now};c.advance(1);assert.notEqual(r.alley.visitor,'buyer');}
});
test('delivery contract requires production, listing, negotiation and matching physical pickup before bonus',t=>{
 const c=setup(t),{r}=c,j=r.contracts.find(j=>j.type==='delivery');assert.equal(act(r,'contract:start',{id:j.id}).ok,true);const b=r.sales.buyers.find(b=>b.contract===j.id);assert.equal(act(r,'sales:accept',{id:b.id}).ok,false);
 r.inventory.packages=2;act(r,'sales:list',{quantity:2});assert.equal(act(r,'sales:counter',{id:b.id,price:b.offer+20}).ok,true);assert.equal(act(r,'sales:accept',{id:b.id}).ok,true);const d=r.sales.deals.at(-1);c.advance(d.arrives-c.now);stand(r,'chute');const before=r.bank;assert.equal(act(r,'alley:drop',{quantity:2}).ok,true);assert.equal(r.bank,before+d.price+j.payout);assert.equal(j.completed,true);assert.equal(r.ledger.contracts,j.payout);
});
test('physical horror pauses pickups and accepted contract clocks so counterplay does not burn work',t=>{
 const c=setup(t),{r}=c,d=deal(r,c.now),j=r.contracts.find(j=>j.type==='economic');r.bank=1000;act(r,'contract:start',{id:j.id});r.horror.recoveryUntil=0;startEncounter(r,'echo',c.now);const deadline=j.deadline,arrival=d.arrives;c.advance(1000);assert.equal(j.deadline,deadline+1000);assert.equal(d.arrives,arrival+1000);
});
test('active remote owner is telegraphed, waiting is safe, interference detects once and queues a fair patrol',t=>{
 const c=setup(t),{r}=c,target=mount(r,'trace');target.activeOwner=true;const snapshot=publicState(r,'a').remoteSession;assert.equal(snapshot.ownerActivity.active,false);assert.match(snapshot.ownerActivity.phase,/FOOTSTEPS/);
 c.advance(4500);assert.equal(publicState(r,'a').remoteSession.ownerActivity.active,true);const bank=r.bank;for(let i=0;i<4;i++)act(r,'remote:interfere');assert.equal(target.burned,true);assert.equal(r.remoteSessions.a,undefined);assert.equal(r.bank,bank-target.penalty);assert.equal(r.policePending,true);
 act(r,'remote:interfere');assert.equal(r.bank,bank-target.penalty);r.horror.recoveryUntil=0;r.nextEvent=c.now;c.advance(1);assert.equal(r.horror.active.kind,'hall');assert.equal(r.horror.active.phase,'warning');assert.equal(r.policePending,false);
});
test('owner inactivity lets suspicion decay and reconnecting does not reroll owner presence or reset trace',t=>{
 const c=setup(t),{r}=c,target=mount(r,'trace');target.activeOwner=true;c.advance(4500);act(r,'remote:interfere');assert.equal(target.suspicion,25);c.advance(10000);assert.ok(target.suspicion<25);assert.equal(publicState(r,'a').remoteSession.ownerActivity.active,false);
 act(r,'remote:disconnect');assert.equal(act(r,'remote:start',{id:target.id}).ok,true);assert.equal(target.activeOwner,true);assert.ok(target.suspicion>0);
});
test('recovered evidence retains its deadline and an unpaid expired bundle cannot mint money',t=>{
 const c=setup(t),{r}=c,target=mount(r,'investigation');target.activeOwner=false;for(const [folder,file] of [['mail','dispatch.txt'],['logs','audit.txt'],['vault',target.valuable.split('/')[1]]]){act(r,'remote:folder',{folder});act(r,'remote:read',{file});}
 assert.equal(act(r,'remote:extract').ok,true);const bank=r.bank;c.advance(r.extractions[target.id].deadline-c.now+1);assert.equal(act(r,'remote:sell',{id:target.id}).ok,false);assert.equal(r.bank,bank-target.penalty);
});
test('rare wardrobe alternate enters visibly, blocks unsafe reuse and catches only the operator opening it',t=>{
 const c=setup(t),{r}=c;r.horror.recoveryUntil=0;startEncounter(r,'window',c.now);t.mock.method(Math,'random',()=>.01);c.advance(23000);assert.equal(r.horror.active.phase,'stalking');assert.equal(r.horror.wardrobe.phase,'entering');stand(r,'curtains');assert.equal(act(r,'curtain:hold').ok,false);assert.equal(r.players.a.scare,undefined);c.advance(8500);assert.equal(r.horror.wardrobe.phase,'occupied');assert.equal(startEncounter(r,'window',c.now),false);
 stand(r,'hide');assert.equal(act(r,'hide:enter').ok,false);assert.equal(r.players.a.scare.kind,'wardrobe');assert.equal(r.players.b.scare,undefined);assert.equal(r.horror.wardrobe,null);assert.equal(r.stalkerUsed,true);
});
test('ordinary wardrobe defense remains reliable and rare stalker cannot occupy a hiding player',t=>{
 const c=setup(t),{r}=c;stand(r,'hide');act(r,'hide:enter');r.horror.recoveryUntil=0;startEncounter(r,'window',c.now);t.mock.method(Math,'random',()=>.001);c.advance(23000);assert.equal(r.horror.wardrobe,null);assert.equal(r.players.a.scare,undefined);assert.equal(r.horror.active.phase,'hunting');
});
test('peephole apparitions require a physical check, are rare, harmless and globally cooled down',t=>{
 const c=setup(t),{r}=c;assert.equal(act(r,'door:peek').ok,false);stand(r,'door');r.horror.nextPeep=0;t.mock.method(Math,'random',()=>.01);assert.equal(act(r,'door:peek').ok,true);const event=r.horror.peep;assert.ok(event);assert.ok(event.ends>event.revealAt);assert.ok(r.horror.nextPeep>=c.now+120000);const bank=r.bank;c.advance(9000);assert.equal(r.horror.peep,null);act(r,'door:peek');assert.equal(r.horror.peep,null);assert.equal(r.bank,bank);
});
test('successful final payment begins a separate offer, majority ballot resolves once and Leave shows credits',t=>{
 const c=setup(t),{r}=c;r.day=6;r.quota=4550;r.bank=5000;finishNight(r,c.now);assert.equal(r.phase,'ending');assert.equal(r.bank,450);assert.equal(act(r,'ending:vote',{choice:'continue'}).ok,false);c.advance(12000);assert.equal(act(r,'ending:vote',{choice:'continue'}).ok,true);assert.equal(r.phase,'ending');assert.equal(gameAction(r,'b','ending:vote',{choice:'leave'}).ok,true);assert.equal(r.phase,'won');assert.match(r.reason,/focustap/);assert.equal(act(r,'ending:vote',{choice:'continue'}).ok,false);assert.equal(r.bank,450);
});
test('New Game+ preserves custody and upgrades, resets six-night settlements and raises quotas and rewards',t=>{
 const c=setup(t),{r}=c;r.bank=6000;trade(r,'buy');r.upgrades.push('lamp');r.day=6;r.quota=4550;finishNight(r,c.now);c.advance(12000);act(r,'ending:vote',{choice:'continue'});gameAction(r,'b','ending:vote',{choice:'continue'});assert.equal(r.phase,'night');assert.equal(r.day,1);assert.equal(r.loop,1);assert.equal(r.quota,Math.round(2550*1.35));assert.equal(r.exchange.holdings.GW.quantity,1);assert.ok(r.upgrades.includes('lamp'));assert.equal(Object.keys(r.settlements).length,0);assert.equal(Object.keys(r.remoteTargets).length,4);
});
test('ending timeout defaults to leaving and disconnected players do not hold the crew hostage',t=>{
 const c=setup(t),{r}=c;r.day=6;r.quota=4550;r.bank=4550;finishNight(r,c.now);r.players.b.connected=false;c.advance(12000);act(r,'ending:vote',{choice:'leave'});assert.equal(r.phase,'won');const c2=newRoom();addPlayer(c2,'a','A');c2.phase='night';c2.day=6;c2.quota=4550;c2.bank=4550;finishNight(c2,c.now);tickEnding(c2,c.now+73000);assert.equal(c2.phase,'won');
});

test('remounting cannot reset owner activity or evade an accepted disconnected deadline',t=>{
 const c=setup(t),{r}=c,target=mount(r,'trace');target.activeOwner=true;const epoch=target.desktopAt,deadline=target.acceptedDeadline;c.advance(5000);act(r,'remote:interfere');act(r,'remote:disconnect');const suspicion=target.suspicion;
 assert.equal(act(r,'remote:start',{id:target.id}).ok,true);for(const port of [...r.remoteSessions.a.route])act(r,'remote:route',{port});assert.equal(r.remoteSessions.a.desktopAt,epoch);assert.equal(publicState(r,'a').remoteSession.ownerActivity.active,true);assert.equal(target.suspicion,suspicion);assert.equal(r.remoteSessions.a.expires,deadline);
 act(r,'remote:disconnect');const bank=r.bank;c.advance(deadline-c.now+1);assert.equal(target.burned,true);assert.equal(r.bank,bank-target.penalty);c.advance(1);assert.equal(r.bank,bank-target.penalty);
});
test('an expired delivery job cancels its pickup and cannot pay late',t=>{
 const c=setup(t),{r}=c,j=r.contracts.find(j=>j.type==='delivery');act(r,'contract:start',{id:j.id});const b=r.sales.buyers.find(b=>b.contract===j.id);r.inventory.packages=2;act(r,'sales:list',{quantity:2});act(r,'sales:accept',{id:b.id});const d=r.sales.deals.at(-1);j.deadline=c.now+1000;c.advance(1001);assert.equal(j.failed,true);assert.equal(d.status,'cancelled');assert.equal(publicState(r,'a').sales.reserved,0);stand(r,'chute');assert.equal(act(r,'alley:drop',{quantity:2}).ok,false);assert.equal(r.ledger.deliveries,0);
});
test('local deliveries and outages appear in market news without a guaranteed profitable round trip',t=>{
 const c=setup(t),{r}=c;c.advance(10000);r.ledger.deliveries=250;c.advance(10000);assert.match(r.exchange.news[0].text,/pickup traffic/);const bank=r.bank;trade(r,'buy',1,'NC');trade(r,'sell',1,'NC');assert.ok(r.bank<bank);r.environment.power=false;c.advance(10000);assert.match(r.exchange.news[0].text,/outage/);
});

test('reaching the wardrobe before the rare stalker occupies it preserves individual hiding counterplay',t=>{
 const c=setup(t),{r}=c;r.horror.recoveryUntil=0;startEncounter(r,'window',c.now);t.mock.method(Math,'random',()=>.01);c.advance(23000);stand(r,'hide');assert.equal(act(r,'hide:enter').ok,true);assert.equal(r.horror.wardrobe,null);assert.equal(r.players.a.hidden,true);c.advance(1);assert.equal(r.players.a.scare,undefined);assert.equal(r.players.b.scare.kind,'window');
});

test('dawn closes unsold evidence without a delayed penalty against the next shift wallet',t=>{
 const c=setup(t),{r}=c,target=mount(r,'trace');act(r,'remote:solve',{answer:target.solution});act(r,'remote:folder',{folder:'vault'});act(r,'remote:read',{file:'route.bundle'});assert.equal(act(r,'remote:extract').ok,true);const bank=r.bank;r.nightEnds=c.now+1;c.advance(1);assert.equal(r.extractions[target.id].failed,true);assert.equal(r.bank,bank);act(r,'night:next');c.advance(1);assert.equal(r.bank,bank);assert.equal(act(r,'remote:sell',{id:target.id}).ok,false);assert.equal(r.bank,bank);
});

test('generated investigations vary evidence position instead of exposing the answer as the first file',t=>{
 let seed=42;t.mock.method(Math,'random',()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;});const positions=new Set();
 for(let i=0;i<12;i++){const r=newRoom();addPlayer(r,'a','A');act(r,'start');const target=Object.values(r.remoteTargets).find(t=>t.type==='investigation');positions.add(Object.keys(target.files.vault).findIndex(file=>'vault/'+file===target.valuable));}
 assert.ok(positions.size>=2);
});
