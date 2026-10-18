import {earn} from './campaign.js';
const pick=a=>a[Math.floor(Math.random()*a.length)];
const token=()=>Math.random().toString(36).slice(2,8).toUpperCase();
const answer=s=>String(s||'').trim().toUpperCase();
const fail=text=>({ok:false,text});
export function seedRemote(r,now){
  r.remoteTargets??={};r.remoteSessions??={};r.extractions??={};r.remoteSerial??=0;
  for(const [id,t] of Object.entries(r.remoteTargets))if((t.completed||t.burned||t.expires<now)&&!t.owner)delete r.remoteTargets[id];
  while(Object.keys(r.remoteTargets).length<4){
    const serial=r.remoteSerial++,type=['archive','investigation','trace'][serial%3],tier=Math.min(3,1+Math.floor(serial/5));
    const id='NODE-'+token(),word=pick(['MOTH','FERN','DUSK','RUST','ECHO']),batch=String(100+Math.floor(Math.random()*800)),shift=2+Math.floor(Math.random()*6);
    const files={'brief':{'read-first.txt':type==='archive'?'Recover the locked archive. The key memo describes its rotation. Decode the seal, then extract payload.arc.':type==='investigation'?'Find the genuine handoff manifest. Cross-check the sender in mail with the batch in audit. Extract only the matching manifest.':'Timed retrieval. Reassemble the three route digits in the order recorded by dispatch. Submit that route, then extract route.bundle.'},mail:{},logs:{},vault:{}};
    let solution='',valuable='';
    if(type==='archive'){
      const cipher=[...word].map(c=>String.fromCharCode(65+(c.charCodeAt(0)-65+shift)%26)).join('');solution=word;valuable='vault/payload.arc';
      files.mail['key-memo.txt']='Archive seal uses alphabet rotation +'+shift+'. Move every encoded letter BACK '+shift+' places. A wraps around to Z.';
      files.logs['seal.txt']='ENCODED SEAL: '+cipher;files.vault['payload.arc']='Encrypted recovery payload. Unlock using the decoded seal.';files.vault['preview.arc']='Zero-filled preview. No recoverable content.';
    }else if(type==='investigation'){
      const names=['manifest-A.dat','manifest-B.dat','manifest-C.dat'].sort(()=>Math.random()-.5);
      solution=word+'-'+batch;valuable='vault/'+names[0];files.mail['dispatch.txt']='Authorised sender: '+word+'. Ignore lookalike senders.';
      files.logs['audit.txt']='Accepted batch: '+batch+'. Cross-check the sender before extracting.';
      files.vault[names[0]]='SIGNED BY '+word+' / BATCH '+batch+' / ORIGINAL HANDOFF';
      files.vault[names[1]]='SIGNED BY '+word+' / BATCH 000 / SUPERSEDED';
      files.vault[names[2]]='SIGNED BY MIRROR / BATCH '+batch+' / UNVERIFIED COPY';
    }else{
      const digits=Array.from({length:3},()=>String(1+Math.floor(Math.random()*8)));solution=digits.join('');valuable='vault/route.bundle';
      files.mail['dispatch.txt']='Chronological relay order: ROWAN, BRASS, ASH. Concatenate their route digits; never sort numerically.';
      for(const [i,name] of ['ASH','ROWAN','BRASS'].entries())files.logs[name.toLowerCase()+'.log']='Relay '+name+' / route digit '+digits[[2,0,1][i]];
      files.vault['route.bundle']='Locked route bundle. Submit the chronological route to unseal.';files.vault['abandoned.bundle']='Expired route 000. No buyer.';
    }
    r.remoteTargets[id]={id,address:'lattice://'+id.toLowerCase(),type,tier,title:{archive:'Rotated archive',investigation:'Counterfeit handoff',trace:'Three-hop dead signal'}[type],payout:175+tier*65,files,solution,valuable,owner:null,completed:false,burned:false,strikes:0,expires:now+240000};
  }
}
export function remotePublic(r,id){
  const s=r.remoteSessions[id],t=s&&r.remoteTargets[s.target];
  return {remoteListings:Object.values(r.remoteTargets).map(({id,address,type,tier,title,payout,owner,completed,burned})=>({id,address,type,tier,title,payout,owner,completed,burned})),
    remoteSession:s&&t?{target:t.id,address:t.address,title:t.title,type:t.type,stage:s.stage,expires:s.expires,ports:s.ports,connected:s.route.slice(0,s.routeIndex),routeIndex:s.routeIndex,cwd:s.cwd,
      folders:Object.keys(t.files),files:Object.keys(t.files[s.cwd]||{}),selected:s.selected,document:s.document,solved:s.solved,strikes:t.strikes}:null,
    extracted:Object.values(r.extractions).map(({id,title,payout,sold,from})=>({id,title,payout,sold,from}))};
}
function strike(r,s,t,text){t.strikes++;r.heat=Math.min(100,r.heat+4);if(t.strikes>=3){t.burned=true;t.owner=null;delete r.remoteSessions[s.owner];return fail('Trace complete. This target burned.');}return fail(text+' Trace '+t.strikes+'/3.');}
export function remoteAction(r,id,action,payload,now){
  if(!action.startsWith('remote:'))return null;
  if(action==='remote:sell'){
    const x=Object.hasOwn(r.extractions,String(payload.id))&&r.extractions[payload.id];if(!x||x.sold)return fail('No unsold evidence at that address.');
    x.sold=true;earn(r,'contracts',x.payout);return {ok:true,text:'Evidence settled. +$'+x.payout+'.'};
  }
  if(action==='remote:start'){
    if(r.remoteSessions[id]||r.challenges[id])return fail('Close the current job first.');
    const t=Object.hasOwn(r.remoteTargets,String(payload.id))&&r.remoteTargets[payload.id];if(!t||t.owner||t.completed||t.burned||t.expires<=now)return fail('Target unavailable.');
    if(t.tier>r.day)return fail('This contact opens on night '+t.tier+'.');
    if(t.tier===3&&!r.upgrades.includes('decoder'))return fail('Tier 3 needs the decoder.');
    const values=[11,23,37,49,61,79,83,97].sort(()=>Math.random()-.5).slice(0,3+t.tier);
    const ports=values.map((voltage,i)=>({id:String(i),voltage}));
    r.remoteSessions[id]={owner:id,target:t.id,stage:'handshake',ports,route:ports.toSorted((a,b)=>a.voltage-b.voltage).map(p=>p.id),routeIndex:0,cwd:'brief',selected:null,document:'',solved:false,expires:now+(t.type==='trace'?95000:150000)};
    t.owner=id;return {ok:true,text:'Route the lowest voltage first. Keep the circuit rising.'};
  }
  const s=r.remoteSessions[id],t=s&&r.remoteTargets[s.target];if(!s||!t||t.owner!==id)return fail('No remote session.');
  if(action==='remote:disconnect'){t.owner=null;delete r.remoteSessions[id];return {ok:true,text:'Remote disconnected. Trace marks remain.'};}
  if(now>=s.expires){t.owner=null;t.burned=true;delete r.remoteSessions[id];return fail('Remote lease expired.');}
  if(action==='remote:route'){
    if(s.stage!=='handshake')return fail('Circuit already connected.');
    if(s.route.slice(0,s.routeIndex).includes(String(payload.port)))return {ok:true,text:'Relay already linked.'};
    if(String(payload.port)!==s.route[s.routeIndex])return strike(r,s,t,'Wrong voltage.');
    if(++s.routeIndex===s.route.length)s.stage='files';return {ok:true,text:s.stage==='files'?'Remote filesystem mounted.':'Relay accepted.'};
  }
  if(s.stage!=='files')return fail('Complete the security circuit first.');
  if(action==='remote:folder'){
    if(!Object.hasOwn(t.files,String(payload.folder)))return fail('No such folder.');s.cwd=payload.folder;s.selected=null;s.document='';return {ok:true,text:'Directory opened.'};
  }
  if(action==='remote:read'){
    if(!Object.hasOwn(t.files[s.cwd],String(payload.file)))return fail('No such file.');
    s.selected=s.cwd+'/'+payload.file;s.document=t.files[s.cwd][payload.file];return {ok:true,text:'Document loaded.'};
  }
  if(action==='remote:solve'){
    if(t.type==='investigation')return fail('Select the genuine manifest and extract it.');
    if(answer(payload.answer)!==t.solution)return strike(r,s,t,'Key rejected. Read the source documents.');
    s.solved=true;return {ok:true,text:'Seal opened. Find the payload in vault.'};
  }
  if(action==='remote:extract'){
    if(!s.selected)return fail('Open a file first.');
    if(s.selected!==t.valuable)return strike(r,s,t,'Decoy rejected by the receiver.');
    if(!s.solved&&t.type!=='investigation')return fail('The file is sealed. Reconstruct its key first.');
    t.completed=true;t.owner=null;r.extractions[t.id]={id:t.id,title:t.title,payout:t.payout,sold:false,from:t.address};delete r.remoteSessions[id];
    return {ok:true,text:'Extracted to local evidence. Sell it on ledger.onion.'};
  }
  return fail('Unknown remote operation.');
}
export function tickRemote(r,now,elapsed){
  for(const [id,s] of Object.entries(r.remoteSessions)){
    // Physical danger and outages pause remote leases so survival never burns a job.
    if(r.horror.active||!r.environment.power){s.expires+=elapsed;continue;}
    if(now>=s.expires){const t=r.remoteTargets[s.target];if(t){t.owner=null;t.burned=true;}delete r.remoteSessions[id];}
  }
}
