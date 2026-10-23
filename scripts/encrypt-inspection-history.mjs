// Encrypt a private extraction with the app's existing data-pack format.
// Usage: node scripts/encrypt-inspection-history.mjs PRIVATE_HISTORY.json
import fs from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
const source=JSON.parse(await fs.readFile(process.argv[2],'utf8'));
if(source.version!==1||!source.months?.length)throw new Error('Invalid inspection archive');
const html=await fs.readFile(new URL('../index.html',import.meta.url),'utf8');
const declaration=html.match(/const MASTER_KEY_SEED\s*=\s*("[^"]+")/);
if(!declaration)throw new Error('Existing data-pack key declaration is unavailable');
const hash=await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.parse(declaration[1])));
const key=await webcrypto.subtle.importKey('raw',hash,{name:'AES-GCM'},false,['encrypt']);
const iv=webcrypto.getRandomValues(new Uint8Array(12));
const ciphertext=await webcrypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(source)));
await fs.writeFile(new URL('../data/inspection-history.enc.json',import.meta.url),JSON.stringify({encrypted:true,iv:[...iv],ciphertext:[...new Uint8Array(ciphertext)]}));
console.log(`Encrypted ${source.months.length} months; private source data was not written to the repository.`);
