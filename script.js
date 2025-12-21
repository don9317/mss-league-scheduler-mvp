// League Scheduler MVP v5
// - Gender + Grade + Skill divisions
// - CSV upload
// - Courts/availability (days + time window), global exception dates
// - 60-minute games, start on :00 or :30
// - Minimum games per team (best-effort) + warnings if not enough capacity
// - Runs locally; saves to localStorage

const LS_KEY = 'leagueSchedulerV5';

let state = {
  teams: [],
  settings: {
    courtsUsed: 4,
    startTime: '09:00',
    endTime: '17:00',
    daysOfWeek: [6],
    seasonStart: new Date().toISOString().slice(0,10),
    minGames: 8,
    exceptions: []
  },
  games: []
};

function uid(prefix='id'){ return prefix + '_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16); }
function pad2(n){ return String(n).padStart(2,'0'); }
function timeToMinutes(t){ const [h,m] = t.split(':').map(Number); return h*60+m; }
function minutesToTime(min){ const h=Math.floor(min/60), m=min%60; return pad2(h)+':'+pad2(m); }
function fmtDate(d){ return d.toISOString().slice(0,10); }
function parseDate(ymd){ const [y,m,dd]=ymd.split('-').map(Number); return new Date(y,m-1,dd); }
function dayName(i){ return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][i]; }
function divKeyFromTeam(t){ return `${t.gender}|${t.grade}|${t.skill}`; }
function divLabelFromKey(k){ const [g,gr,s]=k.split('|'); return `${g} | ${gr} | ${s}`; }
function sanitizeGrade(preset, custom){ const c=(custom||'').trim(); const p=(preset||'').trim(); return c || p || 'Unspecified'; }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

let toastTimer=null;
function toast(msg){
  const el=document.getElementById('genSummary');
  el.textContent=msg;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{ if(el.textContent===msg) el.textContent=''; }, 1800);
}

function saveState(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); toast('Saved.'); }
function loadState(){
  const raw=localStorage.getItem(LS_KEY);
  if(!raw) return;
  try{ const parsed=JSON.parse(raw); if(parsed&&typeof parsed==='object') state=parsed; }catch(e){}
}
function resetAll(){
  if(!confirm('Reset everything (teams, settings, schedule, scores)?')) return;
  localStorage.removeItem(LS_KEY);
  state={
    teams:[],
    settings:{ courtsUsed:4, startTime:'09:00', endTime:'17:00', daysOfWeek:[6], seasonStart:new Date().toISOString().slice(0,10), minGames:8, exceptions:[] },
    games:[]
  };
  hydrateUI(); renderAll(); toast('Reset complete.');
}

function setTab(tab){
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
  document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active', p.id===`tab-${tab}`));
}

// Teams
function addTeamFromForm(){
  const name=document.getElementById('teamName').value.trim();
  if(!name){ alert('Enter a team name.'); return; }
  const gender=document.getElementById('gender').value;
  const skill=document.getElementById('skill').value;
  const grade=sanitizeGrade(document.getElementById('gradePreset').value, document.getElementById('gradeCustom').value);
  state.teams.push({ id:uid('t'), name, gender, grade, skill });
  document.getElementById('teamName').value='';
  document.getElementById('gradeCustom').value='';
  document.getElementById('gradePreset').value='';
  renderTeams(); refreshDivisionFilters();
}
function clearTeams(){
  if(!confirm('Clear all teams?')) return;
  state.teams=[]; state.games=[];
  renderAll(); refreshDivisionFilters();
}
function removeTeam(teamId){
  state.teams=state.teams.filter(t=>t.id!==teamId);
  state.games=state.games.filter(g=>g.aId!==teamId && g.bId!==teamId);
  renderAll(); refreshDivisionFilters();
}
function renderTeams(){
  const list=document.getElementById('teamsList');
  const q=(document.getElementById('teamSearch').value||'').toLowerCase();
  list.innerHTML='';
  const teams=state.teams
    .filter(t=>!q || t.name.toLowerCase().includes(q) || divLabelFromKey(divKeyFromTeam(t)).toLowerCase().includes(q))
    .sort((a,b)=> divKeyFromTeam(a).localeCompare(divKeyFromTeam(b)) || a.name.localeCompare(b.name));

  if(teams.length===0){
    list.innerHTML=`<div class="item"><div>No teams yet.</div><div class="meta">Add manually or upload CSV.</div></div>`;
    return;
  }
  teams.forEach(t=>{
    const div=divLabelFromKey(divKeyFromTeam(t));
    const item=document.createElement('div');
    item.className='item';
    item.innerHTML=`
      <div>
        <div><b>${escapeHtml(t.name)}</b></div>
        <div class="meta">${escapeHtml(div)}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <span class="pill">${escapeHtml(t.skill)}</span>
        <button class="btn secondary" onclick="removeTeam('${t.id}')">Remove</button>
      </div>
    `;
    list.appendChild(item);
  });
}

