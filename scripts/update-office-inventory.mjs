// Usage: node scripts/update-office-inventory.mjs /path/to/private-extraction.json
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash,createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {isIP} from 'node:net';

const input = process.argv[2];
if (!input) throw new Error('자산관리대장에서 추출한 JSON 경로를 지정하세요.');
const data = JSON.parse(fs.readFileSync(input,'utf8'));
if (data.format !== 'HIGHWAY_OFFICE_INVENTORY_V1' || !data.offices || Array.isArray(data.offices))
  throw new Error('자산관리대장 파일 형식이 올바르지 않습니다.');

const index = fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const declaration = index.match(/const MASTER_KEY_SEED\s*=\s*("[^"]+")/);
if (!declaration) throw new Error('기존 데이터팩 형식을 찾지 못했습니다.');
const key = createHash('sha256').update(JSON.parse(declaration[1])).digest();
const target = new URL('../data/master_data.js',import.meta.url);
const context = {window:{}};
vm.runInNewContext(fs.readFileSync(target,'utf8'),context);
const original = context.window.ENCRYPTED_BRANCH_PACKS;
if (!original || !Object.keys(original).length) throw new Error('기존 지사 데이터팩이 없습니다.');

const inventories = new Map();
for (const [id,rows] of Object.entries(data.offices)) {
  if (!/^[A-Z0-9_-]+$/.test(id) || !Array.isArray(rows) || !rows.length)
    throw new Error('장비 또는 거점 데이터가 비어 있습니다.');
  inventories.set(id,rows.map(r => {
    if (!r || !['camera','equipment'].includes(r.kind) || !r.location || !r.system || (r.ip && !isIP(r.ip)))
      throw new Error(`대장 장비 필드 오류: ${id}, ${r?.source_row ?? '?'}행`);
    return {kind:r.kind,location:r.location,system:r.system,model:r.model || '',
      maker:r.maker || '',asset_number:r.asset_number || '',ip:r.ip || '',source_row:r.source_row};
  }));
}
if (!inventories.size) throw new Error('반영할 거점이 없습니다.');

const seen = new Set(), updated = {};
for (const [code,envelope] of Object.entries(original)) {
  const bytes = Buffer.from(envelope.ciphertext);
  const decipher = createDecipheriv('aes-256-gcm',key,Buffer.from(envelope.iv));
  decipher.setAuthTag(bytes.subarray(-16));
  const pack = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(0,-16)),decipher.final()]));
  for (const office of pack.offices || []) {
    if (!inventories.has(office.id)) continue;
    office.devices = inventories.get(office.id);
    office.device_inventory_source = data.source;
    seen.add(office.id);
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm',key,iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(pack),'utf8'),cipher.final(),cipher.getAuthTag()]);
  updated[code] = {...envelope,updated_at:new Date().toISOString(),iv:Array.from(iv),ciphertext:Array.from(ciphertext)};
}
if (seen.size !== inventories.size) throw new Error('GIS에 없는 거점: '+[...inventories.keys()].filter(id=>!seen.has(id)).join(', '));
fs.writeFileSync(target,`// GIS branch packs; office inventories are bundled with the office records.\r\nwindow.ENCRYPTED_BRANCH_PACKS = ${JSON.stringify(updated)};\r\n`);
const devices = [...inventories.values()].flat();
const cameras = devices.filter(d=>d.kind==='camera').length;
console.log(`${seen.size}개 거점 · CCTV ${cameras}대 · 기타 장비 ${devices.length-cameras}대 반영`);
