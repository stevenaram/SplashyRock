export interface ShipPart {x:number;y:number;z:number;width:number;height:number;depth:number;color?:string;rx?:number;ry?:number;rz?:number;round?:boolean}
export const SHIP_PARTS:ShipPart[]=[];
const add=(x:number,y:number,z:number,width:number,height:number,depth:number,color?:string,extra:Partial<ShipPart>={})=>{SHIP_PARTS.push({x,y,z,width,height,depth,color,...extra});};
const metal='#555c60',gold='#737786',light='#a4afbb',dark='#241a36',water='#248ab2',lava='#e5632c';
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
  add(side*8.25,.43,z,.085,1.6,.085,side<0?'#ff792d':'#72c9cf',{round:true,rx:Math.PI/2});
  for(const dz of [-.86,.86]){add(side*8.25,.34,z+dz,.47,.15,.47,metal,{round:true,rx:Math.PI/2});bolt(side*8.25,.60,z+dz);}
  if(z%4===1){add(side*8.25,.69,z,.20,.40,.20,gold,{round:true});for(let k=0;k<6;k++){const a=k*Math.PI/3;add(side*8.25+Math.cos(a)*.22,.93,z+Math.sin(a)*.22,.12,.065,.12,gold);}bolt(side*8.25,.96,z);}
 }
}
// An industrial, two-storey wheelhouse: engineering base and glass bridge.
add(0,.08,-10.2,7.1,.32,3.8);
for(const side of [-1,1])for(let i=0;i<7;i++){add(side*3.25,.17+i*.20,-8.65-i*.34,.85,.18,.39,metal);add(side*3.70,.82+i*.20,-8.65-i*.34,.08,1.05,.08,metal);}
for(let row=0;row<5;row++)for(let col=0;col<6;col++)add(-2.35+col*.94,.38+row*.29,-9.3,.92,.28,.40);
for(const side of [-1,1])add(side*2.75,.95,-10.45,.32,1.7,2.5);
add(0,1.84,-10.4,6.05,.23,3.1,metal);
// Engine access, vents, riveted panels and elemental feed lines.
add(0,.85,-9.05,1.04,1.24,.13,metal);add(0,.85,-8.96,.80,1.02,.065,dark);
for(const side of [-1,1]){
 for(let i=0;i<5;i++)add(side*1.8,.48+i*.19,-9.055,.92,.075,.065,metal);
 for(const x of [side*2.48,side*.64])for(const y of [.35,1.45])add(x,y,-9.025,.095,.095,.075,light);
 add(side*2.45,1.10,-8.99,.15,1.20,.15,side<0?lava:water);
 add(side*2.45,.55,-8.88,.07,.36,.04,side<0?'#ff792d':'#62d2df');
}
// Broad blue glass, mullions and painted reflections; never glowing windows.
add(0,2.10,-10.45,5.8,.30,2.8,metal);
for(let col=0;col<5;col++){
 const x=-2.24+col*1.12;add(x,2.85,-9.12,1.09,1.23,.14,metal);add(x,2.85,-9.015,.91,1.03,.07,'#315d71');
 add(x-.18,3.05,-8.968,.22,.50,.017,'#72a9b5',{rz:-.30});add(x+.26,2.68,-8.968,.09,.58,.017,'#4e899e',{rz:-.30});
 add(x,2.35,-8.94,.88,.10,.08,dark);
}
for(const side of [-1,1])for(let j=0;j<3;j++){
 const z=-9.65-j*.78;add(side*2.82,2.85,z,.14,1.23,.77,metal);add(side*2.91,2.85,z,.045,1.02,.60,'#315d71');add(side*2.94,3.03,z,.02,.20,.51,'#72a9b5');
}
add(0,3.54,-10.3,6.25,.22,3.30);add(0,3.70,-10.3,6.48,.14,3.5,metal);
// Roof ribs, HVAC fans, service hatch and offset antenna replace the pennant.
for(let i=0;i<9;i++)add(-2.8+i*.70,3.80,-10.3,.10,.08,3.12,metal);
for(const x of [-1.7,1.7]){
 add(x,3.86,-10.5,1.14,.18,1.14,dark);add(x,3.99,-10.5,.87,.12,.87,metal,{round:true});
 for(let k=0;k<8;k++){const a=k*Math.PI/4;add(x+Math.cos(a)*.25,4.06,-10.5+Math.sin(a)*.25,.31,.04,.07,dark,{ry:-a});}
}
add(0,3.86,-9.6,.86,.12,.68,dark);add(2.8,4.34,-11.6,.09,1.24,.09,metal);add(2.8,4.62,-11.6,.65,.06,.08,metal);
for(const side of [-1,1]){
 const x=side*4.2;add(x,.22,-10.1,1.08,.40,1.08);add(x,1.18,-10.1,.56,1.65,.56,dark,{round:true});
 for(const y of [.47,1.5,2.0])add(x,y,-10.1,.73,.15,.73,metal,{round:true});
 add(x,2.13,-10.1,.46,.09,.46,side<0?'#ff792d':'#48bace',{round:true});
 for(let i=0;i<4;i++)add(x-.21+i*.14,1.18,-9.79,.07,.52,.055,side<0?lava:water);
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
 const x=side*7.5;add(x,.3,z,.75,.55,.7);add(x,.74,z,.42,.5,.42,gold);add(x,.77,z,.27,.38,.46,'#ff792d');add(x,1.06,z,.61,.14,.58,dark);
}
for(const side of [-1,1])for(let i=0;i<3;i++){
 const x=side*(4.5+i*.8),z=9.5+i*.12;add(x,.28,z,.7,.56,.72,metal);for(const dx of [-.25,.25])add(x+dx,.59,z,.075,.05,.74,gold);
}
// Bow armor, glowing engine intake and anchor emblem.
add(0,.63,10.96,2.0,1.22,.28);for(let i=0;i<5;i++)add(-.65+i*.325,.64,11.13,.14,.72,.04,'#ff792d');
for(const x of [-1.12,1.12])add(x,.64,11.02,.20,1.34,.48,gold);
add(0,.79,11.24,.09,.62,.08,light);beam([-.5,.45,11.24],[0,.27,11.24],.09,light);beam([.5,.45,11.24],[0,.27,11.24],.09,light);
// Riveted armor straps emphasize a ship's joined plates rather than a stone tub.
for(const side of [-1,1])for(let z=-7.6;z<9;z+=1.65){add(side*9.11,.56,z,.12,1.15,.16,metal);for(const y of [.12,.55,1.02])bolt(side*9.20,y,z);}

for(const side of [-1,1])for(let z=-7.4;z<8;z+=1.2){
 add(side*8.94,1.37,z,.38,.10,1.12,metal);
 add(side*8.95,1.44,z,.12,.035,.86,light);
 add(side*8.78,.52,z,.10,.28,.58,side<0?lava:water);
}
