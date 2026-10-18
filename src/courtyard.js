import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import * as THREE from 'three';
import {character} from './security.js';
import {turnToward} from '../shared/npc.js';
import {wornTexture} from './surfaces.js';
const material=(color,roughness=.85,metalness=.05)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
function box(s,w,h,d,x,y,z,m){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;s.add(mesh);return mesh;}
export function human(s,coat){
  const p=character(s,coat,'intruder'),skin=material('#8e8272'),face=new THREE.Mesh(new THREE.SphereGeometry(.14,12,8),skin);
  face.scale.set(.8,1,.28);face.position.set(0,1.65,-.245);p.add(face);
  box(p,.045,.07,.06,0,1.64,-.29,skin);
  for(const x of [-.055,.055])box(p,.035,.016,.014,x,1.69,-.285,material('#17201e'));
  for(const arm of p.userData.arms){const hand=new THREE.Mesh(new THREE.SphereGeometry(.064,8,6),skin);hand.position.set(0,-.57,0);arm.add(hand);}
  s.add(p);return p;
}
function foldedCurtain(s){
  const geometry=new THREE.PlaneGeometry(1.05,1.95,24,1),pos=geometry.attributes.position;
  for(let i=0;i<pos.count;i++)pos.setZ(i,Math.sin(pos.getX(i)*54)*.035);
  geometry.computeVertexNormals();const cloth=material('#514a3d');cloth.side=THREE.DoubleSide;
  const mesh=new THREE.Mesh(geometry,cloth);mesh.position.set(.8,1.58,3.80);mesh.castShadow=true;s.add(mesh);return mesh;
}
export class Courtyard{
  constructor(scene){
    this.scene=scene;const existing=new Set(scene.children);const wet=material('#364448',.19,.25),brick=material('#625650'),metal=material('#394544',.5,.65);
    brick.map=wornTexture('#9c8e7d');wet.map=wornTexture('#777f7c',true);
    box(scene,22,.16,17,0,-.18,12.5,wet);
    box(scene,22,12,.4,0,5.8,20.8,brick);box(scene,.4,12,17,-11,5.8,12.5,brick);box(scene,.4,12,17,11,5.8,12.5,brick);
    // Recessed windows and projecting fire escapes give the view several depth planes.
    const panes=[new THREE.MeshStandardMaterial({color:'#223235',emissive:'#142327',emissiveIntensity:.2,roughness:.3}),new THREE.MeshStandardMaterial({color:'#a59368',emissive:'#a17b3d',emissiveIntensity:.5,roughness:.3})];
    for(let floor=0;floor<4;floor++)for(let col=0;col<7;col++){
      const x=-9+col*3,y=1.8+floor*2.7;
      box(scene,1.3,1.8,.16,x,y,20.52,metal);
      const lit=(col+floor*3)%4===0;
      box(scene,1.12,1.57,.05,x,y,20.40,panes[Number(lit)]);
      box(scene,.05,1.6,.08,x,y,20.33,metal);box(scene,1.12,.05,.08,x,y,20.33,metal);
    }
    for(const x of [-5.8,4.1])for(const y of [2.8,5.5,8.2]){
      box(scene,2.6,.12,1.3,x,y,19.8,metal);
      for(const dx of [-1.25,0,1.25])box(scene,.04,.9,.04,x+dx,y+.5,19.2,metal);
      box(scene,2.6,.04,.04,x,y+.95,19.2,metal);
      for(let i=0;i<11;i++)box(scene,.8,.035,.22,x+.6,y+i*.24,19.75-i*.09,metal);
    }
    for(const side of [-1,1])for(let z=6;z<20;z+=3.3){
      box(scene,.12,1.8,1.15,side*10.73,3.1,z,metal);
      box(scene,.08,1.5,.92,side*10.64,3.1,z,material('#5a635b',.3));
    }
    for(const [x,z] of [[-7,9],[7,17]]){
      box(scene,2.1,1.2,1.3,x,.6,z,material('#344c41',.55,.3));box(scene,2.25,.13,1.4,x,1.25,z,metal);
      for(let i=0;i<3;i++)box(scene,.07,.8,1.33,x-.7+i*.7,.6,z,metal);
      for(const dx of [-.7,.7])box(scene,.22,.22,.23,x+dx,.12,z,material('#111a1b'));
    }
    for(let i=0;i<14;i++){
      const bag=new THREE.Mesh(new THREE.SphereGeometry(.24,7,5),material(i%2?'#292d28':'#34312c'));
      bag.position.set(-8.7+Math.sin(i*7)*.7,.17,7+i*.55);bag.scale.y=.75;scene.add(bag);
    }
    // Wire fence separates a lit service passage from the courtyard.
    for(let x=-10;x<=10;x+=2)box(scene,.065,2.2,.065,x,1.1,17.6,metal);
    box(scene,20,.055,.055,0,2.15,17.6,metal);
    const wire=[];for(let x=-12;x<12;x+=.27){wire.push(x,0,17.6,x+2.2,2.2,17.6,x,2.2,17.6,x+2.2,0,17.6);}
    const wg=new THREE.BufferGeometry();wg.setAttribute('position',new THREE.Float32BufferAttribute(wire,3));scene.add(new THREE.LineSegments(wg,new THREE.LineBasicMaterial({color:'#586561',transparent:true,opacity:.38})));
    for(const [x,z,size] of [[1,6,1.1],[-2,10,1.8],[4,13,1.4],[-6,15,1.9]]){
      const p=new THREE.Mesh(new THREE.CircleGeometry(size,28),material('#74938f',.07,.62));p.rotation.x=-Math.PI/2;p.scale.y=.5;p.position.set(x,-.085,z);p.receiveShadow=true;scene.add(p);
    }
    this.lights=[];
    for(const [x,z,color] of [[-8,8,'#c4a57b'],[6,15,'#8bbdbb']]){
      box(scene,.12,3.6,.12,x,1.7,z,metal);box(scene,.65,.12,.45,x,3.5,z,new THREE.MeshBasicMaterial({color}));
      const lamp=new THREE.SpotLight(color,95,18,Math.PI*.32,.5,1.5);lamp.position.set(x,3.4,z);lamp.target.position.set(x+1,-.1,z-2);lamp.castShadow=true;lamp.shadow.mapSize.set(512,512);scene.add(lamp,lamp.target);this.lights.push(lamp);
    }
    const fill=new THREE.HemisphereLight('#729baf','#111714',.35);scene.add(fill);
    for(let i=0;i<7;i++)box(scene,.3,.025,.07,-1+i*.34,-.075,8.5,metal);
    // Actual rain geometry continues beyond the apartment glazing.
    const rain=new Float32Array(520*6);for(let i=0;i<520;i++){const a=i*6,x=(Math.random()-.5)*21,y=Math.random()*10,z=4.3+Math.random()*16;rain.set([x,y,z,x+.05,y-.35,z-.04],a);}
    const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.BufferAttribute(rain,3));this.rainPositions=rain;
    this.rain=new THREE.LineSegments(rg,new THREE.LineBasicMaterial({color:'#a5c3cb',transparent:true,opacity:.28,depthWrite:false}));this.rain.frustumCulled=false;scene.add(this.rain);
    // Merge fixed props by material; window detail need not add hundreds of draw calls.
    const batches=new Map();for(const mesh of [...scene.children])if(mesh.isMesh&&!existing.has(mesh)){mesh.updateMatrix();const list=batches.get(mesh.material)||[];list.push(mesh.geometry.clone().applyMatrix4(mesh.matrix));batches.set(mesh.material,list);scene.remove(mesh);mesh.geometry.dispose();}
    for(const [m,geometries] of batches){const geometry=mergeGeometries(geometries,false);if(geometry){const mesh=new THREE.Mesh(geometry,m);mesh.castShadow=mesh.receiveShadow=true;scene.add(mesh);}geometries.forEach(g=>g.dispose());}
    this.prowler=human(scene,'#666252');this.prowler.visible=false;
    this.pedestrians=[human(scene,'#3e5054'),human(scene,'#494039')];
    this.curtains=[foldedCurtain(scene),foldedCurtain(scene)];this.closure=0;
    this.hands=new THREE.Group();for(const x of [1.53,2.17]){box(this.hands,.11,.34,.13,x,1.12,3.55,material('#3b4944'));box(this.hands,.12,.14,.09,x,1.35,3.66,material('#a18e77'));}scene.add(this.hands);this.hands.visible=false;
  }
  update(state){this.state=state;}
  animate(now,dt){
    if(!this.state)return;
    const t=now*.001,a=this.state.horror.active,hold=this.state.curtains;
    const target=hold?1:0;this.closure+=(target-this.closure)*Math.min(1,dt*7);
    this.curtains.forEach((mesh,i)=>{mesh.scale.x=.07+.93*this.closure;mesh.position.x=i?2.9-this.closure*.525:.8+this.closure*.525;});
    this.hands.visible=!!hold?.owner&&!hold.closed;this.hands.position.y=Math.sin(t*11)*.009;
    for(let i=0;i<this.rainPositions.length;i+=6){let y=this.rainPositions[i+1]-dt*7;if(y<0)y=10;this.rainPositions[i+1]=y;this.rainPositions[i+4]=y-.35;}
    this.rain.geometry.attributes.position.needsUpdate=true;
    this.pedestrians.forEach((p,i)=>{const cycle=((now-this.state.created)/1000+i*23)%57,walking=cycle<23;p.visible=walking||i===1&&cycle>47;if(!p.visible)return;
      const x=walking?-9+cycle/23*18:7;p.position.set(x,0,walking?15+i*3:19);p.rotation.y=turnToward(p.rotation.y,walking?-Math.PI/2:Math.PI,dt);p.userData.legs.forEach((leg,j)=>leg.rotation.x=walking?Math.sin(t*6)*.38*(j?1:-1):0);
    });
    this.prowler.visible=a?.kind==='window';if(!this.prowler.visible)return;
    const retreat=a.phase==='retreating',hunting=a.phase==='hunting';
    const progress=retreat?Math.min(1,(now-a.retreatAt)/5500):Math.min(1,Math.max(0,(now-a.start)/8000));
    const q=progress*progress*(3-2*progress),from=Math.min(1,(a.retreatAt-a.start)/8000),travel=retreat?(from*from*(3-2*from))*(1-q):q;
    const p=this.prowler;p.position.set(-5+6.85*travel,0,14-9.55*travel-(hunting?Math.min(3,(now-a.attackAt)/800):0));
    const moving=retreat||progress<1||hunting,yaw=hunting?0:moving?(retreat?Math.atan2(6.85,-9.55):Math.atan2(-6.85,9.55)):0;
    p.rotation.y=turnToward(p.rotation.y,yaw,dt);p.rotation.x=!moving?Math.sin(t*1.3)*.03:0;
    p.userData.legs.forEach((leg,j)=>leg.rotation.x=moving?Math.sin(t*7)*.4*(j?1:-1):0);
    p.userData.arms.forEach((arm,j)=>arm.rotation.x=moving?Math.sin(t*7+j*Math.PI)*.2:-1.05);
  }
}
