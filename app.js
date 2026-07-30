
const CONFIG = {
  leagueId: "1341763186407276544",
  api: "https://api.sleeper.app/v1",
  roundsToCheck: 60
};

const state = {
  league: null,
  users: [],
  rosters: [],
  teams: new Map(),
  trades: [],
  selectedWindow: "14",
  charts: {}
};

const $ = id => document.getElementById(id);
const WINDOW_LABELS = {"14":"14 days","28":"28 days","90":"90 days","all":"All time"};

async function getJSON(url, optional=false) {
  const response = await fetch(url);
  if (!response.ok) {
    if (optional) return null;
    throw new Error(`Sleeper returned ${response.status}`);
  }
  return response.json();
}

async function limitedMap(items, limit, worker) {
  const output = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      try { output[i] = await worker(items[i]); }
      catch { output[i] = []; }
    }
  }
  await Promise.all(Array.from({length: limit}, run));
  return output;
}

function buildTeams() {
  const usersById = Object.fromEntries(state.users.map(u => [u.user_id, u]));
  state.teams.clear();

  state.rosters.forEach(roster => {
    const user = usersById[roster.owner_id] || {};
    const name = user.metadata?.team_name || user.display_name || `Team ${roster.roster_id}`;
    state.teams.set(String(roster.roster_id), {
      id: String(roster.roster_id),
      name,
      initials: name.split(/\s+/).slice(0,2).map(x => x[0]).join("").toUpperCase()
    });
  });
}

function teamName(id) {
  return state.teams.get(String(id))?.name || `Team ${id}`;
}

function involvedTeamIds(trade) {
  const ids = new Set((trade.roster_ids || []).map(String));
  Object.values(trade.adds || {}).forEach(id => ids.add(String(id)));
  Object.values(trade.drops || {}).forEach(id => ids.add(String(id)));
  (trade.draft_picks || []).forEach(pick => {
    if (pick.owner_id != null) ids.add(String(pick.owner_id));
    if (pick.previous_owner_id != null) ids.add(String(pick.previous_owner_id));
  });
  return [...ids].filter(id => state.teams.has(id));
}

function cutoffDays(days) {
  return Date.now() - Number(days) * 24 * 60 * 60 * 1000;
}

function tradesForWindow(windowKey) {
  if (windowKey === "all") return state.trades;
  const cutoff = cutoffDays(windowKey);
  return state.trades.filter(t => Number(t.created || 0) >= cutoff);
}

function countsForWindow(windowKey) {
  const counts = Object.fromEntries([...state.teams.keys()].map(id => [id, 0]));
  tradesForWindow(windowKey).forEach(trade => {
    involvedTeamIds(trade).forEach(id => counts[id]++);
  });
  return counts;
}

function ranked(windowKey) {
  const counts = countsForWindow(windowKey);
  return [...state.teams.values()]
    .map(team => ({...team, count: counts[team.id] || 0}))
    .sort((a,b) => b.count - a.count || a.name.localeCompare(b.name));
}

function formatDate(timestamp, short=false) {
  if (!timestamp) return "Unknown date";
  return new Intl.DateTimeFormat("en-AU", short
    ? {day:"numeric", month:"short"}
    : {day:"numeric", month:"short", year:"numeric"}
  ).format(new Date(timestamp));
}

function renderSummary() {
  const windowKey = state.selectedWindow;
  const windowTrades = tradesForWindow(windowKey);
  const ranking = ranked(windowKey);
  const participationTotal = ranking.reduce((n,t) => n + t.count, 0);
  const active = ranking.filter(t => t.count > 0).length;
  const leader = ranking[0];

  $("leagueTrades").textContent = windowTrades.length;
  $("leagueTradesLabel").textContent = windowKey === "all" ? "Complete available history" : `Last ${windowKey} days`;
  $("activeTeams").textContent = active;
  $("averageTrades").textContent = state.teams.size ? (participationTotal / state.teams.size).toFixed(1) : "0.0";
  $("rankingWindow").textContent = WINDOW_LABELS[windowKey];
  $("leaderWindow").textContent = WINDOW_LABELS[windowKey];

  if (leader) {
    $("leaderName").textContent = leader.name;
    $("leaderTrades").textContent = leader.count;
    $("leaderAvatar").textContent = leader.initials || "?";
  }

  const latest = state.trades[0];
  $("latestTradeShort").textContent = latest ? involvedTeamIds(latest).length + "-team" : "—";
  $("latestTradeDate").textContent = latest ? formatDate(latest.created) : "No trade loaded";
}

