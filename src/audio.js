// Synthesized ambience keeps the build small and works without external assets.
export class Soundscape{
  constructor(){this.volume=.35;this.context=null;this.lastLog=null;}
  start(){
    if(this.context){this.context.resume();return;}
    const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
    const c=this.context=new C();this.master=c.createGain();this.master.gain.value=this.volume;const limiter=c.createDynamicsCompressor();limiter.threshold.value=-9;limiter.knee.value=4;limiter.ratio.value=20;limiter.attack.value=.003;limiter.release.value=.2;this.master.connect(limiter);limiter.connect(c.destination);
    const buffer=c.createBuffer(1,c.sampleRate*3,c.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.12;
    const rain=c.createBufferSource();rain.buffer=buffer;rain.loop=true;const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1700;rain.connect(filter);filter.connect(this.master);rain.start();
    this.hum=c.createOscillator();this.hum.frequency.value=58;const gain=c.createGain();gain.gain.value=.025;this.humGain=gain;this.hum.connect(gain);gain.connect(this.master);this.hum.start();
  }
  setVolume(v){this.volume=Number.isFinite(Number(v))?Math.max(0,Math.min(1,Number(v))):.35;if(this.master)this.master.gain.value=this.volume;}
  tone(freq=340,duration=.13,volume=.08){const c=this.context;if(!c)return;const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.setValueAtTime(freq,c.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(20,freq*.5),c.currentTime+duration);g.gain.setValueAtTime(Math.min(volume,this.reducedEffects?.09:.4),c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+duration);o.connect(g);g.connect(this.master);o.start();o.stop(c.currentTime+duration);}
  alarm(){this.tone(1450,.8,.35);setTimeout(()=>this.tone(93,.8,.28),90);setTimeout(()=>this.tone(920,.45,.22),200);}
  collector(){this.tone(34,2.8,.3);[0,600,1250].forEach(delay=>setTimeout(()=>this.tone(75,.3,.3),delay));}
  sting(kind='door'){
    const profile={door:[63,940,.75],window:[125,1700,.65],hall:[39,470,1.1],wardrobe:[91,2300,.8],collector:[28,680,1.8],peep:[110,820,.28]}[kind]||[52,760,.8];
    this.tone(profile[0],profile[2]+.4,.32);this.tone(profile[1],profile[2],.19);
    const c=this.context;if(!c)return;const length=profile[2],buffer=c.createBuffer(1,Math.ceil(c.sampleRate*length),c.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/data.length*5);
    const noise=c.createBufferSource();noise.buffer=buffer;const filter=c.createBiquadFilter();filter.type='bandpass';filter.frequency.value=profile[1];filter.Q.value=1.2;const gain=c.createGain();gain.gain.value=this.reducedEffects?.035:.13;const pan=c.createStereoPanner();pan.pan.value=kind==='window'?.28:kind==='wardrobe'?-.2:0;noise.connect(filter);filter.connect(gain);gain.connect(pan);pan.connect(this.master);noise.start();
  }
  peep(event,now){if(event&&now>=event.revealAt&&this.peepId!==event.id){this.peepId=event.id;this.sting('peep');}}
  scare(){this.tone(52,1.4,.35);this.tone(760,.6,.22);setTimeout(()=>this.tone(130,.8,.18),120);}
  encounter(state){const a=state.horror?.active;if(!a||state.day+':'+a.id===this.encounterId)return;this.encounterId=state.day+':'+a.id;
    const pattern=a.kind==='window'?[0,700,1400,2100]:a.kind==='hall'?[0,650,1400,2300]:[0,350,900];
    pattern.forEach(delay=>setTimeout(()=>this.tone(a.kind==='window'?92:a.kind==='hall'?68:110,.22,a.kind==='window'?.12:.18),delay));
  }
  update(state){if(this.humGain)this.humGain.gain.value=state.phase==='ending'?.002:.025;const w=state.horror?.wardrobe;if(w?.phase==='occupied'&&state.now>=(this.nextScratch||0)){this.nextScratch=state.now+12000;this.tone(318,.3,.045);setTimeout(()=>this.tone(84,.55,.03),300);}this.encounter(state);const prowler=state.horror?.active;if(prowler?.kind==='window'&&prowler.phase==='warning'&&state.now>=prowler.approachUntil&&this.tapped!==state.day+':'+prowler.id){this.tapped=state.day+':'+prowler.id;[0,450,1000].forEach(delay=>setTimeout(()=>this.tone(780,.17,.1),delay));}const entry=state.log?.[0];if(!entry||entry.id===this.lastLog)return;this.lastLog=entry.id;const text=entry.text.toLowerCase();if(/knock|footstep/.test(text)){[0,320,670].forEach(delay=>setTimeout(()=>this.tone(100,.18,.25),delay));}else if(/lost|intrusion|buzzing/.test(text))this.tone(140,.7,.15);else if(/sealed|poured|planted|received|sale|confirmed/.test(text))this.tone(500,.16,.1);}
}
