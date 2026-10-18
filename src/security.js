import * as THREE from 'three';
const mat=(c,rough=0.8,metal=0.08,extra={})=>new THREE.MeshStandardMaterial({color:c,roughness:rough,metalness:metal,...extra});
const wet=mat('#29353a',0.19,0.25),brick=mat('#343232'),cement=mat('#4c5250'),steel=mat('#3a4449',.35,.65);
function box(parent,w,h,d,x,y,z,m){const a=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);a.position.set(x,y,z);a.castShadow=true;a.receiveShadow=true;parent.add(a);return a;}
function cyl(parent,top,bottom,h,x,y,z,m,segments=9){const a=new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,h,segments),m);a.position.set(x,y,z);a.castShadow=true;parent.add(a);return a;}
function character(parent,coat,pose='waiting'){
  const g=new THREE.Group(),cloth=mat(coat,.96),trim=mat('#1d262b'),skin=mat('#8d7c6d'),shoes=mat('#141a1b');
  // Distinct silhouette: hood, face, jacket, hands and legs.
  box(g,.70,.83,.33,0,1.07,0,cloth);
  box(g,.52,.27,.42,0,1.52,-.035,cloth);
  const hood=cyl(g,.28,.31,.38,0,1.69,0,cloth);hood.rotation.z=.04;
  box(g,.36,.29,.19,0,1.68,-.18,skin);
  box(g,.43,.13,.12,0,1.86,-.11,trim);
  for(const side of [-1,1]){
    const arm=box(g,.22,.69,.27,side*.47,1.01,.015,cloth);arm.rotation.z=side*.12;
    box(g,.15,.17,.17,side*.47,0.64,.01,skin);
    const leg=box(g,.25,.66,.28,side*.20,.36,.02,trim);
    leg.rotation.x=side*.045;
    box(g,.31,.16,.48,side*.20,.08,-.085,shoes);
  }
  if(pose==='courier'){box(g,.47,.33,.32,.33,.73,-.40,mat('#8d775b'));box(g,.48,.036,.04,.33,.87,-.57,steel);}
  if(pose==='thief'){box(g,.23,.23,.14,.18,1.13,-.22,mat('#454e4f'));g.rotation.y=-.3;}
  return g;
}
function wallBlocks(scene,offsetX,wallZ,cols,rows,span=6){
  const geometry=new THREE.BoxGeometry(span/cols-.03,.19,.12);
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    const m=new THREE.Mesh(geometry,(x+y)%7===0?cement:brick);
    m.position.set(offsetX-span/2+(x+.5)*span/cols, .23+y*.22,wallZ);
    m.receiveShadow=true;scene.add(m);
  }
}
export class SecurityViews{
  constructor(scene,renderer){
    this.scene=scene;this.renderer=renderer;this.mode=null;this.frame=0;
    this.alleyCamera=new THREE.PerspectiveCamera(65,16/9,.05,55);
    this.alleyCamera.position.set(2.65,2.65,-6.35);this.alleyCamera.lookAt(0,1.14,-9.65);
    this.peepCamera=new THREE.PerspectiveCamera(112,16/9,.035,18);
    this.peepCamera.position.set(5.14,1.67,-1.45);this.peepCamera.lookAt(7.85,1.56,-1.45);
    this.target=new THREE.WebGLRenderTarget(640,360,{depthBuffer:true});
    this.feed=new THREE.Mesh(new THREE.PlaneGeometry(1.075,.645),
      new THREE.MeshBasicMaterial({map:this.target.texture,color:'#cee5da',toneMapped:false}));
    this.feed.rotation.y=Math.PI/2;
    this.feed.position.set(-4.603,2.31,-1.05);scene.add(this.feed);
    this.makeAlley();this.makeHallway();
    this.setVisitors('empty','empty');
  }
  makeAlley(){
    const s=this.scene;
    // Entirely separate outdoor geometry, visible through the security camera.
    box(s,6.4,.14,6.3,0,-.10,-9.6,wet);
    wallBlocks(s,0,-12.45,17,14,6.5);
    box(s,.20,3.7,6.4,-3.1,1.65,-9.6,cement);
    box(s,.20,3.5,6.4,3.1,1.65,-9.6,brick);
    box(s,.11,1.70,1.45,-.85,1.0,-12.31,steel);
    box(s,1.1,.24,.7,-.85,.75,-11.93,mat('#555456',.45,.7));
    box(s,.95,.10,.84,-.85,1.48,-11.90,mat('#af4d43',.40,.5));
    box(s,1.85,.86,1.03,1.73,.37,-11.13,mat('#3c5149'));
    box(s,1.65,.12,1.0,1.73,.84,-11.13,steel);
    for(let j=0;j<4;j++){const p=box(s,.09,2.0,.10,-2.7+j*.1,1.22,-12.28,steel);p.rotation.z=j*.05;}
    for(const [x,z,w] of [[-1.7,-8.55,1.16],[.4,-10.55,.8],[1.35,-8.25,1.0]]){
      const puddle=new THREE.Mesh(new THREE.CircleGeometry(w,20),new THREE.MeshStandardMaterial({color:'#587179',roughness:.08,metalness:.62,transparent:true,opacity:.55}));
      puddle.rotation.x=-Math.PI/2;puddle.scale.y=.46;puddle.position.set(x,.006,z);s.add(puddle);
    }
    const pole=cyl(s,.055,.065,3.1,-2.35,1.45,-10.8,steel);
    const bulb=box(s,.4,.09,.34,-2.35,2.97,-10.8,new THREE.MeshBasicMaterial({color:'#d6d9b8'}));
    const light=new THREE.SpotLight('#d8e5ba',66,12,Math.PI*.28,.6,1.4);
    light.position.set(-2.35,3.05,-10.8);light.target.position.set(-.3,0,-9.95);s.add(light,light.target);
    const ambience=new THREE.PointLight('#9bc3ce',27,9,2);ambience.position.set(1.3,2.5,-7.5);s.add(ambience);
    this.alleyPeople={
      buyer:character(s,'#374c55'),
      thief:character(s,'#282a30','thief'),
      watcher:character(s,'#24292a')
    };
    for(const [kind,g] of Object.entries(this.alleyPeople)){g.position.set(kind==='thief'?-1.05:.65,0,kind==='thief'?-9.4:-10.35);g.rotation.y=.15;s.add(g);}
    this.rainCount=340;this.rainPositions=new Float32Array(this.rainCount*6);
    for(let i=0;i<this.rainCount;i++){
      const a=i*6,x=(Math.random()-.5)*6.1,z=-6.35-Math.random()*6.35,y=Math.random()*3.7;
      this.rainPositions.set([x,y,z,x-.055,y-.28,z+.045],a);
    }
    const rainGeometry=new THREE.BufferGeometry();
    rainGeometry.setAttribute('position',new THREE.BufferAttribute(this.rainPositions,3));
    this.rain=new THREE.LineSegments(rainGeometry,new THREE.LineBasicMaterial({color:'#8bc4cc',transparent:true,opacity:.49,depthWrite:false}));
    this.rain.frustumCulled=false;s.add(this.rain);
  }
  makeHallway(){
    const s=this.scene;
    // The corridor is physically outside the door wall, so the peephole sees real depth.
    box(s,5.2,.14,3.4,7.55,-.09,-1.45,mat('#33312d',.65));
    box(s,5.2,.12,3.4,7.55,2.95,-1.45,cement);
    box(s,.15,3.1,3.5,10.08,1.47,-1.45,cement);
    box(s,5.2,3.1,.16,7.55,1.48,-3.15,mat('#5a5850'));
    box(s,5.2,3.1,.16,7.55,1.48,.25,mat('#5a5850'));
    for(const z of [-3.03,.13])box(s,4.95,.14,.11,7.5,.17,z,mat('#2f3431'));
    const fixture=box(s,.52,.075,.3,7.75,2.80,-1.45,new THREE.MeshBasicMaterial({color:'#e9dca8'}));
    const lamp=new THREE.PointLight('#e5b980',44,7,2);lamp.position.set(7.75,2.6,-1.45);s.add(lamp);
    box(s,.52,1.3,.13,9.92,1.66,-2.44,steel);
    box(s,.2,.20,.03,9.81,1.86,-2.53,new THREE.MeshBasicMaterial({color:'#bb4441'}));
    this.hallPeople={
      courier:character(s,'#686451','courier'),
      intruder:character(s,'#24242b')
    };
    for(const [type,g] of Object.entries(this.hallPeople)){g.position.set(type==='courier'?7.55:7.22,0,-1.45);g.rotation.y=-Math.PI/2;s.add(g);}
  }
  setVisitors(alley='empty',door='empty'){
    if(this.alleyState===alley&&this.doorState===door)return;
    this.alleyState=alley;this.doorState=door;
    for(const [name,mesh] of Object.entries(this.alleyPeople))mesh.visible=(name===alley);
    for(const [name,mesh] of Object.entries(this.hallPeople))mesh.visible=(name===door);
  }
  resize(w,h){this.alleyCamera.aspect=w/h;this.peepCamera.aspect=w/h;this.alleyCamera.updateProjectionMatrix();this.peepCamera.updateProjectionMatrix();}
  setView(mode){this.mode=mode==='alley'||mode==='peephole'?mode:null;}
  camera(){return this.mode==='alley'?this.alleyCamera:this.mode==='peephole'?this.peepCamera:null;}
  animate(dt,elapsed){
    const t=elapsed*.001;
    for(let i=0;i<this.rainCount;i++){
      const a=i*6;let y=this.rainPositions[a+1]-dt*5.1;
      if(y<0){y=3.65;this.rainPositions[a]=this.rainPositions[a+3]=(Math.random()-.5)*6.05;}
      this.rainPositions[a+1]=y;this.rainPositions[a+4]=y-.28;
    }
    this.rain.geometry.attributes.position.needsUpdate=true;
    for(const person of [...Object.values(this.alleyPeople),...Object.values(this.hallPeople)]){
      if(!person.visible)continue;
      person.position.y=Math.sin(t*1.4+person.position.x)*.012;
      person.rotation.y=(person===this.alleyPeople.thief?-.26:person===this.hallPeople.courier||person===this.hallPeople.intruder?-Math.PI/2:.15)+Math.sin(t*.48)*.033;
    }
    // 15 FPS CCTV to look like a surveillance feed without rendering a second WebGL scene.
    if(this.mode!=='alley'&&++this.frame%4===0){
      this.renderer.setRenderTarget(this.target);
      this.renderer.render(this.scene,this.alleyCamera);
      this.renderer.setRenderTarget(null);
    }
  }
  dispose(){this.target.dispose();this.feed.geometry.dispose();this.feed.material.dispose();}
}
