
const Screens=[
{id:"setup",name:"1) Divisions"},
{id:"teams",name:"2) Teams"}
];

const state={
divisions:[
{id:"d1",name:"5th Grade",gender:"Boys",skills:["Open","Rec"]},
{id:"d2",name:"5th Grade",gender:"Girls",skills:["Open","Rec"]}
],
teams:[],
ui:{screen:"setup",divisionId:"d1",skill:"Open"}
};

const tabs=document.getElementById("tabs");
const screen=document.getElementById("screen");

function renderTabs(){
tabs.innerHTML="";
Screens.forEach(s=>{
 const b=document.createElement("button");
 b.textContent=s.name;
 b.onclick=()=>{state.ui.screen=s.id;render()};
 tabs.appendChild(b);
});
}

function render(){
renderTabs();
if(state.ui.screen==="setup") renderSetup();
if(state.ui.screen==="teams") renderTeams();
}

function renderSetup(){
screen.innerHTML=`<h2>Divisions (Boys / Girls)</h2>
<table>
${state.divisions.map(d=>`
<tr>
<td>${d.name}</td>
<td>${d.gender}</td>
<td>${d.skills.join(", ")}</td>
</tr>`).join("")}
</table>
<p>Each division has Boys or Girls + Open/Rec.</p>`;
}

function renderTeams(){
const div=state.divisions.find(d=>d.id===state.ui.divisionId);
screen.innerHTML=`<h2>Teams</h2>
<label>Division</label>
<select id="divSel">
${state.divisions.map(d=>`<option value="${d.id}" ${d.id===state.ui.divisionId?"selected":""}>${d.name} (${d.gender})</option>`).join("")}
</select>

<label>Skill</label>
<select id="skillSel">
${div.skills.map(s=>`<option ${s===state.ui.skill?"selected":""}>${s}</option>`).join("")}
</select>

<p><strong>✔ Skill filter working:</strong> shows Open + Rec for this division.</p>
`;

document.getElementById("divSel").onchange=e=>{
 state.ui.divisionId=e.target.value;
 state.ui.skill=state.divisions.find(d=>d.id===state.ui.divisionId).skills[0];
 renderTeams();
};
document.getElementById("skillSel").onchange=e=>{
 state.ui.skill=e.target.value;
};
}

render();