// CSV parsing
function parseCSV(text){
  const rows=[]; let cur=''; let row=[]; let inQuotes=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(ch === '"'){
      if(inQuotes && text[i+1] === '"'){ cur+='"'; i++; }
      else inQuotes=!inQuotes;
    } else if(ch===',' && !inQuotes){
      row.push(cur); cur='';
    } else if((ch==='\n' || ch==='\r') && !inQuotes){
      if(ch==='\r' && text[i+1]==='\n') i++;
      row.push(cur); cur='';
      if(row.some(v=>v.trim().length>0)) rows.push(row);
      row=[];
    } else {
      cur+=ch;
    }
  }
  if(cur.length || row.length){ row.push(cur); if(row.some(v=>v.trim().length>0)) rows.push(row); }
  return rows;
}
function normalizeGender(g){
  const x=(g||'').toLowerCase();
  if(x.startsWith('b')) return 'Boys';
  if(x.startsWith('g')) return 'Girls';
  return null;
}
function normalizeSkill(s){
  const x=(s||'').toLowerCase();
  if(x.startsWith('o')) return 'Open';
  if(x.startsWith('r')) return 'Rec';
  return null;
}
function handleCsvFile(file){
  const status=document.getElementById('csvStatus');
  status.textContent='';
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const text=String(reader.result||'');
      const rows=parseCSV(text);
      if(rows.length<2){ status.textContent='CSV appears empty.'; return; }
      const header=rows[0].map(h=>h.trim().toLowerCase());
      const idx={
        name: header.findIndex(h=>['team name','team','name'].includes(h)),
        gender: header.findIndex(h=>h==='gender'),
        grade: header.findIndex(h=>h==='grade'),
        skill: header.findIndex(h=>['skill','level'].includes(h))
      };
      if(idx.name<0||idx.gender<0||idx.grade<0||idx.skill<0){
        status.textContent='Missing required headers. Expected: Team Name, Gender, Grade, Skill';
        return;
      }
      let added=0; let skipped=0;
      for(let r=1;r<rows.length;r++){
        const cols=rows[r];
        const name=(cols[idx.name]||'').trim();
        if(!name) continue;
        const g=normalizeGender((cols[idx.gender]||'').trim());
        const s=normalizeSkill((cols[idx.skill]||'').trim());
        const gr=((cols[idx.grade]||'').trim()) || 'Unspecified';
        if(!g||!s){ skipped++; continue; }
        state.teams.push({ id:uid('t'), name, gender:g, grade:gr, skill:s });
        added++;
      }
      renderTeams(); refreshDivisionFilters();
      status.textContent=`Added ${added} team(s).` + (skipped?` (${skipped} row(s) skipped)`:'');
    }catch(e){
      status.textContent='Could not parse CSV.';
    }
  };
  reader.readAsText(file);
}

