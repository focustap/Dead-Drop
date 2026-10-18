// Shared collision and interaction layout; all dimensions are metres.
export const STATIONS = Object.freeze({
  curtains:{x:1.95,z:3.3,range:1.55}, garden:{x:3.1,z:2.4,range:1.8}, packaging:{x:.6,z:2.9,range:1.8},
  door:{x:4.08,z:-1.45,range:1.8}, chute:{x:-4.03,z:1.15,range:1.8},
  breaker:{x:8.3,z:1,range:1.55}, hide:{x:-1.8,z:3.15,range:1.65}, return:{x:5.7,z:-1.45,range:1.65}
});
export const COLLIDERS = [
  ...[-3,-.95,1.1,3.15].flatMap(x=>[
    {x,z:-2.5,w:1.65,d:.9}, {x,z:-1.65,w:.43,d:.55}
  ]),
  {x:3.75,z:2.4,w:1.25,d:1.4}, {x:.6,z:3.15,w:1.8,d:.8},
  {x:-1.8,z:3.58,w:1.15,d:.5},
  {x:-3.5,z:2.6,w:1.25,d:1.25}, {x:-4.65,z:1.15,w:.5,d:1.4}
];
export function blocked(x,z,r=.22,zone='apartment'){
  if(zone==='hall')return x<5.4||x>8.5||z< -14.7||z>12.7;
  if(x < -4.65 || x > 4.65 || z < -3.65 || z > 3.65)return true;
  return COLLIDERS.some(b=>x>b.x-b.w/2-r&&x<b.x+b.w/2+r&&z>b.z-b.d/2-r&&z<b.z+b.d/2+r);
}
export function slide(from,to,zone='apartment'){
  let {x,z}=from;
  const steps=Math.max(1,Math.ceil(Math.hypot(to.x-x,to.z-z)/.08));
  const dx=(to.x-x)/steps,dz=(to.z-z)/steps;
  for(let i=0;i<steps;i++){if(!blocked(x+dx,z,.22,zone))x+=dx;if(!blocked(x,z+dz,.22,zone))z+=dz;}
  return {x,z};
}
export function atStation(player,key){const s=STATIONS[key];return !!player&&Math.hypot(player.x-s.x,player.z-s.z)<=s.range;}

export function atComputer(p){return !!p&&p.zone==='apartment'&&[-3,-.95,1.1,3.15].some(x=>Math.hypot(p.x-x,p.z+1.9)<=3.1);}
