import * as THREE from 'three';
const mesh=(geo,mat,x=0,y=0,z=0)=>{const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;return o;};
const mat=(color,roughness=.85,metalness=.05,extra={})=>new THREE.MeshStandardMaterial({color,roughness,metalness,...extra});
const concrete=mat('#252e2c'),paint=mat('#39423e'),wood=mat('#443d36'),wood2=mat('#2f2b29'),metal=mat('#3d4549',.5,.6),dark=mat('#101a1e'),keymat=mat('#161d1f');
const green=new THREE.MeshStandardMaterial({color:'#74dfb9',emissive:'#1e9872',emissiveIntensity:.8});
const red=new THREE.MeshStandardMaterial({color:'#eb4b53',emissive:'#aa172d',emissiveIntensity:.7});
function box(scene,w,h,d,x,y,z,m){const obj=mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z);scene.add(obj);return obj;}
function cylinder(scene,rt,rb,height,x,y,z,m){const obj=mesh(new THREE.CylinderGeometry(rt,rb,height,10),m,x,y,z);scene.add(obj);return obj;}
function plane(scene,w,h,x,y,z,m,ry=0){const obj=mesh(new THREE.PlaneGeometry(w,h),m,x,y,z);obj.rotation.y=ry;scene.add(obj);return obj;}
export class World{
  constructor(container,callbacks={}){
    this.callbacks=callbacks;this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#101a1a');this.scene.fog=new THREE.FogExp2('#101b1c',.035);
    this.camera=new THREE.PerspectiveCamera(77,1,.06,70);this.camera.rotation.order='YXZ';
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1;
    container.append(this.renderer.domElement);
    this.clock=new THREE.Clock();this.yaw=0;this.pitch=0;this.pos=new THREE.Vector3(-1.2,1.65,-.75);
    this.keys=new Set();this.players=new Map();this.interactions=[];this.near=null;this.lastMove=0;
    this.lights={};this.build();
    this.resize();window.addEventListener('resize',()=>this.resize());
    this.renderer.domElement.addEventListener('click',()=>{if(this.callbacks.canMove?.())this.renderer.domElement.requestPointerLock?.();});
    document.addEventListener('pointerlockchange',()=>this.callbacks.onLock?.(document.pointerLockElement===this.renderer.domElement));
    document.addEventListener('mousemove',e=>{if(document.pointerLockElement!==this.renderer.domElement)return;this.yaw-=e.movementX*.0021;this.pitch=Math.max(-1.33,Math.min(1.33,this.pitch-e.movementY*.0021));});
    window.addEventListener('keydown',e=>{if(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight'].includes(e.code))this.keys.add(e.code);});
    window.addEventListener('keyup',e=>this.keys.delete(e.code));window.addEventListener('blur',()=>this.keys.clear());
    this.camera.position.copy(this.pos);this.animate();
  }
  resize(){const el=this.renderer.domElement.parentElement;const w=el.clientWidth||innerWidth,h=el.clientHeight||innerHeight;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  build(){
    const scene=this.scene;
    const floor=mat('#303532',1);box(scene,10,.2,8,0,-.13,0,floor);
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
    box(scene,1.25,2.4,1.4,3.75,1.15,2.4,metal);
    box(scene,1.05,1.8,1.25,3.70,1.22,2.4,mat('#182e2a'));
    box(scene,.95,.09,1.1,3.66,1.65,2.4,new THREE.MeshStandardMaterial({color:'#799c87',emissive:'#4b8363',emissiveIntensity:1}));
    this.interactions.push({id:'garden',label:'OPEN GROW CABINET',x:3.1,z:2.4,range:1.65});
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
        this.pos.x=Math.min(4.25,Math.max(-4.25,this.pos.x+dx));this.pos.z=Math.min(3.30,Math.max(-3.30,this.pos.z+dz));
        if((dx||dz)&&performance.now()-this.lastMove>75){this.lastMove=performance.now();this.callbacks.onMove?.({x:this.pos.x,z:this.pos.z,yaw:this.yaw});}
      }
      const now=performance.now();this.lights.bulb.intensity=35+(Math.sin(now*.0012)*1.3)+(Math.sin(now*.067)>0.989?-18:0);
      this.camera.position.copy(this.pos);this.camera.rotation.set(this.pitch,this.yaw,0,'YXZ');
      this.near=this.nearby();this.callbacks.onFocus?.(this.near);
      this.renderer.render(this.scene,this.camera);
    };loop();
  }
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
      if(!o){o=new THREE.Group();const colors=['#657e7d','#816f65','#8a7867','#575e62'];
        const body=mesh(new THREE.BoxGeometry(.49,.8,.31),mat(colors[this.players.size%colors.length]),0,.83,0);
        const head=mesh(new THREE.BoxGeometry(.35,.37,.33),mat('#786d64'),0,1.43,0);
        const armA=mesh(new THREE.BoxGeometry(.16,.62,.23),mat('#354042'),-.34,.89,0);
        const armB=armA.clone();armB.position.x=.34;
        o.add(body,head,armA,armB);this.scene.add(o);this.players.set(p.id,o);
      }
      o.position.set(p.x||0,0,p.z||0);o.rotation.y=p.yaw||0;
    }
    for(const [id,o] of this.players)if(!living.has(id)){this.scene.remove(o);this.players.delete(id);}
  }
}