function renderLeaderboard() {
  const rows = ranked(state.selectedWindow);
  const max = Math.max(...rows.map(x => x.count), 1);

  $("leaderboard").classList.remove("loading");
  $("leaderboard").innerHTML = rows.map((team, i) => `
    <div class="leader-row">
      <span class="rank">${i + 1}</span>
      <span class="team-name" title="${escapeHTML(team.name)}">${escapeHTML(team.name)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(team.count / max) * 100}%"></div></div>
      <span class="trade-count">${team.count}</span>
    </div>
  `).join("");
}

function chartColours(count) {
  const palette = ["#8b70ff","#ff668f","#31ddb2","#ffd166","#58a6ff","#ff8f5c","#b98cff","#63e6be","#f783ac","#74c0fc","#ffa94d","#c0eb75"];
  return Array.from({length: count}, (_,i) => palette[i % palette.length]);
}

function baseChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {labels:{color:"#aab3c2",boxWidth:11,boxHeight:11,usePointStyle:true}},
      tooltip: {backgroundColor:"#080b11",borderColor:"#273145",borderWidth:1,titleColor:"#fff",bodyColor:"#c4cad5",padding:12}
    },
    scales: {
      x: {ticks:{color:"#8f99aa",font:{size:10}},grid:{color:"rgba(39,49,69,.35)"}},
      y: {ticks:{color:"#8f99aa",precision:0,font:{size:10}},grid:{color:"rgba(39,49,69,.35)"},beginAtZero:true}
    }
  };
}

function destroyChart(name) {
  if (state.charts[name]) state.charts[name].destroy();
}

function renderDonut() {
  const ranking = ranked(state.selectedWindow).filter(t => t.count > 0);
  const total = ranking.reduce((n,t) => n + t.count, 0);
  $("donutTotal").textContent = total;

  destroyChart("donut");
  state.charts.donut = new Chart($("donutChart"), {
    type: "doughnut",
    data: {
      labels: ranking.length ? ranking.map(t => t.name) : ["No trades"],
      datasets: [{
        data: ranking.length ? ranking.map(t => t.count) : [1],
        backgroundColor: ranking.length ? chartColours(ranking.length) : ["#273145"],
        borderColor: "#111622",
        borderWidth: 4,
        hoverOffset: 7
      }]
    },
    options: {
      responsive:true, maintainAspectRatio:false, cutout:"72%",
      plugins:{
        legend:{position:"bottom",labels:{color:"#9da7b8",boxWidth:9,boxHeight:9,usePointStyle:true,font:{size:9}}},
        tooltip:{backgroundColor:"#080b11",borderColor:"#273145",borderWidth:1,titleColor:"#fff",bodyColor:"#c4cad5",padding:12}
      }
    }
  });
}

function renderComparison() {
  const teams = ranked("all");
  const labels = teams.map(t => t.name);
  const windows = ["14","28","90","all"];
  const counts = Object.fromEntries(windows.map(w => [w, countsForWindow(w)]));
  const colours = ["#31ddb2","#58a6ff","#8b70ff","#ff668f"];

  destroyChart("comparison");
  state.charts.comparison = new Chart($("comparisonChart"), {
    type:"bar",
    data:{
      labels,
      datasets:windows.map((w,i) => ({
        label:WINDOW_LABELS[w],
        data:teams.map(t => counts[w][t.id] || 0),
        backgroundColor:colours[i],
        borderRadius:5,
        maxBarThickness:18
      }))
    },
    options:{
      ...baseChartOptions(),
      indexAxis:"y",
      scales:{
        x:{ticks:{color:"#8f99aa",precision:0},grid:{color:"rgba(39,49,69,.35)"},beginAtZero:true},
        y:{ticks:{color:"#c0c7d3",font:{size:10}},grid:{display:false}}
      }
    }
  });
}

function startOfWeek(timestamp) {
  const d = new Date(timestamp);
  const day = (d.getDay() + 6) % 7;
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() - day);
  return d;
}

function renderWeekly() {
  const nowWeek = startOfWeek(Date.now());
  const weeks = [];
  for (let i=12;i>=0;i--) {
    const d = new Date(nowWeek);
    d.setDate(d.getDate() - i * 7);
    weeks.push({start:d.getTime(), label:formatDate(d.getTime(), true), count:0});
  }
  state.trades.forEach(trade => {
    const week = startOfWeek(Number(trade.created || 0)).getTime();
    const target = weeks.find(w => w.start === week);
    if (target) target.count++;
  });

  destroyChart("weekly");
  state.charts.weekly = new Chart($("weeklyChart"), {
    type:"line",
    data:{
      labels:weeks.map(w => w.label),
      datasets:[{
        label:"Completed trades",
        data:weeks.map(w => w.count),
        borderColor:"#31ddb2",
        backgroundColor:"rgba(49,221,178,.13)",
        fill:true,
        tension:.35,
        pointRadius:3,
        pointHoverRadius:6
      }]
    },
    options:baseChartOptions()
  });
}

