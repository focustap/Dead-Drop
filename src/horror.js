import {human} from './courtyard.js';
import * as THREE from 'three';
import {character} from './security.js';
import {turnToward} from '../shared/npc.js';

export class HorrorScene{
  constructor(scene,camera){
    this.hallFigure=character(scene,'#181e23','intruder');this.hallFigure.scale.y=1.18;scene.add(this.hallFigure);
    this.scare=character(scene,'#29272b','intruder');this.scare.scale.setScalar(1.7);camera.add(this.scare);scene.add(camera);
    for(const x of [-.065,.065]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.017,8,6),new THREE.MeshBasicMaterial({color:'#aabbb2'}));eye.position.set(x,1.68,-.258);eye.scale.set(1,.4,.35);this.scare.add(eye);}
    this.scare.position.set(0,-2.7,-1.02);this.scare.rotation.y=Math.PI;
    const glow=new THREE.PointLight('#d1e6df',4,3);glow.position.set(0,0,-.3);camera.add(glow);this.glow=glow;
    this.windowScare=human(camera,'#666252');this.windowScare.scale.setScalar(1.7);this.windowScare.position.set(0,-2.7,-1.12);this.windowScare.rotation.y=Math.PI;this.windowScare.visible=false;
    this.collector=character(scene,'#211b19','collector');this.collector.scale.set(1.95,1.8,1.8);this.collector.position.set(0,-2.9,-1.18);this.collector.rotation.y=Math.PI;camera.add(this.collector);
    const caseMesh=new THREE.Mesh(new THREE.BoxGeometry(.5,.37,.18),new THREE.MeshStandardMaterial({color:'#362e20',metalness:.6,roughness:.35}));caseMesh.position.set(.42,.7,-.12);this.collector.add(caseMesh);this.collector.visible=false;
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
    this.collector.visible=p?.scare?.kind==='collector'&&p.scare.until>now;
    this.windowScare.visible=p?.scare?.kind==='window'&&p.scare.until>now;
    this.scare.visible=!!p?.scare&&!['collector','window'].includes(p.scare.kind)&&p.scare.until>now;
    this.glow.intensity=this.collector.visible?8:this.scare.visible||this.windowScare.visible?5:0;
    if(this.scare.visible){this.scare.rotation.z=Math.sin(t*23)*.04;this.scare.position.z=-1.02+Math.sin(t*31)*.025;}
  }
}
