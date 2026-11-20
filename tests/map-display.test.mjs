import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const context={};vm.runInNewContext(fs.readFileSync(new URL('../data/map-display.js',import.meta.url),'utf8'),context);
const {placeLabels,overlaps,withJunctions}=context.HighwayMapDisplay;
function check(items,width,height){
 const before=JSON.stringify(items),placed=placeLabels(items,width,height);
 assert.equal(placed.length,items.length);assert.equal(JSON.stringify(items),before);
 for(let i=0;i<placed.length;i++){
  const p=placed[i];assert.ok(p.x>=0&&p.y>=0&&p.x+p.width<=width&&p.y+p.height<=height);
  for(let j=0;j<i;j++)assert.equal(overlaps(p,placed[j]),false);
 }return placed;
}
test('overlapping map names separate below or right while preserving exact anchor points',()=>{
 const items=Array.from({length:12},(_,i)=>({id:i,x:180,y:150,width:110,height:22,anchor:{x:230,y:180},priority:i<2?2:1}));
 const placed=check(items,900,600);assert.ok(placed.some(x=>x.dx>0||x.dy>0));
 assert.ok(placed.every(x=>x.anchor.x===230&&x.anchor.y===180));
});
test('dense labels stay separate on narrow mobile viewports and at map edges',()=>{
 for(const width of [360,390,900])check(Array.from({length:24},(_,i)=>({id:i,x:width-120,y:80,width:i%3?90:200,height:22,anchor:{x:width-30,y:110+i*3},priority:i%3})),width,640);
});
test('zooming and panning recalculate the layout rather than accumulating offsets',()=>{
 const make=scale=>Array.from({length:10},(_,i)=>({id:i,x:50+i*scale,y:90+i*scale,width:100,height:20,anchor:{x:60+i*scale,y:100+i*scale}}));
 for(const scale of [2,5,10,30])check(make(scale),800,600);
 const a=placeLabels(make(5),800,600),b=placeLabels(make(5),800,600);assert.equal(JSON.stringify(a),JSON.stringify(b));
});
test('Pangyo IC and Singal JC supplement the map once without replacing user GIS coordinates',()=>{
 const items=[{name:'신갈JCT',lat:37.3,lng:127.1},{name:'판교IC',lat:37.4,lng:127.2}];
 const result=withJunctions(items);assert.equal(result.length,2);assert.equal(result[0],items[0]);assert.equal(result[1],items[1]);
 const added=withJunctions([]);assert.equal(added.length,2);assert.equal(added.find(x=>x.name==='신갈JC').lat,37.295386);
});
test('bridges, conduits and cables start off while offices and manholes remain visible',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 for(const name of ['bridges','conduits','cables'])assert.ok(!html.match(new RegExp(`<input[^>]*id="layer-${name}"[^>]*>`))[0].includes('checked'));
 for(const name of ['offices','manholes'])assert.ok(html.match(new RegExp(`<input[^>]*id="layer-${name}"[^>]*>`))[0].includes('checked'));
 assert.ok(html.includes('HighwayMapDisplay.create(map, L)'));
 assert.ok(html.includes('data-map-label'));
});
