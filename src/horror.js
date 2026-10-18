import * as THREE from 'three';
import {character} from './security.js';
import {turnToward} from '../shared/npc.js';

export class HorrorScene{
  constructor(scene,camera){
    this.windowFigure=character(scene,'#25292d','intruder');scene.add(this.windowFigure);
    this.hallFigure=character(scene,'#181e23','intruder');this.hallFigure.scale.y=1.18;scene.add(this.hallFigure);
    this.scare=character(scene,'#29272b','intruder');this.scare.scale.setScalar(1.7);camera.add(this.scare);scene.add(camera);
    this.scare.position.set(0,-2.7,-.55);this.scare.rotation.y=Math.PI;
    const glow=new THREE.PointLight('#d1e6df',4,3);glow.position.set(0,0,-.3);camera.add(glow);this.glow=glow;
    this.windowFigure.visible=this.hallFigure.visible=this.scare.visible=false;
  }
  update(state,player){this.state=state;this.player=player;}
  animate(now,dt){
    if(!this.state)return;
    const a=this.state.horror.active,p=this.player,t=now*.001;
    this.windowFigure.visible=!!a&&['window','echo'].includes(a.kind);
    this.hallFigure.visible=a?.kind==='hall';
    if(this.windowFigure.visible){
      const hunt=a.phase==='hunting'&&a.kind==='window',progress=hunt?Math.min(1,(now-a.attackAt)/2000):0;
      this.windowFigure.position.set(1.8+Math.sin(t)*.12,0,3.68-progress*3);
      this.windowFigure.rotation.y=hunt?Math.sin(t*.7)*.6:0;
      this.windowFigure.userData.legs.forEach((leg,i)=>leg.rotation.x=hunt?Math.sin(t*6)*.38*(i?1:-1):0);
      this.windowFigure.userData.arms.forEach((arm,i)=>arm.rotation.x=hunt?Math.sin(t*6+i)*.2:-1.3);
    }
    if(this.hallFigure.visible){
      const elapsed=(now-a.start)/1000,z=a.phase==='warning'?-11+Math.min(8,elapsed*.7):-3+Math.sin((now-a.attackAt)/2000)*4;
      const last=this.hallFigure.position.z;this.hallFigure.position.set(7.1,0,z);
      this.hallFigure.rotation.y=turnToward(this.hallFigure.rotation.y,z>last?Math.PI:0,dt);
      this.hallFigure.userData.legs.forEach((leg,i)=>leg.rotation.x=Math.sin(t*6)*.35*(i?1:-1));
    }
    this.scare.visible=!!p?.scare&&p.scare.until>now;
    this.glow.intensity=this.scare.visible?5:0;
    if(this.scare.visible){this.scare.rotation.z=Math.sin(t*23)*.04;this.scare.position.z=-.57+Math.sin(t*31)*.025;}
  }
}
