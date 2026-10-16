// Public OSM motorway_link extract from api.openstreetmap.org/api/0.6/map,
// bbox=127.145,37.505,127.17,37.525, retrieved 2026-10-16.
// Usage: node scripts/build-office-access.mjs public-extract.json
import fs from 'node:fs/promises';
import {buildGraph} from '../data/highway-routing.mjs';
const raw=JSON.parse((await fs.readFile(process.argv[2],'utf8')).replace(/^\uFEFF/,''));
const graph=buildGraph(JSON.parse(await fs.readFile(new URL('../data/highway-roads.json',import.meta.url),'utf8')));
const arrivals=[];
for(const id of [436249639,13833906976]){
  // Both named Seo-hanam junction nodes have an outgoing directed exit ramp
  // whose public destination includes the regional office / Dongseoul branch.
  if(!raw.elements.some(w=>w.type==='way'&&w.tags?.highway==='motorway_link'&&w.tags.oneway==='yes'&&w.nodes[0]===id))throw new Error('Missing directed Seo-hanam exit ramp');
  for(const e of graph.mainEdges.filter(e=>e.b===id)){
    const a=graph.nodes.get(e.a),b=graph.nodes.get(e.b),t=Math.max(0,1-30/e.length);
    const bearing=(Math.atan2((b.lng-a.lng)*Math.cos(a.lat*Math.PI/180),b.lat-a.lat)*180/Math.PI+360)%360;
    arrivals.push({edgeKey:`${e.a}:${e.b}`,lat:a.lat+(b.lat-a.lat)*t,lng:a.lng+(b.lng-a.lng)*t,road:e.road,bearing:Math.round(bearing),kind:'exit'});
  }
}
if(arrivals.length!==2)throw new Error('Expected both Seo-hanam carriageway exits');
await fs.writeFile(new URL('../data/highway-office-access.mjs',import.meta.url),'// Directed Seo-hanam IC exits from public OSM topology (ODbL-1.0), 2026-10-16.\n// Source: https://api.openstreetmap.org/api/0.6/map?bbox=127.145,37.505,127.17,37.525\nexport const SEO_HANAM_ACCESS = '+JSON.stringify(arrivals,null,2)+';\n');
