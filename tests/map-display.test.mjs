import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const context={};vm.runInNewContext(fs.readFileSync(new URL('../data/map-display.js',import.meta.url),'utf8'),context);
const {placeIcons,overlaps,MAX_ICON_SHIFT,officeKey,withJunctions}=context.HighwayMapDisplay;
test('compact symbols at one point separate nearby without changing geographic data',()=>{
 const items=Array.from({length:8},(_,i)=>({id:String(i),x:100,y:100,width:12,height:12}));
 const source=JSON.stringify(items),placed=placeIcons(items);assert.equal(placed.length,8);assert.equal(JSON.stringify(items),source);
 for(let i=0;i<placed.length;i++){
  assert.ok(Math.hypot(placed[i].dx,placed[i].dy)<=MAX_ICON_SHIFT);
  for(let j=0;j<i;j++)assert.equal(overlaps(placed[i],placed[j]),false);
 }
});
test('panning preserves symbol offsets without accumulating displacement',()=>{
 const items=Array.from({length:5},(_,i)=>({id:String(i),x:100+i*3,y:100+i*3,width:16,height:16}));
 const previous=new Map(),first=placeIcons(items,previous),next=placeIcons(items.map(p=>({...p,x:p.x+320,y:p.y-170})),previous);
 for(let i=0;i<first.length;i++){assert.equal(first[i].dx,next[i].dx);assert.equal(first[i].dy,next[i].dy);}
});
test('name text never receives collision-avoidance translation',()=>{
 const code=fs.readFileSync(new URL('../data/map-display.js',import.meta.url),'utf8');
 assert.ok(code.includes("label.style.translate='';label.style.visibility='';"));assert.ok(!code.includes('label.style.translate=`'));
});
test('shared offices deduplicate and distinct physical points stay separate',()=>{
 const o={id:'OFFICE-SUWON-SINGAL',lat:37.26694,lng:127.10244};
 assert.equal(officeKey({...o,branch_code:'DONGSEOUL'}),officeKey({...o,branch_code:'GWANGJU'}));assert.notEqual(officeKey(o),officeKey({...o,lat:37.4}));
});
test('supplemental junctions remain unique and preserve registered points',()=>{
 assert.equal(withJunctions([]).length,2);const items=[{name:'신갈JCT',lat:37.3,lng:127.1},{name:'판교IC',lat:37.4,lng:127.2}];assert.equal(withJunctions(items).length,2);assert.equal(withJunctions(items)[0],items[0]);
});
test('default-off layers and separate compact junction symbols are retained',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 for(const name of ['bridges','conduits','cables'])assert.ok(!html.match(new RegExp(`<input[^>]*id="layer-${name}"[^>]*>`))[0].includes('checked'));
 assert.ok(html.includes('class="map-junction-symbol ${typeClass}"'));assert.ok(html.includes('.custom-office-symbol {'));
});
