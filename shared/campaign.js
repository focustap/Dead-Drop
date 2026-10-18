import {newHorror} from './horror.js';
export const NIGHT_MS=4*60*1000;
export const QUOTAS=[2550,4550];
export const cycleForDay=day=>Math.floor((day-1)/3);
export const quotaForDay=day=>QUOTAS[cycleForDay(day)];
export const nightsRemaining=day=>3-(day-1)%3;
export const CATALOG={
  seeds:{name:'Seed capsules × 2',price:55,supply:true,amount:2},
  soil:{name:'Substrate sacks × 3',price:30,supply:true,amount:3},
  wrap:{name:'Sealing sleeves × 4',price:25,supply:true,amount:4},
  firewall:{name:'Watchdog firewall',price:220,detail:'Extra 4 seconds to repel intrusions'},
  vault:{name:'Cold wallet',price:300,detail:'Reduces wallet breach losses'},
  lamp:{name:'Broad-spectrum fixture',price:210,detail:'Growth takes 42 seconds instead of 60'},
  irrigation:{name:'Drip reservoir',price:180,detail:'Moisture lasts twice as long'},
  tools:{name:'Harvest tools',price:230,detail:'One extra unit per crop'},
  camera:{name:'Shielded camera cable',price:160,detail:'Shorter camera interference'},
  decoder:{name:'Tier 3 decoder',price:250,detail:'Access advanced archives from night 3'}
};
export function ledger(){return {hacking:0,deliveries:0,contracts:0,trading:0,expenses:0,losses:0};}
export function earn(r,kind,n){r.bank+=n;r.ledger[kind]+=n;}
export function spend(r,n,loss=false){const paid=Math.min(r.bank,n);r.bank-=paid;r.ledger[loss?'losses':'expenses']+=paid;return paid;}
export function income(r){return r.ledger.hacking+r.ledger.deliveries+r.ledger.contracts+(r.ledger.trading||0);}
export function visitor(kind,now,location){
  return {visitor:kind,id:Math.random().toString(36).slice(2),arrived:now,waitAt:now+6500,leaveAt:now+(location==='door'?24500:28500),next:now+33500,outcome:null};
}
export function phase(v,now){return v.visitor==='empty'?'empty':now<v.waitAt?'approaching':now<v.leaveAt?'waiting':now<v.next?'leaving':'empty';}
export function clue(v,now){
  const p=phase(v,now);if(p==='empty')return 'No movement.';if(p==='approaching')return 'Footsteps approaching.';if(p==='leaving')return 'Footsteps fading.';
  const signs={buyer:'Checks a glowing phone, then waits beside the red tray.',thief:'Keeps glancing behind them; stays away from the light.',courier:'A taped parcel under one arm. Two knocks, then a step back.',intruder:'Empty hands. Leans toward the lock and tests the handle.',stranger:'An empty-handed stranger lingers beyond the tray. No pickup code.',police:'A uniformed patrol checks the alley. Keep the chute closed.',searcher:'Someone searches through the dumpster, ignoring the tray.',pedestrian:'A passerby shelters from the rain. No pickup arranged.'};return signs[v.visitor]+(v.visitor==='buyer'&&v.code?' Pickup code '+v.code+'.':'');
}
export function finishNight(r,now){
  if(r.phase!=='night')return false;
  const gross=income(r),cycle=cycleForDay(r.day),cycleEnd=r.day%3===0;
  r.cycleEarned+=gross;
  let paid=0,met=false;
  if(cycleEnd){
    // The room transitions synchronously: no second action can charge this cycle.
    const settlement=r.settlements[cycle];
    if(settlement){met=settlement.paid;}
    else{
      met=r.bank>=r.quota;
      if(met){paid=r.quota;spend(r,paid);}
      r.settlements[cycle]={paid:met,amount:r.quota,at:now};
    }
  }
  r.summary={day:r.day,...r.ledger,gross,net:gross-r.ledger.expenses-r.ledger.losses,quota:r.quota,quotaPaid:paid,cycleEnd,cycleMet:met,cycleEarned:r.cycleEarned,cycleRequired:r.quota,bank:r.bank,nightsRemaining:cycleEnd?0:nightsRemaining(r.day)-1};
  r.history.push(r.summary);
  r.phase=cycleEnd&&!met?'collector':r.day===6?'ending':'summary';
  r.reason=r.phase==='collector'?'The quota is unpaid. The Collector has your address.':r.phase==='ending'?'Both payments accepted. The debt is cleared.':'';
  r.intrusions={};r.challenges={};r.horror.active=null;r.curtains=null;r.nightEnds=now;
  for(const p of Object.values(r.players)){p.computerOpen=false;p.hidden=false;p.scare=null;p.stunnedUntil=0;}
  if(r.phase==='ending')r.ending={start:now,offerAt:now+12000,deadline:now+72000,votes:{},resolved:false};
  if(r.phase==='collector')r.collector={cycle,amount:r.quota,start:now,attackAt:now+2500,ends:now+6500};
  return true;
}
export function tickCollector(r,now){
  const c=r.collector;if(r.phase!=='collector'||!c)return false;
  if(now>=c.attackAt)for(const p of Object.values(r.players))p.scare={id:'collector-'+c.cycle,kind:'collector',start:c.attackAt,until:c.ends};
  if(now>=c.ends){r.phase='lost';r.reason='The Collector came for the unpaid quota. The operation is over.';}
  return true;
}
export function nextNight(r,now){
  r.horror=newHorror(now);r.nextHack=now+75000;
  for(const p of Object.values(r.players))Object.assign(p,{hidden:false,computerOpen:false,zone:'apartment',x:-1.2,z:-.75,stunnedUntil:0,scare:null});
  r.day++;r.quota=Math.round(quotaForDay(r.day)*(1+(r.loop||0)*.35));r.ledger=ledger();r.phase='night';r.summary=null;r.collector=null;r.curtains=null;
  r.contracts=[];r.nextContract={economic:0,delivery:0};r.orders=[];r.sales={buyers:[],deals:[],listed:0,next:0};r.remoteSessions={};r.remoteTargets={};
  if(r.day%3===1){r.cycleEarned=0;r.cycleRequired=r.quota;}
  r.nightEnds=now+NIGHT_MS;r.lastTick=now;r.nextTarget=now+10000;r.nextEvent=now+35000;
  r.heat=Math.max(4,r.heat-18);r.environment={power:true,warning:null,cameraUntil:0};
  r.door={visitor:'empty',next:now+12000};r.alley={visitor:'empty',next:now+9000};
}

