// One ticket per player placement. Descendant reactions retain this same ticket;
// unrelated placements never postpone its completion.
export class Aftermath {
  private work=1;
  private timer:ReturnType<typeof setTimeout>|undefined;
  private closed=false;
  constructor(private readonly done:()=>void){}
  get finished(){return this.closed;}
  retain(){if(this.closed)return;clearTimeout(this.timer);this.work++;}
  release(){
    if(this.closed)return;
    if(--this.work===0)this.timer=setTimeout(()=>{if(this.work===0&&!this.closed){this.closed=true;this.done();}},500);
  }
  cancel(){this.closed=true;clearTimeout(this.timer);}
}