// Settings UI
function initTimeSelects(){
  const startSel=document.getElementById('startTime');
  const endSel=document.getElementById('endTime');
  startSel.innerHTML=''; endSel.innerHTML='';
  const times=[];
  for(let m=6*60;m<=23*60+30;m+=30) times.push(minutesToTime(m));
  times.forEach(t=>{
    const o1=document.createElement('option'); o1.value=t; o1.textContent=t; startSel.appendChild(o1);
    const o2=document.createElement('option'); o2.value=t; o2.textContent=t; endSel.appendChild(o2);
  });
}
function initDaysChips(){
  const wrap=document.getElementById('daysOfWeek');
  wrap.innerHTML='';
  for(let i=0;i<7;i++){
    const chip=document.createElement('div');
    chip.className='chip'; chip.dataset.day=String(i); chip.textContent=dayName(i);
    chip.onclick=()=>toggleDay(i);
    wrap.appendChild(chip);
  }
}
function toggleDay(i){
  const set=new Set(state.settings.daysOfWeek);
  if(set.has(i)) set.delete(i); else set.add(i);
  state.settings.daysOfWeek=Array.from(set).sort((a,b)=>a-b);
  renderSettings();
}
function addException(){
  const d=document.getElementById('exceptionDate').value;
  if(!d) return;
  if(!state.settings.exceptions.includes(d)) state.settings.exceptions.push(d);
  state.settings.exceptions.sort();
  document.getElementById('exceptionDate').value='';
  renderSettings();
}
function removeException(d){
  state.settings.exceptions=state.settings.exceptions.filter(x=>x!==d);
  renderSettings();
}
function renderSettings(){
  document.getElementById('courtsUsed').value=String(state.settings.courtsUsed);
  document.getElementById('startTime').value=state.settings.startTime;
  document.getElementById('endTime').value=state.settings.endTime;
  document.getElementById('seasonStart').value=state.settings.seasonStart;
  document.getElementById('minGames').value=String(state.settings.minGames);
  document.querySelectorAll('#daysOfWeek .chip').forEach(chip=>{
    const d=Number(chip.dataset.day);
    chip.classList.toggle('active', state.settings.daysOfWeek.includes(d));
  });
  const list=document.getElementById('exceptionsList');
  list.innerHTML='';
  if(state.settings.exceptions.length===0){
    list.innerHTML=`<div class="item"><div>No exception dates.</div><div class="meta">Add dates to skip.</div></div>`;
  } else {
    state.settings.exceptions.forEach(d=>{
      const item=document.createElement('div');
      item.className='item';
      item.innerHTML=`
        <div><div><b>${d}</b></div><div class="meta">Skipped</div></div>
        <div><button class="btn secondary" onclick="removeException('${d}')">Remove</button></div>
      `;
      list.appendChild(item);
    });
  }
  renderCapacityPreview();
}
function renderCapacityPreview(){
  const wrap=document.getElementById('capacityPreview');
  const courts=Number(state.settings.courtsUsed);
  const st=timeToMinutes(state.settings.startTime);
  const et=timeToMinutes(state.settings.endTime);
  const windowMins=Math.max(0, et-st);
  const slotsPerCourt=Math.floor(windowMins/60);
  const days=state.settings.daysOfWeek.length;
  const weeklySlots=courts*slotsPerCourt*days;
  wrap.innerHTML=`
    <div class="box"><div class="num">${weeklySlots}</div><div class="lbl">Game slots per week</div></div>
    <div class="box"><div class="num">${courts}</div><div class="lbl">Courts in use</div></div>
    <div class="box"><div class="num">${slotsPerCourt}</div><div class="lbl">Slots per court/day</div></div>
    <div class="box"><div class="num">${days}</div><div class="lbl">Days scheduled per week</div></div>
  `;
}

// Scheduling core
function groupTeamsByDivision(){
  const map={};
  state.teams.forEach(t=>{
    const key=divKeyFromTeam(t);
    if(!map[key]) map[key]=[];
    map[key].push(t);
  });
  Object.values(map).forEach(arr=>arr.sort((a,b)=>a.name.localeCompare(b.name)));
  return map;
}
function buildRoundRobinRounds(teamIds){
  const ids=[...teamIds];
  if(ids.length<2) return [];
  if(ids.length%2===1) ids.push(null);
  const n=ids.length, half=n/2;
  const rounds=[];
  let arr=ids.slice();
  for(let r=0;r<n-1;r++){
    const pairs=[];
    for(let i=0;i<half;i++){
      const a=arr[i], b=arr[n-1-i];
      if(a!=null && b!=null) pairs.push([a,b]);
    }
    rounds.push(pairs);
    const fixed=arr[0];
    const rest=arr.slice(1);
    rest.unshift(rest.pop());
    arr=[fixed, ...rest];
  }
  return rounds;
}
function generateGamesNeededForDivision(teamIds, minGames){
  const counts=Object.fromEntries(teamIds.map(id=>[id,0]));
  const rounds=buildRoundRobinRounds(teamIds);
  const result=[];
  if(!rounds.length) return result;
  let guard=0;
  while(true){
    guard++; if(guard>2000) break;
    if(teamIds.every(id=>counts[id]>=minGames)) break;
    for(const round of rounds){
      for(const [aId,bId] of round){
        if(counts[aId]>=minGames && counts[bId]>=minGames) continue;
        result.push({aId,bId});
        counts[aId]++; counts[bId]++;
      }
      if(teamIds.every(id=>counts[id]>=minGames)) break;
    }
  }
  return result;
}
function generateTimeSlots(){
  const courts=Number(state.settings.courtsUsed);
  const st=timeToMinutes(state.settings.startTime);
  const et=timeToMinutes(state.settings.endTime);
  const slots=[];
  if(et-st<60) return slots;
  const slotsPerCourt=Math.floor((et-st)/60);
  const exceptions=new Set(state.settings.exceptions);
  const daysSet=new Set(state.settings.daysOfWeek);
  let d=parseDate(state.settings.seasonStart);
  let safetyDays=0;
  while(slots.length<5000 && safetyDays<366*2){
    const ymd=fmtDate(d);
    const dow=d.getDay();
    if(daysSet.has(dow) && !exceptions.has(ymd)){
      for(let c=1;c<=courts;c++){
        for(let k=0;k<slotsPerCourt;k++){
          slots.push({ date: ymd, time: minutesToTime(st+60*k), court: c });
        }
      }
    }
    d.setDate(d.getDate()+1);
    safetyDays++;
  }
  return slots;
}

