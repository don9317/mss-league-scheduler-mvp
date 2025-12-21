
// v6.1 – Correct default view handling

const params = new URLSearchParams(window.location.search);
const viewParam = params.get('view');

const isCoach = viewParam === 'coach';
let teamFocus = params.get('team');

const Screens = isCoach
  ? [{id:'standings',name:'Standings'},{id:'schedule',name:'Schedule'}]
  : [{id:'admin',name:'Admin'}];

const state = {
  divisions:[{id:'d1',name:'5th Grade',gender:'Boys',skills:['Open']}],
  teams:[
    {id:'t1',name:'HIVE Gold',divisionId:'d1',skill:'Open'},
    {id:'t2',name:'Tigers',divisionId:'d1',skill:'Open'}
  ],
  games:[
    {id:'g1',divisionId:'d1',skill:'Open',date:'2025-01-06',homeTeamId:'t1',awayTeamId:'t2',homeScore:50,awayScore:42}
  ],
  ui:{
    screen: isCoach ? 'standings' : 'admin'
  }
};

const tabs = document.getElementById('tabs');
const screen = document.getElementById('screen');

function renderTabs(){
  tabs.innerHTML = '';
  Screens.forEach(s=>{
    const b=document.createElement('button');
    b.textContent=s.name;
    b.onclick=()=>{state.ui.screen=s.id;render()};
    tabs.appendChild(b);
  });
}

function render(){
  renderTabs();

  if(isCoach){
    if(teamFocus) return renderTeam();
    if(state.ui.screen==='standings') return renderStandings();
    if(state.ui.screen==='schedule') return renderSchedule();
  }

  screen.innerHTML = `
    <h2>Main Admin Product</h2>
    <p>This is the full League Scheduler admin view.</p>
    <p><em>Open <code>?view=coach</code> for Coach View.</em></p>
  `;
}

function renderStandings(){
  const rows = state.teams.map(t=>{
    const g=state.games.filter(x=>x.homeTeamId===t.id||x.awayTeamId===t.id);
    const w=g.filter(x=>(x.homeTeamId===t.id&&x.homeScore>x.awayScore)||(x.awayTeamId===t.id&&x.awayScore>x.homeScore)).length;
    const l=g.length-w;
    return {...t,w,l};
  });

  screen.innerHTML = `<h2>Standings</h2>
    <table>
    ${rows.map(r=>`
      <tr>
        <td><a onclick="focusTeam('${r.id}')">${r.name}</a></td>
        <td>${r.w}-${r.l}</td>
      </tr>
    `).join('')}
    </table>`;
}

function renderTeam(){
  const t=state.teams.find(x=>x.id===teamFocus);
  const games=state.games.filter(g=>g.homeTeamId===t.id||g.awayTeamId===t.id);

  screen.innerHTML = `
    <h2>${t.name}</h2>
    <button onclick="clearTeam()">← Back to Standings</button>
    <h3>Schedule</h3>
    ${games.map(g=>`
      <div>${g.date}: ${teamName(g.homeTeamId)} ${g.homeScore}-${g.awayScore} ${teamName(g.awayTeamId)}</div>
    `).join('')}
  `;
}

function renderSchedule(){
  screen.innerHTML = '<h2>Division Schedule</h2>';
}

function focusTeam(id){
  teamFocus=id;
  history.replaceState(null,'',`?view=coach&team=${id}`);
  render();
}

function clearTeam(){
  teamFocus=null;
  history.replaceState(null,'',`?view=coach`);
  render();
}

function teamName(id){
  return state.teams.find(t=>t.id===id)?.name||'';
}

render();
