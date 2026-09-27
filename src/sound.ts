export type SoundCue='pick'|'snap'|'reject'|'water'|'lava'|'stone'|'sand'|'steam'|'combo'|'reward'|'egg'|'hatch'|'charge'|'deal'|'over'|'win'|'restart'|'ui'|'warning'|'water-neighbor'|'lava-neighbor'|'quench'|'pet-lava'|'pet-water'|'shell'|'hatch-lava'|'hatch-water';

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
    const at=c.currentTime+delay,gain=c.createGain();gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(volume,at+.008);if(source instanceof AudioBufferSourceNode)gain.gain.linearRampToValueAtTime(volume*.65,at+Math.min(.13,duration*.3));gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
    const pan=c.createStereoPanner();pan.pan.value=this.pan;source.connect(filter);filter.connect(gain);gain.connect(pan);pan.connect(this.dry!);if(wet)pan.connect(this.echo!);
    this.voices.add(source);source.onended=()=>{this.voices.delete(source);source.disconnect();filter.disconnect();gain.disconnect();pan.disconnect();};source.start(at);source.stop(at+duration+.02);
  }
  private tone(from:number,to:number,duration:number,volume:number,delay=0,type:OscillatorType='sine',wet=false){
    const c=this.context!,osc=c.createOscillator(),filter=c.createBiquadFilter();osc.type=type;osc.detune.value=(Math.random()-.5)*8;osc.frequency.setValueAtTime(from,c.currentTime+delay);osc.frequency.exponentialRampToValueAtTime(Math.max(20,to),c.currentTime+delay+duration);filter.type='lowpass';filter.frequency.value=4400;this.voice(osc,filter,duration,volume,delay,wet);
  }
  private air(frequency:number,duration:number,volume:number,delay=0,q=.7){const c=this.context!,source=c.createBufferSource(),filter=c.createBiquadFilter();source.buffer=this.noise;filter.type='bandpass';filter.frequency.setValueAtTime(frequency,c.currentTime+delay);filter.frequency.exponentialRampToValueAtTime(Math.max(180,frequency*.45),c.currentTime+delay+duration);filter.Q.value=q;this.voice(source,filter,duration,volume,delay);}
  private creature(water:boolean,baby=false){
    const c=this.context!,osc=c.createOscillator(),filter=c.createBiquadFilter(),at=c.currentTime;
    const pitch=(water?410:215)*(baby?1.3:1);
    osc.type='sawtooth';osc.frequency.setValueAtTime(pitch,at);osc.frequency.exponentialRampToValueAtTime(pitch*1.45,at+.065);osc.frequency.exponentialRampToValueAtTime(pitch*.78,at+.19);osc.frequency.exponentialRampToValueAtTime(pitch*1.12,at+.31);
    filter.type='bandpass';filter.Q.value=1.1;filter.frequency.setValueAtTime(water?1800:850,at);filter.frequency.exponentialRampToValueAtTime(water?1100:520,at+.34);
    this.voice(osc,filter,.36,baby?.065:.095,0,true);
    this.tone(pitch*.5,pitch*.42,.24,baby?.025:.045,.03,'triangle');
    this.air(water?2100:700,.20,.035,.06);
  }
  play(cue:SoundCue,level=1,pan=0){
    if(this.muted||document.hidden||!this.context||this.context.state!=='running')return;
    const now=this.context.currentTime,gap=cue==='snap'?.085:['charge','hatch','reward','combo','water-neighbor','lava-neighbor','quench','pet-lava','pet-water','hatch-lava','hatch-water','shell'].includes(cue)?.24:.065;
    if(now-(this.last.get(cue)??-100)<gap)return;this.last.set(cue,now);this.pan=Math.max(-.4,Math.min(.4,pan));
    const note=(f:number,d=.25,v=.1,at=0)=>{this.tone(f,f*.998,d,v,at,'sine',true);this.tone(f*2,f*2,d*.55,v*.2,at,'sine');};
    switch(cue){
      case 'pick':this.tone(390,590,.075,.075);this.air(1800,.045,.025);break;
      case 'snap':this.tone(740,670,.035,.024);break;
      case 'ui':this.tone(550,700,.07,.055);break;
      case 'warning':note(392,.22,.045);note(329.63,.24,.04,.09);break;
      case 'reject':this.tone(160,105,.12,.07,0,'triangle');this.air(600,.07,.035);break;
      case 'water':this.tone(590,155,.24,.17);this.air(1800,.34,.12);this.air(3900,.19,.065,.025);this.tone(870,340,.13,.08,.065);this.tone(1100,540,.13,.045,.14);break;
      case 'lava':this.tone(130,55,.30,.18,0,'triangle');this.air(700,.38,.13);this.air(2900,.085,.08,.025);this.air(2300,.06,.055,.12);this.tone(380,120,.17,.07,.075);break;
      case 'stone':this.tone(240,92,.22,.19,0,'triangle');this.tone(390,170,.11,.075,.025);this.air(1300,.20,.17);this.air(3400,.065,.07,.08);this.air(2500,.08,.05,.14);break;
      case 'sand':this.air(850,.30,.14);this.air(2100,.26,.065,.045);this.tone(115,48,.21,.07);break;
      case 'steam':this.air(3400,.55,.17);this.air(1700,.40,.09,.04);this.air(5500,.25,.055,.10);break;
      case 'quench':this.tone(310,90,.16,.09);this.air(4200,.43,.13);this.air(2300,.36,.08,.045);break;
      case 'water-neighbor':this.air(1400,.30,.04,.10);this.tone(730,380,.10,.04,.14);this.tone(960,470,.12,.025,.23);break;
      case 'lava-neighbor':this.air(1800,.08,.055,.12);this.air(3200,.055,.04,.21);this.tone(160,85,.22,.04,.10);break;
      case 'combo':{const base=[523.25,659.25,783.99,1046.5][Math.min(3,Math.max(0,level-2))];[1,1.25,1.5].forEach((r,i)=>note(base*r,.32,.07,i*.065));break;}
      case 'reward':[523.25,659.25,783.99,1046.5].forEach((f,i)=>note(f,.58,.095,i*.09));this.air(2200,.36,.03,.18);break;
      case 'egg':this.tone(310,175,.13,.10);note(659,.25,.07,.06);break;
      case 'shell':this.air(1700,.075,.06);this.air(2600,.06,.045,.075);this.tone(520,330,.06,.025,.04);break;
      case 'hatch':this.air(2800,.075,.13);this.air(4300,.06,.09,.045);this.tone(440,160,.11,.065);this.air(1800,.18,.065,.09);this.air(3400,.065,.045,.19);note(1046.5,.32,.035,.12);break;
      case 'pet-lava':this.creature(false);break;
      case 'pet-water':this.creature(true);break;
      case 'hatch-lava':this.creature(false,true);break;
      case 'hatch-water':this.creature(true,true);break;
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
