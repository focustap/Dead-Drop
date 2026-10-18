export const NIGHT_MS=4*60*1000;
export const QUOTAS=[650,850,1050,1250,1500,1800];
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
export function ledger(){return {hacking:0,deliveries:0,contracts:0,expenses:0,losses:0};}
export function earn(r,kind,n){r.bank+=n;r.ledger[kind]+=n;}
export function spend(r,n,loss=false){const paid=Math.min(r.bank,n);r.bank-=paid;r.ledger[loss?'losses':'expenses']+=paid;return paid;}
export function income(r){return r.ledger.hacking+r.ledger.deliveries+r.ledger.contracts;}
export function visitor(kind,now,location){
  return {visitor:kind,id:Math.random().toString(36).slice(2),arrived:now,waitAt:now+6500,leaveAt:now+(location==='door'?24500:28500),next:now+33500,outcome:null};
}
export function phase(v,now){return v.visitor==='empty'?'empty':now<v.waitAt?'approaching':now<v.leaveAt?'waiting':now<v.next?'leaving':'empty';}
export function clue(v,now){
  const p=phase(v,now);if(p==='empty')return 'No movement.';if(p==='approaching')return 'Footsteps approaching.';if(p==='leaving')return 'Footsteps fading.';
  return {buyer:'Checks a glowing phone, then waits beside the red tray.',thief:'Keeps glancing behind them; stays away from the light.',courier:'A taped parcel under one arm. Two knocks, then a step back.',intruder:'Empty hands. Leans toward the lock and tests the handle.'}[v.visitor];
}
export function finishNight(r,now){
  const gross=income(r),rent=45+r.day*10;
  spend(r,rent);const met=gross>=r.quota;
  if(!met){spend(r,60);r.heat=Math.min(100,r.heat+12);}
  r.cycleEarned+=gross;r.cycleRequired+=r.quota;
  const cycleEnd=r.day%3===0,cycleMet=r.cycleEarned>=r.cycleRequired;
  r.summary={day:r.day,...r.ledger,gross,net:gross-r.ledger.expenses-r.ledger.losses,quota:r.quota,met,cycleEnd,cycleMet,cycleEarned:r.cycleEarned,cycleRequired:r.cycleRequired,bank:r.bank};
  r.history.push(r.summary);r.phase=cycleEnd&&!cycleMet?'lost':r.day===6?'won':'summary';
  r.reason=r.phase==='lost'?'The three-night deadline expired. Your contact pulled the operation.':r.phase==='won'?'Both contracts cleared. The crew leaves before dawn.':'';
  r.intrusions={};r.challenges={};r.nightEnds=now;
}
export function nextNight(r,now){
  r.day++;r.quota=QUOTAS[r.day-1];r.ledger=ledger();r.phase='night';r.summary=null;
  r.contracts=[];r.orders=[];
  if(r.day%3===1){r.cycleEarned=0;r.cycleRequired=0;}
  r.nightEnds=now+NIGHT_MS;r.lastTick=now;r.nextTarget=now+10000;r.nextEvent=now+35000;
  r.heat=Math.max(4,r.heat-18);r.environment={power:true,warning:null,cameraUntil:0};
  r.door={visitor:'empty',next:now+12000};r.alley={visitor:'empty',next:now+9000};
}
