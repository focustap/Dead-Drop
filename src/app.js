import {bindBlackMarket} from './blackmarket.js';
import {remoteView,bindDesktop} from './remote.js';
import {browserView,resolveSite} from './browser.js';
import {Soundscape} from './audio.js';
import {World} from './world.js';
import {io} from 'socket.io-client';
import {newRoom,addPlayer,movePlayer,publicState,terminalCommand,gameAction,intrusionInput,tick} from '../shared/core.js';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>'$'+Math.max(0,Math.floor(n||0)).toLocaleString();
const audio=new Soundscape();
let lastScare=null,curtainHolding=false,curtainPulsePending=false,lastCollector=null;
let stationOpen=null,site='market',browserHistory=[],summaryKey='',serverOffset=0,stationSignature='',lastRenderedView='';
let settings={sensitivity:1,volume:.35,quality:'medium',reducedEffects:false};try{Object.assign(settings,JSON.parse(localStorage.getItem('dead-drop-settings')||'{}'));}catch{}
const gameNow=()=>Date.now()+serverOffset;
let state=null,local=null,self=null,socket=null,remote=false,tab='terminal',panelOpen=false,guideOpen=false,viewOpen=null,active=false,toastTimeout=null;
let termHistory=[{cmd:'',text:'DEAD DROP TERMINAL v0.3\nSYSTEM READY. Enter "help" to list commands.'}],scanBusy=false,nearby=null,lastIntrusion=false;
let lastStateSignature='',inFlight=false,marketCode='',marketResult='AWAITING INPUT...',marketSale='';
const notify=text=>{const e=$('toast');e.textContent=text;e.classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>e.classList.remove('show'),4000);};
function rawState(){
  if(!local)return;
  state=publicState(local,self);
  const p=state.players.find(p=>p.id===self);if(p&&world.zone!==p.zone){world.pos.x=p.x;world.pos.z=p.z;}
  refresh();
}
function receive(s){
  state=s;serverOffset=s.now-Date.now();
  const authoritative=s.players.find(p=>p.id===self);
  if(active&&authoritative&&(world.zone!==authoritative.zone||Math.hypot(world.pos.x-authoritative.x,world.pos.z-authoritative.z)>.8)){world.pos.x=authoritative.x;world.pos.z=authoritative.z;}
  refresh();
}
function updateHud(){
  if(!state)return;
  $('bank').textContent=fmt(state.bank);$('heat').textContent=state.heat+'%';$('day').textContent=state.day+'/6';$('roomCode').textContent=state.code;
  let log=state.log?.[0];$('status').textContent=log?.text||'THE APARTMENT IS QUIET... FOR NOW.';
  world.setOthers(state.players,self);
  world.setVisitors(state.alley,state.door);world.updateGame(state,gameNow());audio.update(state);
  $('panel').classList.toggle('powerOff',!state.environment.power);
  $('panel').querySelector('.panelFooter span').textContent=state.environment.power?'NETWORK ONLINE':'POWER LOST · RESET THE BREAKER';
  $('clock').textContent=new Date(Math.max(0,state.nightEnds-gameNow())).toISOString().slice(14,19);
  $('quota').textContent=fmt(state.bank)+' / '+fmt(state.quota);
  $('quotaDue').textContent='CYCLE '+(Math.floor((state.day-1)/3)+1)+(state.summary?.quotaPaid?' PAID':' / '+state.nightsRemaining+' NIGHT'+(state.nightsRemaining===1?'':'S')+' LEFT');
  $('quotaFill').style.width=(state.summary?.quotaPaid?100:Math.min(100,state.bank/state.quota*100))+'%';
  $('carry').textContent=state.players.find(p=>p.id===self)?.carrying?'CARRYING HARVEST → PACKING TABLE':'';
  renderStation();renderSummary();renderHorror();renderEnding();
  if(viewOpen==='peephole')audio.peep(state.horror.peep,gameNow());
  if(viewOpen){
    const v=viewOpen==='alley'?state.alley?.visitor:state.door?.visitor;
    $('surveillance').dataset.visitor=v||'empty';
    $('surveillancePresence').textContent=(viewOpen==='alley'?state.alley:state.door)?.clue||'No movement.';
    if(viewOpen==='peephole')$('surveillanceInstruction').textContent=state.horror.peep&&gameNow()<state.horror.peep.ends?"I wouldn't go outside right now...":'LOOK THROUGH THE DOOR';
    $('surveillance').classList.toggle('signalLost',viewOpen==='alley'&&(!state.environment.power||state.environment.cameraUntil>gameNow()));
    $('surveillanceStamp').textContent=new Date().toLocaleTimeString('en-GB',{hour12:false});
  }
}
async function command(event,payload={}){
  if(remote){
    if(!socket?.connected){notify('SIGNAL LOST');return {ok:false,text:'Connection offline.'};}
    try{
      const res=await socket.timeout(8000).emitWithAck('game:action',{event,payload});
      if(!res.ok)notify(res.text||'Action rejected.');
      return res;
    }catch{notify('NO RESPONSE FROM SERVER');return {ok:false,text:'Connection timed out.'};}
  }
  let response;
  if(event==='terminal')response={ok:true,...terminalCommand(local,self,payload.line)};
  else if(event==='intrusion')response=intrusionInput(local,self,payload.key);
  else response=gameAction(local,self,event,payload);
  rawState();
  return response;
}
function enter(){
  active=true;audio.start();audio.setVolume(Number(settings.volume));audio.reducedEffects=!!settings.reducedEffects;document.body.classList.toggle('reducedEffects',!!settings.reducedEffects);world.applySettings(settings);$('hud').classList.remove('hidden');$('lobby').classList.add('hidden');
  $('lookPrompt')?.remove();$('prompt').textContent='CLICK TO LOOK AROUND · WASD TO MOVE';
  const current=state.players?.find(p=>p.id===self);
  world.pos.set(current?.x??-1.2,1.65,current?.z??-.75);world.yaw=current?.yaw||0;
  refresh();
  if(!sessionStorage.getItem('dead-drop-guide')){openGuide();sessionStorage.setItem('dead-drop-guide','seen');}
}
function refresh(){
  if(!state)return;
  updateHud();
  const intr=panelOpen?state.intrusion:null;
  if(intr&&!lastIntrusion){audio.alarm();if(viewOpen)closeView();lastIntrusion=true;document.exitPointerLock?.();$('intrusion').classList.remove('hidden');$('panel').classList.add('hidden');notify('INTRUSION DETECTED');}
  else if(!intr&&lastIntrusion){lastIntrusion=false;$('intrusion').classList.add('hidden');if(panelOpen)$('panel').classList.remove('hidden');notify('SYSTEM RESPONSE COMPLETE');}
  if(panelOpen&&!intr&&!inFlight&&!$('computerView').querySelector('[data-dragging="true"]')){
    const signature=JSON.stringify([tab,state.bank,state.heat,state.inventory,state.messages,state.contracts,state.orders,state.pending,state.door,state.alley,state.upgrades,state.terminal,state.discovered,state.remoteListings,state.remoteSession?{...state.remoteSession,suspicion:Math.ceil(state.remoteSession.suspicion),ownerActivity:state.remoteSession.ownerActivity.phase}:null,state.exchange,state.sales,state.extracted,state.log?.[0]?.id]);
    if(signature!==lastStateSignature){lastStateSignature=signature;renderPanel();}
  }
}
async function start(mode){
  const alias=$('playerName').value.trim()||'Ghost',url=$('serverUrl').value.trim();
  if(mode==='solo'){
    remote=false;self='solo-1';local=newRoom();addPlayer(local,self,alias);
    gameAction(local,self,'start');rawState();enter();return;
  }
  if(!url){notify('ADD YOUR CO-OP SERVER URL FIRST');return;}
  try{
    const u=new URL(url);
    if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('Use a server origin, like https://example.onrender.com');
    if(u.protocol==='http:'&&!['localhost','127.0.0.1'].includes(u.hostname))throw Error('Use HTTPS.');
    const conn=io(u.origin,{transports:['websocket','polling'],timeout:18000,reconnection:true});
    const timeout=setTimeout(()=>{if(!conn.connected)conn.disconnect();},22000);
    conn.on('connect_error',e=>notify('CONNECTION ERROR: '+e.message.slice(0,90)));
    conn.on('state',s=>receive(s));
    conn.on('peers',players=>world.setOthers(players,self));
    conn.on('disconnect',()=>{closePanel();stopCurtains();notify('CONNECTION LOST — RECONNECTING');});
    await new Promise((resolve,reject)=>{if(conn.connected)return resolve();conn.once('connect',resolve);conn.once('connect_error',reject);});
    clearTimeout(timeout);
    const res=await conn.timeout(7000).emitWithAck(mode==='create'?'room:create':'room:join',{name:alias,code:$('joinCode').value.trim().toUpperCase()});
    if(!res.ok)throw Error(res.text||'Could not join room');
    socket=conn;remote=true;self=res.playerId;state=res.state;serverOffset=state.now-Date.now();enter();
    const token=res.token;
    conn.on('connect',async()=>{try{const resumed=await conn.timeout(7000).emitWithAck('room:resume',{token});if(!resumed.ok){notify(resumed.text);return;}self=resumed.playerId;receive(resumed.state);notify('RECONNECTED TO '+resumed.code);}catch{notify('RECONNECT FAILED. Your slot is held for two minutes.');}});
    notify('CONNECTED: '+res.code);
  }catch(error){socket?.disconnect();notify(error.message||'CO-OP UNAVAILABLE');}
}
function release(){if(document.pointerLockElement)document.exitPointerLock();}
async function openPanel(which='terminal'){
  if(!state||state.intrusion||state.phase!=='night')return;
  panelOpen=true;const result=await command('computer:enter');if(!result.ok){closePanel();notify(result.text);return;}
  if(!panelOpen||state.phase!=='night'){void command('computer:leave');return;}
  release();tab=which;lastStateSignature='';
  $('panel').classList.remove('hidden');
  renderPanel();
}
function closePanel(){const wasOpen=panelOpen;panelOpen=false;$('panel').classList.add('hidden');if(wasOpen){void command('computer:leave');}}
function openView(mode){
  if(!state||state.intrusion||state.phase!=='night')return;
  release();closePanel();
  if(mode==='peephole')void command('door:peek');
  viewOpen=mode;world.setView(mode);
  const overlay=$('surveillance');overlay.classList.remove('hidden');overlay.dataset.view=mode;
  $('surveillanceName').textContent=mode==='alley'?'CAM 01 // BACK ALLEY':'SUPPLY DOOR // PEEPHOLE';
  $('doorControls').classList.toggle('hidden',mode!=='peephole');
  $('surveillanceInstruction').textContent=mode==='alley'?'RAIN MONITORING ACTIVE':'LOOK THROUGH THE DOOR';
  updateHud();
}
function closeView(){if(!viewOpen)return;if(viewOpen==='peephole')void command('door:unpeek');viewOpen=null;world.setView(null);$('surveillance').classList.add('hidden');}
function openGuide(){release();if(panelOpen)closePanel();guideOpen=true;$('guide').classList.remove('hidden');}
function closeGuide(){guideOpen=false;$('guide').classList.add('hidden');}
function goInteract(t){
  if(!t)return;
  if(t.id==='computer')openPanel('terminal');
  else if(t.id==='garden'||t.id==='packaging'||t.id==='breaker')openStation(t.id);
  else if(t.id==='hide'){command('hide:enter').then(r=>{notify(r.text);if(r.ok)release();});}
  else if(t.id==='return'){command('hall:return').then(r=>notify(r.text));}
  else if(t.id==='camera')openView('alley');
  else if(t.id==='peephole')openView('peephole');
  else if(t.id==='door'||t.id==='chute'){
    if(t.id==='door'){openView('peephole');return;}
    let key='alley:drop';
    command(key).then(r=>{notify(r.text||'INTERACTION COMPLETE');});
  }
}
function viewTerminal(){
  const prefix=state.terminal?.target||'local';
  const cwd=state.terminal?.cwd||'/';
  return '<div class="terminal"><div class="terminalTop"><span>● PRIVATE SHELL</span><span>'+esc(prefix)+':'+esc(cwd)+'</span></div>'+
    '<div id="terminalLog" class="terminalLog">'+termHistory.map(e=>'<div class="cmd">'+(e.cmd?'root@dead-drop:~$ '+esc(e.cmd):'')+'</div><div class="output">'+esc(e.text)+'</div>').join('')+'</div>'+
    '<form id="terminalForm" class="consoleForm"><label for="terminalInput">root@'+esc(prefix)+':~$</label><input id="terminalInput" autocomplete="off" spellcheck="false" maxlength="140" placeholder="type help"><button aria-label="Execute command">↵</button></form></div>';
}
function evidence(){return '<div class="section"><h3>LOCAL EVIDENCE</h3>'+state.extracted.map(x=>`<div class="listing"><div><b>${esc(x.title)}</b><small>${esc(x.from)} / ${x.failed?'DEADLINE MISSED':'DELIVER BEFORE LEASE EXPIRES'}</small></div><button data-evidence="${esc(x.id)}" ${x.sold||x.failed?'disabled':''}>${x.sold?'SOLD':x.failed?'EXPIRED':'SELL $'+x.payout}</button></div>`).join('')+'</div>';}
function market(){
  const found=state.discovered||[];
  return evidence()+'<div class="split"><div class="section"><div class="tag">EXCHANGE // RECORD MARKET</div><h3>VERIFY RECORD</h3><p>Test recovered REC-codes, then sell verified data.</p><form id="verifyForm" class="form"><input id="verifyInput" maxlength="25" placeholder="REC-XXXX-XXXX" autocomplete="off" value="'+esc(marketCode)+'"><button>VERIFY</button></form><p id="verifyResult" class="green">'+esc(marketResult)+'</p><form id="sellForm" class="form"><input id="sellInput" maxlength="25" placeholder="REC-XXXX-XXXX"><button>SELL</button></form><p id="sellResult" class="muted">'+esc(marketSale)+'</p></div>'+
    '<div class="section"><h3>RECOVERED RECORDS</h3><div class="list">'+(found.length?found.map(r=>'<div class="listing"><div><b>'+esc(r.code)+'</b><small>'+esc(r.target)+' · '+(r.sold?'SOLD':'UNVERIFIED / UNSOLD')+'</small></div><button data-verify="'+esc(r.code)+'">CHECK</button></div>').join(''):'<p>NO RECORDS YET. USE THE TERMINAL.</p>')+'</div></div></div>';
}
function security(){
  return '<div class="split"><div class="section"><div class="tag">CAM 01 // REAR ALLEY</div><h3>DROP POINT</h3><p>The CCTV monitor shows a live view of the rainy alley.</p><div class="form"><button id="viewAlley">VIEW LIVE CCTV</button></div><p>PACKAGED INVENTORY: '+state.inventory.packages+'</p></div>'+
    '<div class="section"><div class="tag">SUPPLY ENTRANCE</div><h3>PEEPHOLE</h3><p>Walk to the supply door to use its peephole. Couriers carry a parcel.</p><div class="form"></div><p>Incoming orders: '+state.pending.length+'</p></div></div><div class="section"><h3>HIDEOUT ACTIVITY</h3><div class="list">'+state.log.slice(0,7).map(e=>'<div class="listing">'+esc(e.text)+'</div>').join('')+'</div></div>';
}
function renderPanel(){
  if(!panelOpen||state?.intrusion||$('computerView').querySelector('[data-dragging="true"]'))return;
  const sameView=lastRenderedView===tab+':'+site,focused=document.activeElement?.id;
  const drafts=sameView?[...$('computerView').querySelectorAll('input')].map(el=>({id:el.id,value:el.value,start:el.selectionStart,end:el.selectionEnd})):[];
  lastRenderedView=tab+':'+site;
  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('chosen',b.dataset.tab===tab));
  const el=$('computerView');el.innerHTML=tab==='terminal'?viewTerminal():tab==='remote'?remoteView(state):tab==='market'?market():tab==='browser'?browserView(state,site,market()):security();
  if(tab==='terminal'){
    const form=$('terminalForm'),inp=$('terminalInput');
    form.onsubmit=async e=>{
      e.preventDefault();if(scanBusy)return;
      const line=inp.value.trim();if(!line)return;
      termHistory.push({cmd:line,text:'WORKING...'});inp.value='';renderPanel();scanBusy=true;
      const entry=termHistory[termHistory.length-1];
      const result=await command('terminal',{line});
      await new Promise(resolve=>setTimeout(resolve,Math.min(1300,result?.delay||180)));
      entry.text=result?.text||'No reply.';scanBusy=false;
      if(panelOpen && !state.intrusion && tab==='terminal'){renderPanel();$('terminalInput')?.focus();}
    };
    $('terminalLog').scrollTop=$('terminalLog').scrollHeight;inp?.focus();
  }
  el.querySelectorAll('[data-evidence]').forEach(b=>b.onclick=async()=>{const r=await command('remote:sell',{id:b.dataset.evidence});notify(r.text);renderPanel();});
  if(tab==='remote'){
    const act=async(action,payload={})=>{const r=await command('remote:'+action,payload);notify(r.text);renderPanel();};
    el.querySelectorAll('[data-port]').forEach(b=>b.onclick=()=>act('route',{port:b.dataset.port}));
    el.querySelectorAll('[data-folder]').forEach(b=>b.onclick=()=>act('folder',{folder:b.dataset.folder}));
    el.querySelectorAll('[data-file]').forEach(b=>b.onclick=()=>act('read',{file:b.dataset.file}));
    el.querySelectorAll('[data-remote]').forEach(b=>b.onclick=()=>act(b.dataset.remote));
    if($('remoteSolve'))$('remoteSolve').onsubmit=e=>{e.preventDefault();act('solve',{answer:$('remoteAnswer').value});};
    bindDesktop(el,state.remoteSession,act);
    if($('findRemote'))$('findRemote').onclick=()=>navigate('contracts');
  }
  if(tab==='market'||(tab==='browser'&&site==='records')){
    $('verifyInput').oninput=e=>{marketCode=e.target.value;};
    $('verifyForm').onsubmit=async e=>{e.preventDefault();const code=$('verifyInput').value;marketCode=code;const r=await command('market:verify',{code});marketResult=r.text;renderPanel();};
    $('sellForm').onsubmit=async e=>{e.preventDefault();const code=$('sellInput').value;const r=await command('market:sell',{code});marketSale=r.text;notify(r.text);renderPanel();};
    document.querySelectorAll('[data-verify]').forEach(b=>b.onclick=()=>{marketCode=b.dataset.verify;$('verifyInput').value=marketCode;$('verifyForm').requestSubmit();});
  }
  if(tab==='browser'){
    bindBlackMarket(el,state,command,notify,renderPanel);
    el.querySelectorAll('[data-remote-target]').forEach(b=>b.onclick=async()=>{const r=await command('remote:start',{id:b.dataset.remoteTarget});notify(r.text);if(r.ok){tab='remote';renderPanel();}});
    el.querySelectorAll('[data-buy]').forEach(b=>b.onclick=async()=>{const r=await command('buy',{item:b.dataset.buy});notify(r.text);renderPanel();});
    el.querySelectorAll('[data-site]').forEach(b=>b.onclick=()=>navigate(b.dataset.site));
    el.querySelectorAll('[data-contract]').forEach(b=>b.onclick=async()=>{const r=await command('contract:start',{id:b.dataset.contract});notify(r.text);});
    el.querySelector('[data-nav]').onclick=()=>{site=browserHistory.pop()||'market';renderPanel();};
    $('addressForm').onsubmit=e=>{e.preventDefault();const next=resolveSite($('address').value);if(next)navigate(next);else notify('HOST NOT FOUND');};
    if($('messageForm'))$('messageForm').onsubmit=async e=>{e.preventDefault();const text=$('messageInput').value;const r=await command('message:send',{text});notify(r.text);if(r.ok&&$('messageInput'))$('messageInput').value='';renderPanel();};
  }
  if(tab==='security'){
    $('viewAlley').onclick=()=>openView('alley');
  }
  for(const draft of drafts){const input=$(draft.id);if(input){input.value=draft.value;if(draft.id===focused){input.focus({preventScroll:true});if(draft.start!==null)input.setSelectionRange(draft.start,draft.end);}}}
}
function renderIntrusion(){
  const a=state?.intrusion;
  if(!a)return;
  const directions={ArrowLeft:'←',ArrowRight:'→',ArrowUp:'↑',ArrowDown:'↓'};
  const arrows=$('arrows');
  arrows.innerHTML=a.sequence.map((key,i)=>'<span class="'+(i<a.index?'done':i===a.index?'current':'')+'">'+directions[key]+'</span>').join('');
  const remaining=Math.max(0,a.expires-gameNow());
  $('timerFill').style.width=(remaining/a.duration*100)+'%';
  $('timerText').textContent=(remaining/1000).toFixed(1)+'s';
}
function navigate(next){browserHistory.push(site);site=next;tab='browser';renderPanel();}
function openStation(id){release();stationOpen=id;stationSignature='';world.focusStation(id);$('stationFeedback').textContent='';$('station').classList.remove('hidden');world.keys.clear();renderStation();}
function closeStation(){stationOpen=null;$('station').classList.add('hidden');}
function renderStation(){
  if(!stationOpen||!state)return;
  const g=state.garden,inv=state.inventory,p=state.players.find(p=>p.id===self),button=(action,text)=>`<button data-action="${action}">${text}</button>`;
  const measures=()=>{if($('growthValue'))$('growthValue').textContent=Math.floor(g.growth)+'%';if($('moistureValue'))$('moistureValue').textContent=Math.floor(g.moisture);if($('growthFill'))$('growthFill').style.width=g.growth+'%';if($('growthLabel'))$('growthLabel').textContent=g.planted?(g.growth>=100?'READY TO CUT':'CROP IN PROGRESS'):g.soil?'POT PREPARED':'EMPTY POT';};
  const signature=JSON.stringify([stationOpen,inv,g.soil,g.planted,g.light,state.environment.power,!!state.environment.warning,p?.carrying]);
  if(stationSignature===signature){if(stationOpen==='garden')measures();return;}stationSignature=signature;
  $('stationTitle').textContent=stationOpen==='garden'?'GROW TENT':stationOpen==='packaging'?'PACKING TABLE':'FUSE BOX';
  let content='';
  if(stationOpen==='garden')content=`<div class="stationReadout"><span>${g.planted?(g.growth>=100?'READY TO CUT':'CROP IN PROGRESS'):g.soil?'POT PREPARED':'EMPTY POT'}</span><b>${Math.floor(g.growth)}%</b></div><div class="growthTrack"><i style="width:${g.growth}%"></i></div><p>MOISTURE ${Math.floor(g.moisture)}% · LAMP ${g.light?'ON':'OFF'} · ${state.environment.power?'POWER ON':'NO POWER'}</p><div class="stationTools">${button('garden:soil','01 · TIP SOIL ('+inv.soil+')')}${button('garden:plant','02 · PLACE SEED ('+inv.seeds+')')}${button('garden:water','03 · POUR WATER')}${button('garden:harvest','04 · CUT & CARRY')}${button('garden:light','TOGGLE LAMP')}</div><small>Fill the pot, place a capsule, keep it watered. Carry the harvest to the separate table.</small>`;
  else if(stationOpen==='packaging')content=`<div class="stationReadout"><span>READY FOR DISPATCH</span><b>${inv.packages}</b></div><p>IN HAND ${p?.carrying||0} · ON TABLE ${inv.buds} · SLEEVES ${inv.wrap}</p><div class="stationTools">${button('pack:deposit','SET HARVEST DOWN')}${button('pack:seal','FOLD & SEAL PACKAGE')}</div><small>Check the alley camera, then carry a sealed package to the chute.</small>`;
  else content=`<div class="stationReadout"><span>${state.environment.warning?'BALLAST OVERLOAD':state.environment.power?'CIRCUIT LIVE':'CIRCUIT TRIPPED'}</span></div><p>The computers and grow lamp share this breaker.</p>${button('breaker:reset','RESET BREAKER')}`;
  content=content.replace('<b>'+Math.floor(g.growth)+'%</b>','<b id="growthValue">'+Math.floor(g.growth)+'%</b>').replace('MOISTURE '+Math.floor(g.moisture)+'%','MOISTURE <span id="moistureValue">'+Math.floor(g.moisture)+'</span>%').replace('<i style="width:','<i id="growthFill" style="width:').replace('<div class="stationReadout"><span>','<div class="stationReadout"><span id="growthLabel">');
  const focus=document.activeElement?.dataset.action;
  $('stationBody').innerHTML=content;
  if(focus)$('stationBody').querySelector(`[data-action="${focus}"]`)?.focus({preventScroll:true});
}
function renderSummary(){
  const closed=['summary','won','lost'].includes(state.phase);
  $('nightSummary').classList.toggle('hidden',!closed);
  if(!closed){summaryKey='';return;}
  const key=state.phase+state.day;if(summaryKey===key)return;summaryKey=key;
  release();closePanel();closeStation();closeView();closeGuide();
  const s=state.summary;
  $('summaryTitle').textContent=state.phase==='won'?'THE CREW GOT OUT':state.phase==='lost'?'THE LINE WENT DEAD':'DAWN / NIGHT '+s.day;
  $('summaryText').textContent=state.reason||(s.cycleEnd?'Quota paid. The next three nights are yours.':s.nightsRemaining+' night'+(s.nightsRemaining===1?'':'s')+' left. Keep the quota money in your wallet.');
  $('summaryLedger').innerHTML=[['ARCHIVE SALES',s.hacking],['SHARE SALES',s.trading||0],['CONTRACTS',s.contracts],['DELIVERIES',s.deliveries],['SUPPLIES / EQUIPMENT',-(s.expenses-s.quotaPaid)],['QUOTA PAYMENT',-s.quotaPaid],['LOSSES',-s.losses],['NET',s.net]].map(([label,value])=>`<div><span>${label}</span><b>${value<0?'−':''}${fmt(Math.abs(value))}</b></div>`).join('')+`<p>SHIFT INCOME ${fmt(s.gross)}<br>CYCLE QUOTA ${fmt(s.quota)} ${s.quotaPaid?'PAID':'DUE AFTER NIGHT '+(state.day<=3?'3':'6')}<br>WALLET ${fmt(s.bank)}</p>`;
  if(state.phase==='won'){$('summaryLedger').innerHTML+=`<p>CREW ${state.players.map(p=>esc(p.name)).join(' / ')}<br>${state.history.length} NIGHTS SURVIVED / ${state.loop||0} HARDER CAMPAIGNS<br>TOTAL QUOTAS PAID ${fmt(state.history.reduce((n,h)=>n+h.quotaPaid,0))}<br>TOTAL OPERATION INCOME ${fmt(state.history.reduce((n,h)=>n+h.gross,0))}</p><p>DEAD DROP · focustap<br>Thank you for playing.</p>`;}
  $('nextNight').classList.toggle('hidden',state.phase!=='summary');
}
const world=new World($('scene'),{
  canMove:()=>!curtainHolding&&!state?.players.find(p=>p.id===self)?.hidden&&!(state?.players.find(p=>p.id===self)?.stunnedUntil>gameNow())&&active&&(!remote||socket?.connected)&&state?.phase==='night'&&!panelOpen&&!stationOpen&&!guideOpen&&!viewOpen&&!state?.intrusion,
  onLock:locked=>{if(!active)return;if(!locked&&!panelOpen&&!stationOpen&&!guideOpen&&!viewOpen&&!state?.intrusion)$('prompt').textContent='CLICK ROOM TO LOOK · WASD MOVE';},
  onMove:pos=>{if(remote){if(socket?.connected)socket.emit('player:move',pos);}else if(local){movePlayer(local,self,pos);}},
  onFocus:focus=>{nearby=focus;if(!(state?.players.find(p=>p.id===self)?.stunnedUntil>gameNow())&&active&&state?.phase==='night'&&!panelOpen&&!stationOpen&&!guideOpen&&!viewOpen&&!state?.intrusion)$('prompt').textContent=focus?(focus.id==='curtains'?'[HOLD E] KEEP CURTAINS SHUT':'[E] '+focus.label):(document.pointerLockElement===world.renderer.domElement?'':'CLICK ROOM TO LOOK · WASD MOVE');else $('prompt').textContent='';}
});
window.addEventListener('keydown',async e=>{
  if(state?.players.find(p=>p.id===self)?.hidden){if(e.code==='KeyE'||e.key==='Escape'){e.preventDefault();await command('hide:leave');}return;}
  if(state?.intrusion){
    if(e.key==='Escape'){e.preventDefault();closePanel();return;}
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyW','KeyA','KeyS','KeyD'].includes(e.code)){
      e.preventDefault();const key=e.code.startsWith('Key')?e.code.slice(3).toLowerCase():e.code;
      const r=await command('intrusion',{key});if(!r.ok)notify(r.text);renderIntrusion();
    }return;
  }
  if(e.key==='Escape'){
    if(stationOpen){closeStation();return;}
    if(viewOpen){closeView();return;}
    if(guideOpen){closeGuide();return;}
    if(panelOpen){closePanel();return;}
    openGuide();return;
  }
  if(e.code==='KeyE'&&!panelOpen&&!stationOpen&&!guideOpen&&!viewOpen&&active&&state?.phase==='night'){e.preventDefault();if(nearby?.id==='curtains'){if(!e.repeat&&!curtainHolding){curtainHolding=true;audio.tone(190,.45,.06);world.keys.clear();void pulseCurtains();}return;}goInteract(nearby);}
});
$('solo').onclick=()=>start('solo');$('createRoom').onclick=()=>start('create');$('joinRoom').onclick=()=>start('join');
$('closePanel').onclick=closePanel;
$('closeSurveillance').onclick=closeView;
$('openGuide').onclick=openGuide;$('closeGuide').onclick=closeGuide;$('guideOkay').onclick=closeGuide;
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;lastStateSignature='';renderPanel();});
window.__deadDropReady = true;
setInterval(()=>{
  if(!active)return;
  if(local){tick(local);rawState();}
  renderIntrusion();document.querySelectorAll('[data-deadline]').forEach(el=>{el.textContent=Math.max(0,Math.ceil((Number(el.dataset.deadline)-gameNow())/1000))+'s';});if(remote)updateHud();if($('remoteClock'))$('remoteClock').textContent=Math.ceil(Math.max(0,(state.remoteSession?.expires||gameNow())-gameNow())/1000)+'s '+(state.horror.active||!state.environment.power?'PAUSED':'LEASE');
},180);