function scheduleAll(){
  const warningsEl=document.getElementById('genWarnings');
  warningsEl.textContent='';
  document.getElementById('genSummary').textContent='';

  if(state.teams.length<2){ warningsEl.textContent='Add at least 2 teams to generate a schedule.'; return; }
  if(state.settings.daysOfWeek.length===0){ warningsEl.textContent='Select at least one day of week.'; return; }

  const minGames=Math.max(1, Number(state.settings.minGames)||1);
  const divMap=groupTeamsByDivision();

  const divQueues={};
  Object.keys(divMap).forEach(key=>{
    const ids=divMap[key].map(t=>t.id);
    divQueues[key]=generateGamesNeededForDivision(ids, minGames).slice();
  });

  const slots=generateTimeSlots();
  if(!slots.length){ warningsEl.textContent='No available slots. Check start/end times and courts.'; return; }

  state.games=[];

  const divKeys=Object.keys(divQueues).sort();
  let divIdx=0;
  const playedOnDate={};
  let unscheduled=0; divKeys.forEach(k=>unscheduled+=divQueues[k].length);

  let slotIdx=0, safety=0;
  while(unscheduled>0 && slotIdx<slots.length && safety<200000){
    safety++;
    const slot=slots[slotIdx];
    const dateSet=playedOnDate[slot.date] || (playedOnDate[slot.date]=new Set());

    let tries=0, pickedKey=null;
    while(tries<divKeys.length){
      const key=divKeys[divIdx % divKeys.length];
      divIdx++; tries++;
      if(divQueues[key] && divQueues[key].length>0){ pickedKey=key; break; }
    }
    if(!pickedKey) break;

    const queue=divQueues[pickedKey];
    let picked=null, pickedIndex=-1;
    for(let i=0;i<Math.min(queue.length,20);i++){
      const m=queue[i];
      if(!dateSet.has(m.aId) && !dateSet.has(m.bId)){ picked=m; pickedIndex=i; break; }
    }
    if(!picked){ picked=queue[0]; pickedIndex=0; }
    queue.splice(pickedIndex,1);
    unscheduled--;

    dateSet.add(picked.aId); dateSet.add(picked.bId);
    state.games.push({
      id:uid('g'),
      date:slot.date, time:slot.time, court:slot.court,
      divKey:pickedKey,
      aId:picked.aId, bId:picked.bId,
      sa:null, sb:null
    });
    slotIdx++;
  }

  const warnings=[];
  Object.keys(divQueues).forEach(k=>{
    const left=divQueues[k].length;
    if(left>0) warnings.push(`${divLabelFromKey(k)}: short ${left} game(s)`);
  });
  if(warnings.length){
    warningsEl.innerHTML = `Not enough capacity to reach minimum games in some divisions:<br/>• ${warnings.map(escapeHtml).join('<br/>• ')}`;
  } else warningsEl.textContent='';

  const total=state.games.length;
  const start=total?state.games[0].date:'—';
  const end=total?state.games[total-1].date:'—';
  document.getElementById('genSummary').textContent=`Generated ${total} game(s). Season dates: ${start} → ${end}.`;

  refreshDivisionFilters();
  renderSchedule();
  renderStandings();
  setTab('schedule');
}

