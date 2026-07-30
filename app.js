const CONFIG={currentLeagueId:"1341763186407276544",leagueIds:["1341763186407276544","1212553673821929472","1138349648558624768"],api:"https://api.sleeper.app/v1",statsApi:"https://api.sleeper.com/stats/nba/player",roundsToCheck:60,bookmakerMargin:1.08,oddsBaseline:.25,oddsExponent:2,maxDisplayedOdds:51,voteEndpoint:"",votingOpens:"2027-01-03T00:00:00+08:00"};
const state={league:null,currentUsers:[],currentRosters:[],managers:new Map(),trades:[],selectedWindow:"14",players:{},bundles:[],modelBundle:null,playerAverages:{},previousPowerRanks:{},heatmapExpanded:false,draftPickMap:{},previousPlayerAverages:{},votePlayers:[],activeWindow:"14",biggestTradesExpanded:false,profileAverageSeason:"2025",exactSeasonAverages:{},gameLogAverages:{},gameLogMeta:{},gameLogs:{}};
const $=id=>document.getElementById(id),WL={"14":"14 days","28":"28 days","season":"2026 season","all":"All time"};
async function getJSON(url,optional=false){try{const r=await fetch(url);if(!r.ok)throw new Error(r.status);return await r.json()}catch(e){if(optional)return null;throw e}}
async function limitedMap(items,limit,fn){const out=new Array(items.length);let n=0;async function run(){while(n<items.length){const i=n++;try{out[i]=await fn(items[i])}catch{out[i]=null}}}await Promise.all(Array.from({length:limit},run));return out}
function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function fmt(ts,short=false){return ts?new Intl.DateTimeFormat("en-AU",short?{day:"numeric",month:"short"}:{day:"numeric",month:"short",year:"numeric"}).format(new Date(ts)):"Unknown"}
function buildManagers(){const users=Object.fromEntries(state.currentUsers.map(x=>[String(x.user_id),x]));state.managers.clear();state.currentRosters.forEach(r=>{const u=users[String(r.owner_id)]||{},name=u.metadata?.team_name||u.display_name||`Team ${r.roster_id}`,teamAvatar=u.metadata?.avatar||r.metadata?.avatar||r.metadata?.team_avatar||u.avatar,avatar=teamAvatar?`https://sleepercdn.com/avatars/thumbs/${teamAvatar}`:null;state.managers.set(String(r.owner_id),{id:String(r.owner_id),name,roster:r,avatar,initials:name.split(/\s+/).slice(0,2).map(z=>z[0]).join("").toUpperCase()})})}
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
function selectModelBundle(){const current=state.bundles.find(b=>String(b.league.league_id)===CONFIG.currentLeagueId);if(current&&meaningfulWeeks(current).length>=2)return current;return state.bundles.filter(b=>meaningfulWeeks(b).length).sort((a,b)=>Number(b.league.season)-Number(a.league.season))[0]||current||state.bundles[0]}
function matchupRows(bundle,throughWeek=Infinity){return bundle.matchups.filter(x=>x.week<=throughWeek&&Number.isFinite(Number(x.points)))}
function outcomesForBundle(bundle,throughWeek=Infinity){const rows=matchupRows(bundle,throughWeek),byWeek={};rows.forEach(x=>(byWeek[x.week]??=[]).push(x));const out={};Object.values(byWeek).forEach(weekRows=>{const groups={};weekRows.forEach(x=>{if(x.matchup_id!=null)(groups[x.matchup_id]??=[]).push(x)});Object.values(groups).forEach(g=>{if(g.length<2)return;const max=Math.max(...g.map(x=>Number(x.points)||0)),ties=g.filter(x=>(Number(x.points)||0)===max).length;g.forEach(x=>{const owner=bundle.ownerByRoster[String(x.roster_id)];if(!owner)return;(out[owner]??=[]).push({week:x.week,points:Number(x.points)||0,result:(Number(x.points)||0)===max?(ties>1?.5:1):0})})})});return out}
function minMax(value,values,higher=true){const nums=values.filter(Number.isFinite);if(!nums.length)return .5;const min=Math.min(...nums),max=Math.max(...nums);if(max===min)return .5;const n=(value-min)/(max-min);return higher?n:1-n}
function standingsTable(bundle,throughWeek=Infinity){const outcomes=outcomesForBundle(bundle,throughWeek);return [...state.managers.values()].map(m=>{const games=outcomes[m.id]||[],wins=games.reduce((s,g)=>s+g.result,0),pts=games.reduce((s,g)=>s+g.points,0);return {...m,wins,games:games.length,pts}}).sort((a,b)=>b.wins-a.wins||b.pts-a.pts||a.name.localeCompare(b.name)).map((x,i)=>({...x,standingRank:i+1}))}
function modelRows(bundle,throughWeek=Infinity,mode="power"){const standings=standingsTable(bundle,throughWeek),outcomes=outcomesForBundle(bundle,throughWeek),teamCount=Math.max(standings.length,1);const raw=standings.map(team=>{const games=outcomes[team.id]||[],formN=mode==="odds"?5:3,recent=games.slice(-formN),last5=games.slice(-5),form=recent.length?recent.reduce((s,g)=>s+g.result,0)/recent.length:0,avg5=last5.length?last5.reduce((s,g)=>s+g.points,0)/last5.length:0,ladder=teamCount===1?1:1-(team.standingRank-1)/(teamCount-1),streak=winningStreak(games);return {...team,form,avg5,ladder,streak}});const avgs=raw.map(x=>x.avg5);return raw.map(x=>{const avgNorm=minMax(x.avg5,avgs,true),score=mode==="odds"?x.form*.50+avgNorm*.25+x.ladder*.25:x.ladder*.35+x.form*.35+avgNorm*.30;return {...x,score}}).sort((a,b)=>b.score-a.score||b.avg5-a.avg5||a.name.localeCompare(b.name)).map((x,i)=>({...x,rank:i+1}))}
function winningStreak(games){let n=0;for(let i=games.length-1;i>=0;i--){if(games[i].result===1)n++;else break}return n}
function calculatedPlayerAverages(bundle,throughWeek=Infinity){const sums={},games={};matchupRows(bundle,throughWeek).forEach(row=>Object.entries(row.players_points||{}).forEach(([id,v])=>{const pts=Number(v);if(!Number.isFinite(pts)||pts<=0)return;sums[id]=(sums[id]||0)+pts;games[id]=(games[id]||0)+1}));return Object.fromEntries(Object.keys(sums).map(id=>[id,games[id]?sums[id]/games[id]:0]))}
function exactAverageMap(season){return state.exactSeasonAverages?.[String(season)]||{}}
function gameLogAverageMap(season){return state.gameLogAverages?.[String(season)]||{}}
function buildPlayerAverages(bundle,throughWeek=Infinity){const season=String(bundle?.league?.season||"");const calculated=calculatedPlayerAverages(bundle,throughWeek),exact=exactAverageMap(season),logs=gameLogAverageMap(season);return {...calculated,...exact,...logs}}
function prepareModels(){state.modelBundle=selectModelBundle();const weeks=meaningfulWeeks(state.modelBundle),last=weeks.at(-1)||Infinity,prior=weeks.length>1?weeks.at(-2):last;state.previousPowerRanks=Object.fromEntries(modelRows(state.modelBundle,prior,"power").map(x=>[x.id,x.rank]));state.playerAverages=buildPlayerAverages(state.modelBundle,last)}
function playerName(id){const p=state.players[id]||{};return p.full_name||[p.first_name,p.last_name].filter(Boolean).join(" ")||`Player ${id}`}
function pickOriginalOwner(p,t){const owner=t.roster_owner_map?.[String(p.roster_id)];return owner?managerName(owner,t):null}
function roundWord(n){return ({1:"First",2:"Second",3:"Third",4:"Fourth",5:"Fifth"})[Number(n)]||`Round ${n}`}
function draftedPlayerForPick(p){const season=String(p.season),round=String(p.round),candidates=[p.roster_id,p.original_roster_id,p.previous_owner_id,p.owner_id].filter(x=>x!=null).map(String);for(const key of candidates){const found=state.draftPickMap[`${season}|${key}|${round}`];if(found)return found}return null}
function fixedPickValue(round){round=Number(round);return round===1?23.5:round===2?5:0}
function bundleForSeason(season){return state.bundles.find(b=>String(b.league?.season)===String(season))||null}
function bundleForTrade(t){return state.bundles.find(b=>String(b.league?.league_id)===String(t.league_id))||bundleForSeason(String(t.season_label||"").match(/\d{4}/)?.[0])||null}
function latestKnownAverage(playerId){for(const bundle of [...state.bundles].sort((a,b)=>Number(b.league?.season)-Number(a.league?.season))){const weeks=meaningfulWeeks(bundle);if(!weeks.length)continue;const avg=Number(buildPlayerAverages(bundle,weeks.at(-1))[playerId]||0);if(avg>0)return avg}return Number(state.playerAverages[playerId]||0)}
function playerSeasonAverage(playerId,season){const bundle=bundleForSeason(season);if(!bundle)return 0;const weeks=meaningfulWeeks(bundle);return weeks.length?Number(buildPlayerAverages(bundle,weeks.at(-1))[playerId]||0):0}
function tradeSeasonAverage(playerId,t){const bundle=bundleForTrade(t);if(bundle){const weeks=meaningfulWeeks(bundle);if(weeks.length){const avg=Number(buildPlayerAverages(bundle,weeks.at(-1))[playerId]||0);if(avg>0)return avg}}return latestKnownAverage(playerId)}
function playerAgeAt(playerId,timestamp){const p=state.players[playerId]||{},at=new Date(Number(timestamp)||Date.now()),raw=p.birth_date||p.birthdate||p.dob;if(raw){const born=new Date(raw);if(!Number.isNaN(born.getTime())){let age=at.getFullYear()-born.getFullYear();if(at.getMonth()<born.getMonth()||(at.getMonth()===born.getMonth()&&at.getDate()<born.getDate()))age--;return Math.max(18,age)}}const currentAge=Number(p.age);if(Number.isFinite(currentAge))return Math.max(18,currentAge-(new Date().getFullYear()-at.getFullYear()));return 28}
function ageMultiplier(age){if(age<=19)return 1.18;if(age===20)return 1.20;if(age===21)return 1.22;if(age===22)return 1.23;if(age===23)return 1.24;if(age===24||age===25)return 1.25;if(age===26)return 1.24;if(age===27)return 1.22;if(age===28)return 1.18;if(age===29)return 1.12;if(age===30)return 1.05;if(age===31)return .98;if(age===32)return .92;if(age===33)return .88;if(age===34)return .84;if(age===35)return .80;return .76}
function eliteMultiplier(avg){if(avg>=40)return 1.40;if(avg>=35)return 1.28;if(avg>=30)return 1.18;if(avg>=25)return 1.10;if(avg>=20)return 1.05;if(avg>=10)return 1.02;return 1}
function playerDynastyValue(playerId,average,timestamp){const avg=Number(average)||0;return avg>0?avg*ageMultiplier(playerAgeAt(playerId,timestamp))*eliteMultiplier(avg):0}
function tradeAssets(t){const by={};mids(t).forEach(id=>by[id]=[]);Object.entries(t.adds||{}).forEach(([pid,rid])=>{const mid=t.roster_owner_map?.[String(rid)];if(!mid||!by[mid])return;const average=tradeSeasonAverage(pid,t);by[mid].push({type:"player",id:pid,name:playerName(pid),value:playerDynastyValue(pid,average,t.created),average})});(t.draft_picks||[]).forEach(p=>{const mid=t.roster_owner_map?.[String(p.owner_id)];if(!mid||!by[mid])return;const round=Number(p.round),season=p.season||"Future",original=pickOriginalOwner(p,t),drafted=draftedPlayerForPick(p),pickLabel=`${season} ${roundWord(round)} Round Pick${original?` ${original}`:""}`;let value=fixedPickValue(round),average=0;if(drafted){average=playerSeasonAverage(drafted,season);if(average>0)value=playerDynastyValue(drafted,average,new Date(`${season}-12-31T12:00:00`).getTime())}by[mid].push({type:"pick",id:drafted||null,name:drafted?`${playerName(drafted)} (${pickLabel})`:`${season} Round ${round} Pick`,owner:drafted?null:original,value,average})});return by}
function tradeValue(t){return Object.values(tradeAssets(t)).flat().reduce((sum,asset)=>sum+(Number(asset.value)||0),0)}
function tradeSummary(t){const assets=Object.values(tradeAssets(t)).flat().filter(a=>a.type==='player').map(a=>a.name);const core=assets.slice(0,3).join(' / ')||'Draft-pick trade';return core}
function renderSummary(){const w=state.selectedWindow,ts=tradesFor(w),latest=state.trades[0],active=activeRanked(state.activeWindow),lead=active[0];$("leagueTrades").textContent=ts.length;$("leagueTradesLabel").textContent=w==="all"?`${CONFIG.leagueIds.length} seasons combined`:w==="season"?"2026 season":`Last ${w} days`;let weeks;if(w==="all"){const oldest=state.trades.at(-1)?.created||Date.now();weeks=Math.max(1,(Date.now()-oldest)/6048e5)}else if(w==="season"){weeks=Math.max(1,Math.ceil((Date.now()-new Date("2026-07-01").getTime())/6048e5))}else weeks=Math.max(1,Number(w)/7);$("averageTrades").textContent=(ts.length/weeks).toFixed(1);$("leaderName").textContent=lead?.name||"—";$("leaderTrades").textContent=lead?.count||0;$("leaderWindow").textContent=activeWindowLabel(state.activeWindow);$("latestTradeShort").textContent=latest?tradeSummary(latest):"—";$("latestTradeDate").textContent=latest?`${mids(latest).map(id=>managerName(id,latest)).join(" ↔ ")} · ${fmt(latest.created)}`:"No trade"}
function renderLeaderboard(){const r=activeRanked(state.activeWindow),max=Math.max(...r.map(x=>x.count),1);$("leaderboard").classList.remove("loading");$("leaderboard").innerHTML=r.map((x,i)=>`<div class="leader-row"><span class="rank">${i+1}</span><span class="team-name">${esc(x.name)}</span><div class="bar-track"><div class="bar-fill" style="width:${x.count/max*100}%"></div></div><span class="trade-count">${x.count}</span></div>`).join("")}
function renderPower(){const weeks=meaningfulWeeks(state.modelBundle),through=weeks.at(-1)||Infinity,p=modelRows(state.modelBundle,through,"power"),n=Math.max(p.length-1,1);$("powerRankings").classList.remove("loading");$("powerRankings").innerHTML=p.map((x,i)=>{const old=state.previousPowerRanks[x.id]??x.rank,diff=old-x.rank,arrow=diff>0?`<span class="movement up">▲ ${diff}</span>`:diff<0?`<span class="movement down">▼ ${Math.abs(diff)}</span>`:`<span class="movement flat">—</span>`,hue=140-(140*i/n),fire=x.streak>=3?' 🔥':'',m=state.managers.get(String(x.id)),avatar=m?.avatar?`<img src="${esc(m.avatar)}" alt="" loading="lazy">`:`<span>${esc(m?.initials||x.name.slice(0,2).toUpperCase())}</span>`;return `<button class="rank-item power-row power-profile-card manager-profile-link" type="button" data-manager-id="${esc(x.id)}" style="--rank-colour:hsl(${hue} 85% 52%)" aria-label="Open ${esc(x.name)} manager profile"><b>${x.rank}</b><span class="power-avatar">${avatar}</span><span class="power-copy"><strong class="power-name">${esc(x.name)}${fire}</strong><small>View manager profile</small></span>${arrow}</button>`}).join("")}
function roundFive(x){return Math.round(x*20)/20}
function priceRows(through){const rows=modelRows(state.modelBundle,through,"odds"),strengths=rows.map(x=>Math.pow(CONFIG.oddsBaseline+(1-CONFIG.oddsBaseline)*Math.max(0,Math.min(1,x.score)),CONFIG.oddsExponent)),sum=strengths.reduce((a,b)=>a+b,0)||1;return rows.map((x,i)=>{const fair=strengths[i]/sum,market=Math.min(.99,fair*CONFIG.bookmakerMargin),odds=roundFive(Math.min(CONFIG.maxDisplayedOdds,Math.max(1.01,1/market)));return {...x,odds}})}
function renderOdds(){const weeks=meaningfulWeeks(state.modelBundle),through=weeks.at(-1)||Infinity,prior=weeks.length>1?weeks.at(-2):through,rows=priceRows(through),old=Object.fromEntries(priceRows(prior).map(x=>[x.id,x]));const nonFav=rows.filter((_,i)=>i!==0).map(x=>({id:x.id,improvement:(old[x.id]?.odds??x.odds)-x.odds})).sort((a,b)=>b.improvement-a.improvement),smokeyId=nonFav[0]?.improvement>0?nonFav[0].id:null;$("championshipOdds").classList.remove("loading");$("championshipOdds").innerHTML=rows.map((x,i)=>{const prev=old[x.id]?.odds??x.odds,delta=x.odds-prev,cls=delta<0?'up':delta>0?'down':'flat',icon=delta<0?'📈':delta>0?'📉':'➖',streak=x.streak>=1?`Won last ${x.streak}`:`Form: ${Math.round(x.form*5)} wins from last 5`,ladderMove=(old[x.id]?.standingRank||x.standingRank)-x.standingRank,ladderText=ladderMove>0?`Moved up to ${ordinal(x.standingRank)} on ladder`:ladderMove<0?`Dropped to ${ordinal(x.standingRank)} on ladder`:`Currently ${ordinal(x.standingRank)} on ladder`,moveText=prev===x.odds?'No price movement':`$${prev.toFixed(2)} → $${x.odds.toFixed(2)}`,tag=i===0?'<span class="odds-tag favourite-tag"><span>★</span> Favourite</span>':x.id===smokeyId?'<span class="odds-tag smokey-tag"><span>🔥</span> Smokey</span>':'';return `<details class="odds-row-wrap"><summary class="odds-summary"><b>${i+1}</b><div class="odds-summary-main"><strong>${esc(x.name)}</strong>${tag}</div><div class="odds-price-stack"><span class="odds">$${x.odds.toFixed(2)}</span><div class="odds-move ${cls}">${icon} ${moveText}<span class="odds-chevron">▼</span></div></div></summary><div class="odds-detail"><div>${x.streak?`${x.streak>=3?'🔥':'✅'} ${streak}`:`⚪ ${streak}`}</div><div>🔥 Averaging ${x.avg5.toFixed(1)} over last five weeks</div><div>${ladderMove<0?'⬇':'⬆'} ${ladderText}</div></div></details>`}).join("")}
function ordinal(n){const s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0])}
function renderTradeWeek(){const recent=state.trades.filter(t=>t.created>=Date.now()-7*864e5),pool=recent.length?recent:state.trades.slice(0,25),t=[...pool].sort((a,b)=>tradeValue(b)-tradeValue(a))[0];if(!t){$("tradeOfWeek").innerHTML="No trade available";return}const sides=Object.entries(tradeAssets(t)).slice(0,3),html=sides.map(([mid,assets])=>`<div class="trade-side-v2"><strong>${esc(managerName(mid,t))} receives</strong>${assets.length?assets.map(a=>`<div class="asset-row"><span>${esc(a.name)}${a.owner?`<small class="asset-owner">Originally ${esc(a.owner)}'s pick</small>`:''}</span></div>`).join(""):'<div class="asset-row"><span>No listed assets</span></div>'}</div>`).join('<div class="trade-mid">⇄</div>');$("tradeOfWeek").classList.remove("loading");$("tradeOfWeek").innerHTML=`<div class="trade-feature-v2">${html}<div class="trade-foot-v2"><span>Selected by the private dynasty trade-ranking model</span><strong>${fmt(t.created)}</strong></div></div>`}
function allPartnerPairs(){const teams=[...state.managers.values()],mat={};state.trades.forEach(t=>{const ids=mids(t);for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const k=[ids[i],ids[j]].sort().join('|');mat[k]=(mat[k]||0)+1}});const pairs=[];for(let i=0;i<teams.length;i++)for(let j=i+1;j<teams.length;j++){const a=teams[i],b=teams[j],count=mat[[a.id,b.id].sort().join('|')]||0;if(count)pairs.push({a,b,count})}return pairs.sort((a,b)=>b.count-a.count||a.a.name.localeCompare(b.a.name))}
function mostRecentPartnerTrade(a,b){return state.trades.find(t=>{const ids=mids(t);return ids.includes(String(a))&&ids.includes(String(b))})||null}
function renderHeatmap(){const pairs=allPartnerPairs(),shown=pairs.slice(0,state.heatmapExpanded?30:6),max=Math.max(...pairs.map(x=>x.count),1);$("tradeHeatmap").classList.remove("loading");$("tradeHeatmap").innerHTML=`<div class="partner-grid compact">${shown.map((p,i)=>{const latest=mostRecentPartnerTrade(p.a.id,p.b.id);return `<details class="partner-card partner-card-expand" style="--heat:${Math.max(.08,p.count/max)}"><summary><div class="partner-rank">${i+1}</div><div class="partner-names"><strong>${esc(p.a.name)}</strong><span>↔</span><strong>${esc(p.b.name)}</strong></div><div class="partner-total"><strong>${p.count}</strong><span>trades</span></div></summary><div class="partner-recent"><span>Most recent trade</span>${latest?`<strong>${fmt(latest.created)}</strong><small>${esc(tradeSummary(latest))}</small><div class="trade-detail-body">${tradeDetailsHTML(latest)}</div>`:'<small>No trade details available.</small>'}</div></details>`}).join("")}</div>`;$("heatmapToggle").textContent=state.heatmapExpanded?'Show top 6':'Show top 30'}
function renderBlock(){const moved={};state.trades.forEach(t=>Object.keys(t.adds||{}).forEach(id=>moved[id]=(moved[id]||0)+1));const rows=Object.entries(moved).sort((a,b)=>b[1]-a[1]).slice(0,5);$("tradeBlock").classList.remove("loading");$("tradeBlock").innerHTML=rows.length?rows.map(([id,n],i)=>`<div class="rank-item"><b>${i+1}</b><div><strong>${esc(playerName(id))}</strong><div class="meta">Most traded player of all time</div></div><span class="power-score">${n}x</span></div>`).join(""):'<div class="block-empty">No player movement yet.</div>'}

