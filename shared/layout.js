// Shared collision and interaction layout; all dimensions are metres.
export const STATIONS = Object.freeze({
  garden:{x:3.1,z:2.4,range:1.8}, packaging:{x:.6,z:2.9,range:1.8},
  door:{x:4.08,z:-1.45,range:1.8}, chute:{x:-4.03,z:1.15,range:1.8},
  breaker:{x:4.1,z:.8,range:1.7}
});
export const COLLIDERS = [
  ...[-3,-.95,1.1,3.15].flatMap(x=>[
    {x,z:-2.5,w:1.65,d:.9}, {x,z:-1.65,w:.43,d:.55}
  ]),
  {x:3.75,z:2.4,w:1.25,d:1.4}, {x:.6,z:3.15,w:1.8,d:.8},
  {x:-3.5,z:2.6,w:1.25,d:1.25}, {x:-4.65,z:1.15,w:.5,d:1.4}
];
export function blocked(x,z,r=.22){
  if(x < -4.65 || x > 4.65 || z < -3.65 || z > 3.65)return true;
  return COLLIDERS.some(b=>x>b.x-b.w/2-r&&x<b.x+b.w/2+r&&z>b.z-b.d/2-r&&z<b.z+b.d/2+r);
}
export function slide(from,to){
  let {x,z}=from;
  const steps=Math.max(1,Math.ceil(Math.hypot(to.x-x,to.z-z)/.08));
  const dx=(to.x-x)/steps,dz=(to.z-z)/steps;
  for(let i=0;i<steps;i++){if(!blocked(x+dx,z))x+=dx;if(!blocked(x,z+dz))z+=dz;}
  return {x,z};
}
export function atStation(player,key){const s=STATIONS[key];return !!player&&Math.hypot(player.x-s.x,player.z-s.z)<=s.range;}
