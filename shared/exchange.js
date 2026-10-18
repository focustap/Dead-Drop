import {earn,spend} from './campaign.js';

export const COMPANIES=[
  ['GW','GhostWire','Underground mesh networks',38,.035],['BV','BlackVault','Encrypted cold storage',56,.022],
  ['NC','Night Courier','Discreet deliveries',28,.045],['RL','Redline Labs','Unlicensed technology',72,.085],
  ['PS','Phantom Systems','Counter-surveillance software',46,.055],['HM','Hollow Market','Contraband distribution',24,.075]
];
export const FEE=.02;
export function newExchange(now){return {next:now+10000,revision:0,news:[{at:now,text:'Opening bell. Quotes move every ten seconds. Every trade costs 2%.'}],holdings:{},stocks:Object.fromEntries(COMPANIES.map(([symbol,name,description,price,volatility])=>[symbol,{symbol,name,description,price,volatility,history:[{at:now,price}]}]))};}
export function tickExchange(r,now){
  const m=r.exchange;if(now<m.next)return;
  m.next=now+10000;m.revision++;
  const local=r.ledger.deliveries>(m.lastDelivery||0)?{symbol:'NC',positive:true,text:'Local pickup traffic rises. Night Courier sees modest new demand.'}:m.lastPower===true&&!r.environment.power?{symbol:'GW',positive:false,text:'A building outage interrupts local mesh traffic. GhostWire routes lose capacity.'}:r.heat-(m.lastHeat??r.heat)>=12?{symbol:'PS',positive:true,text:'A local trace alert sends operators shopping for Phantom security software.'}:null;
  m.lastDelivery=r.ledger.deliveries;m.lastPower=r.environment.power;m.lastHeat=r.heat;
  const event=local?.symbol||(Math.random()<.22?COMPANIES[Math.floor(Math.random()*COMPANIES.length)][0]:null),positive=local?.positive??Math.random()<.5;
  for(const s of Object.values(m.stocks)){
    const move=(Math.random()+Math.random()-1)*s.volatility+(event===s.symbol?(positive?(local?.015:.08):-(local?.015:.08)):0);
    s.price=Math.max(4,Math.min(250,Math.round(s.price*(1+move)*100)/100));
    s.history.push({at:now,price:s.price});s.history=s.history.slice(-90);
  }
  if(event){m.news.unshift({at:now,text:local?.text||m.stocks[event].name+(positive?' wins a major underground contract. Demand rises.':' loses a relay to a raid. Holders sell into uncertainty.')});m.news=m.news.slice(0,8);}
}
export function exchangeAction(r,id,action,payload,now){
  if(action!=='exchange:trade')return null;
  const m=r.exchange,s=Object.hasOwn(m.stocks,String(payload.symbol))&&m.stocks[payload.symbol],q=Number(payload.quantity),side=payload.side;
  const fail=text=>({ok:false,text});
  if(!s||!Number.isSafeInteger(q)||q<1||q>100||!['buy','sell'].includes(side))return fail('Choose a listed symbol, side and 1–100 whole shares.');
  // A quote revision prevents a stale tab trading at a price the player has never seen.
  if(payload.revision!==m.revision)return fail('Quote changed. Review the new price and submit again.');
  const h=m.holdings[s.symbol]??={quantity:0,cost:0},total=Math.ceil(s.price*q*(1+FEE));
  if(side==='buy'){
    if(r.bank<total)return fail('Wallet cannot cover shares and fee.');
    if(h.quantity+q>1000)return fail('Custody limit reached.');
    spend(r,total);h.quantity+=q;h.cost+=total;
    for(const j of r.contracts)if(j.owner&&j.type==='economic'&&j.symbol===s.symbol&&!j.completed&&!j.failed&&now<j.deadline&&s.price<=j.limit){const count=j.revisions.includes(m.revision)?0:Math.min(1,q,j.quantity-(j.acquired||0));j.acquired+=count;j.acquisitionCost+=Math.ceil(total*count/q);if(count&&!j.revisions.includes(m.revision))j.revisions.push(m.revision);}
    return {ok:true,text:`Bought ${q} ${s.symbol} for $${total}, including fee.`};
  }
  if(h.quantity<q)return fail('The crew does not own that many shares.');
  const paid=Math.floor(s.price*q*(1-FEE));h.cost=Math.round(h.cost*(h.quantity-q)/h.quantity);h.quantity-=q;earn(r,'trading',paid);
  return {ok:true,text:`Sold ${q} ${s.symbol} for $${paid} after fee.`};
}
