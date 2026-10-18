import * as THREE from 'three';
// Small reusable maps add wear without downloading art or adding geometry.
export function wornTexture(color,tiles=false){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
  const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,256,256);
  let seed=97;const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  for(let i=0;i<2600;i++){ctx.fillStyle=random()>.45?'#0000000d':'#ffffff0b';ctx.fillRect(random()*256,random()*256,1+random()*7,1+random()*14);}
  for(let i=0;i<25;i++){ctx.fillStyle='#12180e0a';ctx.beginPath();ctx.ellipse(random()*256,random()*256,3+random()*20,2+random()*35,0,0,Math.PI*2);ctx.fill();}
  if(tiles){ctx.strokeStyle='#00000044';ctx.lineWidth=2;for(let i=0;i<256;i+=64){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,256);ctx.moveTo(0,i);ctx.lineTo(256,i);ctx.stroke();}}
  const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(3,3);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
