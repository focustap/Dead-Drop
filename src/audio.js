// Synthesized ambience keeps the build small and works without external assets.
export class Soundscape{
  constructor(){this.volume=.35;this.context=null;this.lastLog=null;}
  start(){
    if(this.context){this.context.resume();return;}
    const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
    const c=this.context=new C();this.master=c.createGain();this.master.gain.value=this.volume;this.master.connect(c.destination);
    const buffer=c.createBuffer(1,c.sampleRate*3,c.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.12;
    const rain=c.createBufferSource();rain.buffer=buffer;rain.loop=true;const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1700;rain.connect(filter);filter.connect(this.master);rain.start();
    this.hum=c.createOscillator();this.hum.frequency.value=58;const gain=c.createGain();gain.gain.value=.025;this.hum.connect(gain);gain.connect(this.master);this.hum.start();
  }
  setVolume(v){this.volume=v;if(this.master)this.master.gain.value=v;}
  tone(freq=340,duration=.13,volume=.08){const c=this.context;if(!c)return;const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.setValueAtTime(freq,c.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(20,freq*.5),c.currentTime+duration);g.gain.setValueAtTime(volume,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+duration);o.connect(g);g.connect(this.master);o.start();o.stop(c.currentTime+duration);}
  update(state){const entry=state.log?.[0];if(!entry||entry.id===this.lastLog)return;this.lastLog=entry.id;const text=entry.text.toLowerCase();if(/knock|footstep/.test(text)){[0,320,670].forEach(delay=>setTimeout(()=>this.tone(100,.18,.25),delay));}else if(/lost|intrusion|buzzing/.test(text))this.tone(140,.7,.15);else if(/sealed|poured|planted|received|sale|confirmed/.test(text))this.tone(500,.16,.1);}
}