$('closeStation').onclick=closeStation;
$('stationBody').onclick=async e=>{const b=e.target.closest('[data-action]');if(!b)return;const r=await command(b.dataset.action);$('stationFeedback').textContent=r.text;audio.tone(r.ok?500:120,.18,.12);world.stationFeedback(b.dataset.action);};
$('nextNight').onclick=async()=>{const r=await command('night:next');notify(r.text);};
$('returnLobby').onclick=()=>location.reload();
for(const [id,key] of [['sensitivity','sensitivity'],['volume','volume'],['quality','quality'],['reducedEffects','reducedEffects']]){const el=$(id);if(key==='reducedEffects')el.checked=!!settings[key];else el.value=settings[key];el.oninput=()=>{settings[key]=key==='reducedEffects'?el.checked:key==='quality'?el.value:Number(el.value);localStorage.setItem('dead-drop-settings',JSON.stringify(settings));world.applySettings(settings);audio.setVolume(settings.volume);audio.reducedEffects=!!settings.reducedEffects;document.body.classList.toggle('reducedEffects',!!settings.reducedEffects);};}

$('openDoorView').onclick=async()=>{const r=await command('door:open');notify(r.text);};
$('braceDoorView').onclick=async()=>{const r=await command('door:brace');notify(r.text);};

