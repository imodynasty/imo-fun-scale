const CONFIG={currentLeagueId:"1341763186407276544",leagueIds:["1341763186407276544","1212553673821929472","1138349648558624768"],api:"https://api.sleeper.app/v1",roundsToCheck:60,bookmakerMargin:1.08,oddsBaseline:.25,oddsExponent:2,maxDisplayedOdds:51,voteEndpoint:"",votingOpens:"2027-01-03T00:00:00+08:00"};
const state={league:null,currentUsers:[],currentRosters:[],managers:new Map(),trades:[],selectedWindow:"14",players:{},bundles:[],modelBundle:null,playerAverages:{},previousPowerRanks:{},heatmapExpanded:false,draftPickMap:{},previousPlayerAverages:{},votePlayers:[]};
const $=id=>document.getElementById(id),WL={"14":"14 days","28":"28 days","90":"90 days","all":"All time"};
async function getJSON(url,optional=false){try{const r=await fetch(url);if(!r.ok)throw new Error(r.status);return await r.json()}catch(e){if(optional)return null;throw e}}
async function limitedMap(items,limit,fn){const out=new Array(items.length);let n=0;async function run(){while(n<items.length){const i=n++;try{out[i]=await fn(items[i])}catch{out[i]=null}}}await Promise.all(Array.from({length:limit},run));return out}
function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function fmt(ts,short=false){return ts?new Intl.DateTimeFormat("en-AU",short?{day:"numeric",month:"short"}:{day:"numeric",month:"short",year:"numeric"}).format(new Date(ts)):"Unknown"}
function buildManagers(){const users=Object.fromEntries(state.currentUsers.map(x=>[x.user_id,x]));state.managers.clear();state.currentRosters.forEach(r=>{const u=users[r.owner_id]||{},name=u.metadata?.team_name||u.display_name||`Team ${r.roster_id}`;state.managers.set(String(r.owner_id),{id:String(r.owner_id),name,roster:r,initials:name.split(/\s+/).slice(0,2).map(z=>z[0]).join("").toUpperCase()})})}
function managerName(id,t=null){return state.managers.get(String(id))?.name||t?.manager_name_map?.[String(id)]||"Former manager"}
function mids(t){return [...new Set((t.manager_ids||[]).map(String))].filter(id=>state.managers.has(id))}
function tradesFor(w){return w==="all"?state.trades:state.trades.filter(t=>(t.created||0)>=Date.now()-Number(w)*864e5)}
function counts(w){const c=Object.fromEntries([...state.managers.keys()].map(id=>[id,0]));tradesFor(w).forEach(t=>mids(t).forEach(id=>c[id]++));return c}
function ranked(w){const c=counts(w);return [...state.managers.values()].map(m=>({...m,count:c[m.id]||0})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name))}
function meaningfulWeeks(bundle){return [...new Set(bundle.matchups.filter(x=>Number(x.points)>0).map(x=>x.week))].sort((a,b)=>a-b)}
function selectModelBundle(){const current=state.bundles.find(b=>String(b.league.league_id)===CONFIG.currentLeagueId);if(current&&meaningfulWeeks(current).length>=2)return current;return state.bundles.filter(b=>meaningfulWeeks(b).length).sort((a,b)=>Number(b.league.season)-Number(a.league.season))[0]||current||state.bundles[0]}
function matchupRows(bundle,throughWeek=Infinity){return bundle.matchups.filter(x=>x.week<=throughWeek&&Number.isFinite(Number(x.points)))}
function outcomesForBundle(bundle,throughWeek=Infinity){const rows=matchupRows(bundle,throughWeek),byWeek={};rows.forEach(x=>(byWeek[x.week]??=[]).push(x));const out={};Object.values(byWeek).forEach(weekRows=>{const groups={};weekRows.forEach(x=>{if(x.matchup_id!=null)(groups[x.matchup_id]??=[]).push(x)});Object.values(groups).forEach(g=>{if(g.length<2)return;const max=Math.max(...g.map(x=>Number(x.points)||0)),ties=g.filter(x=>(Number(x.points)||0)===max).length;g.forEach(x=>{const owner=bundle.ownerByRoster[String(x.roster_id)];if(!owner)return;(out[owner]??=[]).push({week:x.week,points:Number(x.points)||0,result:(Number(x.points)||0)===max?(ties>1?.5:1):0})})})});return out}
function minMax(value,values,higher=true){const nums=values.filter(Number.isFinite);if(!nums.length)return .5;const min=Math.min(...nums),max=Math.max(...nums);if(max===min)return .5;const n=(value-min)/(max-min);return higher?n:1-n}
function standingsTable(bundle,throughWeek=Infinity){const outcomes=outcomesForBundle(bundle,throughWeek);return [...state.managers.values()].map(m=>{const games=outcomes[m.id]||[],wins=games.reduce((s,g)=>s+g.result,0),pts=games.reduce((s,g)=>s+g.points,0);return {...m,wins,games:games.length,pts}}).sort((a,b)=>b.wins-a.wins||b.pts-a.pts||a.name.localeCompare(b.name)).map((x,i)=>({...x,standingRank:i+1}))}
function modelRows(bundle,throughWeek=Infinity,mode="power"){const standings=standingsTable(bundle,throughWeek),outcomes=outcomesForBundle(bundle,throughWeek),teamCount=Math.max(standings.length,1);const raw=standings.map(team=>{const games=outcomes[team.id]||[],formN=mode==="odds"?5:3,recent=games.slice(-formN),last5=games.slice(-5),form=recent.length?recent.reduce((s,g)=>s+g.result,0)/recent.length:0,avg5=last5.length?last5.reduce((s,g)=>s+g.points,0)/last5.length:0,ladder=teamCount===1?1:1-(team.standingRank-1)/(teamCount-1),streak=winningStreak(games);return {...team,form,avg5,ladder,streak}});const avgs=raw.map(x=>x.avg5);return raw.map(x=>{const avgNorm=minMax(x.avg5,avgs,true),score=mode==="odds"?x.form*.50+avgNorm*.25+x.ladder*.25:x.ladder*.35+x.form*.35+avgNorm*.30;return {...x,score}}).sort((a,b)=>b.score-a.score||b.avg5-a.avg5||a.name.localeCompare(b.name)).map((x,i)=>({...x,rank:i+1}))}
function winningStreak(games){let n=0;for(let i=games.length-1;i>=0;i--){if(games[i].result===1)n++;else break}return n}
function buildPlayerAverages(bundle,throughWeek=Infinity){const sums={},games={};matchupRows(bundle,throughWeek).forEach(row=>Object.entries(row.players_points||{}).forEach(([id,v])=>{const pts=Number(v);if(!Number.isFinite(pts))return;sums[id]=(sums[id]||0)+pts;games[id]=(games[id]||0)+1}));return Object.fromEntries(Object.keys(sums).map(id=>[id,games[id]?sums[id]/games[id]:0]))}
function prepareModels(){state.modelBundle=selectModelBundle();const weeks=meaningfulWeeks(state.modelBundle),last=weeks.at(-1)||Infinity,prior=weeks.length>1?weeks.at(-2):last;state.previousPowerRanks=Object.fromEntries(modelRows(state.modelBundle,prior,"power").map(x=>[x.id,x.rank]));state.playerAverages=buildPlayerAverages(state.modelBundle,last)}
function playerName(id){const p=state.players[id]||{};return p.full_name||[p.first_name,p.last_name].filter(Boolean).join(" ")||`Player ${id}`}
function pickOriginalOwner(p,t){const owner=t.roster_owner_map?.[String(p.roster_id)];return owner?managerName(owner,t):null}
function roundWord(n){return ({1:"First",2:"Second",3:"Third",4:"Fourth",5:"Fifth"})[Number(n)]||`Round ${n}`}
function draftedPlayerForPick(p){return state.draftPickMap[`${p.season}|${p.roster_id}|${p.round}`]||null}
function tradeAssets(t){const by={};mids(t).forEach(id=>by[id]=[]);Object.entries(t.adds||{}).forEach(([pid,rid])=>{const mid=t.roster_owner_map?.[String(rid)];if(mid&&by[mid])by[mid].push({type:"player",id:pid,name:playerName(pid),value:Number(state.playerAverages[pid]||0)})});(t.draft_picks||[]).forEach(p=>{const mid=t.roster_owner_map?.[String(p.owner_id)];if(!mid||!by[mid])return;const round=Number(p.round),value=round===1?23.5:round===2?5:0,season=p.season||"Future",original=pickOriginalOwner(p,t),drafted=draftedPlayerForPick(p);const pickLabel=`${season} ${roundWord(round)} Round Pick${original?` ${original}`:""}`;by[mid].push({type:"pick",name:drafted?`${playerName(drafted)} (${pickLabel})`:`${season} Round ${round} Pick`,owner:drafted?null:original,value})});return by}
function tradeValue(t){return Object.values(tradeAssets(t)).flat().reduce((s,a)=>s+a.value,0)}
function tradeSummary(t){const assets=Object.values(tradeAssets(t)).flat().filter(a=>a.type==='player').map(a=>a.name);const core=assets.slice(0,3).join(' / ')||'Draft-pick trade';return core}
function renderSummary(){const w=state.selectedWindow,r=ranked(w),ts=tradesFor(w),lead=r[0],latest=state.trades[0];$("leagueTrades").textContent=ts.length;$("leagueTradesLabel").textContent=w==="all"?`${CONFIG.leagueIds.length} seasons combined`:`Last ${w} days`;let weeks;if(w==='all'){const oldest=state.trades.at(-1)?.created||Date.now();weeks=Math.max(1,(Date.now()-oldest)/6048e5)}else weeks=Math.max(1,Number(w)/7);$("averageTrades").textContent=(ts.length/weeks).toFixed(1);$("leaderName").textContent=lead?.name||"—";$("leaderTrades").textContent=lead?.count||0;$("leaderWindow").textContent=WL[w];$("rankingWindow").textContent=WL[w];$("latestTradeShort").textContent=latest?tradeSummary(latest):"—";$("latestTradeDate").textContent=latest?`${mids(latest).map(id=>managerName(id,latest)).join(' ↔ ')} · ${fmt(latest.created)}`:"No trade"}
function renderLeaderboard(){const r=ranked(state.selectedWindow),max=Math.max(...r.map(x=>x.count),1);$("leaderboard").classList.remove("loading");$("leaderboard").innerHTML=r.map((x,i)=>`<div class="leader-row"><span class="rank">${i+1}</span><span class="team-name">${esc(x.name)}</span><div class="bar-track"><div class="bar-fill" style="width:${x.count/max*100}%"></div></div><span class="trade-count">${x.count}</span></div>`).join("")}
function renderPower(){const weeks=meaningfulWeeks(state.modelBundle),through=weeks.at(-1)||Infinity,p=modelRows(state.modelBundle,through,"power"),n=Math.max(p.length-1,1);$("powerRankings").classList.remove("loading");$("powerRankings").innerHTML=p.map((x,i)=>{const old=state.previousPowerRanks[x.id]??x.rank,diff=old-x.rank,arrow=diff>0?`<span class="movement up">▲ ${diff}</span>`:diff<0?`<span class="movement down">▼ ${Math.abs(diff)}</span>`:`<span class="movement flat">—</span>`,hue=140-(140*i/n),fire=x.streak>=3?' 🔥':'';return `<div class="rank-item power-row" style="--rank-colour:hsl(${hue} 85% 52%)"><b>${x.rank}</b><strong class="power-name">${esc(x.name)}${fire}</strong>${arrow}</div>`}).join("")}
function roundFive(x){return Math.round(x*20)/20}
function priceRows(through){const rows=modelRows(state.modelBundle,through,"odds"),strengths=rows.map(x=>Math.pow(CONFIG.oddsBaseline+(1-CONFIG.oddsBaseline)*Math.max(0,Math.min(1,x.score)),CONFIG.oddsExponent)),sum=strengths.reduce((a,b)=>a+b,0)||1;return rows.map((x,i)=>{const fair=strengths[i]/sum,market=Math.min(.99,fair*CONFIG.bookmakerMargin),odds=roundFive(Math.min(CONFIG.maxDisplayedOdds,Math.max(1.01,1/market)));return {...x,odds}})}
function renderOdds(){const weeks=meaningfulWeeks(state.modelBundle),through=weeks.at(-1)||Infinity,prior=weeks.length>1?weeks.at(-2):through,rows=priceRows(through),old=Object.fromEntries(priceRows(prior).map(x=>[x.id,x]));$("championshipOdds").classList.remove("loading");$("championshipOdds").innerHTML=rows.map((x,i)=>{const prev=old[x.id]?.odds??x.odds,delta=x.odds-prev,cls=delta<0?'up':delta>0?'down':'flat',icon=delta<0?'📈':delta>0?'📉':'➖',streak=x.streak>=1?`Won last ${x.streak}`:`Form: ${Math.round(x.form*5)} wins from last 5`,ladderMove=(old[x.id]?.standingRank||x.standingRank)-x.standingRank,ladderText=ladderMove>0?`Moved up to ${ordinal(x.standingRank)} on ladder`:ladderMove<0?`Dropped to ${ordinal(x.standingRank)} on ladder`:`Currently ${ordinal(x.standingRank)} on ladder`,moveText=prev===x.odds?'No price movement':`$${prev.toFixed(2)} → $${x.odds.toFixed(2)}`;return `<details class="odds-row-wrap"><summary class="odds-summary"><b>${i+1}</b><div class="odds-summary-main"><strong>${esc(x.name)}</strong>${i===0?'<div class="favourite">FAVOURITE</div>':''}</div><div class="odds-price-stack"><span class="odds">$${x.odds.toFixed(2)}</span><div class="odds-move ${cls}">${icon} ${moveText}<span class="odds-chevron">▼</span></div></div></summary><div class="odds-detail"><div>${x.streak?`${x.streak>=3?'🔥':'✅'} ${streak}`:`⚪ ${streak}`}</div><div>🔥 Averaging ${x.avg5.toFixed(1)} over last five weeks</div><div>${ladderMove<0?'⬇':'⬆'} ${ladderText}</div></div></details>`}).join("")}
function ordinal(n){const s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0])}
function renderTradeWeek(){const recent=state.trades.filter(t=>t.created>=Date.now()-7*864e5),pool=recent.length?recent:state.trades.slice(0,25),t=[...pool].sort((a,b)=>tradeValue(b)-tradeValue(a))[0];if(!t){$("tradeOfWeek").innerHTML="No trade available";return}const sides=Object.entries(tradeAssets(t)).slice(0,3),html=sides.map(([mid,assets])=>`<div class="trade-side-v2"><strong>${esc(managerName(mid,t))} receives</strong>${assets.length?assets.map(a=>`<div class="asset-row"><span>${esc(a.name)}${a.owner?`<small class="asset-owner">Originally ${esc(a.owner)}'s pick</small>`:''}</span></div>`).join(""):'<div class="asset-row"><span>No listed assets</span></div>'}</div>`).join('<div class="trade-mid">⇄</div>');$("tradeOfWeek").classList.remove("loading");$("tradeOfWeek").innerHTML=`<div class="trade-feature-v2">${html}<div class="trade-foot-v2"><span>Selected as the highest total value exchanged this week</span><strong>${fmt(t.created)}</strong></div></div>`}
function allPartnerPairs(){const teams=[...state.managers.values()],mat={};state.trades.forEach(t=>{const ids=mids(t);for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const k=[ids[i],ids[j]].sort().join('|');mat[k]=(mat[k]||0)+1}});const pairs=[];for(let i=0;i<teams.length;i++)for(let j=i+1;j<teams.length;j++){const a=teams[i],b=teams[j],count=mat[[a.id,b.id].sort().join('|')]||0;if(count)pairs.push({a,b,count})}return pairs.sort((a,b)=>b.count-a.count||a.a.name.localeCompare(b.a.name))}
function renderHeatmap(){const pairs=allPartnerPairs(),shown=pairs.slice(0,state.heatmapExpanded?30:6),max=Math.max(...pairs.map(x=>x.count),1);$("tradeHeatmap").classList.remove("loading");$("tradeHeatmap").innerHTML=`<div class="partner-grid compact">${shown.map((p,i)=>`<article class="partner-card" style="--heat:${Math.max(.08,p.count/max)}"><div class="partner-rank">${i+1}</div><div class="partner-names"><strong>${esc(p.a.name)}</strong><span>↔</span><strong>${esc(p.b.name)}</strong></div><div class="partner-total"><strong>${p.count}</strong><span>trades</span></div></article>`).join("")}</div>`;$("heatmapToggle").textContent=state.heatmapExpanded?'Show top 6':'Show top 30'}
function renderBlock(){const moved={};state.trades.forEach(t=>Object.keys(t.adds||{}).forEach(id=>moved[id]=(moved[id]||0)+1));const rows=Object.entries(moved).sort((a,b)=>b[1]-a[1]).slice(0,5);$("tradeBlock").classList.remove("loading");$("tradeBlock").innerHTML=rows.length?rows.map(([id,n],i)=>`<div class="rank-item"><b>${i+1}</b><div><strong>${esc(playerName(id))}</strong><div class="meta">Most traded player of all time</div></div><span class="power-score">${n}x</span></div>`).join(""):'<div class="block-empty">No player movement yet.</div>'}

