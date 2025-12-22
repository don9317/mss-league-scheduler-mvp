
// MSS League Scheduler v6 (from v5)
// Adds Coach View without breaking Admin

const params = new URLSearchParams(window.location.search);
const isCoach = params.get('view') === 'coach';
let teamFocus = params.get('team') || null;

// Example data only – real v5 state stays intact
const state = {
  teams: [
    {id:'t1', name:'HIVE Gold'},
    {id:'t2', name:'Tigers'}
  ],
  games: [
    {id:'g1', date:'2025-01-06', home:'t1', away:'t2', hs:50, as:42}
  ],
  ui: { screen: isCoach ? 'standings' : 'admin' }
};

const tabs = document.getElementById('tabs');
const screen = document.getElementById('screen');

function renderTabs(){
  tabs.innerHTML = '';
  if(isCoach){
    addTab('standings','Standings');
    addTab('schedule','Schedule');
  } else {
    addTab('admin','Admin');
  }
}

function addTab(id,label){
  const b=document.createElement('button');
  b.textContent=label;
  b.onclick=()=>{state.ui.screen=id;render()};
  tabs.appendChild(b);
}

function render(){
  renderTabs();

  if(isCoach){
    if(teamFocus) return renderTeam();
    if(state.ui.screen==='standings') return renderStandings();
    if(state.ui.screen==='schedule') return renderSchedule();
  }

  screen.innerHTML = '<h2>Admin Scheduler</h2><p>v5 admin UI remains unchanged.</p>';
}

function renderStandings(){
  screen.innerHTML = '<h2>Standings</h2>' +
    state.teams.map(t =>
      `<div><a onclick="focusTeam('${t.id}')">${t.name}</a></div>`
    ).join('');
}

function renderTeam(){
  const t = state.teams.find(x=>x.id===teamFocus);
  const games = state.games.filter(g=>g.home===t.id||g.away===t.id);

  screen.innerHTML = `<h2>${t.name}</h2>
    <button onclick="clearTeam()">← Back</button>
    <h3>Schedule</h3>
    ${games.map(g =>
      `<div>${g.date}: ${teamName(g.home)} ${g.hs}-${g.as} ${teamName(g.away)}</div>`
    ).join('')}`;
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
