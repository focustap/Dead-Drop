import {earn,phase,visitor} from './campaign.js';
const uid=()=>Math.random().toString(36).slice(2,10).toUpperCase();
const fail=text=>({ok:false,text});
const personas=[['MICA','impatient','I pay extra for speed. Do not keep me waiting.',2,1.25],['ROOK','bargainer','Keep it sensible. I know what the market pays.',4,1],['VEIL','careful','Confirmed stock only. Send the pickup code.',3,1.12],['ASH','wholesale','Two parcels. One trip. Give me a quantity price.',3,.96]];
export const reserved=r=>r.sales.deals.filter(d=>d.status==='scheduled').reduce((n,d)=>n+d.quantity,0);
export function seedSales(r,now){
  r.sales??={buyers:[],deals:[],listed:0,next:0};
  if(now<r.sales.next)return;r.sales.next=now+60000;
  r.sales.buyers=r.sales.buyers.filter(b=>!b.walked&&b.expires>now&&!b.deal||b.deal&&r.sales.deals.some(d=>d.id===b.deal&&d.status==='scheduled'));
  for(let i=0;i<3;i++){
    const [name,personality,line,patience,mult]=personas[(i+r.day)%personas.length],quantity=personality==='wholesale'?2:1;
    const max=Math.round((240+r.day*12)*(1+(r.loop||0)*.2)*quantity*mult*(.95+Math.random()*.12));
    r.sales.buyers.push({id:uid(),name,personality,line,quantity,max,offer:Math.round(max*.76),patience,reliability:personality==='careful'?'verified':'unverified',walked:false,expires:now+100000,dialogue:[line]});
  }
  r.sales.deals=r.sales.deals.slice(-20);
}
export function salesPublic(r){return {...r.sales,reserved:reserved(r),buyers:r.sales.buyers.map(({max,...b})=>b)};}
export function salesAction(r,id,action,payload,now){
  if(!action.startsWith('sales:')&&action!=='alley:drop')return null;
  const s=r.sales;
  if(action==='sales:list'){
    const q=Number(payload.quantity),available=r.inventory.packages-reserved(r);
    if(!Number.isSafeInteger(q)||q<0||q>available)return fail('List only unreserved, sealed stock in the apartment.');
    s.listed=q;return {ok:true,text:`${q} sealed parcels listed. Negotiate before opening the chute.`};
  }
  if(action==='alley:drop'){
    if(phase(r.alley,now)!=='waiting')return fail('Wait until the visitor reaches the tray.');
    const d=s.deals.find(d=>d.id===r.alley.deal&&d.status==='scheduled');
    if(!d||r.alley.visitor!=='buyer'){
      if(!r.inventory.packages||r.inventory.packages<=reserved(r))return fail('No unreserved parcel to risk. This is not a confirmed pickup.');
      r.inventory.packages--;s.listed=Math.min(s.listed,r.inventory.packages-reserved(r));r.heat=Math.min(100,r.heat+10);r.shipmentsLost=(r.shipmentsLost||0)+1;r.alley.outcome='theft';r.alley.leaveAt=now;r.alley.next=now+6000;
      return {ok:true,text:'An unconfirmed visitor took the parcel. No payment.'};
    }
    if(now>d.leaveAt)return fail('The pickup window has closed.');
    const quantity=Number(payload.quantity??d.quantity);
    if(quantity!==d.quantity)return fail(`Pickup code ${d.code} requires exactly ${d.quantity} sealed parcels.`);
    if(r.inventory.packages<quantity)return fail('The reserved stock is missing.');
    r.inventory.packages-=quantity;d.status='completed';d.completedAt=now;earn(r,'deliveries',d.price);
    r.alley.outcome='pickup';r.alley.leaveAt=now;r.alley.next=now+6000;
    if(d.contract){const j=r.contracts.find(j=>j.id===d.contract);if(j&&!j.failed&&!j.completed){j.completed=true;earn(r,'contracts',j.payout);}}
    return {ok:true,text:`Code ${d.code} confirmed. ${quantity} parcels delivered. +$${d.price}.`};
  }
  const b=s.buyers.find(b=>b.id===payload.id);
  if(!b||b.walked||b.deal||now>b.expires)return fail('Buyer has left this conversation.');
  if(action==='sales:reject'){b.walked=true;b.dialogue.push('Offer withdrawn.');return {ok:true,text:'Conversation closed.'};}
  if(action==='sales:counter'){
    const price=Number(payload.price),words=String(payload.text||'').trim().slice(0,160);
    if(!Number.isSafeInteger(price)||price<1||price>100000)return fail('Make an offer in whole dollars.');
    b.dialogue.push('YOU: '+(words||'Make it $'+price+'.'),b.name+': '+(price<=b.max?'We can do that. Confirm the pickup.':'Too high. Best I can do is $'+Math.min(b.max,Math.round(b.offer+(b.max-b.offer)*.55))+'.'));
    b.dialogue=b.dialogue.slice(-8);b.patience--;
    if(price<=b.max){b.offer=price;b.agreed=true;}
    else{b.offer=Math.min(b.max,Math.round(b.offer+(b.max-b.offer)*.55));b.agreed=false;if(b.patience<=0){b.walked=true;b.dialogue.push('You wasted my time. Goodbye.');}}
    return {ok:!b.walked,text:b.walked?'Buyer walked away.':b.dialogue.at(-1)};
  }
  if(action==='sales:accept'){
    if(b.contract&&r.contracts.find(j=>j.id===b.contract)?.failed)return fail('The delivery contract has failed.');
    if(s.deals.some(d=>d.status==='scheduled'))return fail('Complete the scheduled pickup before arranging another.');
    if(s.listed<b.quantity||r.inventory.packages-reserved(r)<b.quantity)return fail('List enough sealed stock before confirming.');
    if(b.contract&&now+48000>r.contracts.find(j=>j.id===b.contract).deadline)return fail('Not enough time for this contract pickup. Complete it earlier next time.');
    if(now+52000>=r.nightEnds)return fail('Too close to dawn to arrange a safe pickup.');
    const d={id:uid(),buyer:b.name,quantity:b.quantity,price:b.offer,code:uid().slice(0,4),status:'scheduled',contract:b.contract||null,arrives:now+18000,leaveAt:now+48000};
    s.deals.push(d);s.listed-=d.quantity;b.deal=d.id;
    return {ok:true,text:`${b.name}: code ${d.code}. Arriving in 18 seconds; waiting 30 seconds.`};
  }
  return fail('Unknown sales operation.');
}
export function tickSales(r,now,elapsed){
  for(const d of r.sales.deals.filter(d=>d.status==='scheduled')){
    // No pickup runs out while survival takes the crew away from their stations.
    if(r.horror.active){d.arrives+=elapsed;d.leaveAt+=elapsed;if(r.alley.deal===d.id){r.alley.waitAt+=elapsed;r.alley.leaveAt+=elapsed;r.alley.next+=elapsed;}continue;}
    if(now>d.leaveAt){d.status='missed';continue;}
    if(now>=d.arrives-6500&&r.alley.deal!==d.id){
      r.alley={...visitor('buyer',d.arrives-6500,'alley'),deal:d.id,code:d.code,waitAt:d.arrives,leaveAt:d.leaveAt,next:d.leaveAt+6000};
      r.log.unshift({id:d.id,time:now,text:`Scheduled pickup ${d.code} is approaching. ${d.quantity} parcels / $${d.price}.`});r.log=r.log.slice(0,18);
    }
  }
  if(!r.sales.deals.some(d=>d.status==='scheduled'))seedSales(r,now);
}