// The offer is a crew ballot. All connected votes resolve together; ties and timeouts leave safely.
export function endingAction(r,id,payload,now){
  const e=r.ending;
  if(r.phase!=='ending'||!e||e.resolved||now<e.offerAt)return {ok:false,text:'Wait for the Collector to present the envelope.'};
  if(!['leave','continue'].includes(payload.choice))return {ok:false,text:'Choose leave or continue.'};
  e.votes[id]=payload.choice;tickEnding(r,now);return {ok:true,text:'Crew vote recorded.'};
}
export function tickEnding(r,now){
  const e=r.ending;if(r.phase!=='ending'||!e||e.resolved)return false;
  const crew=Object.values(r.players).filter(p=>p.connected),votes=crew.map(p=>e.votes[p.id]);
  if(now<e.offerAt||now<e.deadline&&votes.some(v=>!v))return true;
  e.resolved=true;
  if(votes.filter(v=>v==='continue').length>crew.length/2){
    r.loop=(r.loop||0)+1;r.victories=(r.victories||0)+1;r.settlements={};r.day=0;r.cycleEarned=0;
    nextNight(r,now);r.cycleRequired=r.quota;r.ending=null;
    r.log.unshift({id:'loop-'+r.loop,time:now,text:'Another envelope. New Game+ '+r.loop+': quotas +35% per loop; earning offers +20%.'});
  }else{r.phase='won';r.reason='Debt cleared. The Collector lets the crew leave. DEAD DROP / Created by focustap. Thank you for surviving.';}
  return true;
}
