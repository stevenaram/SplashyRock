export type SoundCue='pick'|'snap'|'reject'|'water'|'lava'|'stone'|'sand'|'steam'|'combo'|'reward'|'egg'|'hatch'|'charge'|'deal'|'over'|'win'|'restart'|'ui'|'warning'|'bossSpawn'|'bossHit'|'bossDeath'|'bossBurst'|'noSpace'|'bossSlam'|'bush'|'berry'|'leafStone'|'leaves'|'forge';

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
  private pending:{cue:SoundCue;level:number;pan:number;at:number}|null=null;
  private last=new Map<SoundCue,number>();
  private events=new AbortController();
  constructor(){
    try{this.muted=localStorage.getItem('splashy-rock-muted')==='1';}catch{}
    const wake=()=>this.unlock();
    for(const event of ['pointerdown','pointerup','touchstart','touchend','click','keydown'])window.addEventListener(event,wake,{capture:true,passive:true,signal:this.events.signal});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){this.stop();void this.context?.suspend();}else if(this.context)this.unlock();},{signal:this.events.signal});
  }
  unlock(){
    if(this.muted)return;
    try{
      if(!this.context){
        const c=this.context=new AudioContext();
        c.onstatechange=()=>{
          if(c.state!=='running')return;
          const pending=this.pending;this.pending=null;
          if(pending&&performance.now()-pending.at<250)this.play(pending.cue,pending.level,pending.pan);
        };
        const compressor=c.createDynamicsCompressor();compressor.threshold.value=-16;compressor.knee.value=12;compressor.ratio.value=5;compressor.attack.value=.004;compressor.release.value=.16;
        this.master=c.createGain();this.master.gain.value=.55;this.master.connect(compressor);compressor.connect(c.destination);
        this.dry=c.createGain();this.dry.connect(this.master);
        const delay=c.createDelay(.5);delay.delayTime.value=.115;const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=2300;
        this.echo=c.createGain();this.echo.gain.value=.13;this.echo.connect(delay);delay.connect(filter);filter.connect(this.master);
        this.noise=c.createBuffer(1,c.sampleRate,c.sampleRate);const data=this.noise.getChannelData(0);let seed=97;
        for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;data[i]=(seed>>>0)/2147483648-1;}
      }
      if(this.context.state!=='running'&&this.context.state!=='closed'){
        // Start the output inside the actual gesture, before resume resolves.
        const c=this.context,primer=c.createBufferSource();
        primer.buffer=c.createBuffer(1,1,c.sampleRate);primer.connect(c.destination);
        primer.onended=()=>primer.disconnect();primer.start();
        void c.resume().catch(()=>{});
      }
    }catch{/* Silent fallback for devices without audio support. */}
  }
  toggle(){this.muted=!this.muted;try{localStorage.setItem('splashy-rock-muted',this.muted?'1':'0');}catch{}if(this.muted){this.stop();if(this.master&&this.context)this.master.gain.setTargetAtTime(0,this.context.currentTime,.015);}else{this.unlock();if(this.master&&this.context)this.master.gain.setTargetAtTime(.55,this.context.currentTime,.025);this.play('ui');}return this.muted;}
  private voice(source:AudioScheduledSourceNode,filter:AudioNode,duration:number,volume:number,delay=0,wet=false,attack=.008,hold=0){
    const c=this.context!;if(this.voices.size>=48){source.disconnect();filter.disconnect();return;}
    const at=c.currentTime+delay,gain=c.createGain();gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(volume,at+attack);if(hold>0)gain.gain.setValueAtTime(volume,at+attack+hold);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
    const pan=c.createStereoPanner();pan.pan.value=this.pan;source.connect(filter);filter.connect(gain);gain.connect(pan);pan.connect(this.dry!);if(wet)pan.connect(this.echo!);
    this.voices.add(source);source.onended=()=>{this.voices.delete(source);source.disconnect();filter.disconnect();gain.disconnect();pan.disconnect();};source.start(at);source.stop(at+duration+.02);
  }
  private tone(from:number,to:number,duration:number,volume:number,delay=0,type:OscillatorType='sine',wet=false){
    const c=this.context!,osc=c.createOscillator(),filter=c.createBiquadFilter();osc.type=type;osc.detune.value=(Math.random()-.5)*8;osc.frequency.setValueAtTime(from,c.currentTime+delay);osc.frequency.exponentialRampToValueAtTime(Math.max(20,to),c.currentTime+delay+duration);filter.type='lowpass';filter.frequency.value=4400;this.voice(osc,filter,duration,volume,delay,wet);
  }
  private air(frequency:number,duration:number,volume:number,delay=0,q=.7){const c=this.context!,source=c.createBufferSource(),filter=c.createBiquadFilter();source.buffer=this.noise;filter.type='bandpass';filter.frequency.setValueAtTime(frequency,c.currentTime+delay);filter.frequency.exponentialRampToValueAtTime(Math.max(180,frequency*.45),c.currentTime+delay+duration);filter.Q.value=q;this.voice(source,filter,duration,volume,delay);}
  private roar(water:boolean,dying=false){
    // Breath and smooth harmonics give the creature weight without a low buzzy rasp.
    const c=this.context!,delay=.24,at=c.currentTime+delay,pitch=water?220:164.81,duration=dying?1.65:1.9;
    for(const [ratio,volume] of [[1,.095],[2,.035],[3,.012]]){
      const osc=c.createOscillator(),filter=c.createBiquadFilter();osc.type='sine';
      osc.frequency.setValueAtTime(pitch*ratio*.94,at);
      osc.frequency.exponentialRampToValueAtTime(pitch*ratio*(dying?1.02:1.16),at+.35);
      osc.frequency.exponentialRampToValueAtTime(pitch*ratio*(dying?.78:1),at+duration);
      filter.type='lowpass';filter.frequency.value=1800;
      this.voice(osc,filter,duration,volume,delay,true,.16,.28);
    }
    this.air(water?1500:850,1.15,.065,.35,.6);
    if(water){this.tone(660,550,.45,.026,.55,'sine',true);this.tone(880,740,.5,.022,.85,'sine',true);}
    else for(let i=0;i<4;i++)this.air(2100+i*170,.08,.025,.42+i*.17,1);
  }

  play(cue:SoundCue,level=1,pan=0){
    if(this.muted||document.hidden||!this.context)return;
    if(this.context.state!=='running'){this.pending={cue,level,pan,at:performance.now()};return;}
    const now=this.context.currentTime,gap=cue==='snap'?.085:['charge','hatch','reward','combo','leafStone','leaves'].includes(cue)?.24:.065;
    if(now-(this.last.get(cue)??-100)<gap)return;this.last.set(cue,now);this.pan=Math.max(-.4,Math.min(.4,pan));
    const note=(f:number,d=.25,v=.1,at=0)=>{this.tone(f,f*.998,d,v,at,'sine',true);this.tone(f*2,f*2,d*.55,v*.2,at,'sine');};
    switch(cue){
      case 'forge':this.air(2600,1.9,.055);this.air(900,1.2,.035);[0,.12,.29,.52,.85,1.3].forEach((at,i)=>{this.air(3200-i*220,.06,.028/(1+i*.3),at);this.tone(290+i*35,140,.07,.024/(1+i*.3),at,'sine');});[0,.17].forEach(at=>{this.tone(740,700,.16,.045,at,'sine',true);this.tone(1480,1400,.09,.012,at,'sine');this.tone(180,110,.08,.04,at,'triangle');});break;
      case 'bossSlam':this.tone(180,65,.24,.12,0,'sine',true);this.air(level===1?2200:950,.38,.12);this.tone(level===1?620:330,180,.18,.055,.03);break;
      case 'bossSpawn':{const water=level===1;this.air(water?1600:950,.7,.095);this.tone(130,110,.3,.08,0,'sine',true);this.air(water?2400:1800,.45,.06,.3);this.roar(water);break;}
      case 'bossHit':{const f=level===1?330:246.94;this.tone(f,f*.84,.3,.075,0,'sine',true);this.tone(f*2,f*1.75,.2,.025,.025,'sine');this.air(level===1?1400:950,.19,.055);break;}
      case 'bossDeath':this.roar(level===1,true);this.tone(164.81,130.81,.5,.065,0,'sine',true);this.air(1400,.6,.075);break;
      case 'bossBurst':this.tone(110,80,.24,.09,0,'sine',true);this.air(level===1?2400:1700,.53,.12);[523,784,1046].forEach((f,i)=>note(f,.4,.035,.06+i*.07));break;
      case 'noSpace':{const f=[392,329.63,261.63][Math.max(0,Math.min(2,level))];note(f,.32,.06);this.air(1200,.12,.035);break;}
      case 'pick':this.tone(390,590,.075,.075);this.air(1800,.045,.025);break;
      case 'snap':this.tone(740,670,.035,.024);break;
      case 'ui':this.tone(550,700,.07,.055);break;
      case 'warning':note(392,.22,.045);note(329.63,.24,.04,.09);break;
      case 'reject':this.tone(160,105,.12,.07,0,'triangle');this.air(600,.07,.035);break;
      case 'water':this.tone(590,175,.18,.17);this.air(2500,.24,.07);this.tone(870,430,.1,.075,.045);this.tone(1100,680,.09,.04,.10);break;
      case 'lava':this.tone(135,62,.22,.18,0,'triangle');this.air(1100,.22,.10);this.air(2900,.06,.065,.02);this.tone(440,180,.10,.055,.06);break;
      case 'stone':this.tone(270,125,.16,.16,0,'triangle');this.air(1500,.13,.14);note(660,.18,.05,.025);break;
      case 'leafStone':
        // A small stony knock wrapped in crisp foliage, rather than dust.
        this.tone(235,115,.10,.07,0,'triangle');
        this.air(4200,.07,.075,0,1.2);this.air(2300,.19,.055,.025,.8);
        this.air(5200,.055,.025,.085,1.4);break;
      case 'leaves':
        // The cross shoots outward first, then individual leaves flutter down.
        this.air(1700,.28,.095,0,.5);this.air(4700,.12,.065,.012,1.1);
        for(let i=0;i<5;i++)this.air([3400,5600,2800,4900,3800][i],.045+i*.01,.04-i*.005,.06+i*.065,1.4);
        break;
      case 'bush':this.air(1900,.14,.07);this.tone(340,200,.09,.045);break;
      case 'berry':for(let i=0;i<4;i++){this.air(2100+i%2*600,.085,.045,i*.22);this.tone(310+i%2*65,180,.065,.04,i*.22);}break;
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
  stop(){this.pending=null;for(const voice of this.voices){try{voice.stop();}catch{}}this.last.clear();}
  dispose(){this.events.abort();this.stop();void this.context?.close();}
}