function renderHorror(){
  const p=state.players.find(p=>p.id===self),a=state.horror.active,now=gameNow();
  $('toggleBolt').textContent=state.horror.locked?'UNLOCK BOLT':'LOCK BOLT';
  $('enterHall').disabled=state.horror.locked;
  $('hiding').classList.toggle('hidden',!p?.hidden||state.phase!=='night');
  $('hideStatus').textContent=a?.kind==='window'?'KEEP STILL / '+(a.phase==='warning'?'TAPPING AT THE GLASS':Math.ceil(Math.max(0,a.ends-now)/1000)+'s UNTIL FOOTSTEPS FADE'):'QUIET / YOU CAN LEAVE';
  const threatText=a?({door:'LATCH RATTLING / '+(state.horror.locked?'BOLT LOCKED':'BOLT UNLOCKED'),window:a.phase==='retreating'?'THE PROWLER IS LEAVING':a.phase==='warning'?'PROWLER OUTSIDE / HOLD E AT THE CURTAINS':a.phase==='stalking'?'FOOTSTEPS CROSS THE ROOM':'WINDOW BREACHED / FIND COVER',hall:a.phase==='warning'?'HEAVY FOOTSTEPS APPROACHING':'SHADOW IN THE HALLWAY / WAIT INSIDE',echo:'A SOUND FROM THE EMPTY ROOMS'})[a.kind]:'';
  const held=state.curtains;if(curtainHolding&&(held?.closed||a?.kind!=='window'||a.phase!=='warning'))stopCurtains();
  $('curtainHold').classList.toggle('hidden',!curtainHolding);$('curtainHoldText').textContent=held?.owner===self?'HOLD E / '+Math.min(5,(now-held.started)/1000).toFixed(1)+' / 5s':'TAKING THE CURTAINS';
  if(state.phase==='collector'){if(lastCollector!==state.collector.start){lastCollector=state.collector.start;closePanel();closeStation();closeView();closeGuide();release();audio.collector();} }
  $('horrorStatus').textContent=state.phase==='collector'?'QUOTA UNPAID / THE COLLECTOR IS HERE':state.phase==='breach'?'THE LOCKSMITH IS INSIDE':a?.kind==='door'&&a.phase==='warning'?'THE HANDLE IS TURNING / BRACE THE DOOR':threatText;$('horrorStatus').classList.toggle('hidden',!a&&!['collector','breach'].includes(state.phase));
  const caught=p?.scare&&p.scare.until>now;$('scareShade').classList.toggle('hidden',!caught);
  if(caught&&lastScare!==state.day+':'+p.scare.id){lastScare=state.day+':'+p.scare.id;closePanel();closeStation();closeView();closeGuide();release();if(p.scare.kind==='collector')audio.sting('collector');else audio.sting(p.scare.kind);notify(p.scare.kind==='collector'?'The Collector has come for payment.':'You were found. Catch your breath.');}
}
$('toggleBolt').onclick=async()=>{const r=await command(state.horror.locked?'door:unlock':'door:lock');notify(r.text);};
$('enterHall').onclick=async()=>{const r=await command('hall:enter');notify(r.text);if(r.ok)closeView();};
$('leaveHide').onclick=()=>command('hide:leave');


