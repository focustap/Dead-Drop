import {human} from './courtyard.js';
import * as THREE from 'three';
import {character} from './security.js';
import {turnToward} from '../shared/npc.js';

export class HorrorScene{
  constructor(scene,camera){
    this.hallPolice=character(scene,'#1e354e','police');this.hallPolice.visible=false;scene.add(this.hallPolice);
    this.hallFigure=character(scene,'#181e23','intruder');this.hallFigure.scale.y=1.18;scene.add(this.hallFigure);
    this.scare=character(scene,'#29272b','intruder');this.scare.scale.setScalar(1.7);camera.add(this.scare);scene.add(camera);
    for(const x of [-.065,.065]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.017,8,6),new THREE.MeshBasicMaterial({color:'#aabbb2'}));eye.position.set(x,1.68,-.258);eye.scale.set(1,.4,.35);this.scare.add(eye);}
    this.scare.position.set(0,-2.7,-1.02);this.scare.rotation.y=Math.PI;
    const glow=new THREE.PointLight('#d1e6df',4,3);glow.position.set(0,0,-.3);camera.add(glow);this.glow=glow;
    this.windowScare=human(camera,'#666252');this.windowScare.scale.setScalar(1.7);this.windowScare.position.set(0,-2.7,-1.12);this.windowScare.rotation.y=Math.PI;this.windowScare.visible=false;
    for(const x of [-.055,.055]){const socket=new THREE.Mesh(new THREE.SphereGeometry(.035,12,8),new THREE.MeshStandardMaterial({color:'#25211f'}));socket.scale.set(1,.65,.25);socket.position.set(x,1.69,-.292);this.windowScare.add(socket);const eye=new THREE.Mesh(new THREE.SphereGeometry(.016,10,8),new THREE.MeshStandardMaterial({color:'#aba28b',roughness:.4}));eye.scale.set(1,.55,.3);eye.position.set(x,1.689,-.303);this.windowScare.add(eye);const pupil=new THREE.Mesh(new THREE.SphereGeometry(.007,8,6),new THREE.MeshBasicMaterial({color:'#090b09'}));pupil.position.set(x,1.689,-.31);this.windowScare.add(pupil);}
    const openMouth=new THREE.Mesh(new THREE.SphereGeometry(.045,12,10),new THREE.MeshBasicMaterial({color:'#191311'}));openMouth.scale.set(1,.85,.25);openMouth.position.set(0,1.585,-.284);this.windowScare.add(openMouth);
    this.collector=character(scene,'#211b19','collector');this.collector.scale.set(1.95,1.8,1.8);this.collector.position.set(0,-2.9,-1.18);this.collector.rotation.y=Math.PI;camera.add(this.collector);
    const mask=new THREE.Mesh(new THREE.SphereGeometry(.16,14,12),new THREE.MeshStandardMaterial({color:'#a49474',metalness:.45,roughness:.35}));mask.scale.set(.86,1.1,.35);mask.position.set(0,1.65,-.23);this.collector.add(mask);
    for(const x of [-.06,.06]){const slit=new THREE.Mesh(new THREE.BoxGeometry(.045,.012,.02),new THREE.MeshBasicMaterial({color:'#060707'}));slit.position.set(x,1.7,-.29);this.collector.add(slit);}
    const mouthSeal=new THREE.Mesh(new THREE.BoxGeometry(.075,.14,.025),new THREE.MeshStandardMaterial({color:'#332820',metalness:.7,roughness:.2}));mouthSeal.position.set(0,1.57,-.29);this.collector.add(mouthSeal);
    const caseMesh=new THREE.Mesh(new THREE.BoxGeometry(.5,.37,.18),new THREE.MeshStandardMaterial({color:'#362e20',metalness:.6,roughness:.35}));caseMesh.position.set(.42,.7,-.12);this.collector.add(caseMesh);this.collector.visible=false;
    this.wardrobeScare=human(camera,'#54413b');this.wardrobeScare.scale.setScalar(1.7);this.wardrobeScare.rotation.y=Math.PI;
    const mouth=new THREE.Mesh(new THREE.SphereGeometry(.06,10,8),new THREE.MeshBasicMaterial({color:'#080909'}));mouth.scale.set(.6,1,.25);mouth.position.set(0,1.58,-.29);this.wardrobeScare.add(mouth);
    this.stalker=human(scene,'#666252');this.stalker.visible=false;
    this.finalCollector=human(scene,'#29231c');this.finalCollector.position.set(3.5,0,-1.45);this.finalCollector.rotation.y=2.73;this.finalCollector.visible=false;
    const envelope=new THREE.Mesh(new THREE.BoxGeometry(.4,.22,.015),new THREE.MeshStandardMaterial({color:'#c9b58c'}));envelope.position.set(-.2,1,-.32);this.finalCollector.add(envelope);
    this.hallLight=new THREE.PointLight('#b34840',0,8,2);this.hallLight.position.set(7,2.5,-4);scene.add(this.hallLight);
    this.hallFigure.visible=this.scare.visible=false;
  }
  update(state,player){this.state=state;this.player=player;}
  animate(now,dt){
    if(!this.state)return;
    const a=this.state.horror.active,p=this.player,t=now*.001;
    this.hallFigure.visible=a?.kind==='hall';this.hallLight.intensity=this.hallFigure.visible?5+Math.sin(t*5)*3:0;
    if(this.hallFigure.visible){
      const elapsed=(now-a.start)/1000,z=a.phase==='warning'?-11+Math.min(8,elapsed*.7):-3+Math.sin((now-a.attackAt)/2000)*4;
      const last=this.hallFigure.position.z;this.hallFigure.position.set(7.1,0,z);
      this.hallFigure.rotation.y=turnToward(this.hallFigure.rotation.y,z>last?Math.PI:0,dt);
      this.hallFigure.userData.legs.forEach((leg,i)=>leg.rotation.x=Math.sin(t*6)*.35*(i?1:-1));
    }
    const w=this.state.horror.wardrobe;this.stalker.visible=w?.phase==='entering';
    if(this.stalker.visible){const f=Math.min(1,(now-w.start)/8000);this.stalker.position.set(1.85-3.65*f,0,3.3-.8*Math.sin(f*Math.PI));this.stalker.rotation.y=turnToward(this.stalker.rotation.y,Math.PI/2,dt);this.stalker.userData.legs.forEach((leg,i)=>leg.rotation.x=Math.sin(t*6)*.32*(i?1:-1));}
    this.finalCollector.visible=this.state.phase==='ending'&&now-this.state.ending.start>7000;
    const scare=p?.scare&&p.scare.until>now?p.scare:null,kind=scare?.kind;
    this.hallPolice.visible=this.hallFigure.visible&&!!a?.patrol;if(this.hallPolice.visible){this.hallPolice.position.copy(this.hallFigure.position);this.hallPolice.rotation.copy(this.hallFigure.rotation);this.hallPolice.userData.legs.forEach((leg,i)=>leg.rotation.x=this.hallFigure.userData.legs[i].rotation.x);this.hallFigure.visible=false;}
    this.collector.visible=kind==='collector';this.windowScare.visible=kind==='window';this.wardrobeScare.visible=kind==='wardrobe';this.scare.visible=!!scare&&!['collector','window','wardrobe'].includes(kind);
    this.shake={x:0,y:0,z:0};this.glow.intensity=0;
    if(scare){
      const age=Math.max(0,(now-(scare.start||scare.until-2200))/1000),lunge=1-Math.pow(1-Math.min(1,age/.24),3),reduced=!!this.reducedEffects;
      const model=kind==='collector'?this.collector:kind==='window'?this.windowScare:kind==='wardrobe'?this.wardrobeScare:this.scare;
      model.position.set(kind==='wardrobe'?.07:Math.sin(t*31)*.015,reduced?-2.85:kind==='collector'?-2.9:-2.7,-2.2+lunge*(reduced?.9:1.27));
      model.userData.arms.forEach((arm,i)=>arm.rotation.x=-1.2-lunge*.45+(i?.1:0));
      model.rotation.z=reduced?0:Math.sin(age*37)*(kind==='hall'?.07:.035);
      if(kind==='hall')model.scale.set(1.65,1.85,1.7);else if(model===this.scare)model.scale.setScalar(1.7);
      this.glow.color.set(kind==='collector'?'#e1b48a':kind==='window'?'#b0c8cc':kind==='wardrobe'?'#bf8876':'#d5d8b6');
      this.glow.intensity=reduced?1.2:2.6+Math.sin(age*19)*.6;
      if(!reduced){const force=Math.max(0,1-age/1.8)*.04;this.shake={x:Math.sin(age*83)*force,y:Math.cos(age*67)*force,z:Math.sin(age*91)*force*.4};}
    }
  }
}
