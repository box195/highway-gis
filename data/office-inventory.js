// The source ledger stays on the user's device. This module never sends it to a server.
const OfficeInventory = (() => {
  const FORMAT = 'HIGHWAY_OFFICE_INVENTORY_V1';
  const empty = /^(?:undefined|null|n\/?a|-|미기재)$/i;
  const text = value => {
    if (typeof value !== 'string' && typeof value !== 'number') return '';
    const result = String(value).trim();
    return empty.test(result) ? '' : result;
  };
  const html = value => text(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const first = (...values) => values.map(text).find(Boolean) || '';
  const show = (value, missing = '미기재') => html(value) || missing;
  let inventory = null;
  let status = '';
  let revision = 0;

  function ipAddress(value) {
    const ip = text(value);
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip) && ip.split('.').every(n => Number(n) < 256)) return ip;
    if (/^[\da-f:]+$/i.test(ip) && ip.includes(':')) {
      try { return new URL(`http://[${ip}]/`).hostname ? ip : ''; } catch { /* invalid address */ }
    }
    return '';
  }

  function inScope(office) {
    return /지사|영업소|터널\s*관리동/.test(first(office?.category) + ' ' + first(office?.name));
  }

  function legacyRecord(device) {
    const system = first(device.sys_name, device.sys_type, device.type);
    const model = first(device.equip_name, device.model_sn, device.model, device.name);
    const desc = [system, model, text(device.name)].join(' ');
    const camera = !/환경감시|서버|NVR|운영\s*PC|스위치/i.test(desc)
      && (/카메라|camera|speed.?dome|bullet/i.test(desc) || system === 'CCTV');
    return {
      kind: camera ? 'camera' : 'equipment',
      system: first(system, device.name), model,
      location: first(device.install_loc, device.location),
      maker: text(device.maker), asset_number: text(device.dev_no),
      ip: ipAddress(device.ip),
    };
  }

  function devices(office) {
    const imported = inScope(office) && inventory?.offices[office?.id];
    if (imported) return imported;
    return (Array.isArray(office?.devices) ? office.devices : []).filter(d => d && typeof d === 'object').map(legacyRecord);
  }

  function validate(pack) {
    if (pack?.format !== FORMAT || !pack.offices || Array.isArray(pack.offices) || typeof pack.offices !== 'object')
      throw new Error('자산관리대장용 JSON 파일을 선택하세요.');
    const offices = Object.create(null);
    let count = 0;
    for (const [id, rows] of Object.entries(pack.offices)) {
      if (!/^[A-Z0-9_-]{1,64}$/.test(id) || !Array.isArray(rows) || (count += rows.length) > 2500)
        throw new Error('거점 또는 장비 형식이 올바르지 않습니다.');
      offices[id] = rows.map(r => {
        if (!r || !['camera','equipment'].includes(r.kind) || !text(r.location) || !text(r.system))
          throw new Error('장비의 설치 위치 또는 종류를 읽을 수 없습니다.');
        return {kind:r.kind, location:text(r.location).slice(0,180), system:text(r.system).slice(0,80),
          model:text(r.model).slice(0,120), maker:text(r.maker).slice(0,100),
          asset_number:text(r.asset_number).slice(0,120), ip:ipAddress(r.ip),
          source_row:Number.isInteger(r.source_row) && r.source_row > 4 ? r.source_row : null};
      });
    }
    if (!count) throw new Error('불러올 장비가 없습니다.');
    return {format:FORMAT, source:text(pack.source).slice(0,120), sheet:text(pack.sheet).slice(0,100), offices};
  }

  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('HighwayOfficeInventory', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('inventory');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('브라우저 저장소가 열려 있습니다.'));
    });
  }

  async function readLocal() {
    const db = await openDB();
    try {
      const saved = await new Promise((resolve, reject) => {
        const request = db.transaction('inventory').objectStore('inventory').get('active');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (!saved) return null;
      const bytes = await crypto.subtle.decrypt({name:'AES-GCM',iv:saved.iv}, saved.key, saved.ciphertext);
      return validate(JSON.parse(new TextDecoder().decode(bytes)));
    } finally { db.close(); }
  }

  async function storeLocal(pack) {
    const key = await crypto.subtle.generateKey({name:'AES-GCM',length:256}, false, ['encrypt','decrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({name:'AES-GCM',iv}, key, new TextEncoder().encode(JSON.stringify(pack)));
    const db = await openDB();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction('inventory','readwrite');
        tx.oncomplete = resolve;
        tx.onabort = tx.onerror = () => reject(tx.error);
        tx.objectStore('inventory').put({key,iv,ciphertext},'active');
      });
    } finally { db.close(); }
  }

  function report(message) {
    status = message;
    document.querySelectorAll('[data-office-inventory-status]').forEach(el => { el.textContent = status; });
  }

  function init(onChange) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.id = 'office-inventory-file';
    input.hidden = true;
    document.body.append(input);
    let loading = false;
    document.addEventListener('click', event => {
      if (!loading && event.target.closest?.('[data-office-inventory-import]')) input.click();
    });
    input.addEventListener('change', async () => {
      const file = input.files[0];
      input.value = '';
      if (!file || loading) return;
      loading = true;
      try {
        if (file.size > 2_000_000) throw new Error('2MB 이하의 자산관리대장 JSON을 선택하세요.');
        const pack = validate(JSON.parse((await file.text()).replace(/^\uFEFF/, '')));
        revision++;
        inventory = pack;
        const label = `${Object.keys(pack.offices).length}개 거점 자산관리대장`;
        let message = `${label}을 이 브라우저에 저장했습니다.`;
        try { await storeLocal(pack); } catch { message = `${label}을 불러왔습니다. 브라우저 저장이 제한되어 이 탭에서만 표시합니다.`; }
        report(message);
        onChange();
      } catch (error) {
        report(error instanceof SyntaxError ? '자산관리대장 JSON을 읽을 수 없습니다.' : (error.message || '파일을 불러올 수 없습니다.'));
      } finally { loading = false; }
    });
    readLocal().then(pack => {
      if (!pack || revision) return;
      inventory = pack;
      report('이 브라우저에 보관된 자산관리대장을 사용 중입니다.');
      onChange();
    }).catch(() => {});
  }

  function render(office) {
    const scoped = inScope(office);
    const imported = scoped && !!inventory?.offices[office.id];
    const records = devices(office);
    const cameras = scoped ? records.filter(d => d.kind === 'camera') : [];
    const other = scoped ? records.filter(d => d.kind !== 'camera') : records;
    const shell = 'p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2';
    const fileButton = `<button type="button" data-office-inventory-import class="shrink-0 rounded border border-cyan-700 px-2 py-1 text-[11px] text-cyan-200 hover:bg-cyan-900">자산관리대장 불러오기</button>`;
    const heading = (title, count) => `<h3 class="font-bold text-white">${title} <span class="ml-1 text-[10px] text-cyan-300">${count}대</span></h3>`;
    const ip = v => `<span class="font-mono font-semibold text-emerald-300" style="overflow-wrap:anywhere">${show(v)}</span>`;
    return `${scoped ? `<section class="${shell}" aria-label="CCTV 현황">
      <div class="flex flex-wrap items-center justify-between gap-2">${heading('CCTV 현황',cameras.length)}${fileButton}</div>
      <p class="text-[11px] text-slate-400">${imported ? `${html(inventory.source)} · 이 브라우저의 대장` : '기존 등록 자료 · 최신 IP와 장비는 자산관리대장을 불러오세요.'}</p>
      <p class="text-[11px] text-cyan-300 empty:hidden" role="status" data-office-inventory-status>${html(status)}</p>
      ${cameras.length ? `<table class="w-full table-fixed text-left text-[11px] text-slate-200">
        <colgroup><col style="width:39%"><col style="width:26%"><col style="width:35%"></colgroup>
        <thead class="bg-slate-800 text-slate-300"><tr><th scope="col" class="px-2 py-2">설치 위치</th><th scope="col" class="px-2 py-2">카메라 종류</th><th scope="col" class="px-2 py-2">IP</th></tr></thead>
        <tbody>${cameras.map(d => `<tr class="border-b border-slate-800 align-top">
          <td class="px-2 py-2 break-words">${show(d.location)}</td>
          <td class="px-2 py-2 break-words">${show(d.model || d.system)}</td>
          <td class="px-2 py-2">${ip(d.ip)}</td></tr>`).join('')}</tbody></table>`
        : '<p class="p-2 rounded bg-slate-900 text-slate-400">등록된 CCTV 자료가 없습니다.</p>'}
      </section>` : ''}
      <section class="${shell}" aria-label="장비 현황">
        ${heading(scoped ? '기타 장비 현황' : '장비 현황',other.length)}
        ${other.length ? other.map(d => `<article class="rounded-lg border border-slate-800 bg-slate-900 p-2.5">
          <div class="flex flex-wrap justify-between gap-x-2 gap-y-1">
            <span class="font-semibold text-cyan-200">${show(d.system || d.model, '장비명 미기재')}</span>${ip(d.ip)}
          </div>
          <div class="mt-1 text-[11px] break-words text-slate-300">${show(d.location)} · ${show(d.model, '모델 미기재')}</div>
          ${d.maker || d.asset_number ? `<div class="mt-1 text-[10px] break-words text-slate-400">${[d.maker, d.asset_number].filter(Boolean).map(html).join(' · ')}</div>` : ''}
        </article>`).join('') : '<p class="p-2 rounded bg-slate-900 text-slate-400">등록된 장비 자료가 없습니다.</p>'}
      </section>`;
  }

  return {devices, init, render};
})();
