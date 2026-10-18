import {earn,spend} from './campaign.js';
const uid=()=>Math.random().toString(36).slice(2,10).toUpperCase();
const fail=text=>({ok:false,text});
export function seedContracts(r,now){
  r.contracts=r.contracts.filter(j=>j.owner&&!j.completed&&!j.failed||j.expires>now);
  r.nextContract??={economic:0,delivery:0};
  if(r.nightEnds-now<45000)return;
  const stocks=Object.values(r.exchange.stocks),stock=stocks[Math.floor(Math.random()*stocks.length)];
  if(!r.contracts.some(j=>j.type==='economic'&&!j.completed&&!j.failed)&&now>=r.nextContract.economic){r.nextContract.economic=now+50000;r.contracts.push({id:uid(),type:'economic',title:'Quiet accumulation / '+stock.symbol,difficulty:2,symbol:stock.symbol,quantity:2,limit:Math.ceil(stock.price*1.08),payout:Math.round(90*(1+(r.loop||0)*.2)),penalty:30,expires:now+80000,owner:null,objective:'Buy two shares below the price cap across TWO different quote revisions after accepting. Surrender the shares for purchase cost + commission. Selling acquired shares before handoff risks the contract.'});}
  if(r.nightEnds-now>=90000&&!r.contracts.some(j=>j.type==='delivery'&&!j.completed&&!j.failed)&&now>=r.nextContract.delivery){r.nextContract.delivery=now+100000;r.contracts.push({id:uid(),type:'delivery',title:'Two parcels, one receiver',difficulty:3,quantity:2,payout:Math.round(150*(1+(r.loop||0)*.2)),penalty:60,expires:now+140000,owner:null,objective:'Grow and seal two parcels. List them on afterhours.onion, negotiate with the verified contract receiver, schedule pickup and deliver both before the deadline. Sale proceeds are separate from this coordination bonus.'});}
}
export function failContract(r,j,reason){
  if(!j||j.failed||j.completed)return;
  j.failed=true;j.failure=reason;
  if(j.type==='delivery'){for(const b of r.sales.buyers)if(b.contract===j.id)b.walked=true;for(const d of r.sales.deals)if(d.contract===j.id&&d.status==='scheduled'){d.status='cancelled';if(r.alley.deal===d.id){r.alley.leaveAt=Date.now();r.alley.next=Date.now()+6000;}}}
  if(j.owner){spend(r,j.penalty,true);r.heat=Math.min(100,r.heat+4);}
  r.log.unshift({id:j.id+'-fail',time:Date.now(),text:j.title+': '+reason+(j.owner?' / $'+j.penalty+' penalty.':'')});r.log=r.log.slice(0,18);
}
export function contractAction(r,id,action,payload,now){
  if(!action.startsWith('contract:'))return null;
  if(action==='contract:cancel')return {ok:true,text:'Close remote sessions with DISCONNECT; accepted work retains its deadline.'};
  const j=r.contracts.find(j=>j.id===payload.id);
  if(!j||j.completed||j.failed)return fail('Contract unavailable.');
  if(action==='contract:start'){
    if(j.owner||now>=j.expires||r.nightEnds-now<(j.type==='delivery'?85000:30000))return fail('Contract reserved or deadline too close.');
    if(r.contracts.some(c=>c.owner===id&&!c.completed&&!c.failed))return fail('Finish your accepted contract first.');
    if(j.type==='economic'&&r.bank<j.limit*j.quantity*1.02+j.penalty)return fail('Keep enough capital for both shares and the failure bond.');
    if(j.type==='delivery'&&r.sales.buyers.some(b=>b.contract&&!b.walked&&!b.deal))return fail('A contract receiver is already waiting.');
    j.owner=id;j.deadline=Math.min(now+(j.type==='delivery'?140000:70000),r.nightEnds-1000);j.expires=j.deadline;j.accepted=now;j.acquired=0;j.acquisitionCost=0;j.revisions=[];
    if(j.type==='delivery')r.sales.buyers.push({id:uid(),name:'CONTRACT / '+j.id.slice(0,4),personality:'careful',line:'Two parcels. Verified code. Meet the deadline.',quantity:2,max:580+20*r.day,offer:450+20*r.day,patience:4,reliability:'verified',expires:j.deadline,dialogue:['Contract receiver. List two sealed parcels and negotiate the pickup.'],contract:j.id});
    return {ok:true,text:'Accepted. '+j.objective};
  }
  if(!j.owner)return fail('Accept the contract first.');
  if(now>=j.deadline){failContract(r,j,'Deadline missed');return fail('Deadline missed.');}
  if(action==='contract:deliver'&&j.type==='economic'){
    const h=r.exchange.holdings[j.symbol];
    if(j.acquired<j.quantity||j.revisions.length<2||!h||h.quantity<j.quantity)return fail('Acquire both shares across two quote revisions, then hold them for handoff.');
    h.cost=Math.round(h.cost*(h.quantity-j.quantity)/h.quantity);h.quantity-=j.quantity;j.completed=true;
    const paid=j.acquisitionCost+j.payout;earn(r,'contracts',paid);return {ok:true,text:`Asset transfer settled. $${j.acquisitionCost} capital + $${j.payout} commission.`};
  }
  if(action==='contract:abandon'){failContract(r,j,'Operator abandoned the job');return {ok:true,text:'Contract closed. Bond forfeited.'};}
  return fail('Meet the physical objective to settle this contract.');
}
export function tickContracts(r,now,elapsed){
  for(const j of r.contracts){
    if(j.completed||j.failed)continue;
    if(j.owner&&(r.horror.active||!r.environment.power)){j.deadline+=elapsed;j.expires+=elapsed;const b=r.sales.buyers.find(b=>b.contract===j.id);if(b)b.expires+=elapsed;continue;}
    if(j.owner&&now>=j.deadline)failContract(r,j,'Deadline missed');
  }
  seedContracts(r,now);
}
