import fs from 'node:fs';
import crypto from 'node:crypto';
const files=[
  'data/highway-roads.json','data/highway-routing.mjs','data/highway-endpoints.mjs',
  'data/navigation-catalog.mjs','data/highway-toll-access.mjs','data/highway-office-access.mjs',
  'data/highway-tollgates.mjs','data/saved-navigation.mjs','data/songpa-exit-access.mjs',
  'data/quick-origin.mjs'
];
const normalize=value=>value.replace(/\r\n?/g,'\n');
const revision=(convert=identity)=>{
  const hash=crypto.createHash('sha256');
  for(const name of files){
    // Canonical UTF-8 text: Git/autocrlf on Windows must not alter revision.
    const normalized=normalize(convert(fs.readFileSync(name,'utf8')));
    hash.update(name);hash.update('\0');hash.update(normalized);
  }
  return hash.digest('hex').slice(0,24);
};
function identity(value){return value;}
const stamp=revision(),target='data/route-cache-revision.mjs';
if(process.argv.includes('--verify-newlines')){
  const crlf=revision(v=>normalize(v).replace(/\n/g,'\r\n'));
  if(stamp!==crlf)throw Error('LF/CRLF fingerprint mismatch');
  console.log('LF/CRLF fingerprint equivalence PASS:',stamp);
  process.exit(0);
}
const body=`// Routing and public graph fingerprint; run node scripts/stamp-route-cache.mjs after changes.
export const ROUTE_DATA_REVISION='${stamp}';
`;
if(process.argv.includes('--check')){
  if(fs.readFileSync(target,'utf8')!==body)throw Error('Route cache revision stale. Run node scripts/stamp-route-cache.mjs');
  console.log('cache fingerprint current:',stamp);
}else{fs.writeFileSync(target,body);console.log('cache fingerprint stamped:',stamp);}
