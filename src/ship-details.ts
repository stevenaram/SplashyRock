export interface ShipPart {x:number;y:number;z:number;width:number;height:number;depth:number;color?:string;rx?:number;ry?:number;rz?:number;round?:boolean}
export const SHIP_PARTS:ShipPart[]=[];
const add=(x:number,y:number,z:number,width:number,height:number,depth:number,color?:string,extra:Partial<ShipPart>={})=>{SHIP_PARTS.push({x,y,z,width,height,depth,color,...extra});};
const metal='#555c60',gold='#a38a60',light='#d9b47d',dark='#241a36',water='#248ab2',lava='#e5632c';
function bolt(x:number,y:number,z:number){add(x,y,z,.09,.055,.09,light,{round:true});}
function beam(a:number[],b:number[],thick:number,color=gold){const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],length=Math.hypot(dx,dy,dz);add((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,thick,length,thick,color,{rz:-Math.atan2(dx,dy),rx:Math.atan2(dz,Math.hypot(dx,dy))});}
// Narrow service walkways sit outside the entire eight-by-eight playfield.
for(const side of [-1,1]){
 for(let z=-7;z<=7;z+=2){
  add(side*8.64,-.07,z,1.25,.22,2.04);
  add(side*9.06,.76,z,.20,1.35,.20,metal);add(side*9.06,1.46,z,.31,.12,.31,gold);bolt(side*9.06,1.55,z);
  add(side*9.06,1.36,z,.105,.11,2.05,gold);add(side*9.06,.87,z,.09,.10,2.05,metal);
  // Glass-jacketed elemental pipes and broad coupling rings.
  add(side*8.25,.34,z,.31,1.80,.31,side<0?lava:water,{round:true,rx:Math.PI/2});
  add(side*8.25,.43,z,.085,1.6,.085,side<0?'#ffb957':'#72c9cf',{round:true,rx:Math.PI/2});
  for(const dz of [-.86,.86]){add(side*8.25,.34,z+dz,.47,.15,.47,metal,{round:true,rx:Math.PI/2});bolt(side*8.25,.60,z+dz);}
  if(z%4===1){add(side*8.25,.69,z,.20,.40,.20,gold,{round:true});for(let k=0;k<6;k++){const a=k*Math.PI/3;add(side*8.25+Math.cos(a)*.22,.93,z+Math.sin(a)*.22,.12,.065,.12,gold);}bolt(side*8.25,.96,z);}
 }
}
// Captain's platform, steps, brick cabin, inset warm windows, and armored roof.
add(0,.02,-10.1,7.2,.26,3.65);
for(let i=0;i<4;i++){add(-3.2,.15+i*.12,-8.55-i*.42,.95,.18,.48,metal);add(3.2,.15+i*.12,-8.55-i*.42,.95,.18,.48,metal);}
for(let row=0;row<5;row++)for(let col=0;col<7;col++){
 add(-2.58+col*.86,.38+row*.35,-9.0,.84,.34,.38);
 add(-2.58+col*.86,.38+row*.35,-11.6,.84,.34,.38);
}
for(const side of [-1,1])for(let row=0;row<5;row++)for(let z=-11.3;z<-9;z+=.6)add(side*2.85,.38+row*.35,z,.38,.34,.58);
for(let col=0;col<5;col++){
 const x=-2+col;add(x,1.22,-8.77,.78,.76,.14,gold);add(x,1.22,-8.675,.62,.59,.065,'#ffb957');add(x,1.25,-8.63,.49,.13,.025,'#ffe097');add(x,1.22,-8.62,.06,.64,.025,dark);
}
add(0,2.11,-10.3,6.45,.24,3.35);add(0,2.27,-10.3,6.60,.12,3.50);
for(const x of [-3.05,3.05])for(const z of [-11.8,-10.3,-8.8])bolt(x,2.36,z);
add(0,.40,-8.48,1.1,.5,.35,metal);
for(let i=0;i<10;i++){const a=i*Math.PI/5;add(Math.cos(a)*.47,.96+Math.sin(a)*.47,-8.38,.15,.15,.10,gold);beam([0,.96,-8.38],[Math.cos(a)*.6,.96+Math.sin(a)*.6,-8.38],.06,light);}
// Chimneys, collars and furnace grilles.
for(const side of [-1,1]){
 const x=side*2.1;add(x,2.8,-10.8,.56,1.1,.56,dark,{round:true});for(const y of [2.4,3.1,3.35])add(x,y,-10.8,.73,.13,.73,gold,{round:true});add(x,3.44,-10.8,.48,.06,.48,'#ffb957',{round:true});
 for(let i=0;i<4;i++)add(x-.23+i*.15,2.7,-10.49,.065,.52,.04,'#e5632c');
}
// Cargo crane: foot, vertical tower, triangular boom, cable, hook and hanging crate.
add(-6.4,.25,-10.3,1.45,.5,1.45,metal);add(-6.4,1.85,-10.3,.42,3.1,.42);
for(const dz of [-.32,.32]){
 beam([-6.4,3.1,-10.3+dz],[-9.6,4.2,-11.5+dz],.23,dark);
 beam([-6.4,1.7,-10.3+dz],[-9.6,4.2,-11.5+dz],.15,metal);
}
beam([-6.4,3.7,-10.3],[-9.6,4.25,-11.5],.08,gold);
add(-6.4,1.1,-9.96,.68,.68,.18,gold,{round:true,rx:Math.PI/2});
beam([-9.6,4.2,-11.5],[-9.6,1.7,-11.5],.055,light);
add(-9.6,1.46,-11.5,.15,.32,.15,gold);add(-9.48,1.31,-11.5,.35,.10,.15,gold);
add(-9.6,.88,-11.5,.85,.76,.85);
for(const x of [-9.94,-9.26])add(x,.88,-11.5,.075,.8,.91,metal);
for(const z of [-11.85,-11.15])add(-9.6,.88,z,.91,.8,.075,gold);
// Navigation lamps, bollards, and cargo boxes distributed beyond the play area.
for(const side of [-1,1])for(const z of [-8.55,8.9]){
 const x=side*7.5;add(x,.3,z,.75,.55,.7);add(x,.74,z,.42,.5,.42,gold);add(x,.77,z,.27,.38,.46,'#ffb957');add(x,1.06,z,.61,.14,.58,dark);
}
for(const side of [-1,1])for(let i=0;i<3;i++){
 const x=side*(4.5+i*.8),z=9.5+i*.12;add(x,.28,z,.7,.56,.72,metal);for(const dx of [-.25,.25])add(x+dx,.59,z,.075,.05,.74,gold);
}
// Forecastle pennant, capped mast and a brass trident, no lettering.
add(0,2.83,-11.3,.15,1.4,.15,gold);add(0,3.37,-11.27,2.0,.95,.065,dark);
add(0,3.35,-11.21,.075,.68,.045,light);add(0,3.43,-11.21,.62,.075,.045,light);for(const x of [-.3,.3])add(x,3.58,-11.21,.07,.35,.045,light);
// Bow armor, glowing engine intake and anchor emblem.
add(0,.63,10.96,2.0,1.22,.28);for(let i=0;i<5;i++)add(-.65+i*.325,.64,11.13,.14,.72,.04,'#ffb957');
for(const x of [-1.12,1.12])add(x,.64,11.02,.20,1.34,.48,gold);
add(0,.79,11.24,.09,.62,.08,light);beam([-.5,.45,11.24],[0,.27,11.24],.09,light);beam([.5,.45,11.24],[0,.27,11.24],.09,light);
// Riveted armor straps emphasize a ship's joined plates rather than a stone tub.
for(const side of [-1,1])for(let z=-7.6;z<9;z+=1.65){add(side*9.11,.56,z,.12,1.15,.16,metal);for(const y of [.12,.55,1.02])bolt(side*9.20,y,z);}
