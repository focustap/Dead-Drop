import {World} from './world.js';
import {io} from 'socket.io-client';
import {newRoom,addPlayer,movePlayer,publicState,terminalCommand,gameAction,intrusionInput,tick} from '../shared/core.js';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>'$'+Math.max(0,Math.floor(n||0)).toLocaleString();
let state=null,local=null,self=null,socket=null,remote=false,tab='terminal',panelOpen=false,guideOpen=false,viewOpen=null,active=false,toastTimeout=null;
let termHistory=[{cmd:'',text:'DEAD DROP TERMINAL v0.1\nSYSTEM READY. Enter "help" to list commands.'}],scanBusy=false,nearby=null,lastIntrusion=false;
let lastStateSignature='',inFlight=false,marketCode='',marketResult='AWAITING INPUT...',marketSale='';
const notify=text=>{const e=$('toast');e.textContent=text;e.classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>e.classList.remove('show'),4000);};
function rawState(){
  if(!local)return;
  state=publicState(local,self);
  refresh();
}
function receive(s){
  state=s;
  refresh();
}
function updateHud(){
  if(!state)return;
  $('bank').textContent=fmt(state.bank);$('heat').textContent=state.heat+'%';$('day').textContent=state.day+'/3';$('roomCode').textContent=state.code;
  let log=state.log?.[0];$('status').textContent=log?.text||'THE APARTMENT IS QUIET... FOR NOW.';
  world.setOthers(state.players,self);
  world.setVisitors(state.alley?.visitor||'empty',state.door?.visitor||'empty');
  if(viewOpen){
    const v=viewOpen==='alley'?state.alley?.visitor:state.door?.visitor;
    $('surveillance').dataset.visitor=v||'empty';
    $('surveillancePresence').textContent=v==='empty'?'NO ACTIVITY':viewOpen==='alley'?'MOTION DETECTED':'VISITOR AT DOOR';
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
  active=true;$('lobby').classList.add('hidden');
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
    const signature=JSON.stringify([tab,state.bank,state.heat,state.inventory,state.orders,state.pending,state.door,state.alley,state.upgrades,state.terminal,state.discovered,state.log?.[0]?.id]);
    if(signature!==lastStateSignature){lastStateSignature=signature;renderPanel();}
  }
}
async function start(mode){
  const alias=$('playerName').value.trim()||'Ghost',url=$('serverUrl').value.trim();
  if(mode==='solo'){
    remote=false;self='solo-1';local=newRoom();addPlayer(local,self,alias);
    rawState();enter();return;
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
    socket=conn;remote=true;self=res.playerId;state=res.state;enter();
    notify('CONNECTED: '+res.code);
  }catch(error){socket?.disconnect();notify(error.message||'CO-OP UNAVAILABLE');}
}
function release(){if(document.pointerLockElement)document.exitPointerLock();}
function openPanel(which='terminal'){
  if(!state||state.intrusion)return;
  release();panelOpen=true;tab=which;lastStateSignature='';
  $('panel').classList.remove('hidden');
  renderPanel();
}
function closePanel(){panelOpen=false;$('panel').classList.add('hidden');}
function openView(mode){
  if(!state||state.intrusion)return;
  release();panelOpen=false;$('panel').classList.add('hidden');
  viewOpen=mode;world.setView(mode);
  const overlay=$('surveillance');overlay.classList.remove('hidden');overlay.dataset.view=mode;
  $('surveillanceName').textContent=mode==='alley'?'CAM 01 // BACK ALLEY':'SUPPLY DOOR // PEEPHOLE';
  $('surveillanceInstruction').textContent=mode==='alley'?'RAIN MONITORING ACTIVE':'LOOK THROUGH THE DOOR';
  updateHud();
}
function closeView(){if(!viewOpen)return;viewOpen=null;world.setView(null);$('surveillance').classList.add('hidden');}
function openGuide(){release();guideOpen=true;$('guide').classList.remove('hidden');}
function closeGuide(){guideOpen=false;$('guide').classList.add('hidden');}
function goInteract(t){
  if(!t)return;
  if(t.id==='computer')openPanel('terminal');
  else if(t.id==='garden')openPanel('production');
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
function production(){
  const inv=state.inventory,remaining=Math.max(0,Math.ceil((inv.readyAt-Date.now())/1000));
  return '<div class="split"><div><div class="section"><div class="tag">SUPPLY TERMINAL</div><h3>ORDER SUPPLIES</h3><p>Incoming supplies appear at the apartment door. Use the peephole.</p><div class="list">'+
    [['seeds','SEED PACK','$55'],['wrap','PACKAGE WRAPS','$25'],['firewall','FIREWALL','$220'],['vault','WALLET VAULT','$300']].map(([id,name,price])=>'<div class="listing"><div><b>'+name+'</b><small>'+price+'</small></div><button data-buy="'+id+'">'+(state.upgrades.includes(id)?'INSTALLED':'BUY')+'</button></div>').join('')+
    '</div></div></div><div class="section"><div class="tag">GROW CABINET</div><h3>PRODUCTION LINE</h3><p>Seeds: <strong>'+inv.seeds+'</strong> · Harvest: <strong>'+inv.buds+'</strong> · Wraps: <strong>'+inv.wrap+'</strong> · Packed: <strong>'+inv.packages+'</strong></p><p>'+(inv.plants?'CROP GROWING · '+remaining+'s until harvest':'NO CROP IN PROGRESS')+'</p><div class="list"><button data-production="garden:plant">PLANT SEED</button><button data-production="garden:harvest">HARVEST</button><button data-production="garden:package">WRAP PACKAGE</button></div></div></div>';
}
function security(){
  const alley=state.alley.visitor,door=state.door.visitor;
  return '<div class="split"><div class="section"><div class="tag">CAM 01 // REAR ALLEY</div><h3>DROP POINT</h3><p>The CCTV monitor shows a live view of the rainy alley.</p><div class="form"><button id="viewAlley">VIEW LIVE CCTV</button><button id="dropFromPC">RELEASE PACKAGE</button></div><p>PACKAGED INVENTORY: '+state.inventory.packages+'</p></div>'+
    '<div class="section"><div class="tag">SUPPLY ENTRANCE</div><h3>PEEPHOLE</h3><p>Look through the door before letting anyone in.</p><div class="form"><button id="viewPeephole">LOOK THROUGH PEEPHOLE</button><button id="openDoorFromPC">OPEN DOOR</button></div><p>Incoming orders: '+state.pending.length+'</p></div></div><div class="section"><h3>HIDEOUT ACTIVITY</h3><div class="list">'+state.log.slice(0,7).map(e=>'<div class="listing">'+esc(e.text)+'</div>').join('')+'</div></div>';
}
function renderPanel(){
  if(!panelOpen||state?.intrusion)return;
  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('chosen',b.dataset.tab===tab));
  const el=$('computerView');el.innerHTML=tab==='terminal'?viewTerminal():tab==='market'?market():tab==='production'?production():security();
  el.querySelectorAll('button').forEach(b=>{});
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
  if(tab==='market'){
    $('verifyInput').oninput=e=>{marketCode=e.target.value;};
    $('verifyForm').onsubmit=async e=>{e.preventDefault();const code=$('verifyInput').value;marketCode=code;const r=await command('market:verify',{code});marketResult=r.text;renderPanel();};
    $('sellForm').onsubmit=async e=>{e.preventDefault();const code=$('sellInput').value;const r=await command('market:sell',{code});marketSale=r.text;notify(r.text);renderPanel();};
    document.querySelectorAll('[data-verify]').forEach(b=>b.onclick=()=>{marketCode=b.dataset.verify;$('verifyInput').value=marketCode;$('verifyForm').requestSubmit();});
  }
  if(tab==='production'){
    document.querySelectorAll('[data-buy]').forEach(b=>b.onclick=async()=>{const r=await command('buy',{item:b.dataset.buy});notify(r.text);renderPanel();});
    document.querySelectorAll('[data-production]').forEach(b=>b.onclick=async()=>{const r=await command(b.dataset.production);notify(r.text);renderPanel();});
  }
  if(tab==='security'){
    const bind=(id,action)=>{if($(id))$(id).onclick=async()=>{const r=await command(action);notify(r.text);renderPanel();};};
    bind('dropFromPC','alley:drop');bind('openDoorFromPC','door:open');
    $('viewAlley').onclick=()=>openView('alley');$('viewPeephole').onclick=()=>openView('peephole');
  }
}
function renderIntrusion(){
  const a=state?.intrusion;
  if(!a)return;
  const directions={ArrowLeft:'←',ArrowRight:'→',ArrowUp:'↑',ArrowDown:'↓'};
  const arrows=$('arrows');
  arrows.innerHTML=a.sequence.map((key,i)=>'<span class="'+(i<a.index?'done':i===a.index?'current':'')+'">'+directions[key]+'</span>').join('');
  const remaining=Math.max(0,a.expires-Date.now());
  $('timerFill').style.width=(remaining/9500*100)+'%';
  $('timerText').textContent=(remaining/1000).toFixed(1)+'s';
}
const world=new World($('scene'),{
  canMove:()=>active&&!panelOpen&&!guideOpen&&!viewOpen&&!state?.intrusion,
  onLock:locked=>{if(!active)return;if(!locked&&!panelOpen&&!guideOpen&&!viewOpen&&!state?.intrusion)$('prompt').textContent='CLICK ROOM TO LOOK · WASD MOVE';},
  onMove:pos=>{if(remote){if(socket?.connected)socket.emit('player:move',pos);}else if(local){movePlayer(local,self,pos);}},
  onFocus:focus=>{nearby=focus;if(active&&!panelOpen&&!guideOpen&&!viewOpen&&!state?.intrusion)$('prompt').textContent=focus?'[E] '+focus.label:(document.pointerLockElement===world.renderer.domElement?'':'CLICK ROOM TO LOOK · WASD MOVE');else $('prompt').textContent='';}
});
window.addEventListener('keydown',async e=>{
  if(state?.intrusion){
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyW','KeyA','KeyS','KeyD'].includes(e.code)){
      e.preventDefault();const key=e.code.startsWith('Key')?e.code.slice(3).toLowerCase():e.code;
      const r=await command('intrusion',{key});if(!r.ok)notify(r.text);renderIntrusion();
    }return;
  }
  if(e.key==='Escape'){
    if(viewOpen){closeView();return;}
    if(guideOpen){closeGuide();return;}
    if(panelOpen){closePanel();return;}
    release();return;
  }
  if(e.code==='KeyE'&&!panelOpen&&!guideOpen&&!viewOpen&&active){e.preventDefault();goInteract(nearby);}
});
$('solo').onclick=()=>start('solo');$('createRoom').onclick=()=>start('create');$('joinRoom').onclick=()=>start('join');
$('closePanel').onclick=closePanel;
$('closeSurveillance').onclick=closeView;
$('openGuide').onclick=openGuide;$('closeGuide').onclick=closeGuide;$('guideOkay').onclick=closeGuide;
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;lastStateSignature='';renderPanel();});
setInterval(()=>{
  if(!active)return;
  if(local){tick(local);rawState();}
  renderIntrusion();
},180);