function gameDateValue(row){const raw=row?.date||row?.game_date||row?.gameDate||row?.start_time||row?.startTime||row?.timestamp;const d=raw?new Date(raw):null;return d&&!Number.isNaN(d.getTime())?d:null}
function allGameLogFormRows(){const season=String(state.modelBundle?.league?.season||"2025"),logs=state.gameLogs?.[season]||{},nowDates=Object.values(logs).flat().map(gameDateValue).filter(Boolean),latest=nowDates.length?new Date(Math.max(...nowDates.map(d=>d.getTime()))):new Date(),recentStart=new Date(latest.getTime()-14*864e5),rows=[];Object.entries(logs).forEach(([id,games])=>{let priorPts=0,priorGames=0,recentPts=0,recentGames=0;(games||[]).forEach(row=>{const date=gameDateValue(row),fpts=rawFantasyPoints(row,state.modelBundle?.league?.scoring_settings||{});if(!date||!gameWasPlayed(row)||!Number.isFinite(fpts))return;if(date>=recentStart){recentPts+=fpts;recentGames++}else{priorPts+=fpts;priorGames++}});if(!priorGames||!recentGames)return;const priorAvg=priorPts/priorGames,recentAvg=recentPts/recentGames;rows.push({id,name:playerName(id),priorAvg,recentAvg,change:recentAvg-priorAvg})});return rows}
function recentPlayerForm(){const rows=allGameLogFormRows();return{poor:rows.filter(x=>x.priorAvg>=20&&x.recentAvg>0&&x.change<0).sort((a,b)=>a.change-b.change).slice(0,5),good:rows.filter(x=>x.priorAvg>=15&&x.recentAvg>0&&x.change>0).sort((a,b)=>b.change-a.change).slice(0,5)}}
function renderFormList(targetId,rows,positive){const target=$(targetId);target.classList.remove("loading");target.innerHTML=rows.length?rows.map((x,i)=>`<div class="rank-item form-player-row ${positive?'good-form-row':'poor-form-row'}"><b>${i+1}</b><div><strong>${esc(x.name)}</strong><div class="meta">${x.priorAvg.toFixed(1)} previously → ${x.recentAvg.toFixed(1)} last 2 weeks</div></div><span class="form-change ${positive?'positive':'negative'}">${x.change>0?'+':''}${x.change.toFixed(1)}</span></div>`).join(""):`<div class="block-empty">Individual regular-season game logs are still loading.</div>`}
function renderPlayerForm(){const form=recentPlayerForm();renderFormList("poorForm",form.poor,false);renderFormList("goodForm",form.good,true)}
function managerTradeCounts(trades){const c={};trades.forEach(t=>mids(t).forEach(id=>c[id]=(c[id]||0)+1));return c}
function topEntry(obj){return Object.entries(obj).sort((a,b)=>b[1]-a[1])[0]}
function highestTeamScore(bundles){let best=null;bundles.forEach(b=>b.matchups.forEach(m=>{const owner=b.ownerByRoster[String(m.roster_id)],pts=Number(m.points);if(owner&&Number.isFinite(pts)&&(!best||pts>best.pts))best={owner,pts,week:m.week,season:b.league.season}}));return best}
function highestPlayerScore(bundles){let best=null;bundles.forEach(b=>b.matchups.forEach(m=>Object.entries(m.players_points||{}).forEach(([id,v])=>{const pts=Number(v);if(Number.isFinite(pts)&&(!best||pts>best.pts))best={id,pts,week:m.week,season:b.league.season}})));return best}
function renderRecords(){const current=state.bundles.find(b=>String(b.league.league_id)===CONFIG.currentLeagueId)||state.modelBundle,allCounts=managerTradeCounts(state.trades),seasonCounts=managerTradeCounts(current.trades),allTop=topEntry(allCounts),seasonTop=topEntry(seasonCounts);let drought=null;for(const m of state.managers.values()){const last=state.trades.find(t=>mids(t).includes(m.id))?.created||0,days=last?Math.floor((Date.now()-last)/864e5):99999;if(!drought||days>drought.days)drought={m,days,last}}const perDay={};state.trades.forEach(t=>mids(t).forEach(id=>{const key=`${id}|${new Date(t.created).toDateString()}`;perDay[key]=(perDay[key]||0)+1}));const dayTop=topEntry(perDay),[dayOwner,dayDate]=(dayTop?.[0]||'|').split('|'),teamEver=highestTeamScore(state.bundles),teamSeason=highestTeamScore([current]),playerEver=highestPlayerScore(state.bundles),playerSeason=highestPlayerScore([current]);const cards=[['MOST TRADES (ALL TIME)',allTop?managerName(allTop[0]):'—',allTop?`${allTop[1]} trades`:'No data'],['MOST TRADES THIS SEASON',seasonTop?managerName(seasonTop[0]):'—',seasonTop?`${seasonTop[1]} trades`:'No trades'],['LONGEST FUN DROUGHT',drought?.m.name||'—',drought?.last?`${drought.days} days since a trade`:'No recorded trade'],['MOST TRADES IN A DAY',dayOwner?managerName(dayOwner):'—',dayTop?`${dayTop[1]} trades · ${dayDate}`:'No data'],['HIGHEST WEEKLY TEAM SCORE EVER',teamEver?managerName(teamEver.owner):'—',teamEver?`${teamEver.pts.toFixed(1)} pts · Week ${teamEver.week}, ${teamEver.season}`:'No data'],['HIGHEST WEEKLY TEAM SCORE THIS SEASON',teamSeason?managerName(teamSeason.owner):'—',teamSeason?`${teamSeason.pts.toFixed(1)} pts · Week ${teamSeason.week}`:'Season not started'],['HIGHEST PLAYER SCORE EVER',playerEver?playerName(playerEver.id):'—',playerEver?`${playerEver.pts.toFixed(1)} pts · Week ${playerEver.week}, ${playerEver.season}`:'No data'],['HIGHEST PLAYER SCORE THIS SEASON',playerSeason?playerName(playerSeason.id):'—',playerSeason?`${playerSeason.pts.toFixed(1)} pts · Week ${playerSeason.week}`:'Season not started']];$("leagueRecords").classList.remove("loading");$("leagueRecords").innerHTML=cards.map(x=>`<div class="record"><span>${esc(x[0])}</span><strong>${esc(x[1])}</strong><small>${esc(x[2])}</small></div>`).join("")}
function tradeDetailsHTML(t){const sides=Object.entries(tradeAssets(t));return sides.map(([id,assets])=>`<div class="trade-detail-side"><strong>${esc(managerName(id,t))} receives</strong>${assets.map(a=>`<div>${esc(a.name)}${a.owner?` <small>(${esc(a.owner)}'s pick)</small>`:''}</div>`).join('')||'<div>No listed assets</div>'}</div>`).join('')}
function renderRecent(){const r=state.trades.slice(0,4);$("recentTrades").classList.remove("loading");$("recentTrades").innerHTML=r.map(t=>`<details><summary><div class="trade-date">${fmt(t.created)} · ${esc(t.season_label||'')}</div><div class="trade-teams">${mids(t).map(id=>esc(managerName(id,t))).join(' ↔ ')}</div><div class="trade-meta">${tradeSummary(t)}</div></summary><div class="trade-detail-body">${tradeDetailsHTML(t)}</div></details>`).join('')||'<div class="block-empty">No trades.</div>'}
function renderBiggestTrades(){const limit=state.biggestTradesExpanded?8:5,rows=[...state.trades].map(t=>({t,value:tradeValue(t)})).sort((a,b)=>b.value-a.value||(b.t.created||0)-(a.t.created||0)).slice(0,limit);$("biggestTrades").classList.remove("loading");$("biggestTrades").innerHTML=rows.map((row,i)=>`<details class="big-trade-card"><summary><span class="big-trade-rank">${i+1}</span><div><strong>${mids(row.t).map(id=>esc(managerName(id,row.t))).join(" ↔ ")}</strong><small>${fmt(row.t.created)} · ${esc(row.t.season_label||"")}</small></div><span class="big-trade-chevron">View trade</span></summary><div class="trade-detail-body">${tradeDetailsHTML(row.t)}</div></details>`).join("")||'<div class="block-empty">No trades available.</div>';$("biggestTradesToggle").textContent=state.biggestTradesExpanded?"Show top 5":"Show top 8"}
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
    if(storeVote("allNba",{players:[...chosen],fanWeight:.35,averageWeight:.65,normalisationPool:"top50"}))$("allNbaStatus").textContent="All-NBA vote submitted."
  };
  $("submitRookie").onclick=()=>{
    const player=$("rookieVote").value;
    if(!player){$("rookieStatus").textContent="Select one rookie.";return}
    if(storeVote("rookie",{player,fanWeight:.35,averageWeight:.65}))$("rookieStatus").textContent="ROTY vote submitted."
  };
  $("submitMip").onclick=()=>{
    const player=$("mipVote").value;
    if(!player){$("mipStatus").textContent="Select one player.";return}
    if(storeVote("mip",{player,fanWeight:.50,improvementWeight:.50,baselineSeason:"2025",currentSeason:"2026"}))$("mipStatus").textContent="MIP vote submitted."
  };

  applyVotingLocks();
  clearInterval(window.__imoVotingTimer);
  window.__imoVotingTimer=setInterval(applyVotingLocks,1000)
}

