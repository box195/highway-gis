import fs from 'node:fs/promises';
import {buildGraph} from '../data/highway-routing.mjs';
const osm=JSON.parse(await fs.readFile(process.argv[2],'utf8'));
const graph=buildGraph(osm), wayIds=new Set(graph.edges.map(e=>e.way)), nodeIds=new Set(graph.edges.flatMap(e=>[e.a,e.b]));
const data={source:'OpenStreetMap contributors / Geofabrik South Korea',url:'https://download.geofabrik.de/asia/south-korea.html',license:'ODbL-1.0',dataAsOf:osm.dataAsOf||null,extractedAt:new Date().toISOString(),elements:osm.elements.filter(e=>e.type==='way'?wayIds.has(e.id):nodeIds.has(e.id)).map(e=>e.type==='node'?e:{type:e.type,id:e.id,nodes:e.nodes,tags:Object.fromEntries(Object.entries(e.tags).filter(([k])=>['highway','name','ref','oneway','access','vehicle','motor_vehicle'].includes(k)))})};
const output=new URL('../data/highway-roads.json',import.meta.url);
await fs.writeFile(output,JSON.stringify(data));
console.log(JSON.stringify({ways:wayIds.size,nodes:nodeIds.size,bytes:JSON.stringify(data).length,roads:graph.available}));
