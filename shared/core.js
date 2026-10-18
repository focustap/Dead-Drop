import {newExchange,tickExchange,exchangeAction} from './exchange.js';
import {seedSales,salesPublic,salesAction,tickSales} from './sales.js';
import {seedContracts,contractAction,tickContracts} from './contracts.js';
import {seedRemote,remotePublic,remoteAction,tickRemote} from './remote.js';
import {newHorror,startEncounter,tickHorror,horrorAction,openedIntruder} from './horror.js';
import {slide,atStation,atComputer} from './layout.js';
import {NIGHT_MS,QUOTAS,CATALOG,ledger,earn,spend,income,visitor,phase,clue,finishNight,nextNight,tickCollector,tickEnding,endingAction,nightsRemaining} from './campaign.js';
// Dead Drop's complete simulated game state. No real networks, accounts, or personal data.
const PRODUCTS = Object.freeze({
  CARD:{name:'Payment record',base:85}, ID:{name:'Identity record',base:115},
  WALLET:{name:'Wallet fragment',base:185}, JUNK:{name:'Unidentified data',base:0}
});
const TARGET_NAMES=['NOVA-17','ORCHID-02','SABLE-91','CIPHER-08'];
const pick=a=>a[Math.floor(Math.random()*a.length)];
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const uid=()=>Math.random().toString(36).slice(2,10).toUpperCase();
const log=(room,s)=>{room.log.unshift({id:uid(),time:Date.now(),text:s});room.log=room.log.slice(0,18);};
function makeTarget(name,i,registry){
  const folders={documents:{'readme.txt':'Invoice archive. Lots of outdated paperwork.','notes.txt':'Meetings at 14:00. Reminder: buy more coffee.'},
    finances:{'budget.txt':'Quarterly budget 34989, reference 82143.','old_receipts.txt':'Receipt 87391; receipt 70012; nothing filed.'},
    photos:{'camera_index.txt':'Photos moved to a different machine.','manifest.txt':'DSC_88312, DSC_09238'},
    backups:{'todo.txt':'Check old backup codes and obsolete files.'},
    downloads:{'list.txt':'Downloaded music and tax templates. Nothing useful.'}};
  for(const [j,kind] of (i===0?['CARD','JUNK','WALLET']:i===1?['ID','JUNK','CARD']:['WALLET','CARD','JUNK']).entries()){
    const code='REC-'+uid().slice(0,4)+'-'+uid().slice(0,4);
    const folder=j===0?'finances':j===1?'documents':'backups';
    const file=j===0?'archive.dat':j===1?'dump.txt':'recovery.log';
    folders[folder][file]=(folders[folder][file]||'')+' Fragment '+code+'; checksum '+(84321+i*73+j*27);
    registry[code]={kind,value:PRODUCTS[kind].base+(kind==='JUNK'?0:i*24),target:name,folder,discovered:false,sold:false};
  }
  const tier=1+Math.min(2,Math.floor(i/4));
  folders.documents['dispatch.txt']='The receiver checks a phone beside the red tray. A courier carries a taped parcel and waits after two knocks. Never trust an empty-handed visitor at the lock.';
  folders.backups['route.txt']='Archive route /backups. A recovery fragment can fund your next shipment.';
  if(i>=4)folders['.cache']={'dispatch.log':'Hidden recovery mirror. Scrape backups for the original record.', 'checksum.key':'Checksum '+(i*73+84321)};
  return {name,folders,tier,job:['Archive recovery','Wallet reconstruction','Identity audit'][i%3]};
}
export function newRoom(code='LOCAL'){
  const records={},targets=Object.fromEntries(TARGET_NAMES.map((n,i)=>[n,makeTarget(n,i,records)]));
  const now=Date.now();
  return {exchange:newExchange(now),sales:{buyers:[],deals:[],listed:0,next:0},loop:0,ending:null,code,created:now,started:false,phase:'lobby',day:1,quota:QUOTAS[0],bank:185,heat:4,upgrades:[],players:{},terminals:{},intrusions:{},challenges:{},
    targets,records,remoteTargets:{},remoteSessions:{},extractions:{},scans:0,targetSerial:4,ledger:ledger(),cycleEarned:0,cycleRequired:QUOTAS[0],settlements:{},collector:null,curtains:null,history:[],summary:null,
    inventory:{seeds:0,soil:2,buds:0,wrap:2,packages:0},garden:{soil:false,planted:false,moisture:0,growth:0,light:true},
    pending:[],orders:[],contracts:[],messages:[],alley:{visitor:'empty',next:now+14000},door:{visitor:'empty',next:now+23000},nightEnds:now+NIGHT_MS,
    horror:newHorror(now),nextHack:now+75000,environment:{power:true,warning:null,cameraUntil:0,nextOutageAt:now+160000},lastTick:now,nextTarget:now+40000,nextEvent:now+45000,
    log:[{id:uid(),time:now,text:'Night one. Recover records, grow inventory, make the deadline.'}]};
}
export function addPlayer(room,id,name){
  const count=Object.keys(room.players).length;
  if(count>=4)throw Error('The hideout is full (4 players).');
  room.players[id]={id,name:String(name||'Runner').trim().slice(0,22)||'Runner',x:-1.2+(count%2)*2.2,z:-.75+Math.floor(count/2)*1.4,yaw:0,lastMove:Date.now(),connected:true,computerOpen:false,carrying:0,zone:'apartment',hidden:false,stunnedUntil:0,safeUntil:room.horror.active?Date.now()+12000:0};
  room.terminals[id]={target:null,cwd:'/',seen:[]};log(room,room.players[id].name+' entered the hideout.');
}
export function movePlayer(room,id,p,now=Date.now()){
  const player=room.players[id];if(!player||room.phase!=='night')return;
  if(player.hidden||player.stunnedUntil>now||room.curtains?.owner===id&&!room.curtains.closed)return;
  if(!Number.isFinite(p?.x)||!Number.isFinite(p?.z)||!Number.isFinite(p?.yaw))return;
  const max=Math.min(.8,Math.max(.015,(now-player.lastMove)/1000)*4.2);
  const distance=Math.hypot(p.x-player.x,p.z-player.z),ratio=distance>max?max/distance:1;
  const resolved=slide(player,{x:player.x+(p.x-player.x)*ratio,z:player.z+(p.z-player.z)*ratio},player.zone);
  if(player.computerOpen&&Math.hypot(resolved.x-player.x,resolved.z-player.z)>.01)endComputer(room,id);
  Object.assign(player,resolved,{yaw:p.yaw,lastMove:now});
}
export function publicState(room,id){
  const {targets,records,terminals,intrusions,challenges,remoteTargets,remoteSessions,extractions,sales,...rest}=room;
  return {...rest,sales:salesPublic(room),...remotePublic(room,id),nightsRemaining:room.phase==='night'?nightsRemaining(room.day):(room.summary?.nightsRemaining??nightsRemaining(room.day)),now:Date.now(),earnings:income(room),alley:{...room.alley,phase:phase(room.alley,Date.now()),clue:clue(room.alley,Date.now())},door:{...room.door,phase:phase(room.door,Date.now()),clue:clue(room.door,Date.now())},players:Object.values(room.players).map(({lastMove,...p})=>p),challenge:challenges[id]||null,terminal:terminals[id]||null,intrusion:intrusions[id]||null,
    discovered:Object.entries(records).filter(([,r])=>r.discovered).map(([code,r])=>({code,kind:r.kind,sold:r.sold,value:r.value,target:r.target})),
    targets:Object.keys(targets),targetInfo:Object.values(targets).map(({name,tier,job})=>({name,tier,job}))};
}
export function beginIntrusion(room,id,training=false){
  const player=room.players[id];
  if(room.phase!=='night'||!player?.computerOpen||!player.connected||!atComputer(player)||player.hidden||player.stunnedUntil>Date.now()||!room.environment.power)return false;
  if(room.intrusions[id])return false;
  if(room.horror?.active)return false;
  if(!training&&(Date.now()<(room.nextHack||0)||Date.now()<(room.horror?.recoveryUntil||0)||room.horror?.active||Object.keys(room.intrusions).length))return false;
  if(!training)room.nextHack=Date.now()+90000;
  const sequence=Array.from({length:6+Math.min(3,room.day-1)+Math.floor(Math.random()*2)},()=>pick(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown']));
  room.intrusions[id]={sequence,index:0,expires:Date.now()+(training?30000:9500)+(room.upgrades.includes('firewall')?4000:0),duration:(training?30000:9500)+(room.upgrades.includes('firewall')?4000:0),training};
  log(room,'INTRUSION ALERT: '+room.players[id].name+"'s workstation is under attack!");
  room.heat=clamp(room.heat+3,0,100);return true;
}
function loseIntrusion(room,id){
  if(!room.intrusions[id])return;
  delete room.intrusions[id];
  const loss=Math.min(room.bank,Math.ceil(room.bank*(room.upgrades.includes('vault')?.06:.18)));
  spend(room,loss,true);room.heat=clamp(room.heat+8,0,100);
  log(room,room.players[id]?.name+' was breached. $'+loss+' drained from the digital wallet.');
}
export function endComputer(room,id){
  const p=room.players[id];if(!p)return;
  p.computerOpen=false;
  if(room.intrusions[id]?.training)delete room.intrusions[id];
  else if(room.intrusions[id])loseIntrusion(room,id);
}
export function intrusionInput(room,id,key){
  const a=room.intrusions[id];if(!a)return {ok:false,text:'No intrusion in progress.'};
  if(Date.now()>a.expires){loseIntrusion(room,id);return {ok:false,text:'TOO LATE. Wallet breached.'};}
  const aliases={w:'ArrowUp',a:'ArrowLeft',s:'ArrowDown',d:'ArrowRight'};
  const k=aliases[String(key).toLowerCase()]||key;
  if(k!==a.sequence[a.index]){loseIntrusion(room,id);return {ok:false,text:'WRONG KEY. Wallet breached.'};}
  a.index++;
  if(a.index===a.sequence.length){delete room.intrusions[id];log(room,room.players[id].name+' blocked the connection.');return {ok:true,text:'INTRUSION BLOCKED. Funds safe.'};}
  return {ok:true,text:'Blocked '+a.index+'/'+a.sequence.length};
}
const dirNames=t=>Object.keys(t.folders);
function scrape(room,id,target,folder){
  const contents=target.folders[folder];
  if(!contents)return 'Folder not found.';
  const state=room.terminals[id],now=Date.now();
  if(now<(state.nextScan||0))return 'Probe cooling down. Read documents while the scanner clears.';
  state.nextScan=now+8000;room.scans++;
  const found=Object.keys(room.records).filter(code=>room.records[code].target===target.name&&room.records[code].folder===folder);
  const recovered=room.scans===1||Math.random()<.55?found:[];
  for(const code of recovered)room.records[code].discovered=true;
  const decoys=folder==='photos'?[]:['REF-'+Math.floor(10000+Math.random()*89000),'INV-'+Math.floor(1000+Math.random()*8500)];
  room.heat=clamp(room.heat+target.tier,0,100);
  if(room.scans%10===0&&Math.random()<.3)beginIntrusion(room,id);
  return 'Scanning '+target.name+':/'+folder+' ...\n'+(recovered.length+decoys.length?[...recovered,...decoys].map((c,i)=>'['+(i+1)+'] '+c).join('\n'):'No notable records found.')+'\nCheck possible records in BLACK MARKET.';
}
export function terminalCommand(room,id,line){
  const state=room.terminals[id];if(!state)return {text:'Session unavailable.'};
  const player=room.players[id];if(player?.hidden||player?.zone==='hall'||player?.stunnedUntil>Date.now())return {text:'Return to your workstation when it is safe.'};
  const words=String(line||'').trim().split(/\s+/);const verb=(words[0]||'').toLowerCase();
  const active=state.target&&room.targets[state.target];
  if(room.phase!=='night')return {text:'The shift is closed.'};
  if(!room.environment.power)return {text:'NO POWER. Reset the breaker in the hallway.'};
  if(room.intrusions[id])return {text:'SYSTEM LOCKED — repel the intrusion first.'};
  let output='';
  if(verb==='help')output='AVAILABLE: help, targets, connect NAME, ls, pwd, cd NAME, cd .., cat FILE, scrape [FOLDER], cd scrape FOLDER, disconnect, training\nAll recovered records are local to this session.';
  else if(verb==='targets')output=Object.values(room.targets).map(x=>'● '+x.name+' · TIER '+x.tier+' · '+x.job).join('\n');
  else if(verb==='connect'){
    const name=(words[1]||'').toUpperCase();
    if(!room.targets[name])output='Unknown simulated target. Use "targets".';
    else if(room.targets[name].tier>Math.min(3,room.day))output='Target locked until night '+room.targets[name].tier+'.';
    else if(room.targets[name].tier===3&&!room.upgrades.includes('decoder'))output='Tier 3 decoder required. Visit relay.onion.';
    else{state.target=name;state.cwd='/';output='Dialing '+name+' ...\nCONNECTION ESTABLISHED.\nUse "ls" to explore its five folders.';}
  }
  else if(verb==='disconnect'){state.target=null;state.cwd='/';output='Remote session closed.';}
  else if(verb==='training'){beginIntrusion(room,id,true);output='TRAINING ALARM: defend using arrows or WASD.';}
  else if(!active)output='Not connected. Try "targets" then "connect NOVA-17".';
  else if(verb==='pwd')output=active.name+':'+state.cwd;
  else if(verb==='ls')output=state.cwd==='/'?dirNames(active).map(x=>x+'/').join('    '):Object.keys(active.folders[state.cwd.slice(1)]||{}).join('    ');
  else if(verb==='cd'&&words[1]?.toLowerCase()==='scrape')output=scrape(room,id,active,words[2]||state.cwd.slice(1));
  else if(verb==='cd'){
    const path=(words[1]||'').toLowerCase();
    if(path==='..'||path==='/')state.cwd='/';
    else if(active.folders[path])state.cwd='/'+path;
    else output='No such directory: '+path;
    if(!output)output='Current directory: '+state.cwd;
  }
  else if(verb==='cat'){
    if(state.cwd==='/')output='Choose a folder first: cd documents';
    else output=active.folders[state.cwd.slice(1)]?.[words[1]]||'File not found.';
  }
  else if(verb==='scrape'){
    const folder=words[1]||state.cwd.slice(1);
    output=folder?scrape(room,id,active,folder):'Choose a folder: scrape finances';
  }
  else output='Unknown command. Use "help".';
  state.seen=[...state.seen,String(line||'')].slice(-20);
  return {text:output,target:state.target,cwd:state.cwd,delay:verb==='scrape'||(verb==='cd'&&words[1]==='scrape')?1100:350};
}
const fail=text=>({ok:false,text});
export function gameAction(room,id,action,payload={}){
  const now=Date.now(),p=room.players[id];payload=payload||{};
  if(!p)return fail('Player missing.');
  if(action==='computer:leave'){endComputer(room,id);return {ok:true,text:'Workstation closed.'};}
  if(action==='ending:vote'){const result=endingAction(room,id,payload,now);if(room.phase==='night')replenish(room,now);return result;}
  if(action==='start'){
    if(room.phase!=='lobby')return fail('Shift already started.');
    room.started=true;room.phase='night';room.nightEnds=now+NIGHT_MS;room.lastTick=now;
    replenish(room,now);return {ok:true,text:'Four minutes until dawn. Keep the door locked.'};
  }
  if(action==='night:next'){
    if(room.phase!=='summary')return fail('The crew cannot advance yet.');
    nextNight(room,now);replenish(room,now);return {ok:true,text:'Night '+room.day+'. New quota. Stay sharp.'};
  }
  if(room.phase!=='night')return fail('The shift is closed.');
  if(now>=room.nightEnds){tick(room,now);return fail('Dawn. Review the shift ledger.');}
  if(action==='computer:enter'){
    if(!atComputer(p)||p.hidden||p.stunnedUntil>now)return fail('Reach a workstation first.');
    p.computerOpen=true;return {ok:true,text:'Workstation online.'};
  }
  if(room.curtains?.owner===id&&!action.startsWith('curtain:'))horrorAction(room,p,'curtain:release',now);
  if(p.stunnedUntil>now)return fail('Catch your breath.');
  if(p.hidden&&action!=='hide:leave')return fail('Leave the wardrobe first.');
  if(/^(hide:|hall:|curtain:|garden:|pack:|door:|breaker:|alley:)/.test(action)&&p.computerOpen)endComputer(room,id);
  const physical=horrorAction(room,p,action,now);if(physical)return physical;
  const station=action.startsWith('garden:')?'garden':action.startsWith('pack:')?'packaging':action.startsWith('door:')?'door':action==='alley:drop'?'chute':action==='breaker:reset'?'breaker':null;
  if(station&&!atStation(p,station))return fail('Walk to the '+station+' first.');
  if(action==='breaker:reset'&&p.zone!=='hall')return fail('The fuse box is outside in the hallway.');
  const digital=['buy','market:verify','market:sell'];
  const isDigital=digital.includes(action)||/^(remote:|contract:|exchange:|sales:)/.test(action);
  if(isDigital&&(p.hidden||p.zone==='hall'))return fail('Return to the workstation.');
  if(isDigital&&!room.environment.power)return fail('NO POWER. Reset the breaker.');
  if(isDigital&&room.intrusions[id])return fail('Repel the intrusion first.');
  for(const handler of [exchangeAction,contractAction,remoteAction,salesAction]){const result=handler(room,id,action,payload,now);if(result)return result;}
  let message='';
  if(action==='market:verify'||action==='market:sell'){
    const code=String(payload.code||'').trim().toUpperCase(),r=room.records[code];
    if(!r||!r.discovered)return fail('NOT RECOGNIZED — this code has not been recovered.');
    if(r.kind==='JUNK')return fail('INVALID RECORD — random data, no payout.');
    if(r.sold)return fail('ALREADY SOLD — this record has been exhausted.');
    if(action==='market:verify')return {ok:true,text:'VALID '+PRODUCTS[r.kind].name.toUpperCase()+' — $'+r.value+' offer available.'};
    r.sold=true;earn(room,'hacking',r.value);room.heat=clamp(room.heat+3,0,100);message='Sale completed. +$'+r.value+'.';
  }else if(action==='message:send'){
    if(!room.environment.power)return fail('The relay is offline.');
    const text=String(payload.text||'').trim().slice(0,160);if(!text)return fail('Write a message first.');
    room.messages.unshift({id:uid(),from:p.name,text,time:now});room.messages=room.messages.slice(0,20);
    return {ok:true,text:'Sent to the crew.'};
  }else if(action==='buy'){
    const item=String(payload.item||''),entry=CATALOG[item];
    if(!Object.hasOwn(CATALOG,item))return fail('Unknown listing.');
    if(room.bank<entry.price)return fail('Insufficient funds.');
    if(!entry.supply&&room.upgrades.includes(item))return fail('Already installed.');
    if(room.pending.length>=8)return fail('Courier bag full. Collect your supplies first.');
    spend(room,entry.price);
    if(entry.supply){room.pending.push({item,amount:entry.amount,arrives:now+6500});if(room.door.visitor==='empty')room.door=visitor('courier',now,'door');message='Order dispatched. Collect the taped parcel at your door.';}
    else{room.upgrades.push(item);message=entry.name+' installed.';}
  }else if(action.startsWith('garden:')){
    const g=room.garden,inv=room.inventory;
    if(action==='garden:soil'){
      if(g.soil||g.planted||!inv.soil)return fail('Needs an empty pot and substrate.');
      inv.soil--;g.soil=true;message='Substrate tipped into the pot.';
    }else if(action==='garden:plant'){
      if(!g.soil||g.planted||!inv.seeds)return fail('Prepare a pot and collect seed capsules first.');
      inv.seeds--;g.planted=true;g.growth=0;g.moisture=0;message='Capsule planted. Pick up the watering can.';
    }else if(action==='garden:water'){
      if(!g.planted)return fail('Plant a capsule first.');
      g.moisture=100;message='Water poured. Reservoir full.';
    }else if(action==='garden:light'){g.light=!g.light;message=g.light?'Grow lamp on.':'Grow lamp off.';}
    else if(action==='garden:harvest'){
      if(!g.planted||g.growth<100)return fail('The crop is still growing.');
      if(p.carrying)return fail('Take your harvest to the packing table first.');
      p.carrying=room.upgrades.includes('tools')?4:3;Object.assign(g,{soil:false,planted:false,growth:0,moisture:0});message='Harvest in hand. Carry it to the packing table.';
    }else return fail('Unknown growing action.');
  }else if(action==='pack:deposit'){
    if(!p.carrying)return fail('Your hands are empty.');
    room.inventory.buds+=p.carrying;p.carrying=0;message='Harvest placed on the table.';
  }else if(action==='pack:seal'){
    if(room.inventory.buds<1||room.inventory.wrap<1)return fail('Needs harvest and sealing sleeves.');
    room.inventory.buds--;room.inventory.wrap--;room.inventory.packages++;message='Folded. Sealed. Ready for the chute.';
  }else if(action==='door:peek')return {ok:true,text:clue(room.door,now)};
  else if(action==='door:open'){
    if(phase(room.door,now)!=='waiting')return fail('Nobody is waiting at the door.');
    if(room.door.visitor==='courier'){
      const ready=room.pending.filter(x=>x.arrives<=now);
      if(!ready.length)return fail('The courier has no parcel ready for you.');
      for(const item of ready)room.inventory[item.item]+=item.amount;
      room.pending=room.pending.filter(x=>x.arrives>now);room.horror.locked=true;message='Supplies received. Door secured.';
    }else{const loss=spend(room,95+room.day*20,true);room.heat=clamp(room.heat+15,0,100);room.environment.power=false;openedIntruder(room,now);message='The stranger forced the lock. Lost $'+loss+'. Reset the damaged breaker.';}
    room.door.leaveAt=now;room.door.next=now+6000;
  }else if(action==='door:brace'){
    room.horror.locked=true;
    if(room.horror.active?.kind==='door'){room.horror.active.braced=true;room.horror.active=null;room.horror.recoveryUntil=now+30000;}
    if(room.door.visitor==='empty')return fail('The door is already secure.');
    room.door.leaveAt=now;room.door.next=now+6000;room.heat=Math.max(0,room.heat-3);message='Chain secured. The footsteps retreat.';
  }else if(action==='breaker:reset'){
    room.environment.power=true;room.environment.warning=null;message='Breaker reset. Power restored.';
  }else return fail('Unknown interaction.');
  if(station)p.activity={id:uid(),action,until:now+900};
  log(room,message);return {ok:true,text:message};
}
function replenish(room,now){
  seedRemote(room,now);
  seedSales(room,now);seedContracts(room,now);
}
export function schedulePowerOutage(room,now=Date.now(),roll=Math.random()){
  const env=room.environment;
  if(!env.power||env.warning||now<(env.nextOutageAt||0)||roll>=.25)return false;
  env.warning={at:now+12000};env.nextOutageAt=now+300000;
  log(room,'The ballast is buzzing. The fuse box is outside: check the peephole first.');
  return true;
}
export function tick(room,now=Date.now()){
  if(room.phase==='collector')return tickCollector(room,now);
  if(room.phase==='breach'){
    if(now>=room.breach.ends){room.phase='lost';room.horror.active=null;
      const gross=income(room);room.summary={day:room.day,...room.ledger,gross,net:gross-room.ledger.expenses-room.ledger.losses,quota:room.quota,quotaPaid:0,cycleEnd:false,bank:room.bank,nightsRemaining:nightsRemaining(room.day)};
    }
    return true;
  }
  if(room.phase==='ending'){const result=tickEnding(room,now);if(room.phase==='night')replenish(room,now);return result;}
  if(room.phase!=='night')return false;
  if(now>=room.nightEnds){finishNight(room,room.nightEnds);return true;}
  const elapsed=Math.max(0,now-room.lastTick),dt=Math.min(elapsed,2000)/1000;room.lastTick=now;
  tickRemote(room,now,elapsed);
  tickHorror(room,now);
  tickExchange(room,now);tickContracts(room,now,elapsed);tickSales(room,now,elapsed);
  const g=room.garden;
  if(g.planted){
    if(g.moisture>0&&g.light&&room.environment.power)g.growth=Math.min(100,g.growth+dt*100/(room.upgrades.includes('lamp')?42:60));
    g.moisture=Math.max(0,g.moisture-dt*(room.upgrades.includes('irrigation')?.55:1.1));
  }
  for(const [id,intr] of Object.entries(room.intrusions))if(now>=intr.expires)loseIntrusion(room,id);
  if(room.horror.active||!room.environment.power)for(const c of Object.values(room.challenges)){c.expires+=elapsed;c.revealUntil+=elapsed;c.windowStart+=elapsed;c.windowEnd+=elapsed;}
  for(const [id,c] of Object.entries(room.challenges))if(now>=c.expires){delete room.challenges[id];const job=room.contracts.find(j=>j.id===c.id);if(job){job.owner=null;job.expires=now;}log(room,'A contract signal expired.');}
  for(const key of ['alley','door'])if(room[key].next<=now){
    const was=room[key].visitor;
    if(was!=='empty'){room[key]={visitor:'empty',next:now+7000};}
    else{
      const kind=key==='alley'?pick(['thief','stranger','police','searcher','pedestrian']):room.pending.length?'courier':'empty';
      room[key]=kind==='empty'?{visitor:'empty',next:now+20000}:visitor(kind,now,key);
      if(kind!=='empty')log(room,key==='door'?'Footsteps in the hallway. Check the peephole.':'Movement near the dead drop.');
    }
  }
  if(now>=room.nextTarget){
    const i=room.targetSerial++,name=pick(['MOTH','DUSK','ASH','VAULT'])+'-'+i;
    // Bound the live archive without deleting a connected player's target.
    const connected=new Set(Object.values(room.terminals).map(t=>t.target));
    if(Object.keys(room.targets).length>=12){const old=Object.keys(room.targets).find(n=>!connected.has(n));if(old){delete room.targets[old];for(const [code,r]of Object.entries(room.records))if(r.target===old&&!r.discovered)delete room.records[code];}}
    room.targets[name]=makeTarget(name,Math.min(i,room.day*4-1),room.records);
    room.nextTarget=now+40000;replenish(room,now);log(room,'Fresh archives and contracts arrived on the network.');
  }
  if(room.environment.warning&&now>=room.environment.warning.at){room.environment.power=false;room.environment.warning=null;log(room,'POWER LOST. Reset the breaker in the hallway.');}
  if(now>=room.nextEvent&&!room.horror.active&&now>=room.horror.recoveryUntil&&!Object.keys(room.intrusions).length){
    const options=room.day===1?['door','echo','power','camera','hack']:['door','window','hall','echo','power','camera','hack'];
    const choice=room.policePending?'hall':pick(options);
    if(room.policePending&&startEncounter(room,'hall',now)){room.policePending=false;room.horror.active.patrol=true;}
    if(!room.horror.active&&['door','window','hall','echo'].includes(choice))startEncounter(room,choice,now);
    else if(choice==='power')schedulePowerOutage(room,now);
    else if(choice==='camera'){room.environment.cameraUntil=now+(room.upgrades.includes('camera')?4000:10000);log(room,'Camera signal unstable. Wait for a clear view before dropping.');}
    else if(choice==='hack'){const id=pick(Object.keys(room.players).filter(id=>room.players[id].connected&&room.players[id].computerOpen&&atComputer(room.players[id])&&!room.players[id].hidden));if(id)beginIntrusion(room,id);}
    room.nextEvent=now+Math.max(42000,78000-room.day*4500-(room.loop||0)*3000)+Math.random()*14000;
  }
  return true;
}