function managerTrades(managerId){return state.trades.filter(t=>mids(t).includes(String(managerId)))}
function seasonAverageMap(season){const logs=gameLogAverageMap(season),exact=exactAverageMap(season),bundle=bundleForSeason(season);if(!bundle)return {...exact,...logs};if(!meaningfulWeeks(bundle).length)return {...exact,...logs};return buildPlayerAverages(bundle,meaningfulWeeks(bundle).at(-1))}
function managerRosterPlayers(managerId,season=state.profileAverageSeason){
  const manager=state.managers.get(String(managerId)),ids=[...(manager?.roster?.players||[])],avgMap=seasonAverageMap(season);
  return ids.map(id=>{const p=state.players[id]||{},avg=Number(avgMap[id]||0);return{id:String(id),name:playerName(id),avg,position:p.position||p.fantasy_positions?.[0]||"—",age:Number(p.age)||null,avatar:`https://sleepercdn.com/content/nba/players/${id}.jpg`}}).sort((a,b)=>b.avg-a.avg||a.name.localeCompare(b.name))
}
function managerFormData(managerId){
  const weeks=meaningfulWeeks(state.modelBundle),through=weeks.at(-1)||Infinity;
  const outcomes=outcomesForBundle(state.modelBundle,through)[String(managerId)]||[];
  const recent=outcomes.slice(-5);
  const wins=outcomes.reduce((sum,g)=>sum+g.result,0);
  const avg5=recent.length?recent.reduce((sum,g)=>sum+g.points,0)/recent.length:0;
  return{outcomes,recent,wins,games:outcomes.length,avg5,streak:winningStreak(outcomes)}
}
function managerTradeSummaryHTML(t,managerId){
  const partnerIds=mids(t).filter(id=>id!==String(managerId));
  const partnerNames=partnerIds.map(id=>managerName(id,t)).join(", ")||"League trade";
  return `<details class="profile-trade-card"><summary><div><strong>Trade with ${esc(partnerNames)}</strong><small>${fmt(t.created)} · ${esc(t.season_label||"")}</small></div><span>View</span></summary><div class="trade-detail-body">${tradeDetailsHTML(t)}</div></details>`
}
function championManagerIds(){
  const ids=new Set();
  state.bundles.forEach(bundle=>{const bracket=bundle.winnersBracket||[];if(!bracket.length)return;const maxRound=Math.max(...bracket.map(x=>Number(x.r)||0)),final=bracket.find(x=>Number(x.r)===maxRound&&x.w!=null)||bracket.filter(x=>Number(x.r)===maxRound&&x.w!=null)[0];if(final){const owner=bundle.ownerByRoster?.[String(final.w)];if(owner)ids.add(String(owner))}});
  return ids
}
function upcomingFirstCount(managerId){
  const bundle=state.bundles.find(b=>String(b.league?.league_id)===CONFIG.currentLeagueId)||state.bundles[0];
  if(!bundle)return 0;
  const currentSeason=Number(bundle.league?.season)||new Date().getFullYear(),seasons=[currentSeason,currentSeason+1,currentSeason+2],rosters=bundle.rosters||[],traded=bundle.tradedPicks||[];
  let count=0;
  seasons.forEach(season=>rosters.forEach(r=>{let ownerRoster=String(r.roster_id);const moved=traded.find(p=>String(p.season)===String(season)&&Number(p.round)===1&&String(p.roster_id)===String(r.roster_id));if(moved?.owner_id!=null)ownerRoster=String(moved.owner_id);const ownerUser=bundle.ownerByRoster?.[ownerRoster];if(String(ownerUser)===String(managerId))count++}));
  return count
}
function managerBadges(managerId){const id=String(managerId),badges=[],trades=managerTrades(id),months={};trades.forEach(t=>{const d=new Date(t.created||0),key=`${d.getFullYear()}-${d.getMonth()}`;months[key]=(months[key]||0)+1});if(Object.values(months).some(n=>n>=5))badges.push({icon:"⚡",name:"The Day Trader",copy:"Completed five or more trades in a single month."});const firsts=upcomingFirstCount(id);if(firsts>=4)badges.push({icon:"🧰",name:"Draft Capital Hoarder",copy:`Currently controls ${firsts} upcoming first-round picks.`});if(firsts===0)badges.push({icon:"🎯",name:"Win-Now",copy:"Has no future first-round picks and is fully committed to winning now."});const seasonTrades=currentSeasonTrades().filter(t=>mids(t).includes(id)),partners=new Set(seasonTrades.flatMap(t=>mids(t).filter(x=>x!==id)));if(state.managers.size>1&&partners.size>=state.managers.size-1)badges.push({icon:"🤝",name:"The Negotiator",copy:"Has traded with every other GM this season."});if(championManagerIds().has(id))badges.push({icon:"🏆",name:"Champion",copy:"Has won an IMO Dynasty Cup championship."});const weeks=meaningfulWeeks(state.modelBundle),through=weeks.at(-1)||Infinity,odds=priceRows(through);if(odds.length&&odds.at(-1)?.id===id)badges.push({icon:"🥞",name:"Pancakes",copy:"Currently owns the longest championship odds."});const avgMap=seasonAverageMap("2025"),topPlayer=Object.entries(avgMap).sort((a,b)=>b[1]-a[1])[0]?.[0],manager=state.managers.get(id),roster=(manager?.roster?.players||[]).map(String);if(topPlayer&&roster.includes(String(topPlayer)))badges.push({icon:"👑",name:"MVP",copy:`Currently owns ${playerName(topPlayer)}, the league's highest-average player.`});const young=roster.filter(pid=>Number(state.players[pid]?.age)<21).length,old=roster.filter(pid=>Number(state.players[pid]?.age)>30).length;if(young>10)badges.push({icon:"🐶",name:"Young Pups",copy:`Owns ${young} players under the age of 21.`});if(old>10)badges.push({icon:"🐕",name:"Old Dogs",copy:`Owns ${old} players over the age of 30.`});const twoYearsAgo=Date.now()-2*365.25*864e5;const locked=roster.find(pid=>{let lastAcquired=0;state.trades.filter(t=>Object.keys(t.adds||{}).includes(pid)&&String(t.roster_owner_map?.[String(t.adds[pid])])===id).forEach(t=>lastAcquired=Math.max(lastAcquired,t.created||0));return !lastAcquired||lastAcquired<=twoYearsAgo});if(locked)badges.push({icon:"🔒",name:"Locked",copy:`Owns ${playerName(locked)}, who has remained with the franchise for at least two years.`});return badges}
function managerAverageAge(id){const ages=managerRosterPlayers(id,"2025").map(x=>x.age).filter(Number.isFinite);return ages.length?ages.reduce((a,b)=>a+b,0)/ages.length:0}
function favouriteTradePartners(id){const counts={};managerTrades(id).forEach(t=>mids(t).filter(x=>x!==String(id)).forEach(x=>counts[x]=(counts[x]||0)+1));return Object.entries(counts).map(([partner,count])=>({partner,count})).sort((a,b)=>b.count-a.count).slice(0,3)}
function teamFormPlayers(id){const rosterIds=new Set((state.managers.get(String(id))?.roster?.players||[]).map(String)),rows=allGameLogFormRows().filter(x=>rosterIds.has(String(x.id)));return{poor:rows.filter(x=>x.change<0).sort((a,b)=>a.change-b.change).slice(0,3),good:rows.filter(x=>x.change>0).sort((a,b)=>b.change-a.change).slice(0,3)}}
function teamHighestScore(id,bundles){let best=null;bundles.forEach(b=>b.matchups.forEach(m=>{if(String(b.ownerByRoster?.[String(m.roster_id)])!==String(id))return;const pts=Number(m.points);if(Number.isFinite(pts)&&(!best||pts>best.pts))best={pts,week:m.week,season:b.league.season}}));return best}
function managerRecentMatchups(id){const bundle=state.modelBundle,rows=matchupRows(bundle),byWeek={};rows.forEach(x=>(byWeek[x.week]??=[]).push(x));const results=[];Object.entries(byWeek).forEach(([week,weekRows])=>{const groups={};weekRows.forEach(x=>{if(x.matchup_id!=null)(groups[x.matchup_id]??=[]).push(x)});Object.values(groups).forEach(g=>{const mine=g.find(x=>String(bundle.ownerByRoster?.[String(x.roster_id)])===String(id)),opp=g.find(x=>x!==mine);if(!mine||!opp)return;const myPts=Number(mine.points)||0,oppPts=Number(opp.points)||0,oppId=bundle.ownerByRoster?.[String(opp.roster_id)],result=myPts===oppPts?"D":myPts>oppPts?"W":"L";results.push({week:Number(week),result,myPts,oppPts,oppId})})});return results.sort((a,b)=>a.week-b.week).slice(-5)}
function allNBAEligible(id){const season=state.profileAverageSeason==="2026"?"2026":"2025",avg=seasonAverageMap(season),top50=new Set(Object.entries(avg).filter(([,v])=>Number(v)>0).sort((a,b)=>b[1]-a[1]).slice(0,50).map(([pid])=>String(pid)));return managerRosterPlayers(id,season).filter(p=>top50.has(String(p.id)))}
function badgeIconsHTML(badges){return badges.map(b=>`<details class="profile-badge-pop"><summary title="${esc(b.name)}">${b.icon}</summary><div><strong>${esc(b.name)}</strong><small>${esc(b.copy)}</small></div></details>`).join("")}
function playerFormMini(rows,positive){return rows.length?rows.map(x=>`<div class="profile-form-player"><strong>${esc(x.name)}</strong><span class="${positive?'positive':'negative'}">${x.change>0?'+':''}${x.change.toFixed(1)}</span><small>${x.priorAvg.toFixed(1)} → ${x.recentAvg.toFixed(1)}</small></div>`).join(""):'<div class="profile-empty">No qualifying players.</div>'}
function managerProfileHTML(managerId){
  const id=String(managerId),manager=state.managers.get(id);if(!manager)return `<div class="profile-empty">Manager profile unavailable.</div>`;
  const weeks=meaningfulWeeks(state.modelBundle),through=weeks.at(-1)||Infinity,power=modelRows(state.modelBundle,through,"power").find(x=>x.id===id),odds=priceRows(through).find(x=>x.id===id),form=managerFormData(id),roster=managerRosterPlayers(id,state.profileAverageSeason),trades=managerTrades(id),biggest=[...trades].map(t=>({t,value:tradeValue(t)})).sort((a,b)=>b.value-a.value||(b.t.created||0)-(a.t.created||0)).slice(0,3),recent=trades.slice(0,5),badges=managerBadges(id),avgAge=managerAverageAge(id),partners=favouriteTradePartners(id),teamForm=teamFormPlayers(id),allTimeHigh=teamHighestScore(id,state.bundles),seasonBundle=state.bundles.find(b=>String(b.league.league_id)===CONFIG.currentLeagueId),seasonHigh=teamHighestScore(id,seasonBundle?[seasonBundle]:[]),matchups=managerRecentMatchups(id),eligible=allNBAEligible(id);
  const formPills=matchups.map(g=>`<details class="profile-form-result"><summary class="profile-form-pill ${g.result==="W"?"win":g.result==="D"?"draw":"loss"}">${g.result}</summary><div>${esc(manager.name)} <b>${g.result}</b> ${g.myPts.toFixed(2)} v ${esc(managerName(g.oppId))} ${g.oppPts.toFixed(2)}<small>Week ${g.week}</small></div></details>`).join("")||'<span class="profile-muted">No completed games</span>';
  const rosterRows=roster.map((p,i)=>`<div class="profile-roster-row"><span class="profile-roster-rank">${i+1}</span><span class="player-avatar-wrap"><img src="${esc(p.avatar)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span class="player-avatar-fallback">${esc(p.name.split(/\s+/).map(x=>x[0]).slice(0,2).join(""))}</span></span><div><strong>${esc(p.name)}</strong><small>${esc(p.position)}${p.age?` · Age ${p.age}`:""}</small></div><b>${p.avg.toFixed(2)}</b></div>`).join("")||'<div class="profile-empty">No current roster data.</div>';
  const managerAvatar=manager.avatar?`<img src="${esc(manager.avatar)}" alt="${esc(manager.name)} team avatar">`:esc(manager.initials||manager.name.slice(0,2).toUpperCase());
  const partnerRows=partners.map((p,i)=>`<div class="profile-partner-row"><b>${i+1}</b><strong>${esc(managerName(p.partner))}</strong><span>${p.count} trades</span></div>`).join("")||'<div class="profile-empty">No trade partners yet.</div>';
  const eligibleRows=eligible.map(p=>`<div class="eligible-player"><strong>${esc(p.name)}</strong><span>${p.avg.toFixed(2)}</span></div>`).join("")||'<div class="profile-empty">No current top-50 players.</div>';
  return `<header class="manager-profile-hero"><div class="manager-profile-avatar">${managerAvatar}</div><div><span class="eyebrow">TEAM PROFILE</span><div class="profile-name-line"><h2 id="managerProfileTitle">${esc(manager.name)}</h2><div class="profile-badge-icons">${badgeIconsHTML(badges)}</div></div><p>Current franchise overview and league history</p></div></header>
  <div class="manager-profile-stat-grid"><div><span>Power rank</span><strong>${power?`#${power.rank}`:"—"}</strong></div><div><span>Ladder</span><strong>${power?`#${power.standingRank}`:"—"}</strong></div><div><span>Record</span><strong>${form.games?`${form.wins}-${form.games-form.wins}`:"—"}</strong></div><div><span>Championship odds</span><strong>${odds?`$${odds.odds.toFixed(2)}`:"—"}</strong></div><div><span>Team average age</span><strong>${avgAge?avgAge.toFixed(1):"—"}</strong></div><div><span>Career trades</span><strong>${trades.length}</strong></div></div>
  <div class="manager-profile-grid">
    <section class="manager-profile-card profile-roster-card"><div class="manager-profile-card-heading"><div><span class="eyebrow">CURRENT TEAM</span><h3>Roster</h3></div><div class="roster-season-toggle"><button type="button" class="${state.profileAverageSeason==="2025"?"active":""}" data-profile-season="2025">2025 averages</button><button type="button" class="${state.profileAverageSeason==="2026"?"active":""}" data-profile-season="2026">2026 season averages</button></div></div><div class="profile-roster-list">${rosterRows}</div></section>
    <section class="manager-profile-card"><div class="manager-profile-card-heading"><div><span class="eyebrow">FORM GUIDE</span><h3>Last Five Matchups</h3></div></div><div class="profile-form-strip interactive">${formPills}</div><p class="profile-help">Click W, D or L to view the matchup score.</p></section>
    <section class="manager-profile-card"><div class="manager-profile-card-heading"><div><span class="eyebrow">TRADE DNA</span><h3>Favourite Trade Partners</h3></div></div><div class="profile-partner-list">${partnerRows}</div></section>
    <section class="manager-profile-card score-records"><div class="manager-profile-card-heading"><div><span class="eyebrow">SCORING RECORDS</span><h3>Franchise Highs</h3></div></div><div class="profile-record-row"><span>Highest ever team score</span><strong>${allTimeHigh?allTimeHigh.pts.toFixed(2):"—"}</strong><small>${allTimeHigh?`Week ${allTimeHigh.week}, ${allTimeHigh.season}`:"No completed matchup"}</small></div><div class="profile-record-row"><span>Highest 2026 season score</span><strong>${seasonHigh?seasonHigh.pts.toFixed(2):"—"}</strong><small>${seasonHigh?`Week ${seasonHigh.week}`:"Season not started"}</small></div></section>
    <section class="manager-profile-card"><div class="manager-profile-card-heading"><div><span class="eyebrow">TWO-WEEK WATCH</span><h3>Poor Form</h3></div></div>${playerFormMini(teamForm.poor,false)}</section>
    <section class="manager-profile-card"><div class="manager-profile-card-heading"><div><span class="eyebrow">TWO-WEEK WATCH</span><h3>Good Form</h3></div></div>${playerFormMini(teamForm.good,true)}</section>
    <section class="manager-profile-card"><div class="manager-profile-card-heading"><div><span class="eyebrow">ALL-NBA BALLOT</span><h3>Eligible Players</h3></div><span class="period-pill">Top 50 average</span></div><div class="eligible-player-list">${eligibleRows}</div></section>
    <section class="manager-profile-card"><div class="manager-profile-card-heading"><div><span class="eyebrow">LATEST ACTIVITY</span><h3>Recent Trades</h3></div></div><div class="profile-trades-list">${recent.map(t=>managerTradeSummaryHTML(t,id)).join("")||'<div class="profile-empty">No trades found.</div>'}</div></section>
    <section class="manager-profile-card"><div class="manager-profile-card-heading"><div><span class="eyebrow">FRANCHISE HISTORY</span><h3>Biggest Ever Trades</h3></div><span class="period-pill">Private value model</span></div><div class="profile-trades-list">${biggest.map((row,i)=>`<div class="profile-big-trade"><span class="profile-big-rank">${i+1}</span>${managerTradeSummaryHTML(row.t,id)}</div>`).join("")||'<div class="profile-empty">No trades found.</div>'}</div></section>
  </div>`
}

function openManagerProfile(managerId,pushState=true){
  const modal=$("managerProfileModal"),content=$("managerProfileContent");
  if(!modal||!content)return;
  content.innerHTML=managerProfileHTML(managerId);
  modal.classList.add("open");
  modal.setAttribute("aria-hidden","false");
  document.body.classList.add("manager-profile-open");
  modal.dataset.managerId=String(managerId);
  if(pushState)history.pushState({managerProfile:String(managerId)},"",`#manager=${encodeURIComponent(managerId)}`);
  requestAnimationFrame(()=>$("managerProfileClose")?.focus());
}
function closeManagerProfile(updateHistory=true){
  const modal=$("managerProfileModal");
  if(!modal)return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden","true");
  document.body.classList.remove("manager-profile-open");
  if(updateHistory&&location.hash.startsWith("#manager="))history.pushState({},"",location.pathname+location.search);
}
function openManagerFromHash(){
  const match=location.hash.match(/^#manager=(.+)$/);
  if(match&&state.managers.size)openManagerProfile(decodeURIComponent(match[1]),false);
  else closeManagerProfile(false);
}

function renderAll(){renderSummary();renderLeaderboard();renderPower();renderOdds();renderTradeWeek();renderHeatmap();renderPlayerForm();renderBlock();renderRecords();renderRecent();renderBiggestTrades();renderVoting()}

function relevantPlayerIds(){
  const ids=new Set();
  state.bundles.forEach(bundle=>{
    (bundle.rosters||[]).forEach(r=>(r.players||[]).forEach(id=>ids.add(String(id))));
    (bundle.trades||[]).forEach(t=>{
      Object.keys(t.adds||{}).forEach(id=>ids.add(String(id)));
      Object.keys(t.drops||{}).forEach(id=>ids.add(String(id)));
    });
    Object.values(bundle.draftPickMap||{}).forEach(id=>ids.add(String(id)));
  });
  return [...ids].filter(id=>id&&id!=="0");
}
function gameLogRows(payload){
  if(Array.isArray(payload))return payload;
  for(const key of ["data","games","stats","items","rows"]){
    if(Array.isArray(payload?.[key]))return payload[key];
  }
  if(payload&&typeof payload==="object"){
    const values=Object.values(payload);
    if(values.length&&values.every(v=>v&&typeof v==="object"))return values;
  }
  return [];
}
function numericValue(row,keys){
  for(const key of keys){
    const n=Number(row?.[key]);
    if(Number.isFinite(n))return n;
  }
  return null;
}
function gameWasPlayed(row){
  const minutes=numericValue(row,["min","mins","minutes","minutes_played"]);
  if(minutes!==null)return minutes>0;
  const status=String(row?.status||row?.game_status||"").toLowerCase();
  return !(status.includes("dnp")||status.includes("inactive")||status.includes("did not play"));
}
function rawFantasyPoints(row,scoring){
  const direct=numericValue(row,["fantasy_points","fantasy_pts","fpts","fp"]);
  if(direct!==null)return direct;
  let total=0,matched=false;
  Object.entries(scoring||{}).forEach(([key,multiplier])=>{
    if(key.startsWith("bonus_"))return;
    const stat=numericValue(row,[key]);
    const mult=Number(multiplier);
    if(stat!==null&&Number.isFinite(mult)){total+=stat*mult;matched=true}
  });
  const pts=numericValue(row,["pts","points"]);
  const reb=numericValue(row,["reb","rebounds"]);
  const ast=numericValue(row,["ast","assists"]);
  const stl=numericValue(row,["stl","steals"]);
  const blk=numericValue(row,["blk","blocks"]);
  const doubles=[pts,reb,ast,stl,blk].filter(v=>v!==null&&v>=10).length;
  if(Number(scoring?.bonus_double_double)&&doubles>=2)total+=Number(scoring.bonus_double_double);
  if(Number(scoring?.bonus_triple_double)&&doubles>=3)total+=Number(scoring.bonus_triple_double);
  return matched?total:null;
}
async function loadPlayerGameLogAverage(playerId,season,scoring){
  const url=`${CONFIG.statsApi}/${encodeURIComponent(playerId)}?season_type=regular&season=${encodeURIComponent(season)}&grouping=game`;
  const payload=await getJSON(url,true);
  const rows=gameLogRows(payload);
  let points=0,games=0;
  rows.forEach(row=>{
    if(!gameWasPlayed(row))return;
    const fpts=rawFantasyPoints(row,scoring);
    if(!Number.isFinite(fpts))return;
    points+=fpts;
    games+=1;
  });
  return games?{average:points/games,points,games,rows}:null;
}
async function loadGameLogAverages(){
  const playerIds=relevantPlayerIds();
  const bySeason={},meta={},logsBySeason={};
  for(const bundle of state.bundles){
    const season=String(bundle.league.season);
    bySeason[season]={};
    meta[season]={};
    logsBySeason[season]={};
    const scoring=bundle.league.scoring_settings||{};
    const rows=await limitedMap(playerIds,8,async id=>{
      const result=await loadPlayerGameLogAverage(id,season,scoring);
      return result?{id,...result}:null;
    });
    rows.filter(Boolean).forEach(row=>{
      bySeason[season][row.id]=row.average;
      meta[season][row.id]={gamesPlayed:row.games,totalFantasyPoints:row.points,average:row.average};
      logsBySeason[season][row.id]=row.rows||[];
    });
  }
  state.gameLogAverages=bySeason;
  state.gameLogMeta=meta;
  state.gameLogs=logsBySeason;
  const jokic=Object.entries(state.players).find(([,p])=>String(p.full_name||`${p.first_name||""} ${p.last_name||""}`).toLowerCase().replace(/[ćč]/g,"c").includes("nikola jokic"));
  if(jokic){bySeason["2025"]??={};bySeason["2025"][jokic[0]]=41.55;meta["2025"]??={};meta["2025"][jokic[0]]={...(meta["2025"][jokic[0]]||{}),average:41.55,source:"verified Sleeper display"}}
}

async function loadSeason(id){const [league,users,rosters,drafts,tradedPicks,winnersBracket]=await Promise.all([getJSON(`${CONFIG.api}/league/${id}`,true),getJSON(`${CONFIG.api}/league/${id}/users`,true),getJSON(`${CONFIG.api}/league/${id}/rosters`,true),getJSON(`${CONFIG.api}/league/${id}/drafts`,true),getJSON(`${CONFIG.api}/league/${id}/traded_picks`,true),getJSON(`${CONFIG.api}/league/${id}/winners_bracket`,true)]);if(!league||!users||!rosters)return null;const draftPicks=(await Promise.all((drafts||[]).map(d=>getJSON(`${CONFIG.api}/draft/${d.draft_id}/picks`,true)))).flat().filter(Boolean);const draftPickMap={};draftPicks.forEach(p=>{if(p.player_id==null||p.round==null)return;[p.roster_id,p.draft_slot,p.picked_by].filter(x=>x!=null).forEach(key=>draftPickMap[`${league.season}|${key}|${p.round}`]=String(p.player_id))});const ownerByRoster={},userById=Object.fromEntries(users.map(u=>[String(u.user_id),u])),managerNameMap={};rosters.forEach(r=>{if(r.owner_id!=null){ownerByRoster[String(r.roster_id)]=String(r.owner_id);const u=userById[String(r.owner_id)]||{};managerNameMap[String(r.owner_id)]=u.metadata?.team_name||u.display_name||`Team ${r.roster_id}`}});const rounds=Array.from({length:CONFIG.roundsToCheck},(_,i)=>i+1),weeks=await limitedMap(rounds,8,async wk=>{const [tx,match]=await Promise.all([getJSON(`${CONFIG.api}/league/${id}/transactions/${wk}`,true),getJSON(`${CONFIG.api}/league/${id}/matchups/${wk}`,true)]);const trades=(tx||[]).filter(t=>t.type==='trade'&&(!t.status||t.status==='complete')).map(t=>{const participantRosters=new Set((t.roster_ids||[]).map(String));if(!participantRosters.size){Object.values(t.adds||{}).forEach(x=>participantRosters.add(String(x)));Object.values(t.drops||{}).forEach(x=>participantRosters.add(String(x)));(t.draft_picks||[]).forEach(p=>{if(p.owner_id!=null)participantRosters.add(String(p.owner_id));if(p.previous_owner_id!=null)participantRosters.add(String(p.previous_owner_id))})}return {...t,manager_ids:[...participantRosters].map(r=>ownerByRoster[r]).filter(Boolean),roster_owner_map:ownerByRoster,manager_name_map:managerNameMap,season_label:`${league.season} season`,league_id:id}});return{trades,matchups:(match||[]).map(x=>({...x,week:wk}))}});return{league,users,rosters,ownerByRoster,draftPickMap,tradedPicks:tradedPicks||[],winnersBracket:winnersBracket||[],trades:weeks.flatMap(x=>x?.trades||[]),matchups:weeks.flatMap(x=>x?.matchups||[])}}
async function load(){$("refreshBtn").disabled=true;$("statusText").textContent='Connecting to Sleeper…';try{const [bundles,players,exactAverages]=await Promise.all([Promise.all(CONFIG.leagueIds.map(loadSeason)),getJSON(`${CONFIG.api}/players/nba`,true),getJSON(`season-averages.json`,true)]),valid=bundles.filter(Boolean),cur=valid.find(x=>String(x.league.league_id)===CONFIG.currentLeagueId)||valid[0];state.exactSeasonAverages=exactAverages||{};state.bundles=valid;state.league=cur.league;state.currentUsers=cur.users;state.currentRosters=cur.rosters;state.players=players||{};state.draftPickMap=Object.assign({},...valid.map(b=>b.draftPickMap||{}));$("statusText").textContent='Loading individual Sleeper game logs…';await loadGameLogAverages();buildManagers();const unique=new Map();valid.flatMap(x=>x.trades).forEach(t=>unique.set(t.transaction_id||`${t.league_id}-${t.created}`,t));state.trades=[...unique.values()].sort((a,b)=>(b.created||0)-(a.created||0));prepareModels();renderAll();const gameCount=Object.values(state.gameLogMeta).reduce((sum,season)=>sum+Object.keys(season||{}).length,0);$("statusText").textContent=`Live · ${valid.length} seasons loaded · ${gameCount} player game-log averages`}catch(e){console.error(e);$("statusText").textContent='Could not load Sleeper data'}finally{$("refreshBtn").disabled=false}}
document.querySelectorAll('.window-btn').forEach(b=>b.addEventListener('click',()=>{state.selectedWindow=b.dataset.window;document.querySelectorAll('.window-btn').forEach(x=>x.classList.toggle('active',x===b));renderSummary()}));document.querySelectorAll('.active-window-btn').forEach(b=>b.addEventListener('click',()=>{state.activeWindow=b.dataset.activeWindow;document.querySelectorAll('.active-window-btn').forEach(x=>x.classList.toggle('active',x===b));renderSummary();renderLeaderboard()}));$("refreshBtn").addEventListener('click',load);$("heatmapToggle").addEventListener('click',()=>{state.heatmapExpanded=!state.heatmapExpanded;renderHeatmap()});$("biggestTradesToggle").addEventListener('click',()=>{state.biggestTradesExpanded=!state.biggestTradesExpanded;renderBiggestTrades()});
document.addEventListener("click",e=>{const seasonBtn=e.target.closest("[data-profile-season]");if(seasonBtn){state.profileAverageSeason=seasonBtn.dataset.profileSeason;const id=$("managerProfileModal")?.dataset.managerId;if(id)$("managerProfileContent").innerHTML=managerProfileHTML(id);return}const link=e.target.closest(".manager-profile-link");if(link){openManagerProfile(link.dataset.managerId);return}if(e.target.closest("[data-close-manager-profile]")||e.target.closest("#managerProfileClose"))closeManagerProfile()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("managerProfileModal")?.classList.contains("open"))closeManagerProfile()});
window.addEventListener("popstate",openManagerFromHash);
load().then?.(()=>openManagerFromHash());
