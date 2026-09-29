export type SoundCue='pick'|'snap'|'reject'|'water'|'lava'|'stone'|'sand'|'steam'|'combo'|'reward'|'egg'|'hatch'|'charge'|'deal'|'over'|'win'|'restart'|'ui'|'warning'|'bossSpawn'|'bossHit'|'bossDeath'|'bossBurst';

// Small procedural instruments: immediate playback, no downloads, shared noise
// and one restrained echo bus. Caps keep large pet/reaction chains comfortable.
export class SoundEngine {
  muted=false;
  private context:AudioContext|null=null;
  private master:GainNode|null=null;
  private dry:GainNode|null=null;
  private echo:GainNode|null=null;
  private noise:AudioBuffer|null=null;
  private voices=new Set<AudioScheduledSourceNode>();
  private pan=0;
  private last=new Map<SoundCue,number>();
  private events=new AbortController();
  constructor(){
    try{this.muted=localStorage.getItem('splashy-rock-muted')==='1';}catch{}
    const wake=()=>this.unlock();
    window.addEventListener('pointerdown',wake,{capture:true,signal:this.events.signal});
    window.addEventListener('keydown',wake,{capture:true,signal:this.events.signal});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){this.stop();void this.context?.suspend();}else if(this.context&&!this.muted)void this.context.resume().catch(()=>{});},{signal:this.events.signal});
  }
  unlock(){
    if(this.muted)return;
    try{
      if(!this.context){
        const c=this.context=new AudioContext();
        const compressor=c.createDynamicsCompressor();compressor.threshold.value=-16;compressor.knee.value=12;compressor.ratio.value=5;compressor.attack.value=.004;compressor.release.value=.16;
        this.master=c.createGain();this.master.gain.value=.55;this.master.connect(compressor);compressor.connect(c.destination);
        this.dry=c.createGain();this.dry.connect(this.master);
        const delay=c.createDelay(.5);delay.delayTime.value=.115;const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=2300;
        this.echo=c.createGain();this.echo.gain.value=.13;this.echo.connect(delay);delay.connect(filter);filter.connect(this.master);
        this.noise=c.createBuffer(1,c.sampleRate,c.sampleRate);const data=this.noise.getChannelData(0);let seed=97;
        for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;data[i]=(seed>>>0)/2147483648-1;}
      }
      if(this.context.state==='suspended')void this.context.resume().catch(()=>{});
    }catch{/* Silent fallback for devices without audio support. */}
  }
  toggle(){this.muted=!this.muted;try{localStorage.setItem('splashy-rock-muted',this.muted?'1':'0');}catch{}if(this.muted){this.stop();if(this.master&&this.context)this.master.gain.setTargetAtTime(0,this.context.currentTime,.015);}else{this.unlock();if(this.master&&this.context)this.master.gain.setTargetAtTime(.55,this.context.currentTime,.025);this.play('ui');}return this.muted;}
  private voice(source:AudioScheduledSourceNode,filter:AudioNode,duration:number,volume:number,delay=0,wet=false){
    const c=this.context!;if(this.voices.size>=48){source.disconnect();filter.disconnect();return;}
    const at=c.currentTime+delay,gain=c.createGain();gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(volume,at+.008);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
    const pan=c.createStereoPanner();pan.pan.value=this.pan;source.connect(filter);filter.connect(gain);gain.connect(pan);pan.connect(this.dry!);if(wet)pan.connect(this.echo!);
    this.voices.add(source);source.onended=()=>{this.voices.delete(source);source.disconnect();filter.disconnect();gain.disconnect();pan.disconnect();};source.start(at);source.stop(at+duration+.02);
  }
  private tone(from:number,to:number,duration:number,volume:number,delay=0,type:OscillatorType='sine',wet=false){
    const c=this.context!,osc=c.createOscillator(),filter=c.createBiquadFilter();osc.type=type;osc.detune.value=(Math.random()-.5)*8;osc.frequency.setValueAtTime(from,c.currentTime+delay);osc.frequency.exponentialRampToValueAtTime(Math.max(20,to),c.currentTime+delay+duration);filter.type='lowpass';filter.frequency.value=4400;this.voice(osc,filter,duration,volume,delay,wet);
  }
  private air(frequency:number,duration:number,volume:number,delay=0,q=.7){const c=this.context!,source=c.createBufferSource(),filter=c.createBiquadFilter();source.buffer=this.noise;filter.type='bandpass';filter.frequency.setValueAtTime(frequency,c.currentTime+delay);filter.frequency.exponentialRampToValueAtTime(Math.max(180,frequency*.45),c.currentTime+delay+duration);filter.Q.value=q;this.voice(source,filter,duration,volume,delay);}
  private roar(water:boolean,dying=false){
    // Voiced growl through two broad formants: a rounded aquatic call or a gravelly lava roar.
    const c=this.context!,at=c.currentTime+.24,pitch=water?100:68,duration=dying?1.65:1.9;
    for(const [formant,volume] of [[water?470:310,.12],[water?1050:740,.065]]){
      const osc=c.createOscillator(),filter=c.createBiquadFilter();osc.type='sawtooth';
      osc.frequency.setValueAtTime(pitch*.8,at);osc.frequency.exponentialRampToValueAtTime(pitch*(dying?1.1:1.5),at+.3);osc.frequency.exponentialRampToValueAtTime(pitch*(dying?.38:.65),at+duration);
      filter.type='bandpass';filter.Q.value=2.2;filter.frequency.setValueAtTime(formant,at);filter.frequency.exponentialRampToValueAtTime(formant*(dying?.4:.7),at+duration);
      this.voice(osc,filter,duration,volume,.24,true);
    }
    this.air(water?900:480,.56,.065,.31,1.5);
  }
  play(cue:SoundCue,level=1,pan=0){
    if(this.muted||document.hidden||!this.context||this.context.state!=='running')return;
    const now=this.context.currentTime,gap=cue==='snap'?.085:['charge','hatch','reward','combo'].includes(cue)?.24:.065;
    if(now-(this.last.get(cue)??-100)<gap)return;this.last.set(cue,now);this.pan=Math.max(-.4,Math.min(.4,pan));
    const note=(f:number,d=.25,v=.1,at=0)=>{this.tone(f,f*.998,d,v,at,'sine',true);this.tone(f*2,f*2,d*.55,v*.2,at,'sine');};
    switch(cue){
      case 'bossSpawn':{const water=level===1;this.air(water?700:420,.65,.12);this.tone(55,water?180:130,.48,.12,0,'triangle',true);this.tone(water?220:145,water?85:55,.48,.17,.28,'triangle',true);this.air(water?1800:900,.38,.11,.3);this.roar(water);break;}
      case 'bossHit':{const f=level===1?145:95;this.tone(f,f*.52,.29,.15,0,'triangle',true);this.tone(f*1.48,f*.8,.22,.065,.035,'sine');this.air(level===1?650:390,.2,.07);break;}
      case 'bossDeath':this.roar(level===1,true);this.tone(level===1?210:145,45,.56,.18,0,'triangle',true);this.air(620,.48,.10);break;
      case 'bossBurst':this.tone(95,30,.36,.18,0,'sine',true);this.air(level===1?2400:1300,.53,.15);[523,784,1046].forEach((f,i)=>note(f,.4,.035,.06+i*.07));break;
      case 'pick':this.tone(390,590,.075,.075);this.air(1800,.045,.025);break;
      case 'snap':this.tone(740,670,.035,.024);break;
      case 'ui':this.tone(550,700,.07,.055);break;
      case 'warning':note(392,.22,.045);note(329.63,.24,.04,.09);break;
      case 'reject':this.tone(160,105,.12,.07,0,'triangle');this.air(600,.07,.035);break;
      case 'water':this.tone(590,175,.18,.17);this.air(2500,.24,.07);this.tone(870,430,.1,.075,.045);this.tone(1100,680,.09,.04,.10);break;
      case 'lava':this.tone(135,62,.22,.18,0,'triangle');this.air(1100,.22,.10);this.air(2900,.06,.065,.02);this.tone(440,180,.10,.055,.06);break;
      case 'stone':this.tone(270,125,.16,.16,0,'triangle');this.air(1500,.13,.14);note(660,.18,.05,.025);break;
      case 'sand':this.air(950,.23,.10);this.tone(120,60,.17,.065);break;
      case 'steam':this.air(2900,.38,.13);this.air(950,.25,.045,.025);note(880,.23,.028,.05);break;
      case 'combo':{const base=[523.25,659.25,783.99,1046.5][Math.min(3,Math.max(0,level-2))];[1,1.25,1.5].forEach((r,i)=>note(base*r,.32,.07,i*.065));break;}
      case 'reward':[523.25,659.25,783.99,1046.5].forEach((f,i)=>note(f,.58,.095,i*.09));this.air(2200,.36,.03,.18);break;
      case 'egg':this.tone(310,175,.13,.10);note(659,.25,.07,.06);break;
      case 'hatch':this.air(1800,.10,.10);this.air(2900,.07,.07,.045);[659.25,783.99,1046.5].forEach((f,i)=>note(f,.4,.085,.09+i*.08));break;
      case 'charge':this.tone(240,480,.25,.04,0,'sine',true);break;
      case 'deal':[440,554,659].forEach((f,i)=>note(f,.13,.038,i*.04));break;
      case 'over':[392,329.63,261.63].forEach((f,i)=>note(f,.65,.09,i*.15));break;
      case 'win':[523,659,784,1046,1318].forEach((f,i)=>note(f,.75,.10,i*.12));break;
      case 'restart':[392,523,659].forEach((f,i)=>note(f,.25,.06,i*.055));break;
    }
  }
  stop(){for(const voice of this.voices){try{voice.stop();}catch{}}this.last.clear();}
  dispose(){this.events.abort();this.stop();void this.context?.close();}
}