function playerWeekAverages(bundle){
  const rows=matchupRows(bundle),weeks=meaningfulWeeks(bundle),weekMap={};
  weeks.forEach(w=>weekMap[w]={});
  rows.forEach(row=>Object.entries(row.players_points||{}).forEach(([id,value])=>{
    const points=Number(value);
    if(!Number.isFinite(points))return;
    const slot=weekMap[row.week]||(weekMap[row.week]={});
    const current=slot[id]||(slot[id]={sum:0,games:0});
    current.sum+=points;
    current.games+=1
  }));
  return {weeks,weekMap}
}
function recentPlayerForm(){
  const bundle=state.modelBundle;
  if(!bundle)return {poor:[],good:[]};
  const {weeks,weekMap}=playerWeekAverages(bundle);
  if(weeks.length<3)return {poor:[],good:[]};
  const recentWeeks=weeks.slice(-2),priorWeeks=weeks.slice(0,-2);
  const ids=new Set();
  weeks.forEach(w=>Object.keys(weekMap[w]||{}).forEach(id=>ids.add(id)));
  const rows=[];
  ids.forEach(id=>{
    let priorSum=0,priorGames=0,recentSum=0,recentGames=0;
    priorWeeks.forEach(w=>{
      const x=weekMap[w]?.[id];
      if(x){priorSum+=x.sum;priorGames+=x.games}
    });
    recentWeeks.forEach(w=>{
      const x=weekMap[w]?.[id];
      if(x){recentSum+=x.sum;recentGames+=x.games}
    });
    if(!priorGames||!recentGames)return;
    const priorAvg=priorSum/priorGames,recentAvg=recentSum/recentGames;
    rows.push({id,name:playerName(id),priorAvg,recentAvg,change:recentAvg-priorAvg})
  });
  return {
    poor:rows.filter(x=>x.priorAvg>20&&x.change<0).sort((a,b)=>a.change-b.change).slice(0,5),
    good:rows.filter(x=>x.priorAvg>15&&x.change>0).sort((a,b)=>b.change-a.change).slice(0,5)
  }
}
function renderFormList(targetId,rows,positive){
  const target=$(targetId);
  target.classList.remove("loading");
  target.innerHTML=rows.length?rows.map((x,i)=>`
    <div class="rank-item form-player-row ${positive?'good-form-row':'poor-form-row'}">
      <b>${i+1}</b>
      <div>
        <strong>${esc(x.name)}</strong>
        <div class="meta">${x.priorAvg.toFixed(1)} previously → ${x.recentAvg.toFixed(1)} last 2 weeks</div>
      </div>
      <span class="form-change ${positive?'positive':'negative'}">${x.change>0?'+':''}${x.change.toFixed(1)}</span>
    </div>`).join(""):`<div class="block-empty">Not enough completed weekly player data yet.</div>`
}
function renderPlayerForm(){
  const form=recentPlayerForm();
  renderFormList("poorForm",form.poor,false);
  renderFormList("goodForm",form.good,true)
}
function managerTradeCounts(trades){const c={};trades.forEach(t=>mids(t).forEach(id=>c[id]=(c[id]||0)+1));return c}
function topEntry(obj){return Object.entries(obj).sort((a,b)=>b[1]-a[1])[0]}
function highestTeamScore(bundles){let best=null;bundles.forEach(b=>b.matchups.forEach(m=>{const owner=b.ownerByRoster[String(m.roster_id)],pts=Number(m.points);if(owner&&Number.isFinite(pts)&&(!best||pts>best.pts))best={owner,pts,week:m.week,season:b.league.season}}));return best}
function highestPlayerScore(bundles){let best=null;bundles.forEach(b=>b.matchups.forEach(m=>Object.entries(m.players_points||{}).forEach(([id,v])=>{const pts=Number(v);if(Number.isFinite(pts)&&(!best||pts>best.pts))best={id,pts,week:m.week,season:b.league.season}})));return best}
function renderRecords(){const current=state.bundles.find(b=>String(b.league.league_id)===CONFIG.currentLeagueId)||state.modelBundle,allCounts=managerTradeCounts(state.trades),seasonCounts=managerTradeCounts(current.trades),allTop=topEntry(allCounts),seasonTop=topEntry(seasonCounts);let drought=null;for(const m of state.managers.values()){const last=state.trades.find(t=>mids(t).includes(m.id))?.created||0,days=last?Math.floor((Date.now()-last)/864e5):99999;if(!drought||days>drought.days)drought={m,days,last}}const perDay={};state.trades.forEach(t=>mids(t).forEach(id=>{const key=`${id}|${new Date(t.created).toDateString()}`;perDay[key]=(perDay[key]||0)+1}));const dayTop=topEntry(perDay),[dayOwner,dayDate]=(dayTop?.[0]||'|').split('|'),teamEver=highestTeamScore(state.bundles),teamSeason=highestTeamScore([current]),playerEver=highestPlayerScore(state.bundles),playerSeason=highestPlayerScore([current]);const cards=[['MOST TRADES (ALL TIME)',allTop?managerName(allTop[0]):'—',allTop?`${allTop[1]} trades`:'No data'],['MOST TRADES THIS SEASON',seasonTop?managerName(seasonTop[0]):'—',seasonTop?`${seasonTop[1]} trades`:'No trades'],['LONGEST FUN DROUGHT',drought?.m.name||'—',drought?.last?`${drought.days} days since a trade`:'No recorded trade'],['MOST TRADES IN A DAY',dayOwner?managerName(dayOwner):'—',dayTop?`${dayTop[1]} trades · ${dayDate}`:'No data'],['HIGHEST WEEKLY TEAM SCORE EVER',teamEver?managerName(teamEver.owner):'—',teamEver?`${teamEver.pts.toFixed(1)} pts · Week ${teamEver.week}, ${teamEver.season}`:'No data'],['HIGHEST WEEKLY TEAM SCORE THIS SEASON',teamSeason?managerName(teamSeason.owner):'—',teamSeason?`${teamSeason.pts.toFixed(1)} pts · Week ${teamSeason.week}`:'Season not started'],['HIGHEST PLAYER SCORE EVER',playerEver?playerName(playerEver.id):'—',playerEver?`${playerEver.pts.toFixed(1)} pts · Week ${playerEver.week}, ${playerEver.season}`:'No data'],['HIGHEST PLAYER SCORE THIS SEASON',playerSeason?playerName(playerSeason.id):'—',playerSeason?`${playerSeason.pts.toFixed(1)} pts · Week ${playerSeason.week}`:'Season not started']];$("leagueRecords").classList.remove("loading");$("leagueRecords").innerHTML=cards.map(x=>`<div class="record"><span>${esc(x[0])}</span><strong>${esc(x[1])}</strong><small>${esc(x[2])}</small></div>`).join("")}
function tradeDetailsHTML(t){const sides=Object.entries(tradeAssets(t));return sides.map(([id,assets])=>`<div class="trade-detail-side"><strong>${esc(managerName(id,t))} receives</strong>${assets.map(a=>`<div>${esc(a.name)}${a.owner?` <small>(${esc(a.owner)}'s pick)</small>`:''}</div>`).join('')||'<div>No listed assets</div>'}</div>`).join('')}
function renderRecent(){const r=state.trades.slice(0,4);$("recentTrades").classList.remove("loading");$("recentTrades").innerHTML=r.map(t=>`<details><summary><div class="trade-date">${fmt(t.created)} · ${esc(t.season_label||'')}</div><div class="trade-teams">${mids(t).map(id=>esc(managerName(id,t))).join(' ↔ ')}</div><div class="trade-meta">${tradeSummary(t)}</div></summary><div class="trade-detail-body">${tradeDetailsHTML(t)}</div></details>`).join('')||'<div class="block-empty">No trades.</div>'}
function currentVoteAverageMap(){const current=state.bundles.find(b=>String(b.league.league_id)===CONFIG.currentLeagueId);if(current&&meaningfulWeeks(current).length)return buildPlayerAverages(current,meaningfulWeeks(current).at(-1));return state.playerAverages}
function previousSeasonAverageMap(){const sorted=state.bundles.filter(b=>meaningfulWeeks(b).length).sort((a,b)=>Number(b.league.season)-Number(a.league.season));const previous=sorted.find(b=>b!==state.modelBundle)||sorted[1];return previous?buildPlayerAverages(previous,meaningfulWeeks(previous).at(-1)):{} }

