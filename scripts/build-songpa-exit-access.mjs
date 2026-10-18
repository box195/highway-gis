// Deterministic, direction-specific Songpa IC ramp access from the existing public OSM extract.
// Usage: node scripts/build-songpa-exit-access.mjs ../roads-osm.json
import fs from 'node:fs/promises';
import {buildGraph,distance} from '../data/highway-routing.mjs';

const source=process.argv[2];
if(!source)throw new Error('Pass the existing full public roads-osm.json');
const raw=JSON.parse(await fs.readFile(source,'utf8')),graph=buildGraph(raw);
const nodes=new Map(raw.elements.filter(e=>e.type==='node').map(n=>[n.id,{lat:n.lat,lng:n.lon}]));
const ways=new Map(raw.elements.filter(e=>e.type==='way').map(w=>[w.id,w]));
const road='수도권제1순환고속도로';
// These OSM way/node IDs name two independently connected motorway -> exit-ramp
// chains. Fail closed when their ordered directed topology no longer agrees.
const exits=[
  {approach:'northbound',fork:734968654,terminal:8236756523,ways:[908687231,908687232,908687237,903231701]},
  {approach:'southbound',fork:13363699817,terminal:734968966,ways:[908687234,908687236,908687235]}
];
const lerp=(a,b,t)=>({lat:a.lat+(b.lat-a.lat)*t,lng:a.lng+(b.lng-a.lng)*t});
const bearing=(a,b)=>(Math.atan2((b.lng-a.lng)*Math.cos(a.lat*Math.PI/180),b.lat-a.lat)*180/Math.PI+360)%360;
const access=exits.map(({approach,fork,terminal,ways:ids})=>{
  let path=[fork],total=0;
  for(const id of ids){
    const w=ways.get(id);
    if(w?.tags?.highway!=='motorway_link'||!['yes','1','true'].includes(w.tags.oneway)||w.nodes[0]!==path.at(-1) ||
       ['no','private'].some(v=>[w.tags.access,w.tags.motor_vehicle,w.tags.vehicle].includes(v)))
      throw new Error(`Unverified directed ${approach} Songpa ramp: ${id}`);
    path.push(...w.nodes.slice(1));
  }
  if(path.at(-1)!==terminal||new Set(path).size!==path.length)throw new Error('Exit ramp topology disconnected/cyclic: '+approach);
  let at=fork,edge;
  // Some OSM fork segments are shorter than the 30m upstream anchor offset.
  // Walk backward only along unique, directed, named motorway edges.
  for(let i=0;i<8;i++){
    const incoming=graph.mainEdges.filter(e=>e.b===at&&e.road===road);
    if(incoming.length!==1)throw new Error('Missing/ambiguous incoming motorway edge: '+approach);
    edge=incoming[0];if(edge.length>40)break;at=edge.a;
  }
  const a=graph.nodes.get(edge.a),b=graph.nodes.get(edge.b);
  if(!a||!b||edge.length<=40)throw new Error('Exit fork has no safe upstream anchor: '+approach);
  const anchor=lerp(a,b,1-30/edge.length),coords=path.map(id=>nodes.get(id));
  if(coords.some(p=>!p))throw new Error('Missing ramp geometry: '+approach);
  for(let i=1;i<coords.length;i++)total+=distance(coords[i-1],coords[i]);
  if(total<200||total>4000)throw new Error('Exit ramp length outside local Songpa range: '+approach);
  // Stop 35 m BEFORE the final motorway_link vertex. The source extract
  // deliberately omits surface roads, so never project beyond this end.
  let remaining=35,destination,prefix;
  for(let i=coords.length-1;i>0;i--){
    const seg=distance(coords[i-1],coords[i]);
    if(seg>=remaining){
      destination=lerp(coords[i-1],coords[i],(seg-remaining)/seg);
      prefix=coords.slice(0,i);break;
    }
    remaining-=seg;
  }
  if(!destination||distance(destination,coords.at(-1))>36)
    throw new Error('Ramp terminal offset invalid: '+approach);
  return {approach,edgeKey:`${edge.a}:${edge.b}`,lat:anchor.lat,lng:anchor.lng,
    road,bearing:Math.round(bearing(a,b)),kind:'ic-exit',destination,
    rampPoints:[...prefix,destination],sourceWayIds:ids,terminalNodeId:terminal,terminalOffsetMeters:35};
});
if(new Set(access.map(a=>a.edgeKey)).size!==2||new Set(access.map(a=>a.terminalNodeId)).size!==2)throw new Error('Songpa approaches overlap');
const header='// Generated directed Songpa IC exit access (ODbL-1.0), public OSM from ../roads-osm.json.\n'+
  '// Rebuild: node scripts/build-songpa-exit-access.mjs ../roads-osm.json\n'+
  '// Destinations are 35m upstream of terminal motorway_link nodes, not entry ramps or surface roads.\n';
await fs.writeFile(new URL('../data/songpa-exit-access.mjs',import.meta.url),
  header+'export const SONGPA_EXIT_ACCESS = '+JSON.stringify(access,null,2)+';\n','utf8');
for(const p of access)console.log(JSON.stringify({approach:p.approach,anchor:p.edgeKey,bearing:p.bearing,
   destination:p.destination,lengthMeters:Math.round(p.rampPoints.reduce((v,q,i,x)=>v+(i?distance(x[i-1],q):0),0)),
   terminalNodeId:p.terminalNodeId,sourceWayIds:p.sourceWayIds}));

