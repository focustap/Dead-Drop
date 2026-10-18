import {spend,visitor} from './campaign.js';
import {atStation} from './layout.js';

export const THREATS=[
  {id:'door',name:'The Locksmith',look:'An empty-handed hood tests the handle.',sign:'Three slow knocks. The latch rattles.',behavior:'Waits outside, then tries an unlocked door after ten seconds.',counter:'Keep the bolt locked. Use the peephole; collect couriers without leaving the latch open.',cost:'One shared wallet loss, shock, and heat. Hiding protects individuals from the scare.'},
  {id:'window',name:'The Glass Walker',look:'A long silhouette presses against the rear window, then climbs inside.',sign:'Three taps and a pale face in the glass. Twelve seconds to get out of sight.',behavior:'Ignores locks and searches the apartment for ten seconds.',counter:'Use E at the wardrobe beside the packing table. Stay inside until footsteps fade. Every operator must hide; the hallway is also safe.',cost:'Exposed operators are shocked and lose carried harvest. The crew pays one bounded loss per encounter.'},
  {id:'hall',name:'The Tenant',look:'A tall figure in the corridor under a failing ceiling lamp.',sign:'Heavy footsteps, a red flicker, and a shadow visible through the peephole.',behavior:'Twelve seconds of approach, then ten seconds patrolling outside the apartment.',counter:'Check the peephole. Wait indoors until it leaves, then visit the hallway fuse box. If already outside, return through door 204.',cost:'Caught operators are forced inside and shocked. A single crew penalty applies.'},
  {id:'echo',name:'Empty Rooms',look:'A shadow passes the glass; nobody is there when you look again.',sign:'Distant banging, footsteps, or a short light flicker.',behavior:'A brief harmless disturbance, sometimes preceding a long silence.',counter:'Observe. Do not open the door just because something knocked.',cost:'None. Not every sound belongs to a visitor.'},
  {id:'hack',name:'Wallet Leech',look:'The workstation tears into a red security screen.',sign:'A sharp two-tone alarm and visual distortion.',behavior:'Rare digital intrusion with a short response deadline.',counter:'Enter the displayed sequence with arrows or WASD. Firewall buys time; a cold wallet limits damage.',cost:'A bounded portion of shared funds is lost on a mistake or timeout.'},
  {id:'thief',name:'The Collector',look:'A hood lingering away from the alley lamp, looking over a shoulder.',sign:'No phone check beside the red tray.',behavior:'Takes any package released to the chute.',counter:'Watch the live CCTV. Wait for a buyer checking a glowing phone.',cost:'One shipment and extra heat.'},
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
  if(kind==='echo'){h.active.attackAt=now+4000;h.active.ends=now+6000;}
  if(kind==='door'){r.door=visitor('intruder',now,'door');r.door.next=now+27000;}
  r.log.unshift({id:'encounter-'+h.serial,time:now,text:kind==='window'?'Three taps at the rear window. A face against the glass.':kind==='hall'?'Heavy hallway footsteps. A long shadow passes the peephole.':kind==='door'?'Three slow knocks. Someone tests the latch.':'A heavy bang from the empty apartment upstairs.'});
  r.log=r.log.slice(0,18);return true;
}
function catchPlayers(r,event,players,now){
  const fresh=players.filter(p=>p.connected&&!(p.safeUntil>now)&&!event.caught.includes(p.id));if(!fresh.length)return;
  if(!event.charged){spend(r,Math.min(240,Math.ceil(r.bank*.22)+35),true);r.heat=Math.min(100,r.heat+12);event.charged=true;}
  for(const p of fresh){event.caught.push(p.id);p.scare={id:event.id,kind:event.kind,until:now+2200};p.stunnedUntil=now+6000;p.carrying=0;p.hidden=false;
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
  if(now>=a.ends){h.active=null;h.recoveryUntil=now+30000;r.nextEvent=Math.max(r.nextEvent,h.recoveryUntil);return;}
  if(now>=a.attackAt){a.phase='hunting';
    const players=Object.values(r.players);
    if(a.kind==='window')catchPlayers(r,a,players.filter(p=>p.zone!=='hall'&&!p.hidden),now);
    if(a.kind==='hall')catchPlayers(r,a,players.filter(p=>p.zone==='hall'),now);
    if(a.kind==='door'&&!h.locked){catchPlayers(r,a,players.filter(p=>p.zone!=='hall'&&!p.hidden),now);h.locked=true;}
  }
}
export function horrorAction(r,p,action,now){
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