// Schedule rendering + scoring
function teamById(id){ return state.teams.find(t=>t.id===id) || null; }
function refreshDivisionFilters(){
  const sel=document.getElementById('scheduleFilter');
  const prev=sel.value || 'ALL';
  const divs=Array.from(new Set(state.teams.map(divKeyFromTeam))).sort();
  sel.innerHTML='';
  const all=document.createElement('option'); all.value='ALL'; all.textContent='All divisions'; sel.appendChild(all);
  divs.forEach(k=>{ const o=document.createElement('option'); o.value=k; o.textContent=divLabelFromKey(k); sel.appendChild(o); });
  sel.value = divs.includes(prev) ? prev : 'ALL';
}
function scorePillText(g){
  if(g.sa==null || g.sb==null) return 'No score';
  if(g.sa===g.sb) return 'Tie?';
  return (g.sa>g.sb) ? 'A won' : 'B won';
}
function scorePillClass(g){
  if(g.sa==null || g.sb==null) return '';
  if(g.sa===g.sb) return 'warn';
  return 'good';
}
function setScore(gameId, side, val){
  const g=state.games.find(x=>x.id===gameId);
  if(!g) return;
  const n=Number(String(val).trim());
  const score=Number.isFinite(n) ? n : null;
  if(side==='a') g.sa=score;
  if(side==='b') g.sb=score;
  renderStandings(); renderSchedule();
}
function renderSchedule(){
  const list=document.getElementById('scheduleList');
  const filter=document.getElementById('scheduleFilter').value || 'ALL';
  const games=state.games
    .filter(g=>filter==='ALL' || g.divKey===filter)
    .sort((a,b)=> (a.date+a.time+pad2(a.court)).localeCompare(b.date+b.time+pad2(b.court)));
  list.innerHTML='';
  if(!games.length){
    list.innerHTML=`<div class="item"><div>No games scheduled.</div><div class="meta">Generate from Settings.</div></div>`;
    return;
  }
  let currentDate=null;
  games.forEach(g=>{
    if(g.date!==currentDate){
      currentDate=g.date;
      const hdr=document.createElement('div');
      hdr.className='item';
      hdr.innerHTML=`<div><b>${currentDate}</b></div><div class="meta">${dayName(parseDate(currentDate).getDay())}</div>`;
      list.appendChild(hdr);
    }
    const a=teamById(g.aId), b=teamById(g.bId);
    const div=divLabelFromKey(g.divKey);
    const item=document.createElement('div');
    item.className='item';
    item.innerHTML=`
      <div style="min-width:260px;">
        <div><b>${escapeHtml(a?.name||'—')}</b> vs <b>${escapeHtml(b?.name||'—')}</b></div>
        <div class="meta">${escapeHtml(div)} • Court ${g.court} • ${g.time}</div>
      </div>
      <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; justify-content:flex-end;">
        <input class="score-input" inputmode="numeric" placeholder="A" value="${g.sa ?? ''}" onchange="setScore('${g.id}','a',this.value)"/>
        <span class="muted">-</span>
        <input class="score-input" inputmode="numeric" placeholder="B" value="${g.sb ?? ''}" onchange="setScore('${g.id}','b',this.value)"/>
        <span class="pill ${scorePillClass(g)}">${scorePillText(g)}</span>
      </div>
    `;
    list.appendChild(item);
  });
}
function clearSchedule(){
  if(!confirm('Clear schedule and all scores?')) return;
  state.games=[];
  renderSchedule(); renderStandings();
}

// Standings
function computeStandings(){
  const stats={};
  state.teams.forEach(t=>{ stats[t.id]={ id:t.id, w:0, l:0, pf:0, pa:0, divKey:divKeyFromTeam(t), name:t.name }; });
  state.games.forEach(g=>{
    if(g.sa==null || g.sb==null) return;
    if(!stats[g.aId] || !stats[g.bId]) return;
    stats[g.aId].pf+=g.sa; stats[g.aId].pa+=g.sb;
    stats[g.bId].pf+=g.sb; stats[g.bId].pa+=g.sa;
    if(g.sa>g.sb){ stats[g.aId].w++; stats[g.bId].l++; }
    else if(g.sb>g.sa){ stats[g.bId].w++; stats[g.aId].l++; }
  });
  const byDiv={};
  Object.values(stats).forEach(s=>{ (byDiv[s.divKey] ||= []).push(s); });
  Object.keys(byDiv).forEach(k=>{
    byDiv[k].sort((a,b)=> (b.w-a.w) || ((b.pf-b.pa)-(a.pf-a.pa)) || a.name.localeCompare(b.name));
  });
  return byDiv;
}
function renderStandings(){
  const wrap=document.getElementById('standingsWrap');
  wrap.innerHTML='';
  if(!state.teams.length){ wrap.innerHTML='<div class="muted">No teams yet.</div>'; return; }
  const byDiv=computeStandings();
  const keys=Object.keys(byDiv).sort();
  keys.forEach(k=>{
    const h=document.createElement('h3'); h.textContent=divLabelFromKey(k); wrap.appendChild(h);
    const table=document.createElement('table'); table.className='table';
    table.innerHTML=`
      <thead><tr>
        <th style="width:40%;">Team</th><th>W</th><th>L</th><th>PF</th><th>PA</th><th>PD</th>
      </tr></thead>
      <tbody></tbody>
    `;
    const tb=table.querySelector('tbody');
    byDiv[k].forEach(s=>{
      const tr=document.createElement('tr');
      const pd=s.pf-s.pa;
      tr.innerHTML=`<td><b>${escapeHtml(s.name)}</b></td><td>${s.w}</td><td>${s.l}</td><td>${s.pf}</td><td>${s.pa}</td><td>${pd}</td>`;
      tb.appendChild(tr);
    });
    wrap.appendChild(table);
  });
}

