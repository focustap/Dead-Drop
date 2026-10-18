import {browserView,resolveSite} from './browser.js';
import {Soundscape} from './audio.js';
import {World} from './world.js';
import {io} from 'socket.io-client';
import {newRoom,addPlayer,movePlayer,publicState,terminalCommand,gameAction,intrusionInput,tick} from '../shared/core.js';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>'$'+Math.max(0,Math.floor(n||0)).toLocaleString();
const audio=new Soundscape();
let stationOpen=null,site='market',browserHistory=[],summaryKey='',serverOffset=0,stationSignature='',lastRenderedView='';
let settings={sensitivity:1,volume:.35,quality:'medium'};try{Object.assign(settings,JSON.parse(localStorage.getItem('dead-drop-settings')||'{}'));}catch{}
const gameNow=()=>Date.now()+serverOffset;
let state=null,local=null,self=null,socket=null,remote=false,tab='terminal',panelOpen=false,guideOpen=false,viewOpen=null,active=false,toastTimeout=null;
let termHistory=[{cmd:'',text:'DEAD DROP TERMINAL v0.2\nSYSTEM READY. Enter "help" to list commands.'}],scanBusy=false,nearby=null,lastIntrusion=false;
let lastStateSignature='',inFlight=false,marketCode='',marketResult='AWAITING INPUT...',marketSale='';
const notify=text=>{const e=$('toast');e.textContent=text;e.classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>e.classList.remove('show'),4000);};
function rawState(){
  if(!local)return;
  state=publicState(local,self);
  refresh();
}
function receive(s){
  state=s;serverOffset=s.now-Date.now();
  const authoritative=s.players.find(p=>p.id===self);
  if(active&&authoritative&&Math.hypot(world.pos.x-authoritative.x,world.pos.z-authoritative.z)>.8){world.pos.x=authoritative.x;world.pos.z=authoritative.z;}
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
  $('quota').textContent=fmt(state.earnings)+' / '+fmt(state.quota);
  $('quotaFill').style.width=Math.min(100,state.earnings/state.quota*100)+'%';
  $('carry').textContent=state.players.find(p=>p.id===self)?.carrying?'CARRYING HARVEST → PACKING TABLE':'';
  renderStation();renderSummary();
  if(viewOpen){
    const v=viewOpen==='alley'?state.alley?.visitor:state.door?.visitor;
    $('surveillance').dataset.visitor=v||'empty';
    $('surveillancePresence').textContent=(viewOpen==='alley'?state.alley:state.door)?.clue||'No movement.';
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
  active=true;audio.start();audio.setVolume(Number(settings.volume));world.applySettings(settings);$('hud').classList.remove('hidden');$('lobby').classList.add('hidden');
  $('lookPrompt')?.remove();$('prompt').textContent='CLICK TO LOOK AROUND · WASD TO MOVE';
  const current=state.players?.find(p=>p.id===self);
  world.pos.set(current?.x??-1.2,1.65,current?.z??-.75);world.yaw=current?.yaw||0;
  refresh();
  if(!sessionStorage.getItem('dead-drop-guide')){openGuide();sessionStorage.setItem('dead-drop-guide','seen');}
}
function refresh(){
  if(!state)return;
  updateHud();
  const intr=state.intrusion;
  if(intr&&!lastIntrusion){if(viewOpen)closeView();lastIntrusion=true;document.exitPointerLock?.();$('intrusion').classList.remove('hidden');$('panel').classList.add('hidden');notify('INTRUSION DETECTED');}
  else if(!intr&&lastIntrusion){lastIntrusion=false;$('intrusion').classList.add('hidden');if(panelOpen)$('panel').classList.remove('hidden');notify('SYSTEM RESPONSE COMPLETE');}
  if(panelOpen&&!intr&&!inFlight){
    const signature=JSON.stringify([tab,state.bank,state.heat,state.inventory,state.messages,state.contracts,state.orders,state.pending,state.door,state.alley,state.upgrades,state.terminal,state.discovered,state.log?.[0]?.id]);
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
    conn.on('disconnect',()=>notify('CONNECTION LOST — RECONNECTING'));
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
function openPanel(which='terminal'){
  if(!state||state.intrusion||state.phase!=='night')return;
  release();panelOpen=true;tab=which;lastStateSignature='';
  $('panel').classList.remove('hidden');
  renderPanel();
}
function closePanel(){panelOpen=false;$('panel').classList.add('hidden');}
function openView(mode){
  if(!state||state.intrusion||state.phase!=='night')return;
  release();panelOpen=false;$('panel').classList.add('hidden');
  viewOpen=mode;world.setView(mode);
  const overlay=$('surveillance');overlay.classList.remove('hidden');overlay.dataset.view=mode;
  $('surveillanceName').textContent=mode==='alley'?'CAM 01 // BACK ALLEY':'SUPPLY DOOR // PEEPHOLE';
  $('doorControls').classList.toggle('hidden',mode!=='peephole');
  $('surveillanceInstruction').textContent=mode==='alley'?'RAIN MONITORING ACTIVE':'LOOK THROUGH THE DOOR';
  updateHud();
}
function closeView(){if(!viewOpen)return;viewOpen=null;world.setView(null);$('surveillance').classList.add('hidden');}
function openGuide(){release();guideOpen=true;$('guide').classList.remove('hidden');}
function closeGuide(){guideOpen=false;$('guide').classList.add('hidden');}
function goInteract(t){
  if(!t)return;
  if(t.id==='computer')openPanel('terminal');
  else if(t.id==='garden'||t.id==='packaging'||t.id==='breaker')openStation(t.id);
  else if(t.id==='camera')openView('alley');
  else if(t.id==='peephole')openView('peephole');
  else if(t.id==='door'||t.id==='chute'){
    let key=t.id==='door'?'door:open':'alley:drop';
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
function market(){
  const found=state.discovered||[];
  return '<div class="split"><div class="section"><div class="tag">EXCHANGE // RECORD MARKET</div><h3>VERIFY RECORD</h3><p>Test recovered REC-codes, then sell verified data.</p><form id="verifyForm" class="form"><input id="verifyInput" maxlength="25" placeholder="REC-XXXX-XXXX" autocomplete="off" value="'+esc(marketCode)+'"><button>VERIFY</button></form><p id="verifyResult" class="green">'+esc(marketResult)+'</p><form id="sellForm" class="form"><input id="sellInput" maxlength="25" placeholder="REC-XXXX-XXXX"><button>SELL</button></form><p id="sellResult" class="muted">'+esc(marketSale)+'</p></div>'+
    '<div class="section"><h3>RECOVERED RECORDS</h3><div class="list">'+(found.length?found.map(r=>'<div class="listing"><div><b>'+esc(r.code)+'</b><small>'+esc(r.target)+' · '+(r.sold?'SOLD':'UNVERIFIED / UNSOLD')+'</small></div><button data-verify="'+esc(r.code)+'">CHECK</button></div>').join(''):'<p>NO RECORDS YET. USE THE TERMINAL.</p>')+'</div></div></div>';
}
function security(){
  return '<div class="split"><div class="section"><div class="tag">CAM 01 // REAR ALLEY</div><h3>DROP POINT</h3><p>The CCTV monitor shows a live view of the rainy alley.</p><div class="form"><button id="viewAlley">VIEW LIVE CCTV</button></div><p>PACKAGED INVENTORY: '+state.inventory.packages+'</p></div>'+
    '<div class="section"><div class="tag">SUPPLY ENTRANCE</div><h3>PEEPHOLE</h3><p>Walk to the supply door to use its peephole. Couriers carry a parcel.</p><div class="form"></div><p>Incoming orders: '+state.pending.length+'</p></div></div><div class="section"><h3>HIDEOUT ACTIVITY</h3><div class="list">'+state.log.slice(0,7).map(e=>'<div class="listing">'+esc(e.text)+'</div>').join('')+'</div></div>';
}
function renderPanel(){
  if(!panelOpen||state?.intrusion)return;
  const sameView=lastRenderedView===tab+':'+site,focused=document.activeElement?.id;
  const drafts=sameView?[...$('computerView').querySelectorAll('input')].map(el=>({id:el.id,value:el.value,start:el.selectionStart,end:el.selectionEnd})):[];
  lastRenderedView=tab+':'+site;
  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('chosen',b.dataset.tab===tab));
  const el=$('computerView');el.innerHTML=tab==='terminal'?viewTerminal():tab==='market'?market():tab==='browser'?browserView(state,site,market()):security();
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
  if(tab==='market'||(tab==='browser'&&site==='records')){
    $('verifyInput').oninput=e=>{marketCode=e.target.value;};
    $('verifyForm').onsubmit=async e=>{e.preventDefault();const code=$('verifyInput').value;marketCode=code;const r=await command('market:verify',{code});marketResult=r.text;renderPanel();};
    $('sellForm').onsubmit=async e=>{e.preventDefault();const code=$('sellInput').value;const r=await command('market:sell',{code});marketSale=r.text;notify(r.text);renderPanel();};
    document.querySelectorAll('[data-verify]').forEach(b=>b.onclick=()=>{marketCode=b.dataset.verify;$('verifyInput').value=marketCode;$('verifyForm').requestSubmit();});
  }
  if(tab==='browser'){
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
  for(const draft of drafts){const input=$(draft.id);if(input){input.value=draft.value;if(draft.id===focused){input.focus({preventScroll:true});input.setSelectionRange(draft.start,draft.end);}}}
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
  $('summaryText').textContent=state.reason||(s.met?'Quota cleared. Rest while you can.':'Quota missed. $60 penalty. Make it up before the cycle ends.');
  $('summaryLedger').innerHTML=[['ARCHIVE SALES',s.hacking],['CONTRACTS',s.contracts],['DELIVERIES',s.deliveries],['EXPENSES',-s.expenses],['LOSSES',-s.losses],['NET',s.net]].map(([label,value])=>`<div><span>${label}</span><b>${value<0?'−':''}${fmt(Math.abs(value))}</b></div>`).join('')+`<p>SHIFT ${fmt(s.gross)} / ${fmt(s.quota)}<br>CYCLE ${fmt(s.cycleEarned)} / ${fmt(s.cycleRequired)}<br>WALLET ${fmt(s.bank)}</p>`;
  $('nextNight').classList.toggle('hidden',state.phase!=='summary');
}
function renderChallenge(){
  const c=state?.challenge;$('contractChallenge').classList.toggle('hidden',!c);if(!c)return;
  release();const now=gameNow(),revealing=now<c.revealUntil;
  $('challengeTitle').textContent=c.type==='memory'?'MEMORY RELAY':'CARRIER INTERCEPT';
  $('challengeStatus').textContent=c.type==='memory'?(revealing?'REMEMBER '+c.sequence.join(' · '):'REPEAT THE SIGNAL / '+c.index+' RECEIVED'):'STOP WHEN THE CARRIER REACHES THE GREEN BAND';
  $('challengeClock').textContent=Math.max(0,(c.expires-now)/1000).toFixed(1)+'s';
  $('memoryKeys').classList.toggle('hidden',c.type!=='memory');$('pulseControl').classList.toggle('hidden',c.type!=='pulse');
  $('memoryKeys').querySelectorAll('button').forEach(b=>b.disabled=revealing);
  $('carrier').style.left=Math.max(0,Math.min(100,(now-(c.windowStart-2800))/6000*100))+'%';
}
const world=new World($('scene'),{
  canMove:()=>active&&(!remote||socket?.connected)&&state?.phase==='night'&&!panelOpen&&!stationOpen&&!guideOpen&&!viewOpen&&!state?.intrusion&&!state?.challenge,
  onLock:locked=>{if(!active)return;if(!locked&&!panelOpen&&!stationOpen&&!guideOpen&&!viewOpen&&!state?.intrusion)$('prompt').textContent='CLICK ROOM TO LOOK · WASD MOVE';},
  onMove:pos=>{if(remote){if(socket?.connected)socket.emit('player:move',pos);}else if(local){movePlayer(local,self,pos);}},
  onFocus:focus=>{nearby=focus;if(active&&state?.phase==='night'&&!panelOpen&&!stationOpen&&!guideOpen&&!viewOpen&&!state?.intrusion&&!state?.challenge)$('prompt').textContent=focus?'[E] '+focus.label:(document.pointerLockElement===world.renderer.domElement?'':'CLICK ROOM TO LOOK · WASD MOVE');else $('prompt').textContent='';}
});
window.addEventListener('keydown',async e=>{
  if(state?.intrusion){
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
  if(e.code==='KeyE'&&!panelOpen&&!stationOpen&&!guideOpen&&!viewOpen&&active&&state?.phase==='night'&&!state?.challenge){e.preventDefault();goInteract(nearby);}
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
  renderIntrusion();renderChallenge();if(remote)updateHud();
},180);

$('closeStation').onclick=closeStation;
$('stationBody').onclick=async e=>{const b=e.target.closest('[data-action]');if(!b)return;const r=await command(b.dataset.action);$('stationFeedback').textContent=r.text;audio.tone(r.ok?500:120,.18,.12);world.stationFeedback(b.dataset.action);};
$('nextNight').onclick=async()=>{const r=await command('night:next');notify(r.text);};
$('returnLobby').onclick=()=>location.reload();
$('memoryKeys').onclick=async e=>{const key=e.target.dataset.packet;if(key){const r=await command('contract:input',{key});if(!r.ok)notify(r.text);renderChallenge();}};
$('stopCarrier').onclick=async()=>{const r=await command('contract:input');notify(r.text);renderChallenge();};
for(const [id,key] of [['sensitivity','sensitivity'],['volume','volume'],['quality','quality']]){const el=$(id);el.value=settings[key];el.oninput=()=>{settings[key]=key==='quality'?el.value:Number(el.value);localStorage.setItem('dead-drop-settings',JSON.stringify(settings));world.applySettings(settings);audio.setVolume(settings.volume);};}

$('openDoorView').onclick=async()=>{const r=await command('door:open');notify(r.text);};
$('braceDoorView').onclick=async()=>{const r=await command('door:brace');notify(r.text);};
