// Bridge locations and chainage keep their own provenance, separate from manholes.
function bridgeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function bridgeMilepost(item) {
  if (!Number.isFinite(Number(item.milepost)) || item.milepost == null) return '이정 미확인';
  return `${Number(item.milepost).toFixed(1)}km · ${item.milepost_status === 'LEDGER_NOTE' ? '비고 원문 이정' : '추정 이정'}`;
}
function bridgeCoordinateLabel(item) {
  return item.coordinate_status === 'GOOGLE_MAPS' ? '구글지도 위치' : item.coordinate_status === 'UNLOCATED' ? '위치 확인 대기' : '추정 위치';
}
function selectBridge(item) {
  if (item.lat && item.lng) AppState.map.flyTo([item.lat, item.lng], 16, {duration: 1});
  showDetailDrawer('bridge', item);
  closeMobileSidebar();
}
function bridgeSearchResult(item) {
  return `<div class="search-item p-2.5 hover:bg-slate-800 cursor-pointer text-xs border-b border-slate-800" data-type="bridge" data-bridge-id="${bridgeHtml(item.id)}"><div class="font-bold text-violet-300 text-sm">🌉 ${bridgeHtml(item.name)} <span class="text-[10px] font-normal">${bridgeCoordinateLabel(item)}</span></div><div class="text-slate-400 text-[11px]">${bridgeHtml(item.route)} · ${bridgeMilepost(item)}</div></div>`;
}
function renderBridgeFacilities(listContainer, sectionFilter) {
  let count = 0;
  const show = document.getElementById('layer-bridges')?.checked ?? true;
  for (const item of AppState.data.bridges || []) {
    if (sectionFilter !== 'ALL' && item.section !== sectionFilter) continue;
    count++;
    if (show && item.lat && item.lng) {
      const marker = L.circleMarker([item.lat, item.lng], {
        radius: 8, color: '#f5d0fe', weight: 2, fillColor: '#a855f7', fillOpacity: 0.9,
        dashArray: item.coordinate_status === 'GOOGLE_MAPS' ? null : '3 3'
      });
      marker.bindTooltip(`<b>🌉 ${bridgeHtml(item.name)}</b><br>${bridgeHtml(item.route)} · ${bridgeMilepost(item)}<br>${bridgeCoordinateLabel(item)}`, {sticky: true});
      marker.on('click', () => selectBridge(item));
      AppState.layerGroups.bridges.addLayer(marker);
    }
    if (listContainer) {
      const row = document.createElement('div');
      row.className = 'p-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-violet-900/60 cursor-pointer';
      row.innerHTML = `<div class="font-bold text-violet-300 text-sm">🌉 ${bridgeHtml(item.name)}</div><div class="text-[11px] text-slate-400">${bridgeHtml(item.route)} · ${bridgeMilepost(item)}</div><div class="text-[10px] text-amber-300">${bridgeCoordinateLabel(item)}</div>`;
      row.addEventListener('click', () => selectBridge(item));
      listContainer.appendChild(row);
    }
  }
  return count;
}
function renderBridgeDetail(item) {
  const drawer = document.getElementById('detail-drawer');
  const badge = document.getElementById('drawer-type-badge');
  badge.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/40';
  badge.textContent = '교량';
  document.getElementById('drawer-title').textContent = item.name;
  const references = (item.source_refs || []).map(r => `<li>${bridgeHtml(r.file)}<br>${bridgeHtml(r.sheet)} · ${bridgeHtml(r.cell)}<br><span class="text-slate-400">${bridgeHtml(r.text)}</span></li>`).join('');
  const anchors = (item.estimate_anchors || []).map(a => `<li>${bridgeHtml(a.name)} · ${a.milepost}km<br><span class="text-slate-400">${a.lat}, ${a.lng}</span></li>`).join('');
  document.getElementById('drawer-body').innerHTML = `
    <div class="p-3 rounded-xl bg-slate-950 border border-violet-800 space-y-2 text-xs">
      <div>${bridgeHtml(item.branch_name)} · ${bridgeHtml(item.route)}</div>
      <div class="text-slate-400">${bridgeHtml(item.section)} · 양방향 구조물</div>
      <div class="font-bold text-violet-300">${bridgeMilepost(item)}</div>
      <div class="text-amber-300">${bridgeCoordinateLabel(item)}${item.lat ? ` · ${item.lat.toFixed(6)}, ${item.lng.toFixed(6)}` : ''}</div>
      <div class="text-slate-300 leading-relaxed">${bridgeHtml(item.coordinate_note)}</div>
      <div class="text-slate-400 leading-relaxed">${bridgeHtml(item.milepost_note)}</div>
      ${item.aliases?.length ? `<div class="text-slate-400">별칭/원문 확인: ${bridgeHtml(item.aliases.join(', '))}</div>` : ''}
      <a class="block text-cyan-300 underline" href="${bridgeHtml(item.google_maps_url)}" target="_blank" rel="noopener noreferrer">구글지도에서 위치 열기</a>
      <div class="text-slate-400">지도 대조: ${bridgeHtml(item.google_check_note || '원본 맨홀 기준 위치 추정')}</div>
    </div>
    <div class="mt-3 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs"><h3 class="font-bold text-white mb-2">좌표·이정 계산 기준 맨홀</h3><ul class="space-y-2">${anchors || '<li>위치 기준 미확인</li>'}</ul>${item.projection_distance_m != null ? `<p class="mt-2 text-slate-400">맨홀 연결선과 지도 위치의 거리: 약 ${Math.round(item.projection_distance_m)}m</p>` : ''}</div>
    <div class="mt-3 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs"><h3 class="font-bold text-white mb-2">엑셀 원문</h3><ul class="space-y-3">${references}</ul></div>`;
  drawer.classList.add('drawer-open');
}
