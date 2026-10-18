import {visitorMotion,turnToward} from '../shared/npc.js';
import * as THREE from 'three';
import {wornTexture} from './surfaces.js';
const mat=(c,rough=0.8,metal=0.08,extra={})=>new THREE.MeshStandardMaterial({color:c,roughness:rough,metalness:metal,...extra});
const wet=mat('#29353a',0.19,0.25),brick=mat('#343232'),cement=mat('#4c5250'),steel=mat('#3a4449',.35,.65);
cement.map=wornTexture('#a4a69c');brick.map=wornTexture('#a89e91');
function box(parent,w,h,d,x,y,z,m){const a=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);a.position.set(x,y,z);a.castShadow=true;a.receiveShadow=true;parent.add(a);return a;}
function cyl(parent,top,bottom,h,x,y,z,m,segments=9){const a=new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,h,segments),m);a.position.set(x,y,z);a.castShadow=true;parent.add(a);return a;}
export function character(parent,coat,pose='buyer'){
  const g=new THREE.Group(),cloth=mat(coat,.96),trim=mat('#1d262b'),skin=mat('#8d7c6d'),shoes=mat('#141a1b');
  // Distinct silhouette: hood, face, jacket, hands and legs.
  const torso=cyl(g,.24,.30,.76,0,1.05,0,cloth,10);torso.scale.z=.65;
  const shoulders=new THREE.Mesh(new THREE.SphereGeometry(.29,10,8),cloth);shoulders.scale.set(1,.45,.65);shoulders.position.y=1.42;g.add(shoulders);
  const hood=new THREE.Mesh(new THREE.SphereGeometry(.235,12,10),cloth);hood.scale.set(.95,1.12,.95);hood.position.set(0,1.65,.015);g.add(hood);
  const face=new THREE.Mesh(new THREE.SphereGeometry(.17,10,8),mat('#050809'));face.scale.set(.82,1,.36);face.position.set(0,1.65,-.19);g.add(face);
  box(g,.027,.58,.025,0,1.04,-.18,trim);g.userData.pose=pose;g.userData.legs=[];g.userData.arms=[];
  for(const side of [-1,1]){
    const arm=new THREE.Group();arm.position.set(side*.24,1.36,0);g.add(arm);
    cyl(arm,.09,.075,.53,side*.045,-.24,0,cloth);cyl(arm,.065,.06,.12,side*.045,-.52,0,trim);arm.rotation.z=side*.08;g.userData.arms.push(arm);
    const leg=new THREE.Group();leg.position.set(side*.14,.74,0);g.add(leg);
    cyl(leg,.105,.085,.63,0,-.3,0,trim);box(leg,.19,.14,.32,0,-.66,-.07,shoes);g.userData.legs.push(leg);
  }
  if(pose==='courier'){box(g,.47,.33,.32,.18,1,-.35,mat('#8d775b'));box(g,.06,.34,.33,.18,1,-.35,mat('#c3b698'));}
  if(pose==='thief'){box(g,.23,.23,.14,.18,1.13,-.22,mat('#454e4f'));g.rotation.y=-.3;}
  if(pose==='buyer')box(g,.085,.14,.018,-.17,1.12,-.32,new THREE.MeshBasicMaterial({color:'#8eb8c8'}));
  return g;
}
function label(parent,text,x,y,z,rotation=0,color='#e8dac0'){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=96;const ctx=canvas.getContext('2d');ctx.fillStyle='#222b27';ctx.fillRect(0,0,256,96);ctx.font='bold 48px monospace';ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText(text,128,64);
  const obj=new THREE.Mesh(new THREE.PlaneGeometry(.62,.23),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas)}));obj.position.set(x,y,z);obj.rotation.y=rotation;parent.add(obj);
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
    this.peepCamera=new THREE.PerspectiveCamera(122,1,.035,45);
    this.peepCamera.position.set(5.14,1.67,-1.45);this.peepCamera.lookAt(8.4,1.56,-2.05);
    this.target=new THREE.WebGLRenderTarget(640,360,{depthBuffer:true});
    this.lensTarget=new THREE.WebGLRenderTarget(720,720,{depthBuffer:true});
    this.display=new THREE.Scene();this.displayCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    this.displayMaterial=new THREE.ShaderMaterial({uniforms:{feed:{value:this.target.texture},lens:{value:0},time:{value:0},lost:{value:0},aspect:{value:1}},vertexShader:'varying vec2 uv0;void main(){uv0=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`uniform sampler2D feed;uniform float lens,time,lost,aspect;varying vec2 uv0;void main(){vec2 p=uv0*2.-1.;if(lens>0.5){p.x*=aspect;float r=length(p);vec2 uv=.5+p*(.5+.16*r*r);vec3 c=texture2D(feed,clamp(uv,0.,1.)).rgb;gl_FragColor=vec4(c*(1.-smoothstep(.76,.99,r)),1.);}else{float noise=fract(sin(dot(uv0,vec2(12.9898,78.233))+floor(time*15.))*43758.5453);vec3 c=texture2D(feed,uv0).rgb;float scan=.95+.05*sin(uv0.y*900.);gl_FragColor=vec4(mix(c*scan+noise*.025,vec3(noise*.13),lost),1.);}gl_FragColor.rgb=pow(max(gl_FragColor.rgb,vec3(0.)),vec3(1./2.2));}`});
    this.display.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.displayMaterial));
    this.feed=new THREE.Mesh(new THREE.PlaneGeometry(1.075,.645),
      new THREE.MeshBasicMaterial({map:this.target.texture,color:'#cee5da',toneMapped:false}));
    this.feed.rotation.y=Math.PI/2;
    this.feed.position.set(-4.603,2.31,-1.05);scene.add(this.feed);
    this.makeAlley();this.makeHallway();
    this.setVisitors();
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
    this.dropParcel=box(s,.35,.2,.27,-.85,.94,-11.93,mat('#ac9670'));this.dropParcel.visible=false;label(s,'DROP 04',-.85,1.8,-12.15);
    for(let i=0;i<6;i++){const bag=new THREE.Mesh(new THREE.SphereGeometry(.27,7,5),mat('#242a27'));bag.position.set(2.5-i*.13,.23,-10.3+i*.35);bag.scale.set(1,.9,1.2);s.add(bag);}
    label(s,'EXIT',1.8,2.8,-12.2,0,'#98c3a0');
    this.rainCount=340;this.rainPositions=new Float32Array(this.rainCount*6);
    for(let i=0;i<this.rainCount;i++){
      const a=i*6,x=(Math.random()-.5)*6.1,z=-6.35-Math.random()*6.35,y=Math.random()*3.7;
      this.rainPositions.set([x,y,z,x-.055,y-.28,z+.045],a);
    }
    const rainGeometry=new THREE.BufferGeometry();
    rainGeometry.setAttribute('position',new THREE.BufferAttribute(this.rainPositions,3));
    this.rain=new THREE.LineSegments(rainGeometry,new THREE.LineBasicMaterial({color:'#8bc4cc',transparent:true,opacity:.22,depthWrite:false}));
    this.rain.frustumCulled=false;s.add(this.rain);
  }
  makeHallway(){
    const s=this.scene;
    const hallPaint=mat('#717167');hallPaint.map=wornTexture('#b9b7a5');
    box(s,3.8,.14,29,6.95,-.09,-1.45,mat('#3b3931',.55));
    box(s,3.8,.12,29,6.95,2.95,-1.45,cement);
    for(const x of [5.05,8.85]){
      box(s,.13,3.1,29,x,1.47,-1.45,hallPaint);
      box(s,.15,.17,29,x,.13,-1.45,mat('#2c302a'));
      for(let z=-13;z<12;z+=4){
        if(x<6&&z>-4&&z<4)continue;
        box(s,.18,2.3,1.14,x+(x<6?.08:-.08),1.15,z,mat('#787366'));
        box(s,.19,2.17,.99,x+(x<6?.10:-.10),1.08,z,mat('#383e38'));
        const dx=x+(x<6?.22:-.22);box(s,.07,.05,.18,dx,1.03,z+.33,mat('#b4a58b',.35,.6));
        label(s,String(201+Math.round((z+13)/4)+(x>6?7:0)),dx,1.83,z,x<6?Math.PI/2:-Math.PI/2);
      }
    }
    this.hallLights=[];
    for(let z=-12;z<12;z+=5){box(s,.55,.06,.34,7,2.86,z,new THREE.MeshBasicMaterial({color:'#c4b591'}));const lamp=new THREE.PointLight('#e5c695',17,6,2);lamp.position.set(7,2.6,z);s.add(lamp);this.hallLights.push(lamp);}
    for(let i=0;i<3;i++)cyl(s,.035,.035,2.7,8.6-i*.12,1.4,-11,steel);
    const pipe=cyl(s,.04,.04,28,8.5,2.65,-1.45,steel);pipe.rotation.x=Math.PI/2;
    for(let i=0;i<26;i++)box(s,3.7,.006,.025,6.95,.005,-14+i,mat('#242b28'));
    box(s,.22,.7,.5,8.66,1.7,1,steel);box(s,.24,.06,.1,8.52,1.8,1,new THREE.MeshBasicMaterial({color:'#923d34'}));
    label(s,'EXIT →',8.7,2.45,-8,-Math.PI/2,'#a3e5a7');
    for(let i=0;i<12;i++)box(s,.01,.2+(i%3)*.13,.5,8.77,.45+(i%4)*.4,-12+i*2,mat('#41463c'));
    this.hallPeople={courier:character(s,'#686451','courier'),intruder:character(s,'#24242b','intruder')};
    for(const g of Object.values(this.hallPeople)){g.position.set(7.1,0,-1.45);g.rotation.y=Math.PI/2;s.add(g);}
  }
  setVisitors(alley={visitor:'empty'},door={visitor:'empty'}){
    this.alleyState=alley;this.doorState=door;
    for(const [name,person] of Object.entries(this.alleyPeople))person.visible=name===alley.visitor;
    for(const [name,person] of Object.entries(this.hallPeople))person.visible=name===door.visitor;
  }
  resize(w,h){this.displayMaterial.uniforms.aspect.value=w/h;}
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
    const now=this.serverNow?this.serverNow+elapsed-this.serverStamp:Date.now();
    for(const [people,state,hall] of [[this.alleyPeople,this.alleyState,false],[this.hallPeople,this.doorState,true]])for(const person of Object.values(people)){
      if(!person.visible)continue;
      const approaching=now<state.waitAt,leaving=now>=state.leaveAt;
      const route=visitorMotion(state,now,hall),kind=person.userData.pose;
      person.position.set(hall?7.05:kind==='thief'?-1.5:-.8,Math.sin(t*1.4)*.009,route.z);
      if(person.userData.visitId!==state.id){person.userData.visitId=state.id;person.rotation.y=route.yaw;}
      person.rotation.y=turnToward(person.rotation.y,route.yaw+(!approaching&&!leaving&&kind==='thief'?Math.sin(t*1.7)*.3:0),dt);
      person.rotation.z=!approaching&&!leaving&&kind==='intruder'?Math.sin(t)*.04:Math.sin(t)*.006;
      const stride=Math.sin(t*7)*.45*route.stride;
      person.userData.legs.forEach((leg,i)=>leg.rotation.x=stride*(i?1:-1));
      person.userData.arms.forEach((arm,i)=>{arm.rotation.x=kind==='courier'&&i===1?-.8:kind==='buyer'&&i===0?-.5:-stride*(i?1:-1)*.65;});
      person.rotation.x=state.outcome&&now-state.leaveAt<1300?-Math.sin((now-state.leaveAt)/1300*Math.PI)*.35:0;
    }
    this.dropParcel.visible=!!this.alleyState?.outcome&&now-this.alleyState.leaveAt<800;
    this.hallLights.forEach((light,i)=>light.intensity=17*(i===2&&Math.sin(t*17)>.85?.18:1));
    this.displayMaterial.uniforms.time.value=t;
    this.feed.material.color.set(this.signalLost?'#000000':'#cee5da');
    if(++this.frame%(this.quality==='low'?6:4)===0){
      this.feed.visible=false;this.renderer.setRenderTarget(this.target);this.renderer.render(this.scene,this.alleyCamera);this.renderer.setRenderTarget(null);this.feed.visible=true;
    }
  }
  render(mainCamera){
    if(!this.mode){this.renderer.render(this.scene,mainCamera);return;}
    const lens=this.mode==='peephole';
    if(lens){this.renderer.setRenderTarget(this.lensTarget);this.renderer.render(this.scene,this.peepCamera);this.renderer.setRenderTarget(null);}
    this.displayMaterial.uniforms.feed.value=lens?this.lensTarget.texture:this.target.texture;
    this.displayMaterial.uniforms.lens.value=lens?1:0;this.displayMaterial.uniforms.lost.value=!lens&&this.signalLost?1:0;
    this.renderer.render(this.display,this.displayCamera);
  }

  dispose(){this.target.dispose();this.feed.geometry.dispose();this.feed.material.dispose();}
}