function eligibleRookie(id){
  const p=state.players[id]||{},season=String(state.league?.season||"2026");
  return Number(p.years_exp)===0||
    String(p.rookie_year||p.first_season||"")===season||
    String(p.status||"").toLowerCase()==="rookie"
}
function votingOpen(){
  return Date.now()>=new Date(CONFIG.votingOpens).getTime()
}
function votingCountdownText(){
  const remaining=Math.max(0,new Date(CONFIG.votingOpens).getTime()-Date.now());
  if(remaining<=0)return "Voting is open";
  const days=Math.floor(remaining/864e5);
  const hours=Math.floor((remaining%864e5)/36e5);
  const minutes=Math.floor((remaining%36e5)/6e4);
  const seconds=Math.floor((remaining%6e4)/1000);
  return `Voting opens in ${days}d ${hours}h ${minutes}m ${seconds}s`
}
function categoryKey(category){return `imoVoteSubmitted:${category}:2027`}
function categorySubmitted(category){return Boolean(localStorage.getItem(categoryKey(category)))}
function lockCategory(category,message){
  const card=document.querySelector(`.vote-category[data-category="${category}"]`);
  const overlay=$(`${category}Lock`);
  if(!card||!overlay)return;
  card.classList.add("vote-locked");
  overlay.innerHTML=`<div><strong>🔒 ${esc(message)}</strong></div>`;
  card.querySelectorAll("input,select,button").forEach(el=>el.disabled=true)
}
function unlockCategory(category){
  const card=document.querySelector(`.vote-category[data-category="${category}"]`);
  const overlay=$(`${category}Lock`);
  if(!card||!overlay)return;
  card.classList.remove("vote-locked");
  overlay.innerHTML="";
  card.querySelectorAll("input,select,button").forEach(el=>el.disabled=false)
}
function applyVotingLocks(){
  const open=votingOpen(),countdown=votingCountdownText();
  $("votingCountdown").textContent=countdown;
  ["allNba","rookie","mip"].forEach(category=>{
    const status=$(category==="allNba"?"allNbaStatus":category==="rookie"?"rookieStatus":"mipStatus");
    if(categorySubmitted(category)){
      lockCategory(category,"Vote submitted");
      if(status)status.textContent="Your vote has been locked on this device."
    }else if(!open){
      lockCategory(category,"Voting opens 3 January 2027");
      if(status)status.textContent=countdown
    }else{
      unlockCategory(category);
      if(status)status.textContent="One submission allowed on this device."
    }
  })
}
function storeVote(category,payload){
  if(!votingOpen())return false;
  if(categorySubmitted(category))return false;
  localStorage.setItem(categoryKey(category),JSON.stringify({...payload,submittedAt:new Date().toISOString()}));
  applyVotingLocks();
  return true
}
function renderVoting(){
  const avgs=currentVoteAverageMap(),prev=previousSeasonAverageMap();
  state.previousPlayerAverages=prev;
  const allPlayers=Object.entries(avgs)
    .filter(([,v])=>Number(v)>0)
    .map(([id,avg])=>({id,avg:Number(avg),name:playerName(id)}))
    .sort((a,b)=>b.avg-a.avg||a.name.localeCompare(b.name));
  const top=allPlayers.slice(0,50);
  state.votePlayers=top;
  const chosen=new Set();

  $("allNbaChoices").classList.remove("loading");
  const draw=(query="")=>{
    $("allNbaChoices").innerHTML=top
      .filter(x=>x.name.toLowerCase().includes(query.toLowerCase()))
      .map(x=>`<label class="vote-option"><input type="checkbox" value="${x.id}" ${chosen.has(x.id)?"checked":""}><span>${esc(x.name)}</span><small>${x.avg.toFixed(1)}</small></label>`)
      .join("")
  };
  draw();
  $("allNbaCount").textContent=chosen.size;
  $("allNbaSearch").oninput=e=>draw(e.target.value);
  $("allNbaChoices").onchange=e=>{
    if(!e.target.matches("input"))return;
    if(e.target.checked&&chosen.size>=10){e.target.checked=false;return}
    e.target.checked?chosen.add(e.target.value):chosen.delete(e.target.value);
    $("allNbaCount").textContent=chosen.size
  };

  const rookies=allPlayers.filter(x=>eligibleRookie(x.id));
  $("rookieVote").innerHTML='<option value="">Select a rookie…</option>'+
    rookies.map(x=>`<option value="${x.id}">${esc(x.name)} — ${x.avg.toFixed(1)}</option>`).join("");

  const mip=allPlayers
    .filter(x=>Number(prev[x.id])>0)
    .map(x=>({...x,improvement:x.avg-Number(prev[x.id])}))
    .sort((a,b)=>b.improvement-a.improvement||b.avg-a.avg);
  $("mipVote").innerHTML='<option value="">Select a player…</option>'+
    mip.map(x=>`<option value="${x.id}">${esc(x.name)} — ${x.improvement>=0?"+":""}${x.improvement.toFixed(1)} PPG</option>`).join("");

  $("submitAllNba").onclick=()=>{
    if(chosen.size===0||chosen.size>10){$("allNbaStatus").textContent="Select between 1 and 10 players.";return}
    if(storeVote("allNba",{players:[...chosen]}))$("allNbaStatus").textContent="All-NBA vote submitted."
  };
  $("submitRookie").onclick=()=>{
    const player=$("rookieVote").value;
    if(!player){$("rookieStatus").textContent="Select one rookie.";return}
    if(storeVote("rookie",{player}))$("rookieStatus").textContent="ROTY vote submitted."
  };
  $("submitMip").onclick=()=>{
    const player=$("mipVote").value;
    if(!player){$("mipStatus").textContent="Select one player.";return}
    if(storeVote("mip",{player}))$("mipStatus").textContent="MIP vote submitted."
  };

  applyVotingLocks();
  clearInterval(window.__imoVotingTimer);
  window.__imoVotingTimer=setInterval(applyVotingLocks,1000)
}
function renderAll(){renderSummary();renderLeaderboard();renderPower();renderOdds();renderTradeWeek();renderHeatmap();renderPlayerForm();renderBlock();renderRecords();renderRecent();renderVoting()}
async function loadSeason(id){const [league,users,rosters,drafts]=await Promise.all([getJSON(`${CONFIG.api}/league/${id}`,true),getJSON(`${CONFIG.api}/league/${id}/users`,true),getJSON(`${CONFIG.api}/league/${id}/rosters`,true),getJSON(`${CONFIG.api}/league/${id}/drafts`,true)]);if(!league||!users||!rosters)return null;const draftPicks=(await Promise.all((drafts||[]).map(d=>getJSON(`${CONFIG.api}/draft/${d.draft_id}/picks`,true)))).flat().filter(Boolean);const draftPickMap={};draftPicks.forEach(p=>{if(p.player_id!=null&&p.roster_id!=null&&p.round!=null)draftPickMap[`${league.season}|${p.roster_id}|${p.round}`]=String(p.player_id)});const ownerByRoster={},userById=Object.fromEntries(users.map(u=>[String(u.user_id),u])),managerNameMap={};rosters.forEach(r=>{if(r.owner_id!=null){ownerByRoster[String(r.roster_id)]=String(r.owner_id);const u=userById[String(r.owner_id)]||{};managerNameMap[String(r.owner_id)]=u.metadata?.team_name||u.display_name||`Team ${r.roster_id}`}});const rounds=Array.from({length:CONFIG.roundsToCheck},(_,i)=>i+1),weeks=await limitedMap(rounds,8,async wk=>{const [tx,match]=await Promise.all([getJSON(`${CONFIG.api}/league/${id}/transactions/${wk}`,true),getJSON(`${CONFIG.api}/league/${id}/matchups/${wk}`,true)]);const trades=(tx||[]).filter(t=>t.type==='trade'&&(!t.status||t.status==='complete')).map(t=>{const participantRosters=new Set((t.roster_ids||[]).map(String));if(!participantRosters.size){Object.values(t.adds||{}).forEach(x=>participantRosters.add(String(x)));Object.values(t.drops||{}).forEach(x=>participantRosters.add(String(x)));(t.draft_picks||[]).forEach(p=>{if(p.owner_id!=null)participantRosters.add(String(p.owner_id));if(p.previous_owner_id!=null)participantRosters.add(String(p.previous_owner_id))})}return {...t,manager_ids:[...participantRosters].map(r=>ownerByRoster[r]).filter(Boolean),roster_owner_map:ownerByRoster,manager_name_map:managerNameMap,season_label:`${league.season} season`,league_id:id}});return{trades,matchups:(match||[]).map(x=>({...x,week:wk}))}});return{league,users,rosters,ownerByRoster,draftPickMap,trades:weeks.flatMap(x=>x?.trades||[]),matchups:weeks.flatMap(x=>x?.matchups||[])}}
async function load(){$("refreshBtn").disabled=true;$("statusText").textContent='Connecting to Sleeper…';try{const [bundles,players]=await Promise.all([Promise.all(CONFIG.leagueIds.map(loadSeason)),getJSON(`${CONFIG.api}/players/nba`,true)]),valid=bundles.filter(Boolean),cur=valid.find(x=>String(x.league.league_id)===CONFIG.currentLeagueId)||valid[0];state.bundles=valid;state.league=cur.league;state.currentUsers=cur.users;state.currentRosters=cur.rosters;state.players=players||{};state.draftPickMap=Object.assign({},...valid.map(b=>b.draftPickMap||{}));buildManagers();const unique=new Map();valid.flatMap(x=>x.trades).forEach(t=>unique.set(t.transaction_id||`${t.league_id}-${t.created}`,t));state.trades=[...unique.values()].sort((a,b)=>(b.created||0)-(a.created||0));prepareModels();renderAll();$("statusText").textContent=`Live · ${valid.length} seasons loaded · model: ${state.modelBundle?.league?.season||'current'}`}catch(e){console.error(e);$("statusText").textContent='Could not load Sleeper data'}finally{$("refreshBtn").disabled=false}}
document.querySelectorAll('.window-btn').forEach(b=>b.addEventListener('click',()=>{state.selectedWindow=b.dataset.window;document.querySelectorAll('.window-btn').forEach(x=>x.classList.toggle('active',x===b));renderSummary();renderLeaderboard()}));$("refreshBtn").addEventListener('click',load);$("heatmapToggle").addEventListener('click',()=>{state.heatmapExpanded=!state.heatmapExpanded;renderHeatmap()});load();