function renderScorecard() {
  const windows = ["14","28","90","all"];
  const allCounts = Object.fromEntries(windows.map(w => [w, countsForWindow(w)]));
  const current = ranked(state.selectedWindow);
  const maxes = Object.fromEntries(windows.map(w => [w, Math.max(...Object.values(allCounts[w]),0)]));

  $("scorecardBody").innerHTML = current.map((team,i) => `
    <tr>
      <td>${i+1}</td>
      <td class="table-team">${escapeHTML(team.name)}</td>
      ${windows.map(w => `<td class="${allCounts[w][team.id] === maxes[w] && maxes[w] > 0 ? "top-value" : ""}">${allCounts[w][team.id] || 0}</td>`).join("")}
    </tr>
  `).join("");
}

function renderRecentTrades() {
  const recent = state.trades.slice(0, 8);
  $("recentTrades").classList.remove("loading");
  $("recentTrades").innerHTML = recent.length ? recent.map(trade => {
    const teams = involvedTeamIds(trade).map(teamName);
    const playerMoves = Object.keys(trade.adds || {}).length;
    const picks = (trade.draft_picks || []).length;
    return `
      <article class="trade-card">
        <div class="trade-date">${formatDate(trade.created)}</div>
        <div class="trade-teams">${teams.map(escapeHTML).join(" ↔ ") || "Teams unavailable"}</div>
        <div class="trade-meta">${playerMoves} player move${playerMoves===1?"":"s"} · ${picks} draft pick${picks===1?"":"s"}</div>
      </article>
    `;
  }).join("") : `<div class="empty">No completed trades were returned.</div>`;
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function renderAll() {
  renderSummary();
  renderLeaderboard();
  renderDonut();
  renderComparison();
  renderWeekly();
  renderScorecard();
  renderRecentTrades();
}

async function loadTrades() {
  const rounds = Array.from({length:CONFIG.roundsToCheck},(_,i)=>i+1);
  const batches = await limitedMap(rounds, 6, async round => {
    const items = await getJSON(`${CONFIG.api}/league/${CONFIG.leagueId}/transactions/${round}`, true);
    return (items || [])
      .filter(t => t.type === "trade" && (!t.status || t.status === "complete"))
      .map(t => ({...t,_round:round}));
  });

  const unique = new Map();
  batches.flat().forEach(t => {
    const key = t.transaction_id || `${t.created}-${JSON.stringify(t.roster_ids || [])}`;
    unique.set(key,t);
  });
  return [...unique.values()].sort((a,b)=>(b.created||0)-(a.created||0));
}

async function loadData() {
  $("statusText").textContent = "Connecting to Sleeper…";
  $("statusDot").className = "status-dot";
  $("refreshBtn").disabled = true;

  try {
    const [league,users,rosters] = await Promise.all([
      getJSON(`${CONFIG.api}/league/${CONFIG.leagueId}`),
      getJSON(`${CONFIG.api}/league/${CONFIG.leagueId}/users`),
      getJSON(`${CONFIG.api}/league/${CONFIG.leagueId}/rosters`)
    ]);

    state.league = league;
    state.users = users || [];
    state.rosters = rosters || [];
    buildTeams();
    state.trades = await loadTrades();

    renderAll();
    $("statusText").textContent = `Live data loaded · ${formatDate(Date.now())}`;
    $("statusDot").className = "status-dot ok";
  } catch (error) {
    console.error(error);
    $("statusText").textContent = `Could not load Sleeper data: ${error.message}`;
    $("statusDot").className = "status-dot bad";
    $("leaderboard").innerHTML = `<div class="empty">The league could not be loaded. Confirm it is accessible and refresh.</div>`;
    $("recentTrades").innerHTML = `<div class="empty">No data available.</div>`;
  } finally {
    $("refreshBtn").disabled = false;
  }
}

document.querySelectorAll(".window-btn").forEach(button => {
  button.addEventListener("click", () => {
    state.selectedWindow = button.dataset.window;
    document.querySelectorAll(".window-btn").forEach(b => b.classList.toggle("active", b === button));
    renderSummary();
    renderLeaderboard();
    renderDonut();
    renderScorecard();
  });
});

$("refreshBtn").addEventListener("click", loadData);
loadData();
