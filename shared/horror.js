import {spend,visitor} from './campaign.js';
import {atStation} from './layout.js';

export const THREATS=[
  {id:'collector',name:'The Collector',look:'A broad figure with a sealed case. Comes only for an unpaid quota.',sign:'The three-night payment deadline arrives with too little money in the crew wallet.',behavior:'Arrives after night three or six when the full quota cannot be collected. Ends the operation.',counter:'Keep $2,550 available by the end of night three, and $4,550 by the end of night six. Earnings spent on equipment cannot pay the Collector.',cost:'An unavoidable final encounter and the end of the run once payment has failed.'},
  {id:'door',name:'The Locksmith',look:'An empty-handed hood tests the handle.',sign:'Three slow knocks. The latch rattles.',behavior:'Waits outside, then tries an unlocked door after ten seconds.',counter:'Keep the bolt locked. Use the peephole; collect couriers without leaving the latch open.',cost:'One shared wallet loss, shock, and heat. Hiding protects individuals from the scare.'},
  {id:'window',name:'The Window Prowler',look:'A person in a weathered coat crosses the courtyard and peers through the glass.',sign:'Footsteps on wet paving, movement between the lights, then tapping at the window.',behavior:'Approaches for eight seconds, then searches the window for a way inside.',counter:'Stand at the window and HOLD E continuously for five seconds to keep both curtains shut. One operator protects everyone. Releasing early resets the hold and hastens the attack; hiding remains a last resort after entry.',cost:'An entry can shock exposed operators, destroy carried harvest and cause one bounded crew loss.'},
  {id:'hall',name:'The Tenant',look:'A tall figure in the corridor under a failing ceiling lamp.',sign:'Heavy footsteps, a red flicker, and a shadow visible through the peephole.',behavior:'Twelve seconds of approach, then ten seconds patrolling outside the apartment.',counter:'Check the peephole. Wait indoors until it leaves, then visit the hallway fuse box. If already outside, return through door 204.',cost:'Caught operators are forced inside and shocked. A single crew penalty applies.'},
  {id:'echo',name:'Empty Rooms',look:'Distant pedestrians and empty landings outside rain-streaked glass.',sign:'Distant banging, footsteps, or a short light flicker.',behavior:'A brief harmless disturbance, sometimes preceding a long silence.',counter:'Observe. Do not open the door just because something knocked.',cost:'None. Not every sound belongs to a visitor.'},
  {id:'hack',name:'Wallet Leech',look:'The workstation tears into a red security screen.',sign:'A sharp two-tone alarm and visual distortion.',behavior:'Only attacks an operator actively using a workstation. No queued attacks follow you outside the interface.',counter:'Enter the sequence with arrows or WASD. Leaving a live attack forfeits its defense and settles the wallet loss once. Firewall buys time; a cold wallet limits damage.',cost:'A bounded portion of shared funds is lost on a mistake or timeout.'},
  {id:'thief',name:'The Lifter',look:'A hood lingering away from the alley lamp, looking over a shoulder.',sign:'No phone check beside the red tray.',behavior:'Takes any package released to the chute.',counter:'Watch the live CCTV. Wait for a buyer checking a glowing phone.',cost:'One shipment and extra heat.'},
  {id:'power',name:'Bad Wiring',look:'The lamps buzz and dim before the terminals die.',sign:'Twelve seconds of ballast buzzing.',behavior:'Stops computers and plant growth until the hallway breaker is reset.',counter:'Check the peephole, enter the hallway, reset the box opposite door 204, and return. There is no deadline after the power trips.',cost:'Lost working time. Growing progress is preserved.'},
  {id:'camera',name:'Blind Spot',look:'Rolling noise replaces the alley feed.',sign:'Interference on both the monitor and fullscreen CCTV.',behavior:'Clears after ten seconds, or four with shielded wiring.',counter:'Wait for the feed before releasing a shipment.',cost:'No direct loss; a blind drop can feed a thief.'}
];
export function newHorror(now){return {locked:true,active:null,recoveryUntil:now+35000,serial:0,ambient:null};}
const result=(ok,text)=>({ok,text});
export function startEncounter(r,kind,now=Date.now()){
  const h=r.horror;
  if(!['door','window','hall','echo'].includes(kind)||h.active||now<h.recoveryUntil||Object.keys(r.intrusions).length)return false;
  if(kind==='door'&&r.door.visitor!=='empty')return false;
  h.active={id:++h.serial,kind,phase:'warning',start:now,attackAt:now+(kind==='door'?16500:12000),ends:now+(kind==='door'?21000:22000),caught:[],charged:false};
  if(kind==='window'){h.active.approachUntil=now+8000;h.active.attackAt=now+23000;h.active.ends=now+33000;r.curtains=null;}
  if(kind==='echo'){h.active.attackAt=now+4000;h.active.ends=now+6000;}
  if(kind==='door'){r.door=visitor('intruder',now,'door');r.door.next=now+27000;}
  r.log.unshift({id:'encounter-'+h.serial,time:now,text:kind==='window'?'Wet footsteps cross the courtyard. Someone is coming to the window.':kind==='hall'?'Heavy hallway footsteps. A long shadow passes the peephole.':kind==='door'?'Three slow knocks. Someone tests the latch.':'A heavy bang from the empty apartment upstairs.'});
  r.log=r.log.slice(0,18);return true;
}
function catchPlayers(r,event,players,now){
  const fresh=players.filter(p=>p.connected&&!(p.safeUntil>now)&&!event.caught.includes(p.id));if(!fresh.length)return;
  if(!event.charged){spend(r,Math.min(240,Math.ceil(r.bank*.22)+35),true);r.heat=Math.min(100,r.heat+12);event.charged=true;}
  for(const p of fresh){event.caught.push(p.id);p.scare={id:event.id,kind:event.kind,until:now+2200};p.stunnedUntil=now+6000;p.carrying=0;p.hidden=false;
    const challenge=r.challenges[p.id];if(challenge){const job=r.contracts.find(j=>j.id===challenge.id);if(job){job.owner=null;job.expires=now;}delete r.challenges[p.id];}
    if(p.zone==='hall'){Object.assign(p,{zone:'apartment',x:3.8,z:-1.45,lastMove:now});}
  }
}
export function openedIntruder(r,now){
  const event={id:++r.horror.serial,kind:'door',phase:'hunting',start:now,attackAt:now,ends:now+2500,caught:[],charged:true};
  r.horror.active=event;r.horror.locked=true;
  catchPlayers(r,event,Object.values(r.players).filter(p=>p.zone!=='hall'&&!p.hidden),now);
}
export function tickHorror(r,now){
  const h=r.horror,a=h.active;if(!a)return;
  if(a.kind==='window'&&r.curtains?.owner&&a.phase!=='hunting'){
    const hold=r.curtains,p=r.players[hold.owner];
    if(!p?.connected||!atStation(p,'curtains')||p.hidden||p.zone!=='apartment'||now-hold.lastPulse>2000){releaseCurtains(r,hold.owner,now);}
    else if(now-hold.started>=5000&&a.phase!=='retreating'){hold.closed=true;a.phase='retreating';a.retreatAt=now;a.ends=now+5500;}
  }
  if(now>=a.ends){h.active=null;r.curtains=null;h.recoveryUntil=now+30000;r.nextEvent=Math.max(r.nextEvent,h.recoveryUntil);return;}
  if(a.phase==='retreating')return;
  if(now>=a.attackAt){a.phase='hunting';
    const players=Object.values(r.players);
    if(a.kind==='window'){r.curtains=null;}
    if(a.kind==='window')catchPlayers(r,a,players.filter(p=>p.zone!=='hall'&&!p.hidden),now);
    if(a.kind==='hall')catchPlayers(r,a,players.filter(p=>p.zone==='hall'),now);
    if(a.kind==='door'&&!h.locked){catchPlayers(r,a,players.filter(p=>p.zone!=='hall'&&!p.hidden),now);h.locked=true;}
  }
}
export function releaseCurtains(r,id,now){
  const hold=r.curtains,a=r.horror.active;if(!hold||hold.owner!==id||hold.closed)return;
  r.curtains=null;
  if(a?.kind==='window'&&a.phase!=='retreating'){a.attackAt=Math.min(a.attackAt,now+3500);a.ends=a.attackAt+10000;}
}
export function horrorAction(r,p,action,now){
  if(action==='curtain:release'){releaseCurtains(r,p.id,now);return result(true,'Curtains released.');}
  if(action==='curtain:hold'){
    const a=r.horror.active;
    if(a?.kind!=='window'||a.phase==='hunting'||a.phase==='retreating')return result(false,'No prowler at the curtains.');
    if(!atStation(p,'curtains')||p.zone!=='apartment'||p.hidden)return result(false,'Stand at the window.');
    if(r.curtains&&now-r.curtains.lastPulse>2000)releaseCurtains(r,r.curtains.owner,now);
    if(r.curtains?.owner&&r.curtains.owner!==p.id)return result(false,'Another operator has the curtains.');
    r.curtains??={owner:p.id,started:now,lastPulse:now,closed:false};r.curtains.lastPulse=now;
    return result(true,'Keep holding E.');
  }
  if(action==='hide:enter'){
    if(!atStation(p,'hide')||p.zone==='hall')return result(false,'Reach the wardrobe beside the packing table.');
    p.hidden=true;return result(true,'Inside the wardrobe. Stay until the footsteps fade.');
  }
  if(action==='hide:leave'){p.hidden=false;return result(true,'You step out of the wardrobe.');}
  if(action==='hall:return'){
    if(p.zone!=='hall'||!atStation(p,'return'))return result(false,'Return to door 204.');
    Object.assign(p,{zone:'apartment',x:3.8,z:-1.45,lastMove:now});r.horror.locked=true;return result(true,'Back inside. Bolt secured.');
  }
  if(action==='hall:enter'){
    if(p.zone==='hall'||!atStation(p,'door'))return result(false,'Reach the apartment door.');
    if(r.horror.locked)return result(false,'Slide the bolt before entering the hallway.');
    Object.assign(p,{zone:'hall',x:6,z:-1.45,lastMove:now});r.horror.locked=true;
    return result(true,'Hallway. Door 204 locks behind you; your key opens it from outside.');
  }
  if(action==='door:lock'||action==='door:unlock'){
    if(!atStation(p,'door')||p.zone==='hall')return result(false,'Reach the apartment latch.');
    r.horror.locked=action==='door:lock';return result(true,r.horror.locked?'Bolt locked.':'Bolt unlocked. Do not leave it unattended.');
  }
  return null;
}
