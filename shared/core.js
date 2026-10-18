// Dead Drop's complete simulated game state. No real networks, accounts, or personal data.
const PRODUCTS = Object.freeze({
  CARD:{name:'Payment record',base:105}, ID:{name:'Identity record',base:140},
  WALLET:{name:'Wallet fragment',base:270}, JUNK:{name:'Unidentified data',base:0}
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
  return {name,folders};
}
export function newRoom(code='LOCAL'){
  const records={},targets=Object.fromEntries(TARGET_NAMES.map((n,i)=>[n,makeTarget(n,i,records)]));
  const now=Date.now();
  return {code,created:now,started:false,day:1,quota:650,bank:185,protected:0,heat:4,upgrades:[],players:{},terminals:{},intrusions:{},
    targets,records,scans:0,inventory:{seeds:0,plants:0,buds:0,wrap:2,packages:0,readyAt:0},
    pending:[],orders:[],alley:{visitor:'empty',next:now+14000},door:{visitor:'empty',next:now+23000},nightEnds:now+6*60000,
    log:[{id:uid(),time:now,text:'Hideout online. Your contacts are waiting. Visit a computer to begin.'}]};
}
export function addPlayer(room,id,name){
  const count=Object.keys(room.players).length;
  if(count>=4)throw Error('The hideout is full (4 players).');
  room.players[id]={id,name:String(name||'Runner').trim().slice(0,22)||'Runner',x:-1.2+(count%2)*2.2,z:1.6+Math.floor(count/2)*1.4,yaw:0};
  room.terminals[id]={target:null,cwd:'/',seen:[]};log(room,room.players[id].name+' entered the hideout.');
}
export function movePlayer(room,id,p){
  const player=room.players[id];if(!player)return;
  if(!Number.isFinite(p?.x)||!Number.isFinite(p?.z)||!Number.isFinite(p?.yaw))return;
  player.x=clamp(p.x,-4.15,4.15);player.z=clamp(p.z,-3.6,3.6);player.yaw=p.yaw;
}
export function publicState(room,id){
  const {targets,records,terminals,intrusions,...rest}=room;
  return {...rest,players:Object.values(room.players),terminal:terminals[id]||null,intrusion:intrusions[id]||null,
    discovered:Object.entries(records).filter(([,r])=>r.discovered).map(([code,r])=>({code,kind:r.kind,sold:r.sold,value:r.value,target:r.target})),
    targets:Object.keys(targets)};
}
function beginIntrusion(room,id){
  if(room.intrusions[id] || !room.players[id])return false;
  const sequence=Array.from({length:6+Math.floor(Math.random()*2)},()=>pick(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown']));
  room.intrusions[id]={sequence,index:0,expires:Date.now()+6500};
  log(room,'INTRUSION ALERT: '+room.players[id].name+"'s workstation is under attack!");
  room.heat=clamp(room.heat+3,0,100);return true;
}
function loseIntrusion(room,id){
  if(!room.intrusions[id])return;
  delete room.intrusions[id];
  const loss=Math.min(room.bank,Math.ceil(room.bank*(room.upgrades.includes('vault')?.06:.18)));
  room.bank-=loss;room.heat=clamp(room.heat+8,0,100);
  log(room,room.players[id]?.name+' was breached. $'+loss+' drained from the digital wallet.');
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
  room.scans++;
  const found=Object.keys(room.records).filter(code=>room.records[code].target===target.name&&room.records[code].folder===folder);
  for(const code of found)room.records[code].discovered=true;
  const decoys=folder==='photos'?[]:['REF-'+Math.floor(10000+Math.random()*89000),'INV-'+Math.floor(1000+Math.random()*8500)];
  room.heat=clamp(room.heat+2,0,100);
  if(room.scans%3===0)beginIntrusion(room,id);
  return 'Scanning '+target.name+':/'+folder+' ...\n'+(found.length+decoys.length?[...found,...decoys].map((c,i)=>'['+(i+1)+'] '+c).join('\n'):'No notable records found.')+'\nCheck possible records in BLACK MARKET.';
}
export function terminalCommand(room,id,line){
  const state=room.terminals[id];if(!state)return {text:'Session unavailable.'};
  const words=String(line||'').trim().split(/\s+/);const verb=(words[0]||'').toLowerCase();
  const active=state.target&&room.targets[state.target];
  if(room.intrusions[id])return {text:'SYSTEM LOCKED — repel the intrusion first.'};
  let output='';
  if(verb==='help')output='AVAILABLE: help, targets, connect NAME, ls, pwd, cd NAME, cd .., cat FILE, scrape [FOLDER], cd scrape FOLDER, disconnect, training\nAll remote systems and recovered records are generated inside this game.';
  else if(verb==='targets')output=Object.keys(room.targets).map(x=>'● '+x).join('\n');
  else if(verb==='connect'){
    const name=(words[1]||'').toUpperCase();
    if(!room.targets[name])output='Unknown simulated target. Use "targets".';
    else{state.target=name;state.cwd='/';output='Dialing '+name+' ...\nSIMULATED CONNECTION ESTABLISHED.\nUse "ls" to explore its five folders.';}
  }
  else if(verb==='disconnect'){state.target=null;state.cwd='/';output='Remote session closed.';}
  else if(verb==='training'){beginIntrusion(room,id);output='TRAINING ALARM: defend using arrows or WASD.';}
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
export function gameAction(room,id,action,payload={}){
  const now=Date.now();let message='';
  if(!room.players[id])return {ok:false,text:'Player missing.'};
  if(action==='start'){room.started=true;message='Night shift started. Keep your operation alive.';}
  else if(action==='market:verify'){
    const code=String(payload.code||'').trim().toUpperCase();
    const r=room.records[code];
    if(!r||!r.discovered)message='NOT RECOGNIZED — this code has not been recovered.';
    else if(r.kind==='JUNK')message='INVALID RECORD — random data, no payout.';
    else if(r.sold)message='ALREADY SOLD — this record has been exhausted.';
    else message='VALID '+PRODUCTS[r.kind].name.toUpperCase()+' — $'+r.value+' offer available.';
  }else if(action==='market:sell'){
    const code=String(payload.code||'').trim().toUpperCase(),r=room.records[code];
    if(!r||!r.discovered||r.sold||r.kind==='JUNK')message='Cannot sell this record.';
    else {r.sold=true;room.bank+=r.value;room.heat=clamp(room.heat+5,0,100);message='Sale completed. +$'+r.value+' added to wallet.';log(room,room.players[id].name+' sold a '+PRODUCTS[r.kind].name.toLowerCase()+'.');}
  }else if(action==='buy'){
    const items={seeds:55,wrap:25,firewall:220,vault:300};
    const item=String(payload.item||'');const price=items[item];
    if(!price)message='Unknown listing.';
    else if(room.bank<price)message='Insufficient funds.';
    else if(['firewall','vault'].includes(item)&&room.upgrades.includes(item))message='Already installed.';
    else{
      room.bank-=price;
      if(['firewall','vault'].includes(item)){room.upgrades.push(item);message='Software installed. '+item.toUpperCase()+' active.';}
      else {room.pending.push({item,arrives:now+6500});room.door={visitor:'courier',next:now+18000};message='Supply ordered. Check the peephole before opening the door.';}
    }
  }else if(action==='garden:plant'){
    if(room.inventory.seeds<1||room.inventory.plants>0)message='Requires seeds and an empty planter.';
    else {room.inventory.seeds--;room.inventory.plants=1;room.inventory.readyAt=now+35000;message='One crop started. It will be ready shortly.';}
  }else if(action==='garden:harvest'){
    if(!room.inventory.plants||now<room.inventory.readyAt)message='Nothing ready for harvest yet.';
    else {room.inventory.plants=0;room.inventory.buds+=2;message='Harvest ready. +2 units of inventory.';}
  }else if(action==='garden:package'){
    if(room.inventory.buds<1||room.inventory.wrap<1)message='Requires harvested inventory and packaging.';
    else {room.inventory.buds--;room.inventory.wrap--;room.inventory.packages++;message='Package sealed. One shipment ready for the alley chute.';}
  }else if(action==='alley:drop'){
    if(room.inventory.packages<1)message='No packed goods available.';
    else{
      room.inventory.packages--;
      if(room.alley.visitor==='buyer'){room.bank+=190;room.heat=clamp(room.heat+3,0,100);message='Pickup confirmed. +$190 received.';log(room,'A dead drop paid $190.');}
      else {message=room.alley.visitor==='thief'?'THIEF TOOK YOUR PACKAGE. No payment.':'Package left unattended. It vanished.';room.heat=clamp(room.heat+7,0,100);}
      room.alley={visitor:'empty',next:now+15000};
    }
  }else if(action==='door:peek')message=room.door.visitor==='empty'?'Quiet hallway. Nobody at the door.':room.door.visitor==='courier'?'A courier is standing outside with a parcel.':'Something is standing outside. It is NOT your courier.';
  else if(action==='door:open'){
    if(room.door.visitor==='courier'){
      for(const p of room.pending){if(p.item==='seeds')room.inventory.seeds+=2;else if(p.item==='wrap')room.inventory.wrap+=4;}
      room.pending=[];room.door={visitor:'empty',next:now+17000};message='Supplies received. Door secured.';
    }else if(room.door.visitor==='intruder'){
      const loss=Math.min(room.bank,95);room.bank-=loss;room.heat=clamp(room.heat+20,0,100);room.door={visitor:'empty',next:now+25000};message='INTRUDER! You barely escaped. Lost $'+loss+'.';log(room,'An intruder forced their way into the hideout.');
    }else message='You opened an empty hallway.';
  }
  else message='Unknown interaction.';
  return {ok:true,text:message};
}
export function tick(room,now=Date.now()){
  let changed=false;
  for(const [id,intr] of Object.entries(room.intrusions))if(now>=intr.expires){loseIntrusion(room,id);changed=true;}
  if(room.alley.next<=now){
    room.alley={visitor:pick(['buyer','buyer','thief','empty']),next:now+16000+Math.floor(Math.random()*13000)};
    if(room.alley.visitor!=='empty')log(room,room.alley.visitor==='buyer'?'The alley camera picked up someone waiting at the drop.':'Unidentified movement detected in the alley.');
    changed=true;
  }
  if(room.door.next<=now){
    room.door={visitor:room.pending.length?'courier':pick(['intruder','empty','empty']),next:now+26000};
    if(room.door.visitor!=='empty')log(room,'A knock came from the supply entrance.');
    changed=true;
  }
  if(room.inventory.plants&&room.inventory.readyAt<=now&&!room.inventory.announced){room.inventory.announced=true;log(room,'A crop is ready in the grow cabinet.');changed=true;}
  if(!room.inventory.plants)room.inventory.announced=false;
  return changed;
}