// Export schedule CSV
function csvEscape(v){
  const s=String(v ?? '');
  if(/[",\n\r]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
  return s;
}
function downloadText(filename, text){
  const blob=new Blob([text],{type:'text/plain'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=filename;
  document.body.appendChild(a);
  a.click(); a.remove();
}
function exportScheduleCsv(){
  if(!state.games.length){ alert('No games to export.'); return; }
  const rows=[['Date','Time','Court','Division','Team A','Team B','Score A','Score B']];
  const games=state.games.slice().sort((a,b)=> (a.date+a.time+pad2(a.court)).localeCompare(b.date+b.time+pad2(b.court)));
  games.forEach(g=>{
    const a=teamById(g.aId)?.name || '';
    const b=teamById(g.bId)?.name || '';
    rows.push([g.date,g.time,String(g.court),divLabelFromKey(g.divKey),a,b,g.sa ?? '', g.sb ?? '']);
  });
  const csv=rows.map(r=>r.map(csvEscape).join(',')).join('\n');
  downloadText('schedule.csv', csv);
}

// Hydrate + bindings
function hydrateUI(){
  initTimeSelects();
  initDaysChips();
  renderSettings();
  refreshDivisionFilters();
}
function bindUI(){
  document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click', ()=>setTab(btn.dataset.tab)));
  document.getElementById('btnAddTeam').addEventListener('click', addTeamFromForm);
  document.getElementById('teamSearch').addEventListener('input', renderTeams);
  document.getElementById('btnClearTeams').addEventListener('click', clearTeams);

  document.getElementById('csvFile').addEventListener('change', (e)=>{
    const file=e.target.files && e.target.files[0];
    if(file) handleCsvFile(file);
    e.target.value='';
  });
  document.getElementById('btnDownloadTemplate').addEventListener('click', ()=>{
    downloadText('teams_template.csv', 'Team Name,Gender,Grade,Skill\nThunder,Boys,5th,Open\nLightning,Girls,3rd/4th,Rec\n');
  });

  document.getElementById('courtsUsed').addEventListener('change', e=>{ state.settings.courtsUsed=Number(e.target.value); renderSettings(); });
  document.getElementById('startTime').addEventListener('change', e=>{ state.settings.startTime=e.target.value; renderSettings(); });
  document.getElementById('endTime').addEventListener('change', e=>{ state.settings.endTime=e.target.value; renderSettings(); });
  document.getElementById('seasonStart').addEventListener('change', e=>{ state.settings.seasonStart=e.target.value; });
  document.getElementById('minGames').addEventListener('change', e=>{ state.settings.minGames=Number(e.target.value)||1; });

  document.getElementById('btnAddException').addEventListener('click', addException);
  document.getElementById('btnGenerate').addEventListener('click', scheduleAll);

  document.getElementById('scheduleFilter').addEventListener('change', renderSchedule);
  document.getElementById('btnExportCsv').addEventListener('click', exportScheduleCsv);
  document.getElementById('btnClearSchedule').addEventListener('click', clearSchedule);

  document.getElementById('btnSave').addEventListener('click', saveState);
  document.getElementById('btnReset').addEventListener('click', resetAll);
}
function renderAll(){
  renderTeams();
  renderSettings();
  refreshDivisionFilters();
  renderSchedule();
  renderStandings();
}

loadState();
document.addEventListener('DOMContentLoaded', ()=>{
  hydrateUI();
  bindUI();
  renderAll();
});
