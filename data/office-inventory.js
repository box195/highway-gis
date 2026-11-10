// Render the device list from the active GIS branch pack.
const OfficeInventory = (() => {
  const empty = /^(?:undefined|null|n\/?a|-|미기재)$/i;
  const text = value => {
    if (typeof value !== 'string' && typeof value !== 'number') return '';
    const result = String(value).trim();
    return empty.test(result) ? '' : result;
  };
  const html = value => text(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const first = (...values) => values.map(text).find(Boolean) || '';
  const show = (value, missing = '미기재') => html(value) || missing;

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
    const records = (Array.isArray(office?.devices) ? office.devices : []).filter(d => d && typeof d === 'object');
    if (office?.device_inventory_source) {
      return records.map(d => ({
        kind: d.kind === 'camera' ? 'camera' : 'equipment',
        location: text(d.location), system: text(d.system), model: text(d.model),
        maker: text(d.maker), asset_number: text(d.asset_number), ip: ipAddress(d.ip),
      }));
    }
    const legacy = records.map(legacyRecord);
    return inScope(office) ? legacy.filter(d => d.location && d.model && d.ip) : legacy;
  }

  function render(office) {
    const scoped = inScope(office);
    const source = text(office?.device_inventory_source);
    const records = devices(office);
    const cameras = scoped ? records.filter(d => d.kind === 'camera') : [];
    const other = scoped ? records.filter(d => d.kind !== 'camera') : records;
    const shell = 'p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2';
    const heading = (title, count) => `<h3 class="font-bold text-white">${title}${count == null ? '' : ` <span class="ml-1 text-[10px] text-cyan-300">${count}대</span>`}</h3>`;
    const ip = v => `<span class="block max-w-full overflow-x-auto whitespace-nowrap font-mono font-semibold text-emerald-300">${show(v)}</span>`;
    return `${scoped ? `<section class="${shell}" aria-label="CCTV 현황">
      <div class="flex flex-wrap items-center justify-between gap-2">${heading('CCTV 현황',cameras.length)}</div>
      ${source ? `<p class="text-[11px] text-slate-400">${html(source)} · 설치위치 기준 분류</p>` : ''}
      ${cameras.length ? `<div class="overflow-x-auto"><table class="w-full table-auto text-left text-[11px] text-slate-200">
        <colgroup><col class="w-1/3"><col><col class="w-px"></colgroup>
        <thead class="bg-slate-800 text-slate-300"><tr><th scope="col" class="px-1.5 py-2">설치 위치</th><th scope="col" class="px-1.5 py-2">카메라 모델</th><th scope="col" class="px-1.5 py-2">IP</th></tr></thead>
        <tbody>${cameras.map(d => `<tr class="border-b border-slate-800 align-top">
          <td class="px-1.5 py-2 [overflow-wrap:anywhere]">${show(d.location)}</td>
          <td class="px-1.5 py-2 [overflow-wrap:anywhere]">${show(d.model || d.system)}</td>
          <td class="px-1.5 py-2">${ip(d.ip)}</td></tr>`).join('')}</tbody></table></div>`
        : '<p class="p-2 rounded bg-slate-900 text-slate-400">등록된 CCTV 자료가 없습니다.</p>'}
      </section>` : ''}
      <section class="${shell}" aria-label="장비 현황">
        ${heading(scoped ? '기타 장비 현황' : '장비 현황',other.length)}
        ${other.length ? other.map(d => `<article class="rounded-lg border border-slate-800 bg-slate-900 p-2.5">
          <div class="flex flex-wrap justify-between gap-x-2 gap-y-1">
            <span class="min-w-0 font-semibold text-cyan-200 [overflow-wrap:anywhere]">${show(d.system || d.model, '장비명 미기재')}</span>${ip(d.ip)}
          </div>
          ${d.location || d.model ? `<div class="mt-1 text-[11px] break-words text-slate-300">${[d.location,d.model].filter(Boolean).map(html).join(' · ')}</div>` : ''}
          ${d.maker || d.asset_number ? `<div class="mt-1 text-[10px] break-words text-slate-400">${[d.maker, d.asset_number].filter(Boolean).map(html).join(' · ')}</div>` : ''}
        </article>`).join('') : `<p class="p-2 rounded bg-slate-900 text-slate-400">등록된 장비 자료가 없습니다.</p>`}
      </section>`;
  }

  return {devices, render};
})();
