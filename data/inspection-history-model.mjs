export function monthLabel(key){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(key))throw new Error('점검계획 월 형식이 올바르지 않습니다.');
  return `${key.slice(0,4)}년 ${Number(key.slice(5))}월`;
}
export function archiveMonths(archive){
  return (archive?.months||[]).slice().sort((a,b)=>b.month.localeCompare(a.month));
}
export function inspectionRows(month,branch='ALL',query=''){
  const needle=query.trim().toLocaleLowerCase();
  const rows=(month?.groups||[]).filter(g=>(branch==='ALL'||g.branch===branch)&&(!needle||[g.date,g.branch,g.target,g.section,g.milepost,...g.items.flatMap(i=>[i.equipment,i.value,i.cycle])].join(' ').toLocaleLowerCase().includes(needle)));
  return rows.slice().sort((a,b)=>a.date.localeCompare(b.date)||a.branch.localeCompare(b.branch)||a.target.localeCompare(b.target)||a.section.localeCompare(b.section));
}
export function rowTotals(rows){
  return {plans:rows.length,days:new Set(rows.map(g=>g.date)).size,items:rows.reduce((sum,g)=>sum+g.items.length,0)};
}
