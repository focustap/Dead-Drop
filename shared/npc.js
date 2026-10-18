// Models face local -Z. Derive headings from the route, then ease the shortest turn.
export function turnToward(current,target,dt){
  const delta=Math.atan2(Math.sin(target-current),Math.cos(target-current));
  return current+delta*Math.min(1,dt*5);
}
export function visitorMotion(state,now,hall=false){
  const entering=now<state.waitAt,leaving=now>=state.leaveAt;
  const t=Math.max(0,Math.min(1,entering?(now-state.arrived)/6500:leaving?(now-state.leaveAt)/5000:1));
  const eased=t*t*(3-2*t),distance=entering?1-eased:leaving?eased:0;
  return {z:hall?-1.45-distance*10:-11+distance*4.3,
    yaw:entering?(hall?Math.PI:0):leaving?(hall?0:Math.PI):hall?Math.PI/2:Math.PI,
    stride:(entering||leaving)?Math.min(1,6*t*(1-t)):0};
}