async function pulseCurtains(){
  if(!curtainHolding||curtainPulsePending)return;curtainPulsePending=true;
  try{const r=await command('curtain:hold');if(!r.ok)stopCurtains();}finally{curtainPulsePending=false;}
}
function stopCurtains(){if(!curtainHolding)return;curtainHolding=false;void command('curtain:release');}
window.addEventListener('keyup',e=>{if(e.code==='KeyE')stopCurtains();});
window.addEventListener('blur',()=>{stopCurtains();if(panelOpen)closePanel();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopCurtains();if(panelOpen)closePanel();}});
setInterval(()=>{if(curtainHolding)void pulseCurtains();},250);

let endingEntered=null,endingStage=-1;
function renderEnding(){
  const shown=state.phase==='ending',el=$('ending');el.classList.toggle('hidden',!shown);if(!shown){endingEntered=null;endingStage=-1;return;}
  const age=gameNow()-state.ending.start,stage=age<3500?0:age<7000?1:age<12000?2:3;
  if(endingEntered!==state.ending.start){endingEntered=state.ending.start;release();closePanel();closeStation();closeView();closeGuide();}
  if(stage!==endingStage){endingStage=stage;if(stage===1)[0,350,800].forEach(delay=>setTimeout(()=>audio.tone(85,.23,.12),delay));}
  $('endingMessage').textContent=['CONTACT: Both payments received. Your debt is cleared.','The rain is the only sound. Then, three knocks.','THE COLLECTOR: Six nights. Every dollar. You have earned your way out.','An envelope slides across the threshold. One more address. One more contract.'][stage];
  $('endingChoices').classList.toggle('hidden',stage<3);
  $('endingVotes').textContent=state.players.filter(p=>p.connected).map(p=>p.name+': '+(state.ending.votes[p.id]||'deciding')).join(' / ');
  $('endingTimer').textContent=Math.max(0,Math.ceil((state.ending.deadline-gameNow())/1000))+'s / Majority decides. Ties and missing votes leave safely.';
}
document.querySelectorAll('[data-ending]').forEach(b=>b.onclick=async()=>{const r=await command('ending:vote',{choice:b.dataset.ending});notify(r.text);});
