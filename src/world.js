import {slide,STATIONS} from '../shared/layout.js';
import * as THREE from 'three';
import {SecurityViews,character} from './security.js';
import {wornTexture} from './surfaces.js';
const mesh=(geo,mat,x=0,y=0,z=0)=>{const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;return o;};
const mat=(color,roughness=.85,metalness=.05,extra={})=>new THREE.MeshStandardMaterial({color,roughness,metalness,...extra});
const concrete=mat('#252e2c'),paint=mat('#39423e'),wood=mat('#443d36'),wood2=mat('#2f2b29'),metal=mat('#3d4549',.5,.6),dark=mat('#101a1e'),keymat=mat('#161d1f');
paint.map=wornTexture('#a1a79d');wood.map=wornTexture('#a9977f');
const green=new THREE.MeshStandardMaterial({color:'#74dfb9',emissive:'#1e9872',emissiveIntensity:.8});
const red=new THREE.MeshStandardMaterial({color:'#eb4b53',emissive:'#aa172d',emissiveIntensity:.7});
function box(scene,w,h,d,x,y,z,m){const obj=mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z);scene.add(obj);return obj;}
function cylinder(scene,rt,rb,height,x,y,z,m){const obj=mesh(new THREE.CylinderGeometry(rt,rb,height,10),m,x,y,z);scene.add(obj);return obj;}
function plane(scene,w,h,x,y,z,m,ry=0){const obj=mesh(new THREE.PlaneGeometry(w,h),m,x,y,z);obj.rotation.y=ry;scene.add(obj);return obj;}
export class World{
  constructor(container,callbacks={}){
    this.sensitivity=1;this.power=true;this.callbacks=callbacks;this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#101a1a');this.scene.fog=new THREE.FogExp2('#101b1c',.035);
    this.camera=new THREE.PerspectiveCamera(77,1,.06,70);this.camera.rotation.order='YXZ';
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1;
    container.append(this.renderer.domElement);
    this.clock=new THREE.Clock();this.yaw=0;this.pitch=0;this.pos=new THREE.Vector3(-1.2,1.65,-.75);
    this.keys=new Set();this.players=new Map();this.interactions=[];this.near=null;this.lastMove=0;
    this.lights={};this.build();
    this.security=new SecurityViews(this.scene,this.renderer);this.view=null;
    this.resize();window.addEventListener('resize',()=>this.resize());
    this.renderer.domElement.addEventListener('click',()=>{if(this.callbacks.canMove?.())this.renderer.domElement.requestPointerLock?.();});
    document.addEventListener('pointerlockchange',()=>this.callbacks.onLock?.(document.pointerLockElement===this.renderer.domElement));
    document.addEventListener('mousemove',e=>{if(document.pointerLockElement!==this.renderer.domElement)return;this.yaw-=e.movementX*.0021*this.sensitivity;this.pitch=Math.max(-1.33,Math.min(1.33,this.pitch-e.movementY*.0021*this.sensitivity));});
    window.addEventListener('keydown',e=>{if(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight'].includes(e.code))this.keys.add(e.code);});
    window.addEventListener('keyup',e=>this.keys.delete(e.code));window.addEventListener('blur',()=>this.keys.clear());
    this.camera.position.copy(this.pos);this.animate();
  }
  resize(){const el=this.renderer.domElement.parentElement;const w=el.clientWidth||innerWidth,h=el.clientHeight||innerHeight;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.security?.resize(w,h);}
  build(){
    const scene=this.scene;
    const floor=mat('#64695f',1);floor.map=wornTexture('#7d8277',true);box(scene,10,.2,8,0,-.13,0,floor);
    const ceiling=mat('#1a2221');box(scene,10,.18,8,0,3.15,0,ceiling);
    box(scene,10,3.1,.22,0,1.54,-4,paint);box(scene,10,3.1,.22,0,1.54,4,paint);
    box(scene,.22,3.1,8,-5,1.54,0,paint);box(scene,.22,3.1,8,5,1.54,0,paint);
    // Distressed baseboards, pipes, and practical architectural details.
    for(const z of [-3.87,3.87]){box(scene,9.8,.18,.08,0,.09,z,wood2);box(scene,9.8,.06,.08,0,2.95,z,wood2);}
    for(const x of [-4.88,4.88]){box(scene,.08,.19,7.9,x,.09,0,wood2);}
    const conduit=mat('#61645e',.6,.6);for(const z of [-3.8,3.8]){const p=cylinder(scene,.035,.035,9.5,0,2.75,z,conduit);p.rotation.z=Math.PI/2;}
    const lightFixture=mat('#50544a',.48,.5);box(scene,2.6,.12,.7,0,3.0,.1,lightFixture);
    box(scene,2.25,.045,.52,0,2.92,.1,new THREE.MeshStandardMaterial({color:'#b8b6a0',emissive:'#8c8e70',emissiveIntensity:.6}));
    const ambient=new THREE.HemisphereLight('#9bc0b0','#1a2425',.7);scene.add(ambient);
    const overhead=new THREE.PointLight('#f2daaa',35,10,2);overhead.position.set(0,2.6,0);overhead.castShadow=true;overhead.shadow.mapSize.set(512,512);scene.add(overhead);this.lights.overhead=overhead;
    const glow=new THREE.PointLight('#64cbb4',9,4.3,2);glow.position.set(-1.3,1.75,-2.55);scene.add(glow);
    const threat=new THREE.PointLight('#c94241',4,4,2);threat.position.set(4.25,2,-1.6);scene.add(threat);
    // Four independent workstations arranged along the far and side walls.
    const desks=[[-3,-2.5],[-.95,-2.5],[1.1,-2.5],[3.15,-2.5]];
    for(let i=0;i<4;i++){let [x,z]=desks[i];const leg=mat('#222b2b',.65,.4);box(scene,1.65,.12,.9,x,.83,z,wood);for(let dx of [-.7,.7])for(let dz of [-.32,.32])box(scene,.085,.78,.08,x+dx,.4,z+dz,leg);
      box(scene,.88,.58,.12,x,1.2,z-.18,dark);
      box(scene,.76,.46,.04,x,1.2,z-.1,new THREE.MeshStandardMaterial({color:'#24443c',emissive:'#104637',emissiveIntensity:.38}));
      box(scene,.12,.25,.12,x,.93,z-.18,leg);box(scene,.6,.04,.38,x,.91,z+.20,keymat);
      for(let col=0;col<8;col++)for(let row=0;row<3;row++)box(scene,.049,.008,.055,x-.245+col*.07,.938,z+.085+row*.085,mat('#495957',.8,.1));
      box(scene,.43,.07,.4,x,.44,z+.78,wood2);box(scene,.10,.45,.10,x,.19,z+.78,leg);
      box(scene,.41,.50,.07,x,.78,z+.96,mat('#313e3a'));
      this.interactions.push({id:'computer',label:'WORKSTATION '+(i+1),x,z:z+.6,range:3.1,desk:i});
    }
    // Supplies door with metal frame and peephole.
    box(scene,.18,2.48,1.5,4.82,1.25,-1.45,metal);
    box(scene,.10,2.25,1.21,4.71,1.22,-1.45,wood2);
    const knob=cylinder(scene,.07,.07,.10,4.61,1.22,-1.03,mat('#b19b78',.28,.8));knob.rotation.z=Math.PI/2;
    const eye=cylinder(scene,.043,.043,.10,4.60,1.7,-1.45,mat('#c9a978',.26,.8));eye.rotation.z=Math.PI/2;
    box(scene,.04,.18,.78,4.59,2.55,-1.45,red);
    this.interactions.push({id:'peephole',label:'CHECK PEEPHOLE',x:4.08,z:-1.6,range:1.5},{id:'door',label:'OPEN SUPPLY DOOR',x:4.08,z:-.85,range:1.15});
    // Side-wall dead drop with corrugated chute and a small camera feed.
    box(scene,.15,1.4,1.1,-4.82,1.3,1.15,metal);box(scene,.19,.16,.91,-4.72,1.05,1.15,dark);
    box(scene,.21,.12,1.15,-4.68,1.73,1.15,red);box(scene,.50,.09,1.4,-4.59,.7,1.15,wood2);
    this.interactions.push({id:'chute',label:'USE DEAD DROP',x:-4.03,z:1.15,range:1.55});
    box(scene,.13,.75,1.15,-4.80,2.31,-1.05,dark);box(scene,.14,.62,1.03,-4.71,2.31,-1.05,new THREE.MeshStandardMaterial({color:'#29464d',emissive:'#113445',emissiveIntensity:.45}));
    this.interactions.push({id:'camera',label:'CHECK ALLEY CAMERAS',x:-4,z:-1.05,range:1.55});
    // Grow cabinet and storage clutter.
    box(scene,.08,2.4,1.4,4.35,1.15,2.4,metal);for(const z of [1.72,3.08])box(scene,1.25,2.4,.05,3.75,1.15,z,metal);
    box(scene,1.25,.08,1.4,3.75,2.35,2.4,mat('#182e2a'));
    this.growLamp=box(scene,.95,.05,1.1,3.66,2.15,2.4,new THREE.MeshStandardMaterial({color:'#799c87',emissive:'#4b8363',emissiveIntensity:1}));
    this.interactions.push({id:'garden',label:'TEND GROW TENT',x:3.1,z:2.4,range:1.8});
    this.interactions.push({id:'packaging',label:'PACK HARVEST',x:.6,z:2.9,range:1.8},{id:'breaker',label:'RESET FUSE BOX',x:4.1,z:.8,range:1.7});
    box(scene,1.8,.1,.8,.6,.85,3.15,wood);for(const x of [-.15,1.35])box(scene,.08,.8,.65,x,.4,3.15,metal);
    this.harvestTray=box(scene,.55,.08,.40,.15,.94,3.12,mat('#455638'));
    this.packageMesh=box(scene,.40,.18,.30,.85,1,3.15,mat('#9b8862'));
    box(scene,.15,.65,.45,4.7,1.45,.8,metal);this.breakerLamp=box(scene,.17,.08,.08,4.6,1.64,.8,green);
    this.plantGroup=new THREE.Group();this.plantGroup.position.set(3.65,.64,2.4);scene.add(this.plantGroup);
    cylinder(scene,.32,.24,.36,3.65,.40,2.4,mat('#5a5142'));this.soilMesh=cylinder(scene,.29,.29,.04,3.65,.59,2.4,mat('#28201a'));
    cylinder(this.plantGroup,.025,.035,.8,0,.4,0,mat('#445b38'));
    for(let i=0;i<9;i++){const leaf=mesh(new THREE.SphereGeometry(.18,6,4),mat(i%2?'#566744':'#3e5335'),Math.sin(i*2.4)*.19,.18+i*.075,Math.cos(i*2.4)*.19);leaf.scale.set(.6,.24,1.8);leaf.rotation.y=i*2.4;this.plantGroup.add(leaf);}
    this.can=new THREE.Group();cylinder(this.can,.13,.16,.28,0,0,0,mat('#62756f',.4,.4));const spout=cylinder(this.can,.025,.04,.30,-.18,.08,0,metal);spout.rotation.z=1;this.can.position.set(3.2,.28,3.35);scene.add(this.can);
    this.lights.grow=new THREE.PointLight('#b9d29b',5,2.5,2);this.lights.grow.position.set(3.5,1.9,2.4);scene.add(this.lights.grow);
    this.seedToken=mesh(new THREE.SphereGeometry(.045,7,5),mat('#c8b78c'),3.65,1.2,2.4);scene.add(this.seedToken);this.seedToken.visible=false;
    this.waterStream=box(scene,.035,.5,.035,3.48,.9,2.4,mat('#83b8c0',.1,.3));this.waterStream.visible=false;
    for(let i=0;i<8;i++){let x=(i%3)*.42-3.9,z=2.9-Math.floor(i/3)*.43;box(scene,.39,.38,.41,x,.22,z,i%2?wood:metal);}
    // Pipes and loose floor markings.
    const brass=mat('#716957',.6,.55);for(let i=0;i<5;i++){const p=cylinder(scene,.02,.02,1.3,0+i*.38,2.75,3.83,brass);p.rotation.z=Math.PI/2;}
    const stripe=mat('#80734e');for(let i=0;i<4;i++)box(scene,.07,.012,.6,-4.1+i*.2,-.017,3.38,stripe);
    // Hallway flashlight throw under the door.
    plane(scene,.85,.06,4.47,.07,-1.45,new THREE.MeshBasicMaterial({color:'#b7a67a',transparent:true,opacity:.55}),-Math.PI/2);
    this.lights.bulb=overhead;
  }
  animate(){
    const loop=()=>{requestAnimationFrame(loop);const dt=Math.min(.2,this.clock.getDelta());
      if(this.callbacks.canMove?.()&&document.pointerLockElement===this.renderer.domElement){
        const speed=this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')?4:2.8;
        let forward=(this.keys.has('KeyW')?1:0)-(this.keys.has('KeyS')?1:0),side=(this.keys.has('KeyD')?1:0)-(this.keys.has('KeyA')?1:0);
        const norm=Math.hypot(forward,side)||1;forward/=norm;side/=norm;
        const dx=(-Math.sin(this.yaw)*forward+Math.cos(this.yaw)*side)*dt*speed;
        const dz=(-Math.cos(this.yaw)*forward-Math.sin(this.yaw)*side)*dt*speed;
        const resolved=slide(this.pos,{x:this.pos.x+dx,z:this.pos.z+dz});this.pos.x=resolved.x;this.pos.z=resolved.z;
        if((dx||dz)&&performance.now()-this.lastMove>75){this.lastMove=performance.now();this.callbacks.onMove?.({x:this.pos.x,z:this.pos.z,yaw:this.yaw});}
      }
      for(const o of this.players.values()){const moving=o.position.distanceTo(o.userData.target)>.025;o.position.lerp(o.userData.target,Math.min(1,dt*12));o.rotation.y=o.userData.yaw;o.userData.legs.forEach((leg,i)=>leg.rotation.x=moving?Math.sin(performance.now()*.008)*.4*(i?1:-1):0);}
      const now=performance.now();this.security.animate(dt,now);this.lights.bulb.intensity=this.power?35+(Math.sin(now*.0012)*1.3)+(Math.sin(now*.067)>0.989?-18:0):.5;
      if(this.feedbackUntil>now){const progress=(this.feedbackUntil-now)/900;this.can.rotation.z=Math.sin(progress*Math.PI)*-.6;this.waterStream.visible=this.feedbackAction==='garden:water';if(this.waterStream.visible)this.can.position.set(3.9,1.4,2.4);this.seedToken.visible=this.feedbackAction==='garden:plant';this.seedToken.position.y=.65+progress*.65;this.packageMesh.rotation.z=this.feedbackAction==='pack:seal'?Math.sin(progress*Math.PI)*.1:0;}else{this.can.rotation.z=0;this.can.position.set(3.2,.28,3.35);this.seedToken.visible=false;this.waterStream.visible=false;this.packageMesh.rotation.z=0;}
      this.camera.position.copy(this.pos);this.camera.rotation.set(this.pitch,this.yaw,0,'YXZ');
      this.near=this.view?null:this.nearby();this.callbacks.onFocus?.(this.near);
      this.security.render(this.camera);
    };loop();
  }
  applySettings(settings){this.sensitivity=Number(settings.sensitivity)||1;this.renderer.setPixelRatio(settings.quality==='low'?.75:settings.quality==='high'?Math.min(devicePixelRatio,1.75):1);this.renderer.shadowMap.enabled=settings.quality!=='low';this.security.quality=settings.quality;this.resize();}
  updateGame(state,now){this.power=state.environment.power;this.security.signalLost=!this.power||state.environment.cameraUntil>now;this.security.serverNow=now;this.security.serverStamp=performance.now();const g=state.garden;this.plantGroup.visible=g.planted;this.plantGroup.scale.setScalar(.2+g.growth/125);this.soilMesh.visible=g.soil;this.lights.grow.intensity=g.light&&this.power?5:0;this.growLamp.material.emissiveIntensity=g.light&&this.power?1:0;this.seenActivities??=new Set();for(const {activity} of state.players)if(activity&&activity.until>now&&!this.seenActivities.has(activity.id)){this.seenActivities.add(activity.id);if(this.seenActivities.size>64)this.seenActivities.delete(this.seenActivities.values().next().value);this.stationFeedback(activity.action);}this.harvestTray.visible=state.inventory.buds>0;this.packageMesh.visible=state.inventory.packages>0;this.breakerLamp.material=this.power?green:red;}
  stationFeedback(action){this.feedbackAction=action;this.feedbackUntil=performance.now()+900;}
  focusStation(id){const target=STATIONS[id];if(!target)return;this.yaw=Math.atan2(-(target.x-this.pos.x),-(target.z-this.pos.z));this.pitch=-.22;}
  setView(mode){this.view=mode==='alley'||mode==='peephole'?mode:null;this.security.setView(this.view);this.keys.clear();if(!this.view){this.near=this.nearby();this.callbacks.onFocus?.(this.near);}}
  setVisitors(alley,door){this.security.setVisitors(alley,door);}
  nearby(){
    let best=null,score=-1;const dir=new THREE.Vector3(0,0,-1).applyEuler(this.camera.rotation);const p=this.pos;
    for(const t of this.interactions){
      const d=new THREE.Vector3(t.x-p.x,-.5,t.z-p.z),len=d.length();
      if(len>t.range)continue;
      const facing=d.normalize().dot(dir);
      if(facing>.05 && facing/Math.max(.4,len)>score){best=t;score=facing/Math.max(.4,len);}
    }
    return best;
  }
  setOthers(players,self){
    const living=new Set();
    for(const p of players||[]){if(!p||p.id===self)continue;living.add(p.id);let o=this.players.get(p.id);
      if(!o){o=character(this.scene,['#657e7d','#816f65','#8a7867','#575e62'][this.players.size%4],'crew');
        o.userData.carry=box(o,.44,.24,.3,0,.9,-.33,wood);this.scene.add(o);this.players.set(p.id,o);
        o.position.set(p.x,0,p.z);
      }
      o.userData.carry.visible=!!p.carrying;o.userData.target=new THREE.Vector3(p.x||0,0,p.z||0);o.userData.yaw=p.yaw||0;

    }
    for(const [id,o] of this.players)if(!living.has(id)){this.scene.remove(o);this.players.delete(id);}
  }
}
