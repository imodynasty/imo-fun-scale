const CONFIG={currentLeagueId:"1341763186407276544",leagueIds:["1341763186407276544","1212553673821929472","1138349648558624768"],api:"https://api.sleeper.app/v1",statsApi:"https://api.sleeper.com/[...]
const state={league:null,currentUsers:[],currentRosters:[],managers:new Map(),trades:[],selectedWindow:"14",players:{},bundles:[],modelBundle:null,playerAverages:{},previousPowerRanks:{},heatmapExp[...]
const $=id=>document.getElementById(id),WL={"14":"14 days","28":"28 days","season":"2026 season","all":"All time"};
async function getJSON(url,optional=false){try{const r=await fetch(url);if(!r.ok)throw new Error(r.status);return await r.json()}catch(e){if(optional)return null;throw e}}
async function limitedMap(items,limit,fn){const out=new Array(items.length);let n=0;async function run(){while(n<items.length){const i=n++;try{out[i]=await fn(items[i])}catch{out[i]=null}}}await Pr[...]
function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('\"',"&quot;")}
function fmt(ts,short=false){return ts?new Intl.DateTimeFormat("en-AU",short?{day:"numeric",month:"short"}:{day:"numeric",month:"short",year:"numeric"}).format(new Date(ts)):"Unknown"}
function buildManagers(){const users=Object.fromEntries(state.currentUsers.map(x=>[String(x.user_id),x]));state.managers.clear();state.currentRosters.forEach(r=>{const u=users[String(r.owner_id)]||[...]
function managerName(id,t=null){return state.managers.get(String(id))?.name||t?.manager_name_map?.[String(id)]||"Former manager"}
function mids(t){return [...new Set((t.manager_ids||[]).map(String))].filter(id=>state.managers.has(id))}
function tradesFor(w){if(w==="season")return currentSeasonTrades();return w==="all"?state.trades:state.trades.filter(t=>(t.created||0)>=Date.now()-Number(w)*864e5)}
function currentSeasonTrades(){const current=state.bundles.find(b=>String(b.league.league_id)===CONFIG.currentLeagueId);return current?.trades||[]}
function activeTradesFor(w){if(w==="season")return currentSeasonTrades();return w==="all"?state.trades:state.trades.filter(t=>(t.created||0)>=Date.now()-Number(w)*864e5)}
function activeCounts(w){const c=Object.fromEntries([...state.managers.keys()].map(id=>[id,0]));activeTradesFor(w).forEach(t=>mids(t).forEach(id=>c[id]++));return c}
function activeRanked(w){const c=activeCounts(w);return [...state.managers.values()].map(m=>({...m,count:c[m.id]||0})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name))}
function activeWindowLabel(w){return WL[w]||w}
function counts(w){const c=Object.fromEntries([...state.managers.keys()].map(id=>[id,0]));tradesFor(w).forEach(t=>mids(t).forEach(id=>c[id]++));return c}
function ranked(w){const c=counts(w);return [...state.managers.values()].map(m=>({...m,count:c[m.id]||0})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name))}
function meaningfulWeeks(bundle){return [...new Set(bundle.matchups.filter(x=>Number(x.points)>0).map(x=>x.week))].sort((a,b)=>a-b)}
function selectModelBundle(){const current=state.bundles.find(b=>String(b.league.league_id)===CONFIG.currentLeagueId);if(current&&meaningfulWeeks(current).length>=2)return current;return state.bun[...]
function matchupRows(bundle,throughWeek=Infinity){return bundle.matchups.filter(x=>x.week<=throughWeek&&Number.isFinite(Number(x.points)))}
function outcomesForBundle(bundle,throughWeek=Infinity){const rows=matchupRows(bundle,throughWeek),byWeek={};rows.forEach(x=>(byWeek[x.week]??[]).push(x));const out={};Object.values(byWeek).forEa[...]
function minMax(value,values,higher=true){const nums=values.filter(Number.isFinite);if(!nums.length)return .5;const min=Math.min(...nums),max=Math.max(...nums);if(max===min)return .5;const n=(valu[...]
function standingsTable(bundle,throughWeek=Infinity){const outcomes=outcomesForBundle(bundle,throughWeek);return [...state.managers.values()].map(m=>{const games=outcomes[m.id]||[],wins=games.redu[...]
function modelRows(bundle,throughWeek=Infinity,mode="power"){const standings=standingsTable(bundle,throughWeek),outcomes=outcomesForBundle(bundle,throughWeek),teamCount=Math.max(standings.length,1[...]
function winningStreak(games){let n=0;for(let i=games.length-1;i>=0;i--){if(games[i].result===1)n++;else break}return n}
function calculatedPlayerAverages(bundle,throughWeek=Infinity){const sums={},games={};matchupRows(bundle,throughWeek).forEach(row=>Object.entries(row.players_points||{}).forEach(([id,v])=>{const p[...]
function exactAverageMap(season){return state.exactSeasonAverages?.[String(season)]||{}}
function seasonTotalAverageMap(season){return state.seasonTotalAverages?.[String(season)]||{}}
function gameLogAverageMap(season){return state.gameLogAverages?.[String(season)]||{}}
function buildPlayerAverages(bundle,throughWeek=Infinity){
  const season=String(bundle?.league?.season||"");
  const calculated=calculatedPlayerAverages(bundle,throughWeek);
  const exact=exactAverageMap(season);
  const totals=seasonTotalAverageMap(season);
  return {...calculated,...exact,...totals};
}
function prepareModels(){state.modelBundle=selectModelBundle();const weeks=meaningfulWeeks(state.modelBundle),last=weeks.at(-1)||Infinity,prior=weeks.length>1?weeks.at(-2):last;state.previousPower[...]
function playerName(id){const p=state.players[id]||{};return p.full_name||[p.first_name,p.last_name].filter(Boolean).join(" ")||`Player ${id}`} 
function playerLink(id,name=playerName(id),className=""){return `<button type="button" class="player-history-link ${className}" data-player-id="${esc(String(id))}">${esc(name)}</button>`}
function pickOriginalOwner(p,t){const owner=t.roster_owner_map?.[String(p.roster_id)];return owner?managerName(owner,t):null}
function roundWord(n){return ({1:"First",2:"Second",3:"Third",4:"Fourth",5:"Fifth"})[Number(n)]||`Round ${n}`}
function draftedPlayerForPick(p){const season=String(p.season),round=String(p.round),candidates=[p.roster_id,p.original_roster_id,p.previous_owner_id,p.owner_id].filter(x=>x!=null).map(String);for[...]
function fixedPickValue(round){round=Number(round);return round===1?23.5:round===2?5:0}
function bundleForSeason(season){return state.bundles.find(b=>String(b.league?.season)===String(season))||null}
function bundleForTrade(t){return state.bundles.find(b=>String(b.league?.league_id)===String(t.league_id))||bundleForSeason(String(t.season_label||"").match(/\d{4}/)?.[0])||null}
function latestKnownAverage(playerId){for(const bundle of [...state.bundles].sort((a,b)=>Number(b.league?.season)-Number(a.league?.season))){const weeks=meaningfulWeeks(bundle);if(!weeks.length)co[...]
function playerSeasonAverage(playerId,season){const bundle=bundleForSeason(season);if(!bundle)return 0;const weeks=meaningfulWeeks(bundle);return weeks.length?Number(buildPlayerAverages(bundle,wee[...]
function tradeSeasonAverage(playerId,t){const bundle=bundleForTrade(t);if(bundle){const weeks=meaningfulWeeks(bundle);if(weeks.length){const avg=Number(buildPlayerAverages(bundle,weeks.at(-1))[pla[...]
function playerAgeAt(playerId,timestamp){const p=state.players[playerId]||{},at=new Date(Number(timestamp)||Date.now()),raw=p.birth_date||p.birthdate||p.dob;if(raw){const born=new Date(raw);if(!Nu[...]
function ageMultiplier(age){if(age<=19)return 1.18;if(age===20)return 1.20;if(age===21)return 1.22;if(age===22)return 1.23;if(age===23)return 1.24;if(age===24||age===25)return 1.25;if(age===26)ret[...]
function eliteMultiplier(avg){if(avg>=40)return 1.40;if(avg>=35)return 1.28;if(avg>=30)return 1.18;if(avg>=25)return 1.10;if(avg>=20)return 1.05;if(avg>=10)return 1.02;return 1}
function playerDynastyValue(playerId,average,timestamp){const avg=Number(average)||0;return avg>0?avg*ageMultiplier(playerAgeAt(playerId,timestamp))*eliteMultiplier(avg):0}
function tradeAssets(t){const by={};mids(t).forEach(id=>by[id]=[]);Object.entries(t.adds||{}).forEach(([pid,rid])=>{const mid=t.roster_owner_map?.[String(rid)];if(!mid||!by[mid])return;const avera[...]
function tradeValue(t){return Object.values(tradeAssets(t)).flat().reduce((sum,asset)=>sum+(Number(asset.value)||0),0)}
function tradeSummary(t){const assets=Object.values(tradeAssets(t)).flat().filter(a=>a.type==='player').map(a=>a.name);const core=assets.slice(0,3).join(' / ')||'Draft-pick trade';return core}
function renderSummary(){const _leagueTradesEl = $("leagueTrades"); if(!_leagueTradesEl){console.warn('renderSummary aborted: missing leagueTrades');return;}const w=state.selectedWindow,ts=tradesFor(w),latest=state.trades[0],active=activeRanked(state.activeWindow),lead=active[0];$("leagueTrades").textContent=ts.length;$("leagu[...]
function renderLeaderboard(){const r=activeRanked(state.activeWindow),max=Math.max(...r.map(x=>x.count),1);$("leaderboard").classList.remove("loading");$("leaderboard").innerHTML=r.map((x,i)=>`<di[...]
function mergedPowerRows(){
  const weeks=meaningfulWeeks(state.modelBundle),through=weeks.at(-1)||Infinity,prior=weeks.length>1?weeks.at(-2):through;
  const power=modelRows(state.modelBundle,through,"power");
  const oddsNow=Object.fromEntries(priceRows(through).map(x=>[String(x.id),x]));
  const oddsPrior=Object.fromEntries(priceRows(prior).map(x=>[String(x.id),x]));
  return power.map(x=>({...x,oddsRow:oddsNow[String(x.id)],priorOddsRow:oddsPrior[String(x.id)]}));
}
function renderPower(){
  const rows=mergedPowerRows(),n=Math.max(rows.length-1,1),target=$("powerRankings");
  target.classList.remove("loading");
  target.innerHTML=rows.map((x,i)=>{
    const old=state.previousPowerRanks[x.id]??x.rank,diff=old-x.rank;
    const movement=diff>0?`<span class="movement up">▲ ${diff}</span>`:diff<0?`<span class="movement down">▼ ${Math.abs(diff)}</span>`:`<span class="movement flat">—</span>`;
    const hue=140-(140*i/n),m=state.managers.get(String(x.id));
    const avatar=m?.avatar?`<img src="${esc(m.avatar)}" alt="" loading="lazy">`:`<span>${esc(m?.initials||x.name.slice(0,2).toUpperCase())}</span>`;
    const o=x.oddsRow||x,prev=x.priorOddsRow?.odds??o.odds,delta=(o.odds??0)-prev,cls=delta<0?'up':delta>0?'down':'flat';
    const moveText=prev===(o.odds??0)?'No price movement':`$${prev.toFixed(2)} → $${o.odds.toFixed(2)}`;
    const streak=o.streak>=1?`Won last ${o.streak}`:`${Math.round((o.form||0)*5)} wins from last 5`;
    const ladderText=`Currently ${ordinal(o.standingRank||x.standingRank)} on ladder`;
    return `<details class="merged-power-row" style="--rank-colour:hsl(${hue} 85% 52%)">
      <summary>
        <button type="button" class="merged-manager-hitarea manager-profile-link" data-manager-id="${esc(x.id)}" aria-label="Open ${esc(x.name)} manager profile">
          <b class="merged-rank">${x.rank}</b>
          <span class="power-avatar">${avatar}</span>
          <span class="merged-team-copy"><strong>${esc(x.name)}</strong><small>View manager profile</small></span>
          ${movement}
          <span class="merged-odds"><small>Championship odds</small><strong>$${Number(o.odds||0).toFixed(2)}</strong></span>
        </button>
        <button type="button" class="merged-odds-toggle" aria-label="Show odds notes" title="Show odds notes">⌄</button>
      </summary>
      <div class="merged-odds-notes">
        <div><strong>${esc(streak)}</strong></div>
        <div>Averaging ${Number(o.avg5||0).toFixed(1)} over the last five weeks</div>
        <div>${esc(ladderText)}</div>
        <div class="odds-move ${cls}">${esc(moveText)}</div>
      </div>
    </details>`;
  }).join("");
}
function renderOdds(){const target=$("championshipOdds");if(target){target.innerHTML="";target.hidden=true}}
function ordinal(n){const s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0])}
function renderTradeWeek(){const recent=state.trades.filter(t=>t.created>=Date.now()-7*864e5),pool=recent.length?recent:state.trades.slice(0,25),t=[...pool].sort((a,b)=>tradeValue(b)-tradeValue(a[...]
function allPartnerPairs(){const teams=[...state.managers.values()],mat={};state.trades.forEach(t=>{const ids=mids(t);for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const k=[ids[i],[...]
function mostRecentPartnerTrade(a,b){return state.trades.find(t=>{const ids=mids(t);return ids.includes(String(a))&&ids.includes(String(b))})||null}
function renderHeatmap(){const pairs=allPartnerPairs(),shown=pairs.slice(0,state.heatmapExpanded?30:8),max=Math.max(...pairs.map(x=>x.count),1);$("tradeHeatmap").classList.remove("loading");$("tr[...]
function renderBlock(){const moved={};state.trades.forEach(t=>Object.keys(t.adds||{}).forEach(id=>moved[id]=(moved[id]||0)+1));const rows=Object.entries(moved).sort((a,b)=>b[1]-a[1]).slice(0,5);$[...]

function gameDateValue(row){const raw=row?.date||row?.game_date||row?.gameDate||row?.start_time||row?.startTime||row?.timestamp;const d=raw?new Date(raw):null;return d&&!Number.isNaN(d.getTime())[...]
function allGameLogFormRows(){const season=String(state.modelBundle?.league?.season||"2025"),logs=state.gameLogs?.[season]||{},nowDates=Object.values(logs).flat().map(gameDateValue).filter(Boolea[...]
function recentPlayerForm(){const rows=allGameLogFormRows();return{poor:rows.filter(x=>x.priorAvg>=20&&x.recentAvg>0&&x.change<0).sort((a,b)=>a.change-b.change).slice(0,5),good:rows.filter(x=>x.p[...]
function renderFormList(targetId,rows,positive){const target=$(targetId);target.classList.remove("loading");target.innerHTML=rows.length?rows.map((x,i)=>`<div class="rank-item form-player-row ${p[...]
function renderPlayerForm(){const form=recentPlayerForm();renderFormList("poorForm",form.poor,false);renderFormList("goodForm",form.good,true)}
function managerTradeCounts(trades){const c={};trades.forEach(t=>mids(t).forEach(id=>c[id]=(c[id]||0)+1));return c}
function topEntry(obj){return Object.entries(obj).sort((a,b)=>b[1]-a[1])[0]}
function highestTeamScore(bundles){let best=null;bundles.forEach(b=>b.matchups.forEach(m=>{const owner=b.ownerByRoster[String(m.roster_id)],pts=Number(m.points);if(owner&&Number.isFinite(pts)&&(![...]





















async function loadSeason(id){const [league,users,rosters,drafts,tradedPicks,winnersBracket]=await Promise.all([getJSON(`${CONFIG.api}/league/${id}`,true),getJSON(`${CONFIG.api}/league/${id}/user[...]
async function load(){$("refreshBtn").disabled=true;$("statusText").textContent='Connecting to Sleeper…';try{const [bundles,players,exactAverages]=await Promise.all([Promise.all(CONFIG.leagueId[...]
document.querySelectorAll('.window-btn').forEach(b=>b.addEventListener('click',()=>{state.selectedWindow=b.dataset.window;document.querySelectorAll('.window-btn').forEach(x=>x.classList.toggle('a[...]
document.addEventListener("click",e=>{const oddsToggle=e.target.closest(".merged-odds-toggle");if(oddsToggle){e.preventDefault();e.stopPropagation();const detail=oddsToggle.closest(".merged-power[...]
  const playerLinkEl=e.target.closest(".player-history-link");if(playerLinkEl){openPlayerHistory(playerLinkEl.dataset.playerId);return}
  if(e.target.closest("[data-close-player-history]")||e.target.closest("#playerHistoryClose")){closePlayerHistory();return}
  if(e.target.closest("#managerDirectoryBtn")){openManagerDirectory();return}
  if(e.target.closest("[data-close-manager-directory]")||e.target.closest("#managerDirectoryClose")){closeManagerDirectory();return}
  const seasonBtn=e.target.closest("[data-profile-season]");if(seasonBtn){state.profileAverageSeason=seasonBtn.dataset.profileSeason;const id=$("managerProfileModal")?.dataset.managerId;if(id)$("[...]
  const link=e.target.closest(".manager-profile-link");if(link){closeManagerDirectory();openManagerProfile(link.dataset.managerId);return}
  if(e.target.closest("[data-close-manager-profile]")||e.target.closest("#managerProfileClose"))closeManagerProfile()
});
document.addEventListener("toggle",e=>{const detail=e.target;if(!(detail instanceof HTMLDetailsElement)||!detail.open)return;if(detail.matches(".profile-badge-pop")){detail.closest(".profile-badg[...]
document.addEventListener("keydown",e=>{if(e.key!=="Escape")return;if($("playerHistoryModal")?.classList.contains("open"))closePlayerHistory();else if($("managerProfileModal")?.classList.contains[...]
window.addEventListener("popstate",openManagerFromHash);
load().then?.(()=>openManagerFromHash());
