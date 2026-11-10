// Read the local asset ledger's cached XLSX cells. No workbook content is uploaded or executed.
const OfficeInventoryXlsx = (() => {
  const SHEET = '자산관리대장_자가통신망';
  const MAX_MEMBER = 12 * 1024 * 1024;
  const decoder = new TextDecoder();
  const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const key = value => clean(value).replace(/\s/g, '');
  const directSites = new Map([['동서울지사','OFFICE-DONGSEOUL'],['경기광주지사','OFF_GWANGJU_MAIN']]);
  const namedSites = new Map([
    ['성남','OFFICE-SEONGNAM'],['토평','OFFICE-TOPYEONG'],['구리남양주','OFFICE-GURI'],
    ['청계','OFFICE-CHEONGGYE'],['광암터널','OFFICE-GWANGAM'],['광암터널관리동','OFFICE-GWANGAM'],
    ['서이천','OFF_SEOICHUN_TG'],['곤지암','OFF_GONJIAM_TG'],['경기광주','OFF_GWANGJU_TG'],
    ['동서울','OFF_DONGSEOUL_TG'],['하남','OFF_HANAM_TG'],
  ]);

  function identifySite(branch, location) {
    const split = location.indexOf('_');
    if (split < 0) {
      const id = directSites.get(key(branch));
      return id ? {id, location} : null;
    }
    const prefix = key(location.slice(0, split));
    const detail = clean(location.slice(split + 1));
    if (!detail) return null;
    const suwon = /^수원신갈\((입|입구|출구)\)(?:영업소|영)$/.exec(prefix);
    if (suwon) return {id:'OFFICE-SUWON-SINGAL', location:`${suwon[1] === '출구' ? '출구' : '입구'} · ${detail}`};
    const id = directSites.get(prefix) || namedSites.get(prefix.replace(/(?:영업소|영)$/, ''));
    return id ? {id, location:detail} : null;
  }

  function unzip(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const u16 = i => view.getUint16(i, true);
    const u32 = i => view.getUint32(i, true);
    const badZip = () => new Error('정상적인 .xlsx 파일을 선택하세요.');
    let end = bytes.length - 22;
    const start = Math.max(0, end - 65535);
    while (end >= start && (u32(end) !== 0x06054b50 || end + 22 + u16(end + 20) !== bytes.length)) end--;
    if (end < start || u16(end + 4) || u16(end + 6)) throw badZip();
    const members = new Map();
    const count = u16(end + 10);
    let cursor = u32(end + 16);
    if (!count || count > 4096 || cursor + u32(end + 12) > end) throw badZip();
    for (let i = 0; i < count; i++) {
      if (cursor + 46 > end || u32(cursor) !== 0x02014b50) throw badZip();
      const length = u16(cursor + 28);
      const next = cursor + 46 + length + u16(cursor + 30) + u16(cursor + 32);
      if (next > end) throw badZip();
      const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + length));
      members.set(name, {flags:u16(cursor + 8), method:u16(cursor + 10), packed:u32(cursor + 20),
        size:u32(cursor + 24), offset:u32(cursor + 42)});
      cursor = next;
    }
    return {
      has: name => members.has(name),
      async text(name) {
        const entry = members.get(name);
        if (!entry || entry.size > MAX_MEMBER || entry.flags & 1) throw badZip();
        const p = entry.offset;
        if (p + 30 > end || u32(p) !== 0x04034b50) throw badZip();
        const from = p + 30 + u16(p + 26) + u16(p + 28);
        if (from + entry.packed > end) throw badZip();
        const data = bytes.subarray(from, from + entry.packed);
        if (entry.method === 0 && entry.packed === entry.size) return decoder.decode(data);
        if (entry.method !== 8) throw badZip();
        let inflate;
        try { inflate = new DecompressionStream('deflate-raw'); }
        catch { throw new Error('이 브라우저에서 엑셀을 열 수 없습니다. 변환한 JSON을 불러오세요.'); }
        const reader = new Blob([data]).stream().pipeThrough(inflate).getReader();
        let result = '', read = 0;
        const utf8 = new TextDecoder();
        for (;;) {
          const {done,value} = await reader.read();
          if (done) break;
          read += value.byteLength;
          if (read > entry.size) { await reader.cancel(); throw badZip(); }
          result += utf8.decode(value, {stream:true});
        }
        if (read !== entry.size) throw badZip();
        return result + utf8.decode();
      }
    };
  }

  const nodes = (root, name) => Array.from(root.getElementsByTagNameNS('*', name));
  const child = (node, name) => Array.from(node?.children || []).find(c => c.localName === name);
  const richText = node => Array.from(node?.children || []).filter(c => c.localName === 't' || c.localName === 'r')
    .map(c => c.localName === 't' ? c.textContent : child(c,'t')?.textContent || '').join('');
  async function xml(zip, path) {
    const source = await zip.text(path);
    if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error('이 엑셀의 XML 형식은 지원하지 않습니다.');
    const doc = new DOMParser().parseFromString(source, 'application/xml');
    if (nodes(doc,'parsererror').length) throw new Error('엑셀 내용을 읽을 수 없습니다.');
    return doc;
  }

  function resolvePart(rel) {
    const url = new URL(rel.getAttribute('Target') || '', 'https://xlsx.invalid/xl/workbook.xml');
    if (rel.getAttribute('TargetMode') === 'External' || url.origin !== 'https://xlsx.invalid' || !url.pathname.startsWith('/xl/'))
      throw new Error('지원하지 않는 엑셀 문서 구조입니다.');
    return url.pathname.slice(1);
  }

  async function read(file) {
    const zip = unzip(new Uint8Array(await file.arrayBuffer()));
    const [book, relationships] = await Promise.all([xml(zip,'xl/workbook.xml'),xml(zip,'xl/_rels/workbook.xml.rels')]);
    const sheet = nodes(book,'sheet').find(s => s.getAttribute('name') === SHEET);
    if (!sheet) throw new Error(`${SHEET} 시트를 찾지 못했습니다.`);
    const relations = nodes(relationships,'Relationship');
    const id = sheet.getAttribute('r:id') || sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
    const relation = relations.find(r => r.getAttribute('Id') === id && r.getAttribute('Type')?.endsWith('/worksheet'));
    if (!relation) throw new Error('자산관리대장 시트를 열 수 없습니다.');
    const stringsPart = relations.find(r => r.getAttribute('Type')?.endsWith('/sharedStrings'));
    const stringsPath = stringsPart ? resolvePart(stringsPart) : 'xl/sharedStrings.xml';
    const [table, stringsDoc] = await Promise.all([xml(zip,resolvePart(relation)),zip.has(stringsPath) ? xml(zip,stringsPath) : null]);
    const strings = stringsDoc ? nodes(stringsDoc,'si').map(richText) : [];
    const value = c => {
      const raw = child(c,'v')?.textContent || '';
      const type = c.getAttribute('t');
      if (type === 'inlineStr') return clean(richText(child(c,'is')));
      if (type === 's') return clean(raw === '' ? '' : strings[Number(raw)]);
      return type === 'e' ? '' : clean(raw);
    };
    const columns = new Set(['D','E','G','H','I','J','Q','T']);
    const rows = nodes(table,'row');
    const rowCells = row => Object.fromEntries(Array.from(row.children)
      .filter(c => c.localName === 'c')
      .map(c => [c.getAttribute('r')?.match(/^[A-Z]+/)?.[0],c])
      .filter(([col]) => columns.has(col)).map(([col,c]) => [col,value(c)]));
    const headerRow = rows.find(r => r.getAttribute('r') === '4');
    const header = headerRow && rowCells(headerRow);
    if (!header || Object.entries({D:'지사',E:'설치위치',G:'시스템명',H:'장비명',J:'IP'}).some(([col,label]) => key(header[col]) !== label))
      throw new Error('자산관리대장의 열 제목이 예상과 다릅니다.');
    const offices = Object.create(null);
    const unmatched = [];
    for (const row of rows) {
      const source_row = Number(row.getAttribute('r'));
      if (source_row <= 4) continue;
      const c = rowCells(row);
      if (!c.E || !c.G) continue;
      const site = identifySite(c.D,c.E);
      if (!site) {
        if (directSites.has(key(c.D))) unmatched.push(source_row);
        continue;
      }
      const camera = c.G === 'CCTV' && (/카메라/.test(c.H || '') || c.T === '카메라');
      (offices[site.id] ??= []).push({kind:camera?'camera':'equipment',location:site.location,system:c.G,
        model:c.H || '',maker:c.I || '',asset_number:c.Q || '',ip:c.J || '',source_row});
    }
    return {format:'HIGHWAY_OFFICE_INVENTORY_V1',source:file.name,sheet:SHEET,offices,unmatched};
  }
  return {read};
})();
