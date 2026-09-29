export const HIGH_SCORE_KEY='splashy-rock-best';
export class HighScore {
 private best=0;
 constructor(private readonly storage?:Pick<Storage,'getItem'|'setItem'>){this.refresh();}
 get value(){return this.best;}
 refresh(){
  try {const saved=Number(this.storage?.getItem(HIGH_SCORE_KEY));if(Number.isSafeInteger(saved)&&saved>=0)this.best=Math.max(this.best,saved);}catch{}
  return this.best;
 }
 record(score:number){
  if(!Number.isSafeInteger(score)||score<=this.best)return this.best;
  this.refresh();this.best=Math.max(this.best,score);
  try {this.storage?.setItem(HIGH_SCORE_KEY,String(this.best));}catch{}
  return this.best;
 }
}
