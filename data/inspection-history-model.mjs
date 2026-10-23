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

export const INSPECTION_BRANCHES={'동서울지사':'DONGSEOUL','경기광주지사':'GWANGJU'};
export function inspectionOfficeName(name){
  const value=name.replace(/\s/g,'').replace(/^한국도로공사/,'').replace(/영$/,'영업소');
  return value==='구리영업소'?'구리남양주영업소':value;
}
export function calendarSchedule(month,data={},branch='ALL'){
  const groups=inspectionRows(month,branch).filter(g=>INSPECTION_BRANCHES[g.branch]);
  const plans=new Map();
  for(const g of groups){
    const names=g.items.filter(i=>/인공|수공/.test(i.equipment)).flatMap(i=>i.value.match(/\d+(?:-\d+)?[MH]/g)||[]);
    const office=!g.section.includes('선로')||(!names.length&&/지사|영업소|본부|관리|센터|영$/.test(g.target));
    const target=office?inspectionOfficeName(g.target):g.target;
    const id=[g.date,g.branch,office?'OFFICE':'LINE',target,office?'':g.milepost].join('|');
    let p=plans.get(id);
    if(!p){
      p={history:true,date:g.date,day:Number(g.date.slice(8)),branch_name:g.branch,branch_code:INSPECTION_BRANCHES[g.branch],type:office?'OFFICE':'LINE',title:`${target} 점검`,history_items:[]};
      if(office)Object.assign(p,{office_name:target,transmission:[],wired:[]});
      else p.line={section_label:target,milepost_range:g.milepost||'원본 미기재',manhole_names:[],manholes:[],bridge:'',joint_box_count:0};
      plans.set(id,p);
    }
    for(const item of g.items){
      p.history_items.push({...item,section:g.section,sheet:g.sheet});
      if(office){
        const entry={facility:item.equipment,cycle:item.value,office:target};
        if(g.section.includes('전송'))p.transmission.push(entry);
        else if(/유선|방범/.test(g.section))p.wired.push(entry);
        else if(/케이블/.test(item.equipment))p.cable_check={name:item.equipment,cycle:item.value,detail:item.value};
        else if(/국소|OFD/.test(item.equipment))p.ofd_check={name:item.equipment,cycle:item.value,detail:item.value};
        else p.wired.push(entry);
      }else{
        if(/인공|수공/.test(item.equipment)){
          for(const name of item.value.match(/\d+(?:-\d+)?[MH]/g)||[]){
            if(p.line.manhole_names.includes(name))continue;
            p.line.manhole_names.push(name);
            const known=(data.manholes||[]).find(m=>m.name===name&&(!m.branch_code||m.branch_code===p.branch_code));
            p.line.manholes.push(known?{...known}:{name,category:name.endsWith('M')?'인공':'수공',type:'원본 계획',section:target});
          }
        }else if(/교량/.test(item.equipment))p.line.bridge=[p.line.bridge,item.value].filter(Boolean).join(' · ');
        else if(/접속함체/.test(item.equipment)){p.line.joint_box_count+=Number(item.value)||0;p.line.joint_box_cycle=item.cycle;}
      }
    }
  }
  const schedule={};
  for(const p of plans.values()){
    p.cycle=[...new Set(p.history_items.flatMap(i=>(i.cycle||i.value).match(/[MQH]/g)||[]))].join('·');
    if(p.line)p.line.cycle=p.cycle;
    (schedule[p.date]??=[]).push(p);
  }
  return Object.fromEntries(Object.entries(schedule).sort(([a],[b])=>a.localeCompare(b)).map(([date,dayPlans])=>[date,{...dayPlans[0],plans:dayPlans}]));
}
