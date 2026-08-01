/* IMO DYNASTY V3.3.15 — Live Head To Head + Waiver History */
const CONFIG={currentLeagueId:"1341763186407276544",leagueIds:["1341763186407276544","1212553673821929472","1138349648558624768"],api:"https://api.sleeper.app/v1",statsApi:"https://api.sleeper.com/stats/nba/player",bulkStatsApi:"https://api.sleeper.com/stats/nba",roundsToCheck:60,bookmakerMargin:1.08,oddsBaseline:.25,oddsExponent:2,maxDisplayedOdds:51,voteEndpoint:"",votingOpens:"2027-02-23T00:00:00+08:00",votingCloses:"2027-03-01T00:00:00+08:00",awardsAnnounced:"2027-03-01T12:00:00+08:00"};

// Completed-draft column ownership is the source of truth for converting a
// traded historical pick into the player it became. Sleeper's drafter/current
// owner fields are deliberately ignored for these overrides.
const CANONICAL_DRAFT_COLUMNS={
  "2026":{
    "thehouseofpatience":1,
    "marajuana":2,
    "chetanyahu":3,
    "flintlovesmesexy":4,
    "sengooning":5,
    "muzandmuzptyltd":6,
    "melbournelongnecks":7,
    "thanos":8
  }
};
function normaliseTeamKey(name){return String(name||"").toLowerCase().replace(/[^a-z0-9]/g,"")}
function canonicalDraftSlot(season,teamName){return CANONICAL_DRAFT_COLUMNS[String(season)]?.[normaliseTeamKey(teamName)]??null}

const state={league:null,currentUsers:[],currentRosters:[],managers:new Map(),trades:[],selectedWindow:"14",players:{},bundles:[],modelBundle:null,playerAverages:{},previousPowerRanks:{},heatmapExpanded:false,draftPickMap:{},previousPlayerAverages:{},votePlayers:[],activeWindow:"14",biggestTradesExpanded:false,profileAverageSeason:"2025",exactSeasonAverages:{},gameLogAverages:{},gameLogMeta:{},seasonTotalAverages:{},seasonTotalMeta:{},gameLogs:{},playerInterest:[],profileHTMLCache:new Map(),profilePrewarmQueued:false,profileBuilds:new Map(),statsRequestCache:new Map(),seasonTotalsLoading:false,draftSelections:[],allDraftSelections:[],oddsMovement:null,sportState:null,h2hRefreshTimer:null,h2hRefreshBusy:false,computedCache:{seasonAverages:new Map(),managerTrades:new Map(),tradeSide:new Map(),completedMatchups:new Map(),tendencyLeague:null,managerGrades:null}};
const $=id=>document.getElementById(id),WL={"14":"14 days","28":"28 days","season":"2026 season","all":"All time"};
try{for(let i=sessionStorage.length-1;i>=0;i--){const key=sessionStorage.key(i);if(key&&key.startsWith('imo-profile-')&&!key.startsWith('imo-profile-v337-'))sessionStorage.removeItem(key)}}catch(_){ }
function resetComputedCaches(){state.computedCache.seasonAverages.clear();state.computedCache.managerTrades.clear();state.computedCache.tradeSide.clear();state.computedCache.completedMatchups.clear();state.computedCache.tendencyLeague=null;state.computedCache.managerGrades=null;state.profileHTMLCache.clear()}
async function getJSON(url,optional=false){try{const r=await fetch(url);if(!r.ok)throw new Error(r.status);return await r.json()}catch(e){if(optional)return null;throw e}}
async function statsJSON(url){if(state.statsRequestCache.has(url))return state.statsRequestCache.get(url);const request=getJSON(url,true).finally(()=>{});state.statsRequestCache.set(url,request);return request}
async function limitedMap(items,limit,fn){const out=new Array(items.length);let n=0;async function run(){while(n<items.length){const i=n++;try{out[i]=await fn(items[i])}catch{out[i]=null}}}await Promise.all(Array.from({length:limit},run));return out}
function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function fmt(ts,short=false){return ts?new Intl.DateTimeFormat("en-AU",short?{day:"numeric",month:"short"}:{day:"numeric",month:"short",year:"numeric"}).format(new Date(ts)):"Unknown"}
function buildManagers(){const users=Object.fromEntries(state.currentUsers.map(x=>[String(x.user_id),x]));state.managers.clear();state.currentRosters.forEach(r=>{const u=users[String(r.owner_id)]||{},name=u.metadata?.team_name||u.display_name||`Team ${r.roster_id}`,profileAvatar=u.avatar,avatar=profileAvatar?`https://sleepercdn.com/avatars/${profileAvatar}`:null;state.managers.set(String(r.owner_id),{id:String(r.owner_id),name,roster:r,avatar,initials:name.split(/\s+/).slice(0,2).map(z=>z[0]).join("").toUpperCase()})})}
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
function outcomesForBundle(bundle,throughWeek=Infinity){const rows=matchupRows(bundle,throughWeek),byWeek={};rows.forEach(x=>(byWeek[x.week]??=[]).push(x));const out={};Object.values(byWeek).forEach(weekRows=>{const groups={};weekRows.forEach(x=>{if(x.matchup_id!=null)(groups[x.matchup_id]??=[]).push(x)});Object.values(groups).forEach(g=>{if(g.length<2)return;const scores=g.map(x=>Number(x.points));if(scores.some(x=>!Number.isFinite(x))||scores.every(x=>x===0))return;const max=Math.max(...scores),ties=scores.filter(x=>x===max).length;g.forEach((x,i)=>{const owner=bundle.ownerByRoster[String(x.roster_id)];if(!owner)return;(out[owner]??=[]).push({week:x.week,points:scores[i],result:scores[i]===max?(ties>1?.5:1):0})})})});return out}
function minMax(value,values,higher=true){const nums=values.filter(Number.isFinite);if(!nums.length)return .5;const min=Math.min(...nums),max=Math.max(...nums);if(max===min)return .5;const n=(value-min)/(max-min);return higher?n:1-n}
function standingsTable(bundle,throughWeek=Infinity){const outcomes=outcomesForBundle(bundle,throughWeek);return [...state.managers.values()].map(m=>{const games=outcomes[m.id]||[],wins=games.reduce((s,g)=>s+g.result,0),pts=games.reduce((s,g)=>s+g.points,0);return {...m,wins,games:games.length,pts}}).sort((a,b)=>b.wins-a.wins||b.pts-a.pts||a.name.localeCompare(b.name)).map((x,i)=>({...x,standingRank:i+1}))}
function modelRows(bundle,throughWeek=Infinity,mode="power"){const standings=standingsTable(bundle,throughWeek),outcomes=outcomesForBundle(bundle,throughWeek),teamCount=Math.max(standings.length,1);const raw=standings.map(team=>{const games=outcomes[team.id]||[],formN=mode==="odds"?5:3,recent=games.slice(-formN),last5=games.slice(-5),form=recent.length?recent.reduce((s,g)=>s+g.result,0)/recent.length:0,avg5=last5.length?last5.reduce((s,g)=>s+g.points,0)/last5.length:0,ladder=teamCount===1?1:1-(team.standingRank-1)/(teamCount-1),streak=winningStreak(games);return {...team,form,avg5,ladder,streak}});const avgs=raw.map(x=>x.avg5);return raw.map(x=>{const avgNorm=minMax(x.avg5,avgs,true),score=mode==="odds"?x.form*.50+avgNorm*.25+x.ladder*.25:x.ladder*.35+x.form*.35+avgNorm*.30;return {...x,score}}).sort((a,b)=>b.score-a.score||b.avg5-a.avg5||a.name.localeCompare(b.name)).map((x,i)=>({...x,rank:i+1}))}
function winningStreak(games){let n=0;for(let i=games.length-1;i>=0;i--){if(games[i].result===1)n++;else break}return n}
function calculatedPlayerAverages(bundle,throughWeek=Infinity){const sums={},games={};matchupRows(bundle,throughWeek).forEach(row=>Object.entries(row.players_points||{}).forEach(([id,v])=>{const pts=Number(v);if(!Number.isFinite(pts)||pts<=0)return;sums[id]=(sums[id]||0)+pts;games[id]=(games[id]||0)+1}));return Object.fromEntries(Object.keys(sums).map(id=>[id,games[id]?sums[id]/games[id]:0]))}
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
function prepareModels(){state.modelBundle=selectModelBundle();const weeks=meaningfulWeeks(state.modelBundle),last=weeks.at(-1)||Infinity,prior=weeks.length>1?weeks.at(-2):last;state.previousPowerRanks=Object.fromEntries(modelRows(state.modelBundle,prior,"power").map(x=>[x.id,x.rank]));state.playerAverages=buildPlayerAverages(state.modelBundle,last)}
function playerName(id){const p=state.players[id]||{};return p.full_name||[p.first_name,p.last_name].filter(Boolean).join(" ")||`Player ${id}`}
function playerLink(id,name=playerName(id),className=""){return `<button type="button" class="player-history-link ${className}" data-player-id="${esc(String(id))}">${esc(name)}</button>`}
function pickOriginalOwner(p,t){const owner=t.roster_owner_map?.[String(p.roster_id)];return owner?managerName(owner,t):null}
function roundWord(n){return ({1:"First",2:"Second",3:"Third",4:"Fourth",5:"Fifth"})[Number(n)]||`Round ${n}`}
function draftedPlayerForPick(p){
  const season=String(p.season),round=String(p.round);
  // A traded pick belongs to its original roster slot. Current/previous owner
  // IDs must never be used here, otherwise a manager who used a traded 1.02
  // can make that player appear as their own 1.08 selection.
  const originalSlot=p.roster_id??p.original_roster_id;
  if(originalSlot==null)return null;
  return state.draftPickMap[`${season}|${String(originalSlot)}|${round}`]||null
}
function fixedPickValue(round){
  round=Number(round);
  return round===1?17.5:round===2?2.5:round===3?2:round===4?1:round===5?.5:0
}
function bundleForSeason(season){return state.bundles.find(b=>String(b.league?.season)===String(season))||null}
function bundleForTrade(t){return state.bundles.find(b=>String(b.league?.league_id)===String(t.league_id))||bundleForSeason(String(t.season_label||"").match(/\d{4}/)?.[0])||null}
function latestKnownAverage(playerId){for(const bundle of [...state.bundles].sort((a,b)=>Number(b.league?.season)-Number(a.league?.season))){const weeks=meaningfulWeeks(bundle);if(!weeks.length)continue;const avg=Number(buildPlayerAverages(bundle,weeks.at(-1))[playerId]||0);if(avg>0)return avg}return Number(state.playerAverages[playerId]||0)}
function playerSeasonAverage(playerId,season){const bundle=bundleForSeason(season);if(!bundle)return 0;const weeks=meaningfulWeeks(bundle);return weeks.length?Number(buildPlayerAverages(bundle,weeks.at(-1))[playerId]||0):0}
function tradeSeasonAverage(playerId,t){const bundle=bundleForTrade(t);if(bundle){const weeks=meaningfulWeeks(bundle);if(weeks.length){const avg=Number(buildPlayerAverages(bundle,weeks.at(-1))[playerId]||0);if(avg>0)return avg}}return latestKnownAverage(playerId)}
function playerAgeAt(playerId,timestamp){const p=state.players[playerId]||{},at=new Date(Number(timestamp)||Date.now()),raw=p.birth_date||p.birthdate||p.dob;if(raw){const born=new Date(raw);if(!Number.isNaN(born.getTime())){let age=at.getFullYear()-born.getFullYear();if(at.getMonth()<born.getMonth()||(at.getMonth()===born.getMonth()&&at.getDate()<born.getDate()))age--;return Math.max(18,age)}}const currentAge=Number(p.age);if(Number.isFinite(currentAge))return Math.max(18,currentAge-(new Date().getFullYear()-at.getFullYear()));return 28}
function ageMultiplier(age){if(age<=19)return 1.18;if(age===20)return 1.20;if(age===21)return 1.22;if(age===22)return 1.23;if(age===23)return 1.24;if(age===24||age===25)return 1.25;if(age===26)return 1.24;if(age===27)return 1.22;if(age===28)return 1.18;if(age===29)return 1.12;if(age===30)return 1.05;if(age===31)return .98;if(age===32)return .92;if(age===33)return .88;if(age===34)return .84;if(age===35)return .80;return .76}
function eliteMultiplier(avg){if(avg>=40)return 1.40;if(avg>=35)return 1.28;if(avg>=30)return 1.18;if(avg>=25)return 1.10;if(avg>=20)return 1.05;if(avg>=10)return 1.02;return 1}
function playerDynastyValue(playerId,average,timestamp){const avg=Number(average)||0;return avg>0?avg*ageMultiplier(playerAgeAt(playerId,timestamp))*eliteMultiplier(avg):0}
function topTenSeasonAverageIds(t){
  // Use the trade season when actual games exist. During a preseason or when a
  // historical bundle is incomplete, fall back to the latest loaded season
  // with meaningful player averages so elite-player premiums never disappear.
  const candidates=[];
  const tradeBundle=bundleForTrade(t);
  if(tradeBundle)candidates.push(tradeBundle);
  [...state.bundles]
    .sort((a,b)=>Number(b.league?.season)-Number(a.league?.season))
    .forEach(bundle=>{if(!candidates.includes(bundle))candidates.push(bundle)});
  for(const bundle of candidates){
    const weeks=meaningfulWeeks(bundle);
    if(!weeks.length)continue;
    const averages=buildPlayerAverages(bundle,weeks.at(-1));
    const ranked=Object.entries(averages)
      .filter(([,avg])=>Number(avg)>0)
      .sort((a,b)=>Number(b[1])-Number(a[1]));
    if(ranked.length>=10)return new Set(ranked.slice(0,10).map(([id])=>String(id)));
  }
  const fallback=Object.entries(state.playerAverages||{})
    .filter(([,avg])=>Number(avg)>0)
    .sort((a,b)=>Number(b[1])-Number(a[1]))
    .slice(0,10)
    .map(([id])=>String(id));
  return new Set(fallback)
}
function tradePlayerValue(playerId,average,t){
  const base=playerDynastyValue(playerId,average,t.created);
  return topTenSeasonAverageIds(t).has(String(playerId))?base*1.20:base
}
function tradeAssets(t){const by={};mids(t).forEach(id=>by[id]=[]);Object.entries(t.adds||{}).forEach(([pid,rid])=>{const mid=t.roster_owner_map?.[String(rid)];if(!mid||!by[mid])return;const average=tradeSeasonAverage(pid,t);by[mid].push({type:"player",id:pid,name:playerName(pid),value:tradePlayerValue(pid,average,t),average,topTenBonus:topTenSeasonAverageIds(t).has(String(pid))})});(t.draft_picks||[]).forEach(p=>{const mid=t.roster_owner_map?.[String(p.owner_id)];if(!mid||!by[mid])return;const round=Number(p.round),season=p.season||"Future",original=pickOriginalOwner(p,t),drafted=draftedPlayerForPick(p),pickLabel=`${season} ${roundWord(round)} Round Pick${original?` ${original}`:""}`;const value=fixedPickValue(round),average=0;by[mid].push({type:"pick",id:drafted||null,pickKey:pickAssetKey(p),pick:{...p,_trade:t},name:drafted?`${playerName(drafted)} (${pickLabel})`:`${season} Round ${round} Pick`,owner:drafted?null:original,value,average})});return by}
function tradeValue(t){return Object.values(tradeAssets(t)).flat().reduce((sum,asset)=>sum+(Number(asset.value)||0),0)}

function tradeOutgoingAssets(t){
  const by={};mids(t).forEach(id=>by[id]=[]);
  Object.entries(t.drops||{}).forEach(([pid,rid])=>{const mid=t.roster_owner_map?.[String(rid)];if(!mid||!by[mid])return;const average=tradeSeasonAverage(pid,t);by[mid].push({type:"player",id:pid,name:playerName(pid),value:tradePlayerValue(pid,average,t),average,age:playerAgeAt(pid,t.created),topTenBonus:topTenSeasonAverageIds(t).has(String(pid))})});
  (t.draft_picks||[]).forEach(p=>{const mid=t.roster_owner_map?.[String(p.previous_owner_id)];if(!mid||!by[mid])return;const round=Number(p.round),season=p.season||"Future",drafted=draftedPlayerForPick(p),value=fixedPickValue(round),average=0;by[mid].push({type:"pick",id:drafted||null,name:drafted?playerName(drafted):`${season} Round ${round} Pick`,value,average,age:drafted?playerAgeAt(drafted,t.created):20})});
  return by
}
function tradeSideMetrics(t,managerId){
  const id=String(managerId),tradeKey=String(t.transaction_id||`${t.league_id||''}-${t.created||''}`),cacheKey=`${tradeKey}|${id}`;
  if(state.computedCache.tradeSide.has(cacheKey))return state.computedCache.tradeSide.get(cacheKey);
  const received=tradeAssets(t)[id]||[],outgoing=tradeOutgoingAssets(t)[id]||[];
  let sent=outgoing;
  if(!sent.length&&mids(t).length===2){const other=mids(t).find(x=>String(x)!==id);sent=tradeAssets(t)[other]||[]}
  const rawReceivedValue=received.reduce((sum,a)=>sum+(Number(a.value)||0),0),rawSentValue=sent.reduce((sum,a)=>sum+(Number(a.value)||0),0);
  const allPlayers=Object.values(tradeAssets(t)).flat().filter(a=>a.type==='player').sort((a,b)=>(Number(b.value)||0)-(Number(a.value)||0));
  const bestPlayer=allPlayers[0]||null,nextBest=allPlayers[1]||null;
  const bestReceived=Boolean(bestPlayer&&received.some(a=>a.type==='player'&&String(a.id)===String(bestPlayer.id)));
  const bestRatio=bestPlayer&&nextBest&&Number(nextBest.value)>0?Number(bestPlayer.value)/Number(nextBest.value):bestPlayer?Infinity:1;
  // The grade floor is determined strictly by relative player value. Do not
  // require an arbitrary minimum value, as missing/partial historical feeds can
  // otherwise disable the protection for an obvious superstar acquisition.
  const clearCentrepiece=Boolean(bestReceived&&bestRatio>=1.15);

  // Star premium: the clear best player carries 10% extra effective value.
  const starBonus=clearCentrepiece?Number(bestPlayer.value)*0.10:0;

  // Consolidation premium: reward the side turning a larger outgoing package into fewer incoming assets.
  // This stacks only when the side also secured the clear best player in the deal.
  const assetReduction=Math.max(0,sent.length-received.length);
  const consolidationRate=clearCentrepiece?(assetReduction>=3?0.10:assetReduction===2?0.08:assetReduction===1?0.05:0):0;
  const consolidationBonus=rawReceivedValue*consolidationRate;

  // Keep the combined contextual lift meaningful but controlled.
  const contextualBonus=Math.min(rawReceivedValue*0.18,starBonus+consolidationBonus);
  const adjustedReceivedValue=rawReceivedValue+contextualBonus;
  const average=(adjustedReceivedValue+rawSentValue)/2;
  const edge=average>0?(adjustedReceivedValue-rawSentValue)/average*100:0;
  const net=adjustedReceivedValue-rawSentValue;

  const result={id,received,sent,receivedValue:rawReceivedValue,sentValue:rawSentValue,adjustedReceivedValue,edge,net,bestReceived,bestPlayer,clearCentrepiece,bestRatio,starBonus,consolidationRate,consolidationBonus,contextualBonus,assetReduction};
  state.computedCache.tradeSide.set(cacheKey,result);
  return result
}
function packageGradePoints(edge,net){
  let points=edge>=45?10:edge>=32?9:edge>=20?8:edge>=9?7:edge>=2?6:edge>=-9?5:edge>=-19?4:edge>=-31?3:2;
  // Small-value trades cannot produce sensational grades solely from percentage swings.
  if(points>=9&&net<12)points=net>=8?8:net>=4?7:6;
  if(points===8&&net<7)points=net>=4?7:net>=2?6:5;
  if(points===7&&net<3)points=6;
  if(points<=2&&net>-18)points=3;
  return points
}
function gradeFromPoints(points,m){
  // A+ is reserved for genuinely meaningful wins, not tiny percentage steals.
  // A low-value player acquired for a late pick can still grade very well, but
  // needs a substantial absolute gain or a truly premium centrepiece to reach A+.
  const totalDealValue=m.receivedValue+m.sentValue;
  const premiumCentrepiece=Boolean(m.clearCentrepiece&&Number(m.bestPlayer?.value||0)>=25);
  const meaningfulAPlus=points>=10&&m.net>=10&&totalDealValue>=20&&(
    (m.edge>=40&&m.net>=18)||
    (premiumCentrepiece&&m.edge>=24&&m.net>=12)
  );
  if(meaningfulAPlus)return'A+';
  if(points>=9)return'A';
  if(points>=8)return'B+';
  if(points>=7)return'B';
  if(points>=6)return'C+';
  if(points>=5)return'C';
  if(points>=4)return'D+';
  if(points>=3)return'D';
  if(m.edge<=-48&&m.net<=-25&&!m.clearCentrepiece)return'FLEECE ALERT 🚨';
  return'F';
}
function stableIndex(key,length){let h=2166136261;for(const c of String(key)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return Math.abs(h>>>0)%Math.max(1,length)}
const TRADE_COMMENTS={
  'A+':['A premium result, combining a standout return with excellent deal structure.','Exceptional business — this side secured the headline asset and protected its overall position.','A rare top-tier outcome that delivers both quality and value.','Outstanding work, landing the centrepiece without losing control of the deal.'],
  'A':['A strong result that meaningfully improves this roster.','Excellent business, with the return comfortably justifying the cost.','A high-quality move built around a clear advantage.','They leave the table in a notably stronger position.'],
  'B+':['A strong return that gives this side a clear advantage.','Smart business, with the better overall package coming back.','A tidy win that strengthens the roster without a major overpay.','They came away comfortably ahead while addressing a genuine need.','A quality deal that leaves this franchise in the stronger position.','Good negotiating — the return outweighs what was sent out.'],
  'B':['A useful win, with a little more coming back than went out.','Solid work — the trade improves this roster without creating a major weakness.','A positive result that quietly moves the team in the right direction.','Good business, with the incoming package earning a meaningful edge.','A sensible move that delivers more upside than risk.'],
  'C+':['Almost even, but this side earns the slightest advantage.','A balanced exchange with a small edge in their favour.','Little separates the packages, though this return just shades it.','A fair trade that leans narrowly toward this side.'],
  'C':['A balanced exchange with very little separating the two sides.','Fair business — each side can make a credible case for the deal.','A needs-based move with no obvious loser.','Close enough to call even, with the outcome likely decided over time.'],
  'D+':['A small overpay, though the move remains easy enough to justify.','They gave up a little extra, but the roster fit softens the damage.','Slightly expensive, without becoming a serious mistake.','The price was a touch high, though the return still has a clear purpose.'],
  'D':['A noticeable overpay, but not one that cannot be justified.','The outgoing package carries more weight, placing pressure on the return.','They paid above the going rate and will need the incoming assets to deliver.','A clear disadvantage on the exchange, though the logic remains understandable.'],
  'F':['A major overpay, with a sizeable gap between cost and return.','This one is difficult to defend — too much went out the door.','A significant value loss that places enormous pressure on the incoming assets.','They surrendered the stronger package by a considerable margin.'],
  'FLEECE ALERT 🚨':['FLEECE ALERT 🚨 Trade authorities have been notified after a landslide result.','FLEECE ALERT 🚨 A brutal gap makes this one almost impossible to defend.','FLEECE ALERT 🚨 One side walked away with the keys, the car and the registration.','FLEECE ALERT 🚨 This was less a negotiation and more a daylight robbery.']
};
function tradeGrade(t,managerId){
  const m=tradeSideMetrics(t,managerId),base=packageGradePoints(m.edge,m.net);
  let final=base,grade=gradeFromPoints(final,m);
  const isConsolidation=m.assetReduction>0;
  const gradeRank={'FLEECE ALERT 🚨':0,'F':1,'D':2,'D+':3,'C':4,'C+':5,'B':6,'B+':7,'A':8,'A+':9};
  // Apply the superstar protections LAST, after every raw-value and contextual
  // calculation. This guarantees the displayed grade can never bypass them.
  if(m.bestReceived&&m.bestRatio>=1.30&&isConsolidation&&(gradeRank[grade]??0)<gradeRank.B)grade='B';
  else if(m.bestReceived&&m.bestRatio>=1.15&&(gradeRank[grade]??0)<gradeRank.C)grade='C';
  const comments=TRADE_COMMENTS[grade]||TRADE_COMMENTS.C;
  return{...m,base,final,grade,comment:comments[stableIndex(`${t.transaction_id||t.created}|${managerId}|${grade}`,comments.length)]}
}
function tradeGrades(t){return mids(t).map(id=>tradeGrade(t,id))}
function winWinTrade(t){const grades=tradeGrades(t),rank={'A+':10,'A':9,'B+':8,'B':7,'C+':6,'C':5,'D+':4,'D':3,'F':2,'FLEECE ALERT 🚨':0};return grades.length>=2&&grades.every(g=>(rank[g.grade]||0)>=7)}
function gradeClass(grade){return grade.startsWith('A')?'grade-a':grade.startsWith('B')?'grade-b':grade.startsWith('C')?'grade-c':grade.startsWith('D')?'grade-d':'grade-f'}
function tradeEditorialHTML(t,compact=false){const grades=tradeGrades(t),winwin=winWinTrade(t);return `<div class="trade-editorial ${compact?'compact':''}">${winwin?'<div class="win-win-label">🤝 WIN-WIN TRADE</div>':''}${grades.map(g=>{const badge=compact&&g.grade==='FLEECE ALERT 🚨'?'FLEECE':g.grade;const comment=compact&&g.grade==='FLEECE ALERT 🚨'?g.comment.replace(/^FLEECE ALERT 🚨\s*/,''):g.comment;return `<div class="trade-grade-row"><span class="trade-grade-team">${esc(managerName(g.id,t))}</span><span class="trade-grade-badge ${gradeClass(g.grade)}">${esc(badge)}</span><span class="trade-grade-comment">${esc(comment)}</span></div>`}).join('')}</div>`}
function tradeSummary(t){const assets=Object.values(tradeAssets(t)).flat().filter(a=>a.type==='player').map(a=>a.name);const core=assets.slice(0,3).join(' / ')||'Draft-pick trade';return core}
function tradeAssetLinkHTML(asset,className=''){
  if(asset?.type==='player'&&asset.id)return playerLink(asset.id,asset.name,className);
  if(asset?.type==='pick'&&asset.pickKey)return pickHistoryLink(asset.pickKey,asset.name,`pick-history-link ${className}`.trim());
  return esc(asset?.name||'Unknown asset')
}
function tradeSummaryLinksHTML(t){
  const assets=Object.values(tradeAssets(t)).flat().sort((a,b)=>Number(b.value||0)-Number(a.value||0)).slice(0,3);
  return assets.length?assets.map(a=>tradeAssetLinkHTML(a,'trade-summary-asset-link')).join('<span class="trade-summary-separator"> / </span>'):'Draft-pick trade'
}
function renderSummary(){
  const last7=tradesFor("7"),latest=state.trades[0],active=activeRanked(state.activeWindow),lead=active[0];
  const current=state.bundles.find(b=>String(b.league.league_id)===CONFIG.currentLeagueId)||state.modelBundle;
  const seasonTrades=current?.trades||[];
  const seasonStart=Number(current?.league?.season_start_date?new Date(current.league.season_start_date).getTime():0)||Math.min(...seasonTrades.map(t=>Number(t.created)||Date.now()),Date.now());
  const seasonWeeks=Math.max(1,(Date.now()-seasonStart)/6048e5);
  $("leagueTrades").textContent=last7.length;
  $("leagueTradesLabel").textContent="Last 7 days";
  $("averageTrades").textContent=(seasonTrades.length/seasonWeeks).toFixed(1);
  const topActive=$('topActiveManagers'),topThree=activeRanked('14').slice(0,3);
  if(topActive)topActive.innerHTML=topThree.length?topThree.map((x,i)=>`<div class="top-active-row"><b>${i+1}.</b><span class="summary-manager-avatar">${x.avatar?`<img src="${esc(x.avatar)}" alt="" loading="lazy">`:`<span>${esc(x.initials||x.name.slice(0,2).toUpperCase())}</span>`}</span><button class="inline-manager-link manager-profile-link" type="button" data-manager-id="${esc(x.id)}">${esc(x.name)}</button><small>${x.count} ${x.count===1?'trade':'trades'}</small></div>`).join(''):'<small>No trades in the last 14 days</small>';
  if(latest){
    const sides=Object.entries(tradeAssets(latest)).slice(0,2),headline=sides.map(([mid,assets])=>{const biggest=[...assets].sort((a,b)=>Number(b.value||0)-Number(a.value||0))[0];return biggest?tradeAssetLinkHTML(biggest,'summary-player-link'):esc(managerName(mid,latest))}).join('<span class="latest-trade-for"> for </span>');
    $("latestTradeShort").innerHTML=headline||esc(tradeSummary(latest));$("latestTradeDate").textContent=`${mids(latest).map(id=>managerName(id,latest)).join(" ↔ ")} · ${fmt(latest.created)}`;
  }else{$("latestTradeShort").textContent='—';$("latestTradeDate").textContent='No trade'}
}
function renderLeaderboard(){const r=activeRanked(state.activeWindow),max=Math.max(...r.map(x=>x.count),1);$("leaderboard").classList.remove("loading");$("leaderboard").innerHTML=r.map((x,i)=>`<div class="leader-row manager-row-hover"><span class="rank">${i+1}</span><button class="team-name manager-profile-link" type="button" data-manager-id="${esc(x.id)}">${esc(x.name)}</button><div class="bar-track"><div class="bar-fill" style="width:${x.count/max*100}%"></div></div><span class="trade-count">${x.count}</span></div>`).join("")}
function leagueLuckRatings(bundle=state.modelBundle,throughWeek=Infinity){
  const ratings=Object.fromEntries([...state.managers.keys()].map(id=>[String(id),0]));
  if(!bundle)return ratings;
  const rows=matchupRows(bundle,throughWeek),byWeek={};
  rows.forEach(row=>(byWeek[row.week]??=[]).push(row));
  Object.values(byWeek).forEach(weekRows=>{
    const groups={};
    weekRows.forEach(row=>{if(row.matchup_id!=null)(groups[row.matchup_id]??=[]).push(row)});
    const completed=[];
    Object.values(groups).forEach(group=>{
      if(group.length<2)return;
      const a=group[0],b=group[1],aPts=Number(a.points),bPts=Number(b.points);
      if(!Number.isFinite(aPts)||!Number.isFinite(bPts)||(aPts===0&&bPts===0))return;
      const aId=String(bundle.ownerByRoster?.[String(a.roster_id)]||''),bId=String(bundle.ownerByRoster?.[String(b.roster_id)]||'');
      if(!aId||!bId||aId===bId)return;
      completed.push({id:aId,points:aPts,opp:bId});
      completed.push({id:bId,points:bPts,opp:aId});
      if(aPts>bPts){ratings[aId]=(ratings[aId]||0)+1}else if(bPts>aPts){ratings[bId]=(ratings[bId]||0)+1}else{ratings[aId]=(ratings[aId]||0)+.5;ratings[bId]=(ratings[bId]||0)+.5}
    });
    const n=completed.length;
    if(n<2)return;
    completed.forEach(team=>{
      const others=completed.filter(x=>x.id!==team.id),lower=others.filter(x=>team.points>x.points).length,equal=others.filter(x=>team.points===x.points).length;
      const expected=(lower+equal*.5)/Math.max(1,others.length);
      ratings[team.id]=(ratings[team.id]||0)-expected;
    });
  });
  const total=Object.values(ratings).reduce((sum,v)=>sum+v,0);
  if(Math.abs(total)>.000001){
    const active=Object.keys(ratings).filter(id=>Number.isFinite(ratings[id]));
    const adjustment=active.length?total/active.length:0;
    active.forEach(id=>ratings[id]-=adjustment);
  }
  return ratings;
}
function managerLuckRating(managerId,bundle=state.modelBundle,throughWeek=Infinity){return Number(leagueLuckRatings(bundle,throughWeek)[String(managerId)]||0)}
function recentThreePointAverage(managerId,bundle=state.modelBundle,throughWeek=Infinity){const games=(outcomesForBundle(bundle,throughWeek)[String(managerId)]||[]).slice(-3);return games.length?games.reduce((s,g)=>s+g.points,0)/games.length:0}
function activeTrendBundle(){const current=state.bundles.find(b=>String(b.league?.league_id)===CONFIG.currentLeagueId);if(current&&meaningfulWeeks(current).length)return current;return state.bundles.filter(b=>meaningfulWeeks(b).length).sort((a,b)=>Number(b.league?.season)-Number(a.league?.season))[0]||state.modelBundle}
function currentRosterPlayerValue(managerId){const manager=state.managers.get(String(managerId)),players=(manager?.roster?.players||[]).map(String);return players.reduce((sum,pid)=>{const avg=playerSeasonAverage(pid,"2025")||playerSeasonAverage(pid,"2026")||0;return sum+playerDynastyValue(pid,avg,Date.now())},0)}
function preseasonProjectionRows(bundle){const prior=state.bundles.filter(b=>String(b.league?.season)<String(bundle.league?.season)&&meaningfulWeeks(b).length).sort((a,b)=>Number(b.league?.season||0)-Number(a.league?.season||0))[0],current=standingsTable(bundle,Infinity),priorTable=prior?standingsTable(prior,Infinity):[],priorById=Object.fromEntries(priorTable.map(x=>[String(x.id),x])),values=current.map(x=>currentRosterPlayerValue(x.id)),standingsScores=current.map(x=>{const p=priorById[String(x.id)];if(!p)return .5;const n=Math.max(priorTable.length-1,1);return 1-(p.standingRank-1)/n});return current.map((x,i)=>({...x,form:0,avg5:0,ladder:standingsScores[i],score:standingsScores[i]*.45+minMax(values[i],values,true)*.55,projection:true})).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name)).map((x,i)=>({...x,rank:i+1}))}
function priceRowsForBundle(bundle,through){
  const isCurrent=String(bundle.league?.league_id)===CONFIG.currentLeagueId,weeks=meaningfulWeeks(bundle),weekCount=weeks.filter(w=>through===Infinity||w<=through).length;
  let rows;
  if(isCurrent&&weekCount===0)rows=preseasonProjectionRows(bundle);
  else if(isCurrent&&weekCount<4){
    const live=modelRows(bundle,through,"odds"),pre=Object.fromEntries(preseasonProjectionRows(bundle).map(x=>[String(x.id),x])),priorWeight=({1:.30,2:.20,3:.10}[weekCount]||0);
    rows=live.map(x=>({...x,score:x.score*(1-priorWeight)+(pre[String(x.id)]?.score??.5)*priorWeight,preseasonWeight:priorWeight})).sort((a,b)=>b.score-a.score||b.avg5-a.avg5||a.name.localeCompare(b.name)).map((x,i)=>({...x,rank:i+1}));
  }else rows=modelRows(bundle,through,"odds");
  const strengths=rows.map(x=>Math.pow(CONFIG.oddsBaseline+(1-CONFIG.oddsBaseline)*Math.max(0,Math.min(1,x.score)),CONFIG.oddsExponent)),sum=strengths.reduce((a,b)=>a+b,0)||1;
  return rows.map((x,i)=>{const fair=strengths[i]/sum,market=Math.min(.99,fair*CONFIG.bookmakerMargin),odds=roundFive(Math.min(CONFIG.maxDisplayedOdds,Math.max(1.01,1/market)));return {...x,odds,probability:fair,eliminated:false}})
}
function championshipOddsLabel(row){return row?.eliminated?'0%':row?.odds!=null?`$${Number(row.odds).toFixed(2)}`:'—'}
function managerPowerTrend(managerId){const bundle=activeTrendBundle(),weeks=meaningfulWeeks(bundle),outcomes=outcomesForBundle(bundle);return weeks.map(week=>{const row=modelRows(bundle,week,"power").find(x=>String(x.id)===String(managerId)),odds=priceRowsForBundle(bundle,week).find(x=>String(x.id)===String(managerId)),games=(outcomes[String(managerId)]||[]).filter(g=>g.week<=week),weekGame=games.find(g=>g.week===week),wins=games.reduce((sum,g)=>sum+g.result,0);return row?{week,rank:row.rank,odds:odds?.odds??null,oddsLabel:odds?championshipOddsLabel(odds):'Unavailable',wins,games:games.length,score:weekGame?.points??null,season:String(bundle.league?.season||'')}:null}).filter(Boolean)}
function powerTrendHTML(managerId){const rows=managerPowerTrend(managerId);if(!rows.length)return '<div class="profile-empty">Power-ranking history will appear once the season begins.</div>';const width=760,height=210,padX=42,padY=24,maxRank=Math.max(state.managers.size,...rows.map(x=>x.rank)),x=i=>rows.length===1?width/2:padX+i*(width-padX*2)/(rows.length-1),y=rank=>padY+(rank-1)*(height-padY*2)/Math.max(1,maxRank-1),points=rows.map((r,i)=>`${x(i).toFixed(1)},${y(r.rank).toFixed(1)}`).join(' '),dots=rows.map((r,i)=>`<circle class="spark-point" tabindex="0" cx="${x(i)}" cy="${y(r.rank)}" r="6" data-week="${r.week}" data-rank="${r.rank}" data-record="${r.wins}-${r.games-r.wins}" data-score="${r.score==null?'Unavailable':Number(r.score).toFixed(1)}" data-odds="${r.oddsLabel||'Unavailable'}"></circle>`).join(''),labels=rows.map((r,i)=>`<text x="${x(i)}" y="${height-5}" text-anchor="middle">W${r.week}</text>`).join(''),last=rows.at(-1),currentBundle=state.bundles.find(b=>String(b.league?.league_id)===CONFIG.currentLeagueId),isCurrent=currentBundle&&String(currentBundle.league?.season)===last.season&&meaningfulWeeks(currentBundle).length>0,endLabel=isCurrent?'Current':'Finished',movement=rows[0].rank-last.rank;return `<div class="profile-sparkline-wrap" data-season="${esc(last.season)}"><div class="sparkline-season-label">${esc(last.season)} POWER RANKING JOURNEY</div><div class="sparkline-chart"><svg class="profile-sparkline" viewBox="0 0 ${width} ${height}" role="img" aria-label="Week-on-week power ranking"><line x1="${padX}" y1="${padY}" x2="${padX}" y2="${height-padY}"/><line x1="${padX}" y1="${height-padY}" x2="${width-padX}" y2="${height-padY}"/><text x="8" y="${padY+5}">#1</text><text x="8" y="${height-padY+5}">#${maxRank}</text><polyline points="${points}"/>${dots}${labels}</svg><div class="sparkline-tooltip" aria-hidden="true"></div></div><div class="profile-sparkline-summary"><span>Started: #${rows[0].rank}</span><strong>${movement>0?'▲ '+movement:movement<0?'▼ '+Math.abs(movement):'—'} </strong><span>${endLabel}: #${last.rank}</span></div></div>`}
function bindSparklineTooltips(root=document){root.querySelectorAll('.sparkline-chart').forEach(chart=>{const tip=chart.querySelector('.sparkline-tooltip');chart.querySelectorAll('.spark-point').forEach(point=>{const show=()=>{tip.innerHTML=`<strong>Week ${esc(point.dataset.week)}</strong><span>Power Rank <b>#${esc(point.dataset.rank)}</b></span><span>Record <b>${esc(point.dataset.record)}</b></span><span>Weekly Score <b>${esc(point.dataset.score)}</b></span><span>Championship Odds <b>${esc(point.dataset.odds)}</b></span>`;const svg=chart.querySelector('svg'),box=svg.getBoundingClientRect(),cx=Number(point.getAttribute('cx'))/760*box.width,cy=Number(point.getAttribute('cy'))/210*box.height;tip.style.left=`${Math.max(8,Math.min(box.width-170,cx-75))}px`;tip.style.top=`${Math.max(8,cy-128)}px`;tip.classList.add('show');tip.setAttribute('aria-hidden','false')},hide=()=>{tip.classList.remove('show');tip.setAttribute('aria-hidden','true')};point.addEventListener('mouseenter',show);point.addEventListener('focus',show);point.addEventListener('mouseleave',hide);point.addEventListener('blur',hide);point.addEventListener('click',e=>{e.stopPropagation();show()})});chart.addEventListener('click',e=>{if(!e.target.classList.contains('spark-point'))tip.classList.remove('show')})})}
function latestCurrentLeagueTrade(){return state.trades.find(t=>String(t.league_id)===String(CONFIG.currentLeagueId))||state.trades[0]||null}
function oddsSnapshotRows(){const weeks=meaningfulWeeks(state.modelBundle),through=weeks.at(-1)||Infinity;return priceRows(through)}
function readStoredJSON(key){try{return JSON.parse(localStorage.getItem(key)||"null")}catch{return null}}
function prepareOddsMovement(){
  const rows=oddsSnapshotRows(),latest=latestCurrentLeagueTrade(),tradeId=String(latest?.transaction_id||latest?.created||"none"),currentOdds=Object.fromEntries(rows.map(x=>[String(x.id),Number(x.odds)]));
  const existing=readStoredJSON("imoOddsMovementV2"),dedicated=readStoredJSON("imoOddsSnapshotV2"),market=readStoredJSON("imoMarketSnapshotV1"),previous=dedicated||market;
  let movement=existing?.tradeId===tradeId?existing:null;
  if(!movement&&previous&&String(previous.latestTradeId||"none")!==tradeId){
    const changes={};
    Object.entries(currentOdds).forEach(([id,newOdds])=>{const raw=previous.odds?.[id],oldOdds=Number(raw&&typeof raw==="object"?raw.odds:raw);if(Number.isFinite(oldOdds)&&Number.isFinite(newOdds)&&Math.abs(newOdds-oldOdds)>=.001)changes[id]={oldOdds,newOdds}});
    movement={tradeId,tradeCreated:Number(latest?.created||Date.now()),changes};
    try{localStorage.setItem("imoOddsMovementV2",JSON.stringify(movement))}catch(_){ }
  }else if(movement){
    Object.entries(currentOdds).forEach(([id,newOdds])=>{if(movement.changes?.[id])movement.changes[id].newOdds=newOdds});
    try{localStorage.setItem("imoOddsMovementV2",JSON.stringify(movement))}catch(_){ }
  }
  state.oddsMovement=movement;
  try{localStorage.setItem("imoOddsSnapshotV2",JSON.stringify({savedAt:Date.now(),latestTradeId:tradeId,odds:currentOdds}))}catch(_){ }
}
function renderPower(){const weeks=meaningfulWeeks(state.modelBundle),through=weeks.at(-1)||Infinity,prior=weeks.length>1?weeks.at(-2):through,p=modelRows(state.modelBundle,through,"power"),priced=priceRows(through),oddsById=Object.fromEntries(priced.map(x=>[String(x.id),x])),oldOdds=Object.fromEntries(priceRows(prior).map(x=>[String(x.id),x])),n=Math.max(p.length-1,1),favouriteId=String([...priced].filter(x=>!x.eliminated).sort((a,b)=>a.odds-b.odds)[0]?.id||""),bottomFour=p.slice(-4),smokeyId=String([...bottomFour].sort((a,b)=>recentThreePointAverage(b.id,state.modelBundle,through)-recentThreePointAverage(a.id,state.modelBundle,through))[0]?.id||"");$("powerRankings").classList.remove("loading");$("powerRankings").innerHTML=p.map((x,i)=>{const oldRank=state.previousPowerRanks[x.id]??x.rank,diff=oldRank-x.rank,arrow=diff>0?`<span class="movement up">▲ ${diff}</span>`:diff<0?`<span class="movement down">▼ ${Math.abs(diff)}</span>`:`<span class="movement flat">—</span>`,hue=140-(140*i/n),m=state.managers.get(String(x.id)),avatar=m?.avatar?`<img src="${esc(m.avatar)}" alt="" loading="lazy">`:`<span>${esc(m?.initials||x.name.slice(0,2).toUpperCase())}</span>`,o=oddsById[String(x.id)]||x,tradeMove=state.oddsMovement?.changes?.[String(x.id)],prev=Number.isFinite(Number(tradeMove?.oldOdds))?Number(tradeMove.oldOdds):(oldOdds[String(x.id)]?.odds??o.odds),current=Number.isFinite(Number(tradeMove?.newOdds))?Number(tradeMove.newOdds):Number(o.odds),delta=current-prev,oddsClass=delta<0?'up':delta>0?'down':'flat',moveText=Math.abs(delta)<.001?'No price movement':`$${prev.toFixed(2)} → $${current.toFixed(2)}`,ladderMove=(oldOdds[String(x.id)]?.standingRank||o.standingRank)-o.standingRank,ladderText=ladderMove>0?`Moved up to ${ordinal(o.standingRank)} on ladder`:ladderMove<0?`Dropped to ${ordinal(o.standingRank)} on ladder`:`Currently ${ordinal(o.standingRank)} on ladder`,streak=o.streak>=1?`Won last ${o.streak}`:`Form: ${Math.round(o.form*5)} wins from last 5`,temperature=Number(o.avg5||0)<220?'❄️':'🔥',luck=managerLuckRating(x.id,state.modelBundle,through),luckText=`${luck>=0?'+':''}${luck.toFixed(1)} wins vs expected`,tag=String(x.id)===favouriteId?'<span class="market-tag favourite-tag">Favourite</span>':String(x.id)===smokeyId?'<span class="market-tag smokey-tag">Smokey</span>':'';return `<details class="power-odds-row ${x.rank===1?'featured-number-one':''}" style="--rank-colour:hsl(${hue} 85% 52%)"><summary><b class="power-rank-number">${x.rank}</b><span class="power-avatar">${avatar}</span><span class="power-copy"><button class="power-name manager-profile-link" type="button" data-manager-id="${esc(x.id)}">${esc(x.name)}</button><small>View manager profile</small></span><span class="power-market-stack"><span class="power-odds-price">${championshipOddsLabel(o)}</span>${tag}</span>${arrow}<span class="power-chevron">⌄</span></summary><div class="power-detail"><div>${o.streak>=3?'🔥':o.streak?'✅':'⚪'} ${streak}</div><div>${temperature} Averaging ${Number(o.avg5||0).toFixed(1)} over last five games</div><div>${ladderMove<0?'⬇':'⬆'} ${ladderText}</div><div class="odds-move ${oddsClass}">${moveText}</div><div class="luck-rating ${luck>0.5?'lucky':luck<-0.5?'unlucky':'neutral'}">🍀 Luck rating: ${luckText}</div></div></details>`}).join("")}
function roundFive(x){return Math.round(x*20)/20}
function priceRows(through){const current=state.bundles.find(b=>String(b.league?.league_id)===CONFIG.currentLeagueId);return priceRowsForBundle(current||state.modelBundle,through)}
function renderOdds(){}
function ordinal(n){const s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0])}
function renderTradeWeek(){
  const currentLeagueTrades=state.trades.filter(t=>String(t.league_id)===String(CONFIG.currentLeagueId)),t=currentLeagueTrades.find(t=>tradeValue(t)>=25)||state.trades.find(t=>tradeValue(t)>=25)||null;
  const target=$("tradeOfWeek");if(!target)return;
  if(!t){target.innerHTML="No trade available";return}
  const featuredGrades=Object.fromEntries(tradeGrades(t).map(g=>[String(g.id),g])),sides=Object.entries(tradeAssets(t)).slice(0,3),html=sides.map(([mid,assets])=>{const g=featuredGrades[String(mid)];return `<div class="trade-side-v2">${g?`<span class="featured-trade-grade ${gradeClass(g.grade)}">${esc(g.grade)}</span>`:''}<strong>${esc(managerName(mid,t))} receives</strong>${assets.length?assets.map(a=>`<div class="asset-row"><span>${tradeAssetLinkHTML(a,'featured-trade-asset-link')}${a.owner?`<small class="asset-owner">Originally ${esc(a.owner)}'s pick</small>`:''}</span></div>`).join(""):'<div class="asset-row"><span>No listed assets</span></div>'}</div>`}).join('<div class="trade-mid">⇄</div>');
  target.classList.remove("loading");target.innerHTML=`<div class="trade-feature-v2">${html}${tradeEditorialHTML(t)}<div class="trade-foot-v2"><span>Featured trade</span><strong>${fmt(t.created)}</strong></div></div>`
}
function allPartnerPairs(){const teams=[...state.managers.values()],mat={};state.trades.forEach(t=>{const ids=mids(t);for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const k=[ids[i],ids[j]].sort().join('|');mat[k]=(mat[k]||0)+1}});const pairs=[];for(let i=0;i<teams.length;i++)for(let j=i+1;j<teams.length;j++){const a=teams[i],b=teams[j],count=mat[[a.id,b.id].sort().join('|')]||0;if(count)pairs.push({a,b,count})}return pairs.sort((a,b)=>b.count-a.count||a.a.name.localeCompare(b.a.name))}
function mostRecentPartnerTrade(a,b){return state.trades.find(t=>{const ids=mids(t);return ids.includes(String(a))&&ids.includes(String(b))})||null}
function renderHeatmap(){
  const target=$("tradeHeatmap");
  if(!target)return;
  const pairs=allPartnerPairs().slice(0,5);
  target.classList.remove("loading");
  if(!pairs.length){target.innerHTML='<div class="block-empty">No trade partnerships found.</div>';return}
  target.innerHTML=`<div class="partner-list-compact">${pairs.map((p,i)=>`<div class="partner-row-compact"><span class="partner-rank">${i+1}</span><span class="partner-team-pair"><button type="button" class="compact-manager-link manager-profile-link" data-manager-id="${esc(p.a.id)}">${esc(p.a.name)}</button><span class="partner-arrow">↔</span><button type="button" class="compact-manager-link manager-profile-link" data-manager-id="${esc(p.b.id)}">${esc(p.b.name)}</button></span><strong class="partner-count-compact">${p.count} ${p.count===1?'trade':'trades'}</strong></div>`).join("")}</div>`;
}
function renderBlock(){const moved={};state.trades.forEach(t=>Object.keys(t.adds||{}).forEach(id=>moved[id]=(moved[id]||0)+1));const rows=Object.entries(moved).sort((a,b)=>b[1]-a[1]).slice(0,5);$("tradeBlock").classList.remove("loading");$("tradeBlock").innerHTML=rows.length?rows.map(([id,n],i)=>`<div class="rank-item"><b>${i+1}</b><div><strong>${playerLink(id,playerName(id))}</strong><div class="meta">Most traded player of all time</div></div><span class="power-score">${n}x</span></div>`).join(""):'<div class="block-empty">No player movement yet.</div>'}

function allLeagueTransactions(){
  const unique=new Map();
  state.bundles.forEach(bundle=>(bundle.transactions||[]).forEach(t=>{
    const key=`${bundle.league?.league_id||t.league_id||'league'}|${t.transaction_id||`${t.created||0}-${t.week||0}-${t.type||'move'}`}`;
    if(!unique.has(key))unique.set(key,{...t,league_id:t.league_id||bundle.league?.league_id,season_label:t.season_label||`${bundle.league?.season||''} season`});
  }));
  return [...unique.values()]
}
function renderWaivedBlock(){
  const target=$("waiverBlock");if(!target)return;
  const counts={};
  allLeagueTransactions().filter(t=>['waiver','free_agent'].includes(String(t.type||''))&&(!t.status||t.status==='complete')).forEach(t=>{
    Object.keys(t.drops||{}).forEach(id=>{if(id&&id!=='0')counts[String(id)]=(counts[String(id)]||0)+1});
  });
  const rows=Object.entries(counts).sort((a,b)=>b[1]-a[1]||playerName(a[0]).localeCompare(playerName(b[0]))).slice(0,5);
  target.classList.remove("loading");
  target.innerHTML=rows.length?rows.map(([id,n],i)=>`<div class="rank-item waiver-rank-item"><b>${i+1}</b><div><strong>${playerLink(id,playerName(id))}</strong><div class="meta">${n===1?'Waived once':`Waived ${n} times`} across loaded league history</div></div><span class="power-score">${n}x</span></div>`).join(""):'<div class="block-empty">No completed waiver drops found.</div>'
}
function currentLeagueBundle(){return state.bundles.find(b=>String(b.league?.league_id)===CONFIG.currentLeagueId)||state.bundles[0]||null}
function groupedMatchupsForWeek(bundle,week){
  const groups={};
  (bundle?.matchups||[]).filter(row=>Number(row.week)===Number(week)&&row.matchup_id!=null).forEach(row=>(groups[String(row.matchup_id)]??=[]).push(row));
  return Object.values(groups).filter(group=>group.length>=2).map(group=>group.slice(0,2))
}
function resolveHeadToHeadWeek(bundle){
  if(!bundle)return 1;
  const leagueSeason=String(bundle.league?.season||''),sportSeason=String(state.sportState?.season||''),sportWeek=Number(state.sportState?.week),leagueWeek=Number(bundle.league?.settings?.leg||bundle.league?.settings?.week);
  if(sportSeason===leagueSeason&&Number.isFinite(sportWeek)&&sportWeek>0)return sportWeek;
  if(Number.isFinite(leagueWeek)&&leagueWeek>0)return leagueWeek;
  const allWeeks=[...new Set((bundle.matchups||[]).filter(x=>x.matchup_id!=null).map(x=>Number(x.week)).filter(Number.isFinite))].sort((a,b)=>a-b);
  const completed=meaningfulWeeks(bundle),lastCompleted=completed.at(-1)||0;
  return allWeeks.find(w=>w>lastCompleted)||lastCompleted||allWeeks[0]||1
}
function managerWeeklyScores(bundle,managerId,beforeWeek=Infinity){
  const id=String(managerId),rows=[];
  (bundle?.matchups||[]).forEach(row=>{
    if(Number(row.week)>=Number(beforeWeek))return;
    if(String(bundle.ownerByRoster?.[String(row.roster_id)]||'')!==id)return;
    const points=Number(row.points);if(Number.isFinite(points)&&points>0)rows.push({week:Number(row.week),points});
  });
  return rows.sort((a,b)=>a.week-b.week)
}
function meanNumber(values){const nums=values.map(Number).filter(Number.isFinite);return nums.length?nums.reduce((a,b)=>a+b,0)/nums.length:0}
function managerPreGameProjection(managerId,bundle,week){
  let rows=managerWeeklyScores(bundle,managerId,week);
  if(!rows.length&&state.modelBundle&&state.modelBundle!==bundle)rows=managerWeeklyScores(state.modelBundle,managerId,Infinity);
  const scores=rows.map(x=>x.points),weeklyProjection=meanNumber(scores.slice(-5))||meanNumber(scores)||220,last3=meanNumber(scores.slice(-3))||weeklyProjection;
  return Math.max(1,.80*weeklyProjection+.20*last3)
}
function gameWeekProgress(){
  const now=new Date(),day=now.getDay(),daysSinceTuesday=(day-2+7)%7,fraction=(daysSinceTuesday+(now.getHours()+now.getMinutes()/60)/24)/7;
  return Math.max(.03,Math.min(.97,fraction))
}
function liveWeightedProjection(current,pregame){
  const progress=gameWeekProgress(),expectedSoFar=Math.max(1,pregame*progress),pace=Math.max(.65,Math.min(1.45,current/expectedSoFar||1)),remaining=pregame*(1-progress)*pace;
  return Math.max(current,current+remaining)
}
function roundOdds05(value){if(!Number.isFinite(value)||value<=0)return 2;return Math.max(1.05,Math.min(51,Math.round(value/.05)*.05))}
function matchupOdds(a,b){
  const total=Math.max(.001,a+b),baseA=Math.max(.001,Math.min(.999,a/total)),baseB=1-baseA;
  // Add 15% market separation so favourites and underdogs are more distinct.
  const weightA=Math.pow(baseA,1.15),weightB=Math.pow(baseB,1.15),pa=weightA/(weightA+weightB),pb=1-pa;
  return{a:roundOdds05(1/Math.max(.001,pa)),b:roundOdds05(1/Math.max(.001,pb)),pa,pb}
}
function managerFormBadges(managerId,bundle,beforeWeek){
  let games=(outcomesForBundle(bundle,Number(beforeWeek)-1)[String(managerId)]||[]);
  if(!games.length&&state.modelBundle&&state.modelBundle!==bundle)games=(outcomesForBundle(state.modelBundle)[String(managerId)]||[]);
  return games.slice(-3).map(g=>g.result===1?'W':g.result===0?'L':'D')
}
function rivalryRecord(managerA,managerB){
  const a=String(managerA),b=String(managerB),record={a:0,b:0,d:0};
  state.bundles.forEach(bundle=>{
    const groups={};(bundle.matchups||[]).filter(row=>Number(row.points)>0&&row.matchup_id!=null).forEach(row=>{const key=`${row.week}|${row.matchup_id}`;(groups[key]??=[]).push(row)});
    Object.values(groups).forEach(group=>{
      const rowA=group.find(row=>String(bundle.ownerByRoster?.[String(row.roster_id)]||'')===a),rowB=group.find(row=>String(bundle.ownerByRoster?.[String(row.roster_id)]||'')===b);
      if(!rowA||!rowB)return;const pa=Number(rowA.points),pb=Number(rowB.points);if(!Number.isFinite(pa)||!Number.isFinite(pb)||(pa===0&&pb===0))return;
      if(pa>pb)record.a++;else if(pb>pa)record.b++;else record.d++;
    });
  });
  return record
}
function rivalryLabel(managerA,managerB){
  const r=rivalryRecord(managerA,managerB),nameA=managerName(managerA),nameB=managerName(managerB);
  if(r.a===r.b)return `Series tied ${r.a}–${r.b}${r.d?` · ${r.d} draw${r.d===1?'':'s'}`:''}`;
  const leader=r.a>r.b?nameA:nameB,wins=Math.max(r.a,r.b),losses=Math.min(r.a,r.b);
  return `${leader} leads ${wins}–${losses} all-time${r.d?` · ${r.d} draw${r.d===1?'':'s'}`:''}`
}
function keyMatchupPlayer(managerId,row){
  const rosterIds=new Set((state.managers.get(String(managerId))?.roster?.players||[]).map(String));
  const form=allGameLogFormRows().filter(x=>rosterIds.has(String(x.id))).sort((a,b)=>Number(b.recentAvg)-Number(a.recentAvg));
  const fallback=managerRosterPlayers(managerId,String(currentLeagueBundle()?.league?.season||'2026'))[0]||managerRosterPlayers(managerId,'2025')[0]||null;
  const chosen=form[0]||fallback;if(!chosen)return null;
  const id=String(chosen.id),recentAvg=Number(chosen.recentAvg??chosen.avg??0),live=Number(row?.players_points?.[id]||0),player=state.players[id]||{};
  return{id,name:chosen.name||playerName(id),recentAvg,live,position:player.position||player.fantasy_positions?.[0]||chosen.position||'',avatar:`https://sleepercdn.com/content/nba/players/${id}.jpg`}
}
function h2hManagerAvatar(managerId){
  const manager=state.managers.get(String(managerId));return manager?.avatar?`<img src="${esc(manager.avatar)}" alt="" loading="lazy">`:`<span>${esc(manager?.initials||'—')}</span>`
}
function h2hFormHTML(form){return `<span class="h2h-form-badges">${form.length?form.map(x=>`<i class="${x==='W'?'win':x==='L'?'loss':'draw'}">${x}</i>`).join(''):'<small>No form</small>'}</span>`}
function h2hKeyPlayerHTML(player,isLive){
  if(!player)return '<div class="h2h-key-player empty">No player form available</div>';
  return `<div class="h2h-key-player"><span class="h2h-key-avatar"><img src="${esc(player.avatar)}" alt="" loading="lazy" onerror="this.style.display='none'"></span><div>${playerLink(player.id,player.name,'h2h-key-player-link')}<small>${player.recentAvg?`${player.recentAvg.toFixed(1)} avg · last 5`:'Current roster leader'}</small></div>${isLive?`<strong>${player.live.toFixed(1)}<small>LIVE</small></strong>`:''}</div>`
}
function h2hAverageSeason(){
  const current=currentLeagueBundle(),currentSeason=String(current?.league?.season||'2026');
  if(current&&meaningfulWeeks(current).length&&Object.values(seasonAverageMap(currentSeason)).some(v=>Number(v)>0))return currentSeason;
  const completed=[...state.bundles].filter(b=>meaningfulWeeks(b).length).sort((a,b)=>Number(b.league?.season)-Number(a.league?.season))[0];
  return String(completed?.league?.season||'2025')
}
function sleeperListsPlayerOut(playerId){
  const player=state.players[String(playerId)]||{},values=[player.injury_status,player.status,player.injuryStatus].map(v=>String(v||'').trim().toLowerCase());
  return values.some(v=>v==='out')
}
function h2hOutPlayers(managerId){
  const season=h2hAverageSeason();
  return managerRosterPlayers(managerId,season).filter(x=>Number(x.avg)>0).slice(0,5).filter(x=>sleeperListsPlayerOut(x.id)).map(x=>({id:String(x.id),name:x.name,avg:Number(x.avg)||0}))
}
function h2hInjuryHTML(idA,idB,injuriesA,injuriesB){
  const side=(id,rows)=>rows.length?`<div class="h2h-injury-side"><strong>${esc(managerName(id))}</strong>${rows.map(p=>`<span>${playerLink(p.id,p.name,'h2h-injury-player')} <small>OUT</small></span>`).join('')}</div>`:`<div class="h2h-injury-side clear"><strong>${esc(managerName(id))}</strong><span>No top-five player listed OUT</span></div>`;
  return `<div class="h2h-injuries"><div class="h2h-detail-heading"><span>INJURY WATCH</span><small>Top-five average players only</small></div><div class="h2h-injury-grid">${side(idA,injuriesA)}${side(idB,injuriesB)}</div></div>`
}
function h2hNarrative(data){
  const {idA,idB,keyA,keyB,odds,injuriesA,injuriesB,formA,formB}=data,nameA=managerName(idA),nameB=managerName(idB),gap=Math.abs(odds.a-odds.b),aFav=odds.a<=odds.b,fav=aFav?nameA:nameB,dog=aFav?nameB:nameA,favOdds=aFav?odds.a:odds.b;
  const bothBigs=[keyA?.position,keyB?.position].every(pos=>/C|PF/i.test(String(pos||'')));
  let first;
  if(bothBigs&&keyA&&keyB)first=`The Battle of the Bigs: ${keyA.name} and ${keyB.name} headline a matchup built around frontcourt star power.`;
  else if(gap<=.20)first=`A genuine coin flip: ${nameA} and ${nameB} enter the week with almost nothing separating their markets.`;
  else if(keyA&&keyB)first=`${fav} opens as the $${favOdds.toFixed(2)} favourite, with ${keyA.name} and ${keyB.name} shaping the key individual battle.`;
  else first=`${fav} enters as the favourite, but ${dog} remains close enough to turn this into a live underdog opportunity.`;
  const injuryRows=[...injuriesA.map(p=>`${p.name} (${nameA})`),...injuriesB.map(p=>`${p.name} (${nameB})`)];
  let second='';
  if(injuryRows.length)second=`The market also has to account for ${injuryRows.join(' and ')}, who ${injuryRows.length===1?'is':'are'} currently listed OUT.`;
  else if(formA.length&&formB.length){const aWins=formA.filter(x=>x==='W').length,bWins=formB.filter(x=>x==='W').length;if(aWins!==bWins)second=`Recent form leans toward ${aWins>bWins?nameA:nameB}, adding pressure to the opposing side before the week begins.`}
  if(!second)second=`The all-time series currently reads: ${rivalryLabel(idA,idB)}.`;
  return `${first} ${second}`
}
function h2hMatchupDetailsHTML(data,mode){
  const {idA,idB,keyA,keyB,formA,formB,injuriesA,injuriesB,line,favouriteA}=data;
  return `<div class="h2h-preview"><span>AI MATCHUP PREVIEW</span><p>${esc(h2hNarrative(data))}</p></div>
    <div class="h2h-detail-grid">
      <div class="h2h-line"><span>Market line</span><strong>${esc(managerName(favouriteA?idA:idB))} −${line.toFixed(1)} <small>·</small> ${esc(managerName(favouriteA?idB:idA))} +${line.toFixed(1)}</strong></div>
      <div class="h2h-rivalry"><span>Rivalry record</span><strong>${esc(rivalryLabel(idA,idB))}</strong></div>
    </div>
    <div class="h2h-key-heading"><span>KEY MATCHUP</span><small>Top last-five performer</small></div>
    <div class="h2h-key-grid">${h2hKeyPlayerHTML(keyA,mode==='live')}${h2hKeyPlayerHTML(keyB,mode==='live')}</div>
    ${h2hInjuryHTML(idA,idB,injuriesA,injuriesB)}
    <div class="h2h-expanded-form"><span>Recent form</span><div>${esc(managerName(idA))}${h2hFormHTML(formA)}</div><div>${esc(managerName(idB))}${h2hFormHTML(formB)}</div></div>`
}
function buildHeadToHeadMatchup(group,bundle,week,mode){
  const rowA=group[0],rowB=group[1],idA=String(bundle.ownerByRoster?.[String(rowA.roster_id)]||''),idB=String(bundle.ownerByRoster?.[String(rowB.roster_id)]||'');
  const currentA=Number(rowA.points)||0,currentB=Number(rowB.points)||0,preA=managerPreGameProjection(idA,bundle,week),preB=managerPreGameProjection(idB,bundle,week),finishA=mode==='live'?liveWeightedProjection(currentA,preA):preA,finishB=mode==='live'?liveWeightedProjection(currentB,preB):preB,odds=matchupOdds(finishA,finishB),difference=Math.abs(finishA-finishB),line=Math.floor(difference)+.5,favouriteA=finishA>=finishB;
  return{rowA,rowB,idA,idB,finishA,finishB,odds,line,favouriteA,keyA:keyMatchupPlayer(idA,rowA),keyB:keyMatchupPlayer(idB,rowB),formA:managerFormBadges(idA,bundle,week),formB:managerFormBadges(idB,bundle,week),injuriesA:h2hOutPlayers(idA),injuriesB:h2hOutPlayers(idB)}
}
function h2hFeaturedTeamHTML(managerId,odds,form,side){
  return `<div class="h2h-featured-team ${side}"><span class="h2h-featured-avatar">${h2hManagerAvatar(managerId)}</span><button type="button" class="manager-profile-link" data-manager-id="${esc(managerId)}">${esc(managerName(managerId))}</button><strong>$${odds.toFixed(2)}</strong>${h2hFormHTML(form)}</div>`
}
function h2hCompactTeamHTML(managerId,odds,form){
  return `<div class="h2h-compact-team"><span class="h2h-compact-avatar">${h2hManagerAvatar(managerId)}</span><strong>${esc(managerName(managerId))}</strong><em>$${odds.toFixed(2)}</em>${h2hFormHTML(form)}</div>`
}
function renderHeadToHead(){
  const target=$("headToHead");if(!target)return;
  const bundle=currentLeagueBundle();if(!bundle){target.classList.remove('loading');target.innerHTML='<div class="block-empty">Current league data unavailable.</div>';return}
  const week=resolveHeadToHeadWeek(bundle),groups=groupedMatchupsForWeek(bundle,week);
  if(!groups.length){target.classList.remove('loading');target.innerHTML=`<div class="h2h-empty"><strong>Week ${week} matchups are not available yet.</strong><small>The board will populate automatically when Sleeper publishes the gameweek.</small></div>`;return}
  const anyScore=groups.some(group=>group.some(row=>Number(row.points)>0)),mode=anyScore?'live':'upcoming';
  const status=$("headToHeadStatus");if(status){status.textContent=mode==='live'?`Week ${week} · Live`:`Week ${week} · Upcoming`;status.classList.toggle('live',mode==='live')}
  const matchups=groups.map(group=>buildHeadToHeadMatchup(group,bundle,week,mode)).sort((a,b)=>Math.abs(a.odds.a-a.odds.b)-Math.abs(b.odds.a-b.odds.b));
  const featured=matchups[0],others=matchups.slice(1);
  target.classList.remove('loading');
  target.innerHTML=`<article class="h2h-featured-card ${mode}">
      <div class="h2h-card-kicker"><span>${mode==='live'?'<i></i> LIVE MARKET':'MATCHUP OF THE WEEK'}</span><small>Closest odds · Week ${week}</small></div>
      <div class="h2h-featured-market">${h2hFeaturedTeamHTML(featured.idA,featured.odds.a,featured.formA,'left')}<div class="h2h-market-centre"><span>VS</span><small>LIVE ODDS</small></div>${h2hFeaturedTeamHTML(featured.idB,featured.odds.b,featured.formB,'right')}</div>
      ${h2hMatchupDetailsHTML(featured,mode)}
    </article>
    ${others.length?`<div class="h2h-other-heading"><span>OTHER MATCHUPS</span><small>Tap a row to expand</small></div><div class="h2h-compact-list">${others.map((data,index)=>`<details class="h2h-compact-matchup ${mode}"><summary><div class="h2h-compact-pair">${h2hCompactTeamHTML(data.idA,data.odds.a,data.formA)}${h2hCompactTeamHTML(data.idB,data.odds.b,data.formB)}</div><span class="h2h-expand-mark">+</span></summary><div class="h2h-compact-details">${h2hMatchupDetailsHTML(data,mode)}</div></details>`).join('')}</div>`:''}
    <p class="h2h-method-note">Odds are the primary market view, use a 15% probability separation for clearer favourites and underdogs, and refresh automatically every 60 seconds during live gameweeks.</p>`
}
async function refreshHeadToHeadData(){
  if(state.h2hRefreshBusy||document.hidden)return;state.h2hRefreshBusy=true;
  try{
    const bundle=currentLeagueBundle();if(!bundle)return;
    const [league,sportState]=await Promise.all([getJSON(`${CONFIG.api}/league/${CONFIG.currentLeagueId}`,true),getJSON(`${CONFIG.api}/state/nba`,true)]);
    if(league){bundle.league=league;state.league=league}if(sportState)state.sportState=sportState;
    const week=resolveHeadToHeadWeek(bundle),rows=await getJSON(`${CONFIG.api}/league/${CONFIG.currentLeagueId}/matchups/${week}`,true);
    if(Array.isArray(rows)){bundle.matchups=(bundle.matchups||[]).filter(x=>Number(x.week)!==Number(week));bundle.matchups.push(...rows.map(x=>({...x,week})))}
    renderHeadToHead()
  }catch(error){console.warn('Head to head live refresh unavailable:',error)}
  finally{state.h2hRefreshBusy=false}
}
function setupHeadToHeadRefresh(){
  if(state.h2hRefreshTimer)clearInterval(state.h2hRefreshTimer);
  state.h2hRefreshTimer=setInterval(refreshHeadToHeadData,60000);
}

function gameDateValue(row){const raw=row?.date||row?.game_date||row?.gameDate||row?.start_time||row?.startTime||row?.timestamp;const d=raw?new Date(raw):null;return d&&!Number.isNaN(d.getTime())?d:null}
function fallbackSeasonFormRows(){
  const bundle=state.bundles.find(b=>String(b.league?.season)==="2025")||state.modelBundle;
  if(!bundle)return [];
  const playerScores={};
  matchupRows(bundle).forEach(row=>Object.entries(row.players_points||{}).forEach(([id,value])=>{
    const pts=Number(value);if(!Number.isFinite(pts)||pts<=0)return;
    (playerScores[id]??=[]).push({week:Number(row.week)||0,pts});
  }));
  return Object.entries(playerScores).map(([id,scores])=>{
    scores.sort((a,b)=>a.week-b.week);if(scores.length<5)return null;
    const all=scores.map(x=>x.pts),recent=all.slice(-5),priorAvg=all.reduce((a,b)=>a+b,0)/all.length,recentAvg=recent.reduce((a,b)=>a+b,0)/recent.length;
    return{id,name:playerName(id),priorAvg,recentAvg,change:recentAvg-priorAvg,sourceSeason:"2025",games:all.length};
  }).filter(Boolean)
}
function allGameLogFormRows(){
  const preferred=["2026","2025",String(state.modelBundle?.league?.season||"")].filter((v,i,a)=>v&&a.indexOf(v)===i);
  for(const season of preferred){
    const logs=state.gameLogs?.[season]||{},rows=[];
    Object.entries(logs).forEach(([id,games])=>{
      const played=(games||[]).map(row=>({row,date:gameDateValue(row),fpts:rawFantasyPoints(row,state.modelBundle?.league?.scoring_settings||{})})).filter(x=>x.date&&gameWasPlayed(x.row)&&Number.isFinite(x.fpts)).sort((a,b)=>a.date-b.date);
      if(played.length<5)return;
      const all=played.map(x=>x.fpts),recent=all.slice(-5),priorAvg=all.reduce((a,b)=>a+b,0)/all.length,recentAvg=recent.reduce((a,b)=>a+b,0)/recent.length;
      rows.push({id,name:playerName(id),priorAvg,recentAvg,change:recentAvg-priorAvg,sourceSeason:season,games:all.length});
    });
    if(rows.length)return rows;
  }
  return fallbackSeasonFormRows()
}
function recentPlayerForm(){const rows=allGameLogFormRows();return{poor:rows.filter(x=>x.priorAvg>=20&&x.recentAvg>0&&x.change<0).sort((a,b)=>a.change-b.change).slice(0,5),good:rows.filter(x=>x.priorAvg>=15&&x.recentAvg>0&&x.change>0).sort((a,b)=>b.change-a.change).slice(0,5)}}
function renderFormList(targetId,rows,positive){const target=$(targetId);target.classList.remove("loading");target.innerHTML=rows.length?rows.map((x,i)=>`<div class="rank-item form-player-row ${positive?'good-form-row':'poor-form-row'}"><b>${i+1}</b><div>${playerLink(x.id,x.name,"form-player-link")}<div class="meta">${x.priorAvg.toFixed(1)} season avg → ${x.recentAvg.toFixed(1)} last 5 games</div></div><span class="form-change ${positive?'positive':'negative'}">${x.change>0?'+':''}${x.change.toFixed(1)}</span></div>`).join(""):`<div class="block-empty">Individual regular-season game logs are still loading.</div>`}
function renderPlayerForm(){const form=recentPlayerForm();renderFormList("poorForm",form.poor,false);renderFormList("goodForm",form.good,true)}
function managerTradeCounts(trades){const c={};trades.forEach(t=>mids(t).forEach(id=>c[id]=(c[id]||0)+1));return c}
function topEntry(obj){return Object.entries(obj).sort((a,b)=>b[1]-a[1])[0]}
function highestTeamScore(bundles){let best=null;bundles.forEach(b=>b.matchups.forEach(m=>{const owner=b.ownerByRoster[String(m.roster_id)],pts=Number(m.points);if(owner&&Number.isFinite(pts)&&(!best||pts>best.pts))best={owner,pts,week:m.week,season:b.league.season}}));return best}
function highestPlayerScore(bundles){let best=null;bundles.forEach(b=>b.matchups.forEach(m=>Object.entries(m.players_points||{}).forEach(([id,v])=>{const pts=Number(v);if(Number.isFinite(pts)&&(!best||pts>best.pts))best={id,pts,week:m.week,season:b.league.season}})));return best}
function renderRecords(){const current=state.bundles.find(b=>String(b.league.league_id)===CONFIG.currentLeagueId)||state.modelBundle,allCounts=managerTradeCounts(state.trades),seasonCounts=managerTradeCounts(current.trades),allTop=topEntry(allCounts),seasonTop=topEntry(seasonCounts);let drought=null;for(const m of state.managers.values()){const last=state.trades.find(t=>mids(t).includes(m.id))?.created||0,days=last?Math.floor((Date.now()-last)/864e5):99999;if(!drought||days>drought.days)drought={m,days,last}}const perDay={};state.trades.forEach(t=>mids(t).forEach(id=>{const key=`${id}|${new Date(t.created).toDateString()}`;perDay[key]=(perDay[key]||0)+1}));const dayTop=topEntry(perDay),[dayOwner,dayDate]=(dayTop?.[0]||'|').split('|'),teamEver=highestTeamScore(state.bundles),teamSeason=highestTeamScore([current]),playerEver=highestPlayerScore(state.bundles),playerSeason=highestPlayerScore([current]);const cards=[['MOST TRADES (ALL TIME)',allTop?managerName(allTop[0]):'—',allTop?`${allTop[1]} trades`:'No data','record-green'],['MOST TRADES THIS SEASON',seasonTop?managerName(seasonTop[0]):'—',seasonTop?`${seasonTop[1]} trades`:'No trades','record-green'],['LONGEST FUN DROUGHT',drought?.m.name||'—',drought?.last?`${drought.days} days since a trade`:'No recorded trade','record-grey'],['MOST TRADES IN A DAY',dayOwner?managerName(dayOwner):'—',dayTop?`${dayTop[1]} trades · ${dayDate}`:'No data','record-orange'],['HIGHEST WEEKLY TEAM SCORE EVER',teamEver?managerName(teamEver.owner):'—',teamEver?`${teamEver.pts.toFixed(1)} pts · Week ${teamEver.week}, ${teamEver.season}`:'No data','record-blue'],['HIGHEST WEEKLY TEAM SCORE THIS SEASON',teamSeason?managerName(teamSeason.owner):'—',teamSeason?`${teamSeason.pts.toFixed(1)} pts · Week ${teamSeason.week}`:'Season not started','record-blue'],['HIGHEST PLAYER SCORE EVER',playerEver?playerName(playerEver.id):'—',playerEver?`${playerEver.pts.toFixed(1)} pts · Week ${playerEver.week}, ${playerEver.season}`:'No data','record-gold'],['HIGHEST PLAYER SCORE THIS SEASON',playerSeason?playerName(playerSeason.id):'—',playerSeason?`${playerSeason.pts.toFixed(1)} pts · Week ${playerSeason.week}`:'Season not started','record-gold']];$("leagueRecords").classList.remove("loading");$("leagueRecords").innerHTML=cards.map(x=>`<div class="record ${x[3]}"><span>${esc(x[0])}</span><strong>${esc(x[1])}</strong><small>${esc(x[2])}</small></div>`).join("")}
function tradeDetailsHTML(t){const sides=Object.entries(tradeAssets(t));return sides.map(([id,assets])=>`<div class="trade-detail-side"><strong>${esc(managerName(id,t))} receives</strong>${assets.map(a=>`<div>${tradeAssetLinkHTML(a,'trade-detail-asset-link')}${a.owner?` <small>(${esc(a.owner)}'s pick)</small>`:''}</div>`).join('')||'<div>No listed assets</div>'}</div>`).join('')}
function renderRecent(){const r=state.trades.slice(0,4);$("recentTrades").classList.remove("loading");$("recentTrades").innerHTML=r.map(t=>`<details><summary><div class="trade-date">${fmt(t.created)} · ${esc(t.season_label||'')}</div><div class="trade-teams">${mids(t).map(id=>esc(managerName(id,t))).join(' ↔ ')}</div><div class="trade-meta">${tradeSummaryLinksHTML(t)}</div>${tradeEditorialHTML(t,true)}</summary><div class="trade-detail-body">${tradeDetailsHTML(t)}</div></details>`).join('')||'<div class="block-empty">No trades.</div>'}
function renderBiggestTrades(){const limit=state.biggestTradesExpanded?10:5,rows=[...state.trades].map(t=>({t,value:tradeValue(t)})).sort((a,b)=>b.value-a.value||(b.t.created||0)-(a.t.created||0)).slice(0,limit);$("biggestTrades").classList.remove("loading");$("biggestTrades").innerHTML=rows.map((row,i)=>`<details class="big-trade-card"><summary><span class="big-trade-rank">${i+1}</span><div><strong>${mids(row.t).map(id=>esc(managerName(id,row.t))).join(" ↔ ")}</strong><small>${fmt(row.t.created)} · ${esc(row.t.season_label||"")}</small></div><span class="big-trade-chevron">View trade</span></summary><div class="trade-detail-body">${tradeDetailsHTML(row.t)}</div></details>`).join("")||'<div class="block-empty">No trades available.</div>';$("biggestTradesToggle").textContent=state.biggestTradesExpanded?"Show top 5":"Show top 10"}
function currentVoteAverageMap(){const current=state.bundles.find(b=>String(b.league.league_id)===CONFIG.currentLeagueId);if(current&&meaningfulWeeks(current).length)return buildPlayerAverages(current,meaningfulWeeks(current).at(-1));return state.playerAverages}
function previousSeasonAverageMap(){const sorted=state.bundles.filter(b=>meaningfulWeeks(b).length).sort((a,b)=>Number(b.league.season)-Number(a.league.season));const previous=sorted.find(b=>b!==state.modelBundle)||sorted[1];return previous?buildPlayerAverages(previous,meaningfulWeeks(previous).at(-1)):{} }

function eligibleRookie(id){
  const p=state.players[id]||{},season=String(state.league?.season||"2026");
  return Number(p.years_exp)===0||
    String(p.rookie_year||p.first_season||"")===season||
    String(p.status||"").toLowerCase()==="rookie"
}
function votingOpen(){const now=Date.now();return now>=new Date(CONFIG.votingOpens).getTime()&&now<new Date(CONFIG.votingCloses).getTime()}
function votingPhase(){const now=Date.now(),opens=new Date(CONFIG.votingOpens).getTime(),closes=new Date(CONFIG.votingCloses).getTime(),announce=new Date(CONFIG.awardsAnnounced).getTime();return now<opens?'pre':now<closes?'open':now<announce?'closed':'announced'}
function votingCountdownText(){const phase=votingPhase(),target=phase==='pre'?new Date(CONFIG.votingOpens).getTime():phase==='open'?new Date(CONFIG.votingCloses).getTime():phase==='closed'?new Date(CONFIG.awardsAnnounced).getTime():0;if(phase==='announced')return 'Winners announced 1 March';const remaining=Math.max(0,target-Date.now()),days=Math.floor(remaining/864e5),hours=Math.floor((remaining%864e5)/36e5),minutes=Math.floor((remaining%36e5)/6e4),seconds=Math.floor((remaining%6e4)/1000);const lead=phase==='pre'?'Voting opens':phase==='open'?'Voting closes':'Winners announced';return `${lead} in ${days}d ${hours}h ${minutes}m ${seconds}s`}
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
  const open=votingOpen(),phase=votingPhase(),countdown=votingCountdownText();
  $("votingCountdown").textContent=countdown;
  ["allNba","rookie","mip"].forEach(category=>{
    const status=$(category==="allNba"?"allNbaStatus":category==="rookie"?"rookieStatus":"mipStatus");
    if(categorySubmitted(category)){
      lockCategory(category,"Vote submitted");
      if(status)status.textContent="Your vote has been locked on this device."
    }else if(!open){
      const message=phase==='pre'?'Voting opens 23 February':phase==='closed'?'Voting closed — winners announced 1 March':'Winners announced 1 March';
      lockCategory(category,message);
      if(status)status.textContent=countdown
    }else{
      unlockCategory(category);
      if(status)status.textContent="Voting closes 28 February. One submission allowed on this device."
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

function managerTrades(managerId){
  const id=String(managerId);
  if(state.computedCache.managerTrades.has(id))return state.computedCache.managerTrades.get(id);
  const rows=state.trades.filter(t=>mids(t).includes(id));
  state.computedCache.managerTrades.set(id,rows);
  return rows
}
function seasonAverageMap(season){
  const key=String(season);
  if(state.computedCache.seasonAverages.has(key))return state.computedCache.seasonAverages.get(key);
  const totals=seasonTotalAverageMap(key),exact=exactAverageMap(key),bundle=bundleForSeason(key);
  let result;
  if(!bundle)result={...exact,...totals};
  else{const weeks=meaningfulWeeks(bundle);result=weeks.length?buildPlayerAverages(bundle,weeks.at(-1)):{...exact,...totals}}
  state.computedCache.seasonAverages.set(key,result);
  return result;
}
function managerRosterPlayers(managerId,season=state.profileAverageSeason){
  const manager=state.managers.get(String(managerId)),ids=[...(manager?.roster?.players||[])],avgMap=seasonAverageMap(season);
  const leagueRank=Object.fromEntries(Object.entries(avgMap).filter(([,v])=>Number(v)>0).sort((a,b)=>Number(b[1])-Number(a[1])||String(a[0]).localeCompare(String(b[0]))).map(([pid],i)=>[String(pid),i+1]));
  return ids.map(id=>{const p=state.players[id]||{},avg=Number(avgMap[id]||0);return{id:String(id),name:playerName(id),avg,avgRank:leagueRank[String(id)]||null,position:p.position||p.fantasy_positions?.[0]||"—",age:Number(p.age)||null,avatar:`https://sleepercdn.com/content/nba/players/${id}.jpg`}}).sort((a,b)=>b.avg-a.avg||a.name.localeCompare(b.name))
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
  // Use the same canonical current-ownership list shown in the manager profile.
  // This prevents original picks that have already been traded away from being
  // counted as if the original manager still owns them.
  return managerCurrentDraftPicks(managerId).filter(p=>Number(p.round)===1).length
}
function managerBadges(managerId){
  const id=String(managerId),badges=[],trades=managerTrades(id),cutoff=Date.now()-28*864e5,recent28=trades.filter(t=>(t.created||0)>=cutoff).length;
  if(recent28>=5)badges.push({icon:"⚡",name:"The Day Trader",copy:`Completed ${recent28} trades in the last 28 days.`});
  const firsts=upcomingFirstCount(id);if(firsts>=4)badges.push({icon:"🧰",name:"Draft Capital Hoarder",copy:`Currently controls ${firsts} upcoming first-round picks.`});if(firsts===0)badges.push({icon:"🎯",name:"Win-Now",copy:"Has no future first-round picks and is fully committed to winning now."});
  const seasonTrades=currentSeasonTrades().filter(t=>mids(t).includes(id)),partners=new Set(seasonTrades.flatMap(t=>mids(t).filter(x=>x!==id)));if(state.managers.size>1&&partners.size>=state.managers.size-1)badges.push({icon:"🤝",name:"The Negotiator",copy:"Has traded with every other GM this season."});if(championManagerIds().has(id))badges.push({icon:"🏆",name:"Champion",copy:"Has won an IMO Dynasty Cup championship."});
  const weeks=meaningfulWeeks(state.modelBundle),through=weeks.at(-1)||Infinity,odds=priceRows(through);if(odds.length&&odds.at(-1)?.id===id)badges.push({icon:"🥞",name:"Pancakes",copy:"Currently owns the longest championship odds."});
  const currentSeason=String(state.bundles.find(b=>String(b.league?.league_id)===CONFIG.currentLeagueId)?.league?.season||state.modelBundle?.league?.season||"2026"),avgMap=seasonAverageMap(currentSeason),topPlayer=Object.entries(avgMap).sort((a,b)=>b[1]-a[1])[0]?.[0],manager=state.managers.get(id),roster=(manager?.roster?.players||[]).map(String);if(topPlayer&&roster.includes(String(topPlayer)))badges.push({icon:"👑",name:"MVP",copy:`Currently owns ${playerName(topPlayer)}, the league's highest-average player.`});
  const infinityPlayers=roster.filter(pid=>Number(avgMap[pid]||0)>28);if(infinityPlayers.length>=5)badges.push({icon:"💎",name:"Infinity Stones",copy:`Owns ${infinityPlayers.length} players averaging more than 28.00 this season.`});
  const currentForm=managerFormData(id),lastFive=currentForm.outcomes.slice(-5);if(lastFive.length===5&&lastFive.every(g=>g.result===0))badges.push({icon:"🏖️",name:"Cancun",copy:"Has lost five games in a row."});
  const young=roster.filter(pid=>Number(state.players[pid]?.age)<21).length,old=roster.filter(pid=>Number(state.players[pid]?.age)>30).length;if(young>10)badges.push({icon:"🐶",name:"Young Pups",copy:`Owns ${young} players under the age of 21.`});if(old>=8)badges.push({icon:"🐕",name:"Old Dogs",copy:`Owns ${old} players over the age of 30.`});return badges
}
function managerAverageAge(id){const ages=managerRosterPlayers(id,"2025").map(x=>x.age).filter(Number.isFinite);return ages.length?ages.reduce((a,b)=>a+b,0)/ages.length:0}
function fileSafeName(v){return String(v||'manager').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'manager'}
function managerShareCardData(managerId){
  const id=String(managerId),manager=state.managers.get(id);if(!manager)return null;
  const bundle=currentBundle(),season=String(bundle?.league?.season||'2026'),weeks=meaningfulWeeks(state.modelBundle),through=weeks.at(-1)||Infinity,power=modelRows(state.modelBundle,through,'power').find(x=>String(x.id)===id)||null,odds=priceRows(through).find(x=>String(x.id)===id)||null,form=managerFormData(id),gm=managerGMProfile(id),avgAge=managerAverageAge(id);
  let roster=managerRosterPlayers(id,season);if(!roster.some(p=>Number(p.avg)>0))roster=managerRosterPlayers(id,'2025');
  const bestPlayer=roster[0]||null;
  return{id,name:manager.name,avatar:manager.avatar,initials:manager.initials||manager.name.split(/\s+/).slice(0,2).map(z=>z[0]).join('').toUpperCase(),powerRank:power?.rank||null,ladderRank:power?.standingRank||null,record:form.games?`${form.wins}-${form.games-form.wins}`:'—',bestPlayer:bestPlayer?.name||'—',bestPlayerAvatar:bestPlayer?.avatar||null,averageAge:Number.isFinite(avgAge)&&avgAge>0?avgAge.toFixed(1):'—',archetype:gm?.primary?.name||'—',championshipOdds:odds?championshipOddsLabel(odds):'—'}
}
function blobToDataURL(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob)})}
async function imageFromDataURL(dataUrl){return await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=dataUrl})}
async function loadImageAsset(url){
  if(!url)return null;
  const attempts=[url,`https://images.weserv.nl/?url=${encodeURIComponent(url)}&output=png`];
  for(const src of attempts){try{const res=await fetch(src,{mode:'cors',cache:'force-cache'});if(!res.ok)throw new Error(res.status);const blob=await res.blob();return await imageFromDataURL(await blobToDataURL(blob))}catch{}}
  return null
}
function roundedRectPath(ctx,x,y,w,h,r){const rr=Math.max(0,Math.min(r,Math.min(w,h)/2));ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath()}
function fillRoundedRect(ctx,x,y,w,h,r,fill,stroke=null,lineWidth=1){ctx.save();roundedRectPath(ctx,x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.lineWidth=lineWidth;ctx.strokeStyle=stroke;ctx.stroke()}ctx.restore()}
function fitFontSize(ctx,text,maxWidth,start,min=24,weight='800',family='Inter,Arial,sans-serif'){let size=start;for(;size>min;size-=2){ctx.font=`${weight} ${size}px ${family}`;if(ctx.measureText(String(text)).width<=maxWidth)break}return size}
function drawCoverImage(ctx,img,x,y,w,h,r=0){ctx.save();if(r){roundedRectPath(ctx,x,y,w,h,r);ctx.clip()}const scale=Math.max(w/img.width,h/img.height),dw=img.width*scale,dh=img.height*scale;ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh);ctx.restore()}
function drawAvatarFallback(ctx,x,y,size,initials){const grad=ctx.createLinearGradient(x,y,x+size,y+size);grad.addColorStop(0,'#10b981');grad.addColorStop(1,'#8b5cf6');fillRoundedRect(ctx,x,y,size,size,30,grad);ctx.fillStyle='#f8fafc';ctx.font=`900 ${Math.round(size*.36)}px Inter,Arial,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(initials||'IM',x+size/2,y+size/2+3);ctx.textAlign='left';ctx.textBaseline='alphabetic'}
async function buildManagerShareCardCanvas(data){
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1080;const ctx=canvas.getContext('2d');
  const bg=ctx.createLinearGradient(0,0,1080,1080);bg.addColorStop(0,'#08111f');bg.addColorStop(.55,'#050914');bg.addColorStop(1,'#10162a');ctx.fillStyle=bg;ctx.fillRect(0,0,1080,1080);
  const glowA=ctx.createRadialGradient(120,90,0,120,90,420);glowA.addColorStop(0,'rgba(52,211,153,.18)');glowA.addColorStop(1,'rgba(52,211,153,0)');ctx.fillStyle=glowA;ctx.fillRect(0,0,1080,1080);
  const glowB=ctx.createRadialGradient(1010,100,0,1010,100,360);glowB.addColorStop(0,'rgba(139,92,246,.18)');glowB.addColorStop(1,'rgba(139,92,246,0)');ctx.fillStyle=glowB;ctx.fillRect(0,0,1080,1080);
  fillRoundedRect(ctx,34,34,1012,1012,34,'rgba(2,6,23,.36)','rgba(148,163,184,.16)',2);
  ctx.fillStyle='#34d399';ctx.font='900 21px Inter,Arial,sans-serif';ctx.fillText('IMO DYNASTY',72,82);ctx.fillStyle='rgba(226,232,240,.68)';ctx.font='700 17px Inter,Arial,sans-serif';ctx.fillText('MANAGER PROFILE',72,108);

  const [managerAvatar,bestAvatar]=await Promise.all([loadImageAsset(data.avatar),loadImageAsset(data.bestPlayerAvatar)]);
  const avatarX=72,avatarY=145,avatarSize=176;
  if(managerAvatar)drawCoverImage(ctx,managerAvatar,avatarX,avatarY,avatarSize,avatarSize,34);else drawAvatarFallback(ctx,avatarX,avatarY,avatarSize,data.initials);
  fillRoundedRect(ctx,avatarX,avatarY,avatarSize,avatarSize,34,null,'rgba(52,211,153,.52)',3);

  const nameX=286,nameY=174,nameMax=704;const nameSize=fitFontSize(ctx,data.name,nameMax,72,38,'900');ctx.fillStyle='#f8fafc';ctx.font=`900 ${nameSize}px Inter,Arial,sans-serif`;ctx.fillText(data.name,nameX,nameY);
  ctx.fillStyle='rgba(226,232,240,.72)';ctx.font='600 24px Inter,Arial,sans-serif';ctx.fillText('Current IMO Dynasty franchise snapshot',nameX,nameY+42);
  fillRoundedRect(ctx,nameX,nameY+70,310,50,20,'rgba(16,185,129,.11)','rgba(52,211,153,.28)',2);ctx.fillStyle='#6ee7b7';ctx.font='800 16px Inter,Arial,sans-serif';ctx.fillText('ARCHETYPE',nameX+18,nameY+101);ctx.fillStyle='#f0fdf4';const archSize=fitFontSize(ctx,data.archetype,180,21,15,'900');ctx.font=`900 ${archSize}px Inter,Arial,sans-serif`;ctx.fillText(data.archetype,nameX+122,nameY+101);
  fillRoundedRect(ctx,nameX+326,nameY+70,250,50,20,'rgba(139,92,246,.11)','rgba(167,139,250,.28)',2);ctx.fillStyle='#c4b5fd';ctx.font='800 16px Inter,Arial,sans-serif';ctx.fillText('TITLE ODDS',nameX+344,nameY+101);ctx.fillStyle='#f8fafc';ctx.font='900 22px Inter,Arial,sans-serif';ctx.fillText(data.championshipOdds,nameX+450,nameY+101);

  const margin=72,gap=22,colW=(1080-margin*2-gap)/2,cardH=132,row1=354,row2=508,row3=662;
  function statCard(x,y,label,value,accent,valueSize=52){fillRoundedRect(ctx,x,y,colW,cardH,24,'rgba(15,23,42,.80)','rgba(148,163,184,.17)',2);ctx.fillStyle=accent;ctx.font='800 16px Inter,Arial,sans-serif';ctx.fillText(label.toUpperCase(),x+24,y+34);const size=fitFontSize(ctx,value,colW-48,valueSize,26,'900');ctx.fillStyle='#f8fafc';ctx.font=`900 ${size}px Inter,Arial,sans-serif`;ctx.fillText(String(value),x+24,y+92)}
  statCard(margin,row1,'Power Rank',data.powerRank?`#${data.powerRank}`:'—','#34d399',60);
  statCard(margin+colW+gap,row1,'Ladder Position',data.ladderRank?`#${data.ladderRank}`:'—','#a78bfa',60);
  statCard(margin,row2,'Record',data.record,'#38bdf8',56);
  statCard(margin+colW+gap,row2,'Championship Odds',data.championshipOdds,'#fbbf24',48);
  statCard(margin,row3,'Average Age',data.averageAge,'#60a5fa',54);
  statCard(margin+colW+gap,row3,'Archetype',data.archetype,'#c084fc',34);

  const bestY=816,bestH=160;fillRoundedRect(ctx,margin,bestY,936,bestH,26,'rgba(15,23,42,.84)','rgba(148,163,184,.18)',2);
  ctx.fillStyle='#34d399';ctx.font='800 16px Inter,Arial,sans-serif';ctx.fillText('BEST PLAYER',margin+24,bestY+34);
  const pSize=98,pX=margin+24,pY=bestY+48;if(bestAvatar)drawCoverImage(ctx,bestAvatar,pX,pY,pSize,pSize,24);else drawAvatarFallback(ctx,pX,pY,pSize,(data.bestPlayer||'—').split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase());fillRoundedRect(ctx,pX,pY,pSize,pSize,24,null,'rgba(52,211,153,.34)',2);
  const bestNameX=pX+pSize+24,bestNameMax=936-(bestNameX-margin)-28,bestSize=fitFontSize(ctx,data.bestPlayer,bestNameMax,50,26,'900');ctx.fillStyle='#f8fafc';ctx.font=`900 ${bestSize}px Inter,Arial,sans-serif`;ctx.fillText(data.bestPlayer,bestNameX,bestY+108);

  ctx.fillStyle='rgba(226,232,240,.48)';ctx.font='600 15px Inter,Arial,sans-serif';ctx.fillText('Generated from live IMO HUB data',72,1018);ctx.textAlign='right';ctx.fillText('1080 × 1080 PNG',1008,1018);ctx.textAlign='left';
  return canvas
}
async function downloadManagerShareCard(managerId,button){
  const data=managerShareCardData(managerId);if(!data)return;
  const buttons=document.querySelectorAll(`[data-download-manager-share-card="${CSS.escape(String(managerId))}"]`),reset=()=>buttons.forEach(btn=>{btn.disabled=false;btn.classList.remove('is-loading','is-success','is-error');btn.textContent='↓'});
  buttons.forEach(btn=>{btn.disabled=true;btn.classList.remove('is-success','is-error');btn.classList.add('is-loading');btn.textContent='…'});
  try{const canvas=await buildManagerShareCardCanvas(data);const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG export failed')),'image/png'));const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`imo-dynasty-${fileSafeName(data.name)}-share-card.png`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);buttons.forEach(btn=>{btn.disabled=false;btn.classList.remove('is-loading','is-error');btn.classList.add('is-success');btn.textContent='✓'});setTimeout(()=>reset('🖼️'),1600)}catch(error){console.error('Failed to download manager share card',error);buttons.forEach(btn=>{btn.disabled=false;btn.classList.remove('is-loading','is-success');btn.classList.add('is-error');btn.textContent='!'});setTimeout(()=>reset('🖼️'),1800)}}
function favouriteTradePartners(id){const all=managerTrades(id),counts={};all.forEach(t=>mids(t).filter(x=>x!==String(id)).forEach(x=>counts[x]=(counts[x]||0)+1));return Object.entries(counts).map(([partner,count])=>({partner,count,percent:all.length?count/all.length*100:0})).sort((a,b)=>b.count-a.count).slice(0,7)}
function teamFormPlayers(id){const rosterIds=new Set((state.managers.get(String(id))?.roster?.players||[]).map(String)),rows=allGameLogFormRows().filter(x=>rosterIds.has(String(x.id)));return{poor:rows.filter(x=>x.change<0).sort((a,b)=>a.change-b.change).slice(0,3),good:rows.filter(x=>x.change>0).sort((a,b)=>b.change-a.change).slice(0,3)}}
function teamHighestScore(id,bundles){let best=null;bundles.forEach(b=>b.matchups.forEach(m=>{if(String(b.ownerByRoster?.[String(m.roster_id)])!==String(id))return;const pts=Number(m.points);if(Number.isFinite(pts)&&(!best||pts>best.pts))best={pts,week:m.week,season:b.league.season}}));return best}
function managerRecentMatchups(id){const bundle=state.modelBundle,rows=matchupRows(bundle),byWeek={};rows.forEach(x=>(byWeek[x.week]??=[]).push(x));const results=[];Object.entries(byWeek).forEach(([week,weekRows])=>{const groups={};weekRows.forEach(x=>{if(x.matchup_id!=null)(groups[x.matchup_id]??=[]).push(x)});Object.values(groups).forEach(g=>{const mine=g.find(x=>String(bundle.ownerByRoster?.[String(x.roster_id)])===String(id)),opp=g.find(x=>x!==mine);if(!mine||!opp)return;const myPts=Number(mine.points),oppPts=Number(opp.points);if(!Number.isFinite(myPts)||!Number.isFinite(oppPts)||(myPts===0&&oppPts===0))return;const oppId=bundle.ownerByRoster?.[String(opp.roster_id)],result=myPts===oppPts?"D":myPts>oppPts?"W":"L";results.push({week:Number(week),result,myPts,oppPts,oppId})})});return results.sort((a,b)=>a.week-b.week).slice(-5)}
function managerHeadToHead(id){
  const records={};
  state.bundles.forEach(bundle=>{const byWeek={};matchupRows(bundle).forEach(row=>(byWeek[row.week]??=[]).push(row));Object.values(byWeek).forEach(weekRows=>{const groups={};weekRows.forEach(row=>{if(row.matchup_id!=null)(groups[row.matchup_id]??=[]).push(row)});Object.values(groups).forEach(group=>{const mine=group.find(row=>String(bundle.ownerByRoster?.[String(row.roster_id)])===String(id)),opp=group.find(row=>row!==mine);if(!mine||!opp)return;const oppId=String(bundle.ownerByRoster?.[String(opp.roster_id)]||"");if(!oppId||oppId===String(id)||!state.managers.has(oppId))return;const minePts=Number(mine.points),oppPts=Number(opp.points);if(!Number.isFinite(minePts)||!Number.isFinite(oppPts)||(minePts===0&&oppPts===0))return;const rec=records[oppId]??={oppId,wins:0,losses:0,draws:0,games:0};rec.games++;if(minePts>oppPts)rec.wins++;else if(minePts<oppPts)rec.losses++;else rec.draws++})})});
  return Object.values(records).sort((a,b)=>b.games-a.games||managerName(a.oppId).localeCompare(managerName(b.oppId)))
}
function completedMatchupsForBundle(bundle){const cacheKey=String(bundle?.league?.league_id||bundle?.league?.season||'unknown');if(state.computedCache.completedMatchups.has(cacheKey))return state.computedCache.completedMatchups.get(cacheKey);const byWeek={};matchupRows(bundle).forEach(row=>(byWeek[row.week]??=[]).push(row));const games=[];Object.entries(byWeek).forEach(([week,rows])=>{const groups={};rows.forEach(row=>{if(row.matchup_id!=null)(groups[row.matchup_id]??=[]).push(row)});Object.values(groups).forEach(group=>{if(group.length<2)return;const a=group[0],b=group[1],aPts=Number(a.points),bPts=Number(b.points);if(!Number.isFinite(aPts)||!Number.isFinite(bPts)||(aPts===0&&bPts===0))return;const aId=String(bundle.ownerByRoster?.[String(a.roster_id)]||''),bId=String(bundle.ownerByRoster?.[String(b.roster_id)]||'');if(!aId||!bId||aId===bId)return;games.push({season:String(bundle.league?.season||''),week:Number(week),aId,bId,aPts,bPts})})});state.computedCache.completedMatchups.set(cacheKey,games);return games}
function managerBiggestResult(id){let win=null,loss=null;state.bundles.forEach(bundle=>completedMatchupsForBundle(bundle).forEach(g=>{let mine,opp,oppId;if(g.aId===String(id)){mine=g.aPts;opp=g.bPts;oppId=g.bId}else if(g.bId===String(id)){mine=g.bPts;opp=g.aPts;oppId=g.aId}else return;if(!state.managers.has(oppId))return;const margin=mine-opp,item={margin:Math.abs(margin),oppId,week:g.week,season:g.season,myPts:mine,oppPts:opp};if(margin>0&&(!win||item.margin>win.margin))win=item;if(margin<0&&(!loss||item.margin>loss.margin))loss=item}));return{win,loss}}
function finalResult(bundle){const bracket=bundle.winnersBracket||[];if(!bracket.length)return null;const maxRound=Math.max(...bracket.map(x=>Number(x.r)||0)),finals=bracket.filter(x=>Number(x.r)===maxRound&&x.w!=null&&x.l!=null);const final=finals[0];if(!final)return null;return{winner:String(bundle.ownerByRoster?.[String(final.w)]||''),runnerUp:String(bundle.ownerByRoster?.[String(final.l)]||'')}}
function regularSeasonWinnerIds(bundle){const start=Number(bundle.league?.settings?.playoff_week_start)||Infinity,through=Number.isFinite(start)?start-1:Infinity,table=standingsTable(bundle,through);if(!table.length)return[];const best=table[0];return table.filter(x=>x.wins===best.wins&&x.pts===best.pts).map(x=>String(x.id))}
function trophyCabinetData(managerId){const id=String(managerId),t=[];const champs=[],runners=[],regular=[],tradeKings=[];state.bundles.forEach(bundle=>{const season=String(bundle.league?.season||''),final=finalResult(bundle);if(final?.winner===id)champs.push(season);if(final?.runnerUp===id)runners.push(season);if(meaningfulWeeks(bundle).length&&regularSeasonWinnerIds(bundle).includes(id))regular.push(season);const counts={};bundle.trades.forEach(tr=>mids(tr).forEach(mid=>counts[mid]=(counts[mid]||0)+1));const max=Math.max(0,...Object.values(counts));if(max>0&&(counts[id]||0)===max)tradeKings.push(season)});if(champs.length)t.push({icon:'🏆',name:'Championships',value:String(champs.length),detail:champs.sort().join(' · ')});if(regular.length)t.push({icon:'🥇',name:'Regular Season Titles',value:String(regular.length),detail:regular.sort().join(' · ')});if(runners.length)t.push({icon:'🎖️',name:'Runner-Up',value:String(runners.length),detail:runners.sort().join(' · ')});if(tradeKings.length)t.push({icon:'🤝',name:'Trade King',value:String(tradeKings.length),detail:tradeKings.sort().join(' · ')});
  const allGames=state.bundles.flatMap(completedMatchupsForBundle);let leagueStreak=0,streakOwners=[];for(const m of state.managers.values()){let best=0;state.bundles.forEach(bundle=>{let run=0;completedMatchupsForBundle(bundle).filter(g=>g.aId===m.id||g.bId===m.id).sort((a,b)=>a.week-b.week).forEach(g=>{const won=(g.aId===m.id?g.aPts>g.bPts:g.bPts>g.aPts);run=won?run+1:0;best=Math.max(best,run)})});if(best>leagueStreak){leagueStreak=best;streakOwners=[m.id]}else if(best===leagueStreak&&best>0)streakOwners.push(m.id)}if(streakOwners.includes(id))t.push({icon:'🔥',name:'Longest Win Streak',value:`${leagueStreak} straight wins`,detail:'League record'});
  const scores=[];allGames.forEach(g=>{scores.push({id:g.aId,pts:g.aPts,week:g.week,season:g.season});scores.push({id:g.bId,pts:g.bPts,week:g.week,season:g.season})});const high=Math.max(0,...scores.map(x=>x.pts));const highMine=scores.find(x=>x.id===id&&x.pts===high);if(highMine)t.push({icon:'💯',name:'Highest Weekly Score',value:`${high.toFixed(1)} points`,detail:`Week ${highMine.week} · ${highMine.season}`});
  const margins=[];allGames.forEach(g=>{if(g.aPts>g.bPts)margins.push({id:g.aId,opp:g.bId,margin:g.aPts-g.bPts,week:g.week,season:g.season});else if(g.bPts>g.aPts)margins.push({id:g.bId,opp:g.aId,margin:g.bPts-g.aPts,week:g.week,season:g.season})});const maxMargin=Math.max(0,...margins.map(x=>x.margin));const marginMine=margins.find(x=>x.id===id&&Math.abs(x.margin-maxMargin)<.0001);if(marginMine)t.push({icon:'💥',name:'Largest Margin of Victory',value:`+${maxMargin.toFixed(1)} points`,detail:`vs ${managerName(marginMine.opp)} · Week ${marginMine.week} · ${marginMine.season}`});return t}
function trophyCabinetHTML(id){const trophies=trophyCabinetData(id);return trophies.length?`<div class="trophy-grid">${trophies.map(x=>`<div class="trophy-card"><span class="trophy-icon">${x.icon}</span><div><strong>${esc(x.name)}</strong><b>${esc(x.value)}</b><small>${esc(x.detail)}</small></div></div>`).join('')}</div>`:'<div class="profile-empty">No permanent trophies earned yet.</div>'}
function allNBAEligible(id){const season=state.profileAverageSeason==="2026"?"2026":"2025",avg=seasonAverageMap(season),top50=new Set(Object.entries(avg).filter(([,v])=>Number(v)>0).sort((a,b)=>b[1]-a[1]).slice(0,50).map(([pid])=>String(pid)));return managerRosterPlayers(id,season).filter(p=>top50.has(String(p.id)))}
function badgeIconsHTML(badges){return badges.map(b=>`<details class="profile-badge-pop"><summary title="${esc(b.name)}">${b.icon}</summary><div><strong>${esc(b.name)}</strong><small>${esc(b.copy)}</small></div></details>`).join("")}
function playerFormMini(rows,positive){return rows.length?rows.map(x=>`<div class="profile-form-player">${playerLink(x.id,x.name)}<span class="form-change ${positive?'positive':'negative'}">${x.change>0?'+':''}${x.change.toFixed(1)} <i aria-hidden="true">${positive?'↑':'↓'}</i></span><small>${x.priorAvg.toFixed(1)} → ${x.recentAvg.toFixed(1)}</small></div>`).join(""):'<div class="profile-empty">No qualifying players.</div>'}

function currentRosterIds(managerId){return (state.managers.get(String(managerId))?.roster?.players||[]).map(String)}
function currentBundle(){return state.bundles.find(b=>String(b.league?.league_id)===CONFIG.currentLeagueId)||state.bundles[0]||null}
function managerFuturePickCounts(managerId){
  const picks=managerCurrentDraftPicks(managerId),firsts=picks.filter(p=>Number(p.round)===1).length,seconds=picks.filter(p=>Number(p.round)===2).length;
  return{firsts,seconds,totalValue:firsts*17.5+seconds*2.5}
}
function managerCurrentDraftPicks(managerId){
  const bundle=currentBundle();if(!bundle)return[];
  const currentSeason=Number(bundle.league?.season)||2026,moved=bundle.tradedPicks||[],maxMovedSeason=Math.max(currentSeason+3,...moved.map(p=>Number(p.season)||0)),seasons=[];
  for(let season=currentSeason+1;season<=maxMovedSeason;season++)seasons.push(season);
  const maxMovedRound=Math.max(0,...moved.map(p=>Number(p.round)||0)),rounds=Math.max(4,Number(bundle.league?.settings?.draft_rounds)||0,maxMovedRound),out=[];
  // Sleeper identifies a pick by season + round + its original roster slot.
  // Build one canonical current-owner lookup and let the latest duplicate entry
  // win if the API ever returns the same pick more than once.
  const currentOwnerByPick=new Map();
  moved.forEach(p=>{const originalRosterId=String(p.roster_id??p.original_roster_id??'');if(!originalRosterId)return;currentOwnerByPick.set(`${String(p.season)}|${Number(p.round)}|${originalRosterId}`,String(p.owner_id??originalRosterId))});
  seasons.forEach(season=>(bundle.rosters||[]).forEach(originalRoster=>{for(let round=1;round<=rounds;round++){
    const originalRosterId=String(originalRoster.roster_id),pickKey=`${String(season)}|${round}|${originalRosterId}`,ownerRoster=currentOwnerByPick.get(pickKey)||originalRosterId,ownerUser=String(bundle.ownerByRoster?.[ownerRoster]||'');
    if(ownerUser!==String(managerId))continue;
    const originalUser=String(bundle.ownerByRoster?.[originalRosterId]||''),originalName=managerName(originalUser),pick={season:String(season),round,roster_id:originalRosterId,original_roster_id:originalRosterId,owner_id:ownerRoster},key=pickAssetKey(pick),label=`${season} Round ${round} Pick (${originalName}'s pick)`;
    out.push({season,round,key,label,originalName});
  }}));
  return out.sort((a,b)=>a.round-b.round||a.season-b.season||a.originalName.localeCompare(b.originalName))
}
function managerDraftPicksHTML(managerId){
  const picks=managerCurrentDraftPicks(managerId),firsts=picks.filter(p=>p.round===1),later=picks.filter(p=>p.round!==1),rows=list=>list.map(p=>`<div class="manager-future-pick-row"><span class="manager-future-pick-icon">◆</span>${pickHistoryLink(p.key,p.label,'pick-history-link manager-future-pick-link')}</div>`).join('');
  return `<section class="manager-profile-card profile-draft-picks-card"><div class="manager-profile-card-heading"><div><span class="eyebrow">DRAFT CAPITAL</span><h3>Current Draft Picks</h3></div><span class="period-pill">${picks.length} assets</span></div><div class="manager-future-picks-primary">${rows(firsts)||'<div class="profile-empty">No future first-round picks currently held.</div>'}</div>${later.length?`<details class="manager-future-picks-more"><summary>Show ${later.length} later-round pick${later.length===1?'':'s'}</summary><div class="manager-future-picks-list">${rows(later)}</div></details>`:''}</section>`
}
function managerWaiverMoves(managerId){
  const bundle=currentBundle();if(!bundle)return 0;const rosterId=String(state.managers.get(String(managerId))?.roster?.roster_id||'');
  return (bundle.transactions||[]).filter(t=>['waiver','free_agent'].includes(t.type)&&(!t.status||t.status==='complete')).filter(t=>{
    if((t.roster_ids||[]).map(String).includes(rosterId))return true;
    return Object.values(t.adds||{}).map(String).includes(rosterId)||Object.values(t.drops||{}).map(String).includes(rosterId)
  }).length
}
function managerPlayerValue(managerId){
  const ids=currentRosterIds(managerId),season=String(currentBundle()?.league?.season||'2026'),avg=seasonAverageMap(season),fallback=seasonAverageMap('2025');
  return ids.reduce((sum,pid)=>{const a=Number(avg[pid]||fallback[pid]||latestKnownAverage(pid)||0);return sum+playerDynastyValue(pid,a,Date.now())},0)
}
function managerStarCount(managerId){
  const ids=currentRosterIds(managerId),season=String(currentBundle()?.league?.season||'2026'),avg=seasonAverageMap(season),fallback=seasonAverageMap('2025');
  return ids.filter(pid=>Number(avg[pid]||fallback[pid]||latestKnownAverage(pid)||0)>=28).length
}
function managerTradeRiskRaw(managerId){
  const trades=managerTrades(managerId);if(!trades.length)return 0;let score=0;
  trades.forEach(t=>{const received=tradeAssets(t)[String(managerId)]||[],sent=tradeOutgoingAssets(t)[String(managerId)]||[],assets=received.length+sent.length,total=[...received,...sent].reduce((a,x)=>a+(Number(x.value)||0),0),firsts=[...received,...sent].filter(x=>x.type==='pick'&&/Round 1|First/i.test(x.name)).length,stars=[...received,...sent].filter(x=>x.type==='player'&&Number(x.value)>=35).length;score+=Math.min(4,assets/2)+Math.min(5,total/45)+firsts*1.5+stars*1.2});
  return score/trades.length*Math.log2(trades.length+1)
}
function managerTradeEfficiencyRaw(managerId){
  const trades=managerTrades(managerId);if(!trades.length)return 50;const vals=trades.map(t=>{const m=tradeSideMetrics(t,managerId);return 50+Math.max(-40,Math.min(40,m.edge*160))});return vals.reduce((a,b)=>a+b,0)/vals.length
}
function leagueScale(rawById,invert=false){
  const vals=Object.values(rawById).filter(Number.isFinite),min=Math.min(...vals),max=Math.max(...vals);const out={};Object.entries(rawById).forEach(([id,v])=>{let n=max===min?.5:(v-min)/(max-min);if(invert)n=1-n;out[id]=Math.round(25+n*74)});return out
}
function calibratedLeagueScale(rawById,low=44,high=91){
  const entries=Object.entries(rawById).filter(([,v])=>Number.isFinite(v)).sort((a,b)=>a[1]-b[1]),out={};
  if(!entries.length)return out;
  if(entries.length===1){out[entries[0][0]]=68;return out}
  entries.forEach(([id],i)=>{const percentile=i/(entries.length-1),curved=.5+(percentile-.5)*.86;out[id]=Math.round(low+Math.max(0,Math.min(1,curved))*(high-low))});
  return out
}
function managerTendencyLeague(){
  if(state.computedCache.tendencyLeague)return state.computedCache.tendencyLeague;
  const ids=[...state.managers.keys()],bundle=currentBundle(),weeks=meaningfulWeeks(bundle||{matchups:[]}),through=weeks.at(-1)||Infinity,powerRows=bundle?modelRows(bundle,through,'power'):[],oddsRows=bundle?priceRows(through):[],powerBy=Object.fromEntries(powerRows.map(x=>[String(x.id),x])),oddsBy=Object.fromEntries(oddsRows.map(x=>[String(x.id),x]));
  const raw={trade:{},youth:{},winNow:{},draft:{},waiver:{},risk:{},asset:{},star:{}};
  ids.forEach(id=>{const roster=managerRosterPlayers(id,'2025'),ages=roster.map(x=>x.age).filter(Number.isFinite),avgAge=ages.length?ages.reduce((a,b)=>a+b,0)/ages.length:27,under25=ages.length?ages.filter(x=>x<25).length/ages.length:0,picks=managerFuturePickCounts(id),p=powerBy[id],o=oddsBy[id],playerValue=managerPlayerValue(id),stars=managerStarCount(id),career=managerTrades(id).length,season=currentSeasonTrades().filter(t=>mids(t).includes(id)).length;
    raw.trade[id]=season*3+career*.45;
    raw.youth[id]=(31-avgAge)*8+under25*45+picks.firsts*2;
    raw.winNow[id]=(p?Math.max(0,state.managers.size-p.standingRank+1)*7:0)+(p?.avg5||0)/8+(o&&!o.eliminated?Math.max(0,55-o.odds):0)+Math.max(0,avgAge-26)*5-picks.firsts*1.5;
    raw.draft[id]=picks.totalValue;
    raw.waiver[id]=managerWaiverMoves(id);
    raw.risk[id]=managerTradeRiskRaw(id);
    raw.asset[id]=managerTradeEfficiencyRaw(id)*.65+playerValue*.35;
    raw.star[id]=stars*18+playerValue*.18;
  });
  const ratings={trade:leagueScale(raw.trade),youth:leagueScale(raw.youth),winNow:leagueScale(raw.winNow),draft:leagueScale(raw.draft),waiver:leagueScale(raw.waiver),risk:leagueScale(raw.risk),asset:leagueScale(raw.asset),star:leagueScale(raw.star)};
  const result={ratings,raw,week:weeks.at(-1)||0};state.computedCache.tendencyLeague=result;return result
}
function rankForRating(metric,id,league){const rows=[...state.managers.keys()].sort((a,b)=>league.ratings[metric][b]-league.ratings[metric][a]||managerName(a).localeCompare(managerName(b)));return rows.indexOf(String(id))+1}
function archetypeCandidates(r,picks,avgAge){return[
  {name:'The Rebuilder',icon:'🏗️',score:r.draft*.40+r.youth*.35+(100-r.winNow)*.25},
  {name:'The Wheel & Dealer',icon:'🤝',score:r.trade*.60+r.risk*.25+r.waiver*.15},
  {name:'The Veteran Chaser',icon:'🦖',score:(100-r.youth)*.45+r.winNow*.35+Math.max(0,avgAge-26)*8},
  {name:'The Contender',icon:'🏆',score:r.winNow*.55+r.star*.30+r.asset*.15},
  {name:'The Talent Collector',icon:'🎯',score:r.star*.55+r.asset*.30+r.risk*.15},
  {name:'Draft Capital King',icon:'💎',score:r.draft*.70+r.youth*.20+(picks.firsts>=5?15:0)},
  {name:'Diamond Hands',icon:'🛡️',score:(100-r.trade)*.65+(100-r.waiver)*.25+r.asset*.10},
  {name:'Prospect Hunter',icon:'🌱',score:r.youth*.70+r.draft*.20+(100-r.winNow)*.10},
  {name:'The Gambler',icon:'🎲',score:r.risk*.65+r.trade*.20+r.waiver*.15}
].sort((a,b)=>b.score-a.score)}
function managerScoutReport(name,r,primary,secondary){
  const strongest=Object.entries(r).sort((a,b)=>b[1]-a[1]).map(([k])=>k),weakest=[...strongest].reverse(),lead=strongest[0],support=strongest[1];
  const identity={
    'The Rebuilder':`${name} is operating with a long horizon, prioritising young assets and future flexibility over short-term results.`,
    'The Wheel & Dealer':`${name} remains one of the league's most active front offices, continually testing the market and reshaping the roster through trades.`,
    'The Veteran Chaser':`${name} has built around proven production, favouring established veterans who can contribute immediately.`,
    'The Contender':`${name} has assembled a roster designed to compete now, with high-end production and a clear focus on the championship window.`,
    'The Talent Collector':`${name} has concentrated premium talent at the top of the roster, building around players capable of deciding matchups.`,
    'Draft Capital King':`${name} has quietly become one of the league's premier asset accumulators, maintaining exceptional flexibility through elite draft capital.`,
    'Diamond Hands':`${name} runs a patient front office, preferring roster continuity and calculated moves over constant turnover.`,
    'Prospect Hunter':`${name} has committed to a youth-led build, consistently targeting players whose best fantasy seasons may still be ahead of them.`,
    'The Gambler':`${name} embraces volatility more than most, showing a willingness to make aggressive moves in pursuit of a major payoff.`
  }[primary.name]||`${name} presents as a balanced front office with a clearly defined roster-building identity.`;
  const detail={
    trade:'Trade activity remains central to the strategy, with the roster rarely standing still for long.',
    youth:'The roster construction is deliberately youthful, preserving both upside and long-term control.',
    winNow:'Recent decisions point firmly toward immediate competitiveness rather than patient development.',
    draft:'Draft capital provides the organisation with leverage, optionality and multiple paths forward.',
    waiver:'Consistent waiver activity gives the roster a steady stream of low-cost opportunities.',
    risk:'The front office is comfortable accepting variance when the potential return is significant.',
    asset:'Asset management has been a strength, with value generally preserved across roster moves.',
    star:'The roster carries genuine star power and is built to lean on elite fantasy production.'
  };
  const transition=r.winNow>=70&&r.draft>=70?'Despite retaining long-term flexibility, the current build is beginning to signal a transition toward contention.':r.winNow>=75?'The next challenge is converting that win-now profile into sustained results across the season.':r.youth>=75||r.draft>=75?'The key question is when that long-term value will be converted into established weekly production.':r.trade<=35?'Future improvement may depend on becoming more willing to use the trade market when opportunities emerge.':`The secondary ${secondary.name.toLowerCase()} profile adds another layer to an otherwise well-defined approach.`;
  return`${identity} ${detail[lead]} ${support!==lead?detail[support]:''} ${transition}`.replace(/\s+/g,' ').trim()
}
function managerTraits(r,picks,avgAge){const traits=[];if(r.trade>=75)traits.push('Loves trading');if(r.trade<=35)traits.push('Patient with the roster');if(r.youth>=75)traits.push('Invests heavily in youth');if(r.winNow>=75)traits.push('Aggressive win-now build');if(r.draft>=75)traits.push(`Controls premium draft capital`);if(picks.firsts>=5)traits.push(`Holds ${picks.firsts} future firsts`);if(r.waiver>=75)traits.push('Works the waiver wire');if(r.waiver<=35)traits.push('Rarely churns the roster');if(r.risk>=75)traits.push('Comfortable with blockbuster risk');if(r.asset>=75)traits.push('Strong asset manager');if(r.star>=75)traits.push('Collects elite talent');if(avgAge>=29)traits.push('Prefers proven veterans');return traits.slice(0,5)}
function managerWeaknesses(managerId,r,picks,avgAge){
  const id=String(managerId),seasonTrades=currentSeasonTrades().filter(t=>mids(t).includes(id)),careerTrades=managerTrades(id),roster=managerRosterPlayers(id,'2025');
  const seasonCounts=[...state.managers.keys()].map(mid=>currentSeasonTrades().filter(t=>mids(t).includes(String(mid))).length),seasonAvg=seasonCounts.reduce((a,b)=>a+b,0)/Math.max(1,seasonCounts.length),seasonCount=seasonTrades.length;
  const waiverCounts=[...state.managers.keys()].map(mid=>managerWaiverMoves(mid)),waiverAvg=waiverCounts.reduce((a,b)=>a+b,0)/Math.max(1,waiverCounts.length),waivers=managerWaiverMoves(id);
  const top8=roster.slice(0,8).map(x=>String(x.id)),top8Moved=top8.filter(pid=>careerTrades.some(t=>Object.prototype.hasOwnProperty.call(t.drops||{},pid))).length,leagueTop8MoveRates=[...state.managers.keys()].map(mid=>{const rr=managerRosterPlayers(mid,'2025').slice(0,8).map(x=>String(x.id)),tt=managerTrades(mid);return rr.length?rr.filter(pid=>tt.some(t=>Object.prototype.hasOwnProperty.call(t.drops||{},pid))).length/rr.length:0}),leagueTop8Avg=leagueTop8MoveRates.reduce((a,b)=>a+b,0)/Math.max(1,leagueTop8MoveRates.length),top8MoveRate=top8.length?top8Moved/top8.length:0;
  const values=roster.map(x=>Number(x.avg)||0).filter(x=>x>0),top3=values.slice(0,3).reduce((a,b)=>a+b,0),total=values.reduce((a,b)=>a+b,0),starShare=total?top3/total:0,midDepth=values.slice(5,12),midDepthAvg=midDepth.length?midDepth.reduce((a,b)=>a+b,0)/midDepth.length:0;
  const allMidDepth=[...state.managers.keys()].map(mid=>{const vals=managerRosterPlayers(mid,'2025').map(x=>Number(x.avg)||0).filter(x=>x>0).slice(5,12);return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0}),leagueMidDepth=allMidDepth.reduce((a,b)=>a+b,0)/Math.max(1,allMidDepth.length);
  const weeks=meaningfulWeeks(state.modelBundle),through=weeks.at(-1)||Infinity,power=modelRows(state.modelBundle,through,'power').find(x=>String(x.id)===id),standingGap=power?Number(power.standingRank)-Number(power.rank):0;
  const current=currentBundle(),currentWeeks=current?meaningfulWeeks(current):[],averageSeason=currentWeeks.length?String(current.league?.season||'2026'):String([...state.bundles].filter(b=>meaningfulWeeks(b).length).sort((a,b)=>Number(b.league?.season)-Number(a.league?.season))[0]?.league?.season||'2025'),leagueAverages=seasonAverageMap(averageSeason),top12Ids=new Set(Object.entries(leagueAverages).filter(([,avg])=>Number(avg)>0).sort((a,b)=>Number(b[1])-Number(a[1])).slice(0,12).map(([pid])=>String(pid))),currentRosterIds=new Set((state.managers.get(id)?.roster?.players||[]).map(String)),ownsTop12=[...top12Ids].some(pid=>currentRosterIds.has(pid));
  const candidates=[];
  const add=(score,label)=>{if(Number.isFinite(score)&&score>0)candidates.push({score,label})};
  const trulyInactive=seasonAvg>=1&&r.trade<35&&seasonCount<=Math.max(0,Math.floor(seasonAvg*.25));
  add(trulyInactive?82+Math.min(12,(seasonAvg-seasonCount)*5):0,'Needs to trade more');
  add(top8.length&&top8MoveRate+0.08<leagueTop8Avg?62+(leagueTop8Avg-top8MoveRate)*70:0,'Values own assets too much');
  add(seasonAvg>0&&seasonCount>seasonAvg*1.75?58+Math.min(35,(seasonCount/seasonAvg-1.75)*25):0,'Too quick to reshuffle');
  add(r.waiver<55?55+(55-r.waiver)*.7+(waiverAvg>waivers?10:0):0,'Leaves value on the waiver wire');
  add(picks.firsts<2&&avgAge>24?82+Math.min(12,(avgAge-24)*3):0,'Short on future flexibility');
  add(avgAge>=29&&picks.firsts<=2?82+(avgAge-29)*5:avgAge>=28.5?68+(avgAge-28.5)*6:0,'Too veteran-heavy');
  add(avgAge<=24.5&&r.winNow<55?76+(55-r.winNow)*.35:0,'Youth has not converted yet');
  add(avgAge>25.5&&avgAge<28.5&&r.winNow<58&&r.draft<58?72+(58-Math.max(r.winNow,r.draft))*.35:0,'Caught between timelines');
  add(starShare>=.48?64+(starShare-.48)*120:0,'Too reliant on star power');
  add(!ownsTop12?82+Math.max(0,55-r.star)*.35:0,'Roster lacks a clear centrepiece');
  add(leagueMidDepth>0&&midDepthAvg<leagueMidDepth*.88?68+(1-midDepthAvg/leagueMidDepth)*90:0,'Middle of the roster lacks depth');
  add(standingGap>=2?72+standingGap*6:0,'Results lag behind the roster');
  add(standingGap<=-2?68+Math.abs(standingGap)*5:0,'Overperforming fragile foundations');
  add(r.risk>=82?70+(r.risk-82)*.8:0,'Too comfortable with blockbuster risk');
  add(r.asset<48?66+(48-r.asset)*.55:0,'Asset value leaks through trades');
  add(r.winNow<45&&r.draft<55?70+(45-r.winNow)*.45:0,'Limited margin for error');
  const fallback=[
    {score:63+(100-r.waiver)*.16,label:'Leaves value on the waiver wire'},
    {score:60+(100-r.asset)*.13,label:'Asset value leaks through trades'},
    {score:59+(100-r.winNow)*.12,label:'Needs more reliable production'},
    {score:58+Math.abs(60-r.youth)*.10,label:'Roster timeline needs more clarity'},
    {score:57+(100-r.risk)*.08,label:'Could be more decisive in the market'},
    {score:56+(100-r.star)*.08,label:'Needs another dependable difference-maker'}
  ];
  const ranked=[...candidates,...fallback].sort((a,b)=>b.score-a.score);
  const unique=[];for(const item of ranked){if(!unique.some(x=>x.label===item.label))unique.push(item);if(unique.length>=5)break}
  const fifth=unique[4]?.score||0,fourth=unique[3]?.score||0,count=fifth>=76?5:fourth>=70?4:3;
  return unique.slice(0,Math.max(3,Math.min(5,count))).map(x=>x.label)
}
function managerGMProfile(managerId){
  const id=String(managerId),league=managerTendencyLeague(),keys=['trade','youth','winNow','draft','waiver','risk','asset','star'],labels={trade:'Trade Activity',youth:'Youth Focus',winNow:'Win-Now Focus',draft:'Draft Capital',waiver:'Waiver Activity',risk:'Risk Appetite',asset:'Asset Management',star:'Star Power'},icons={trade:'🤝',youth:'🌱',winNow:'🏆',draft:'📈',waiver:'⚡',risk:'🎲',asset:'💼',star:'🧲'},r=Object.fromEntries(keys.map(k=>[k,league.ratings[k][id]||25])),picks=managerFuturePickCounts(id),avgAge=managerAverageAge(id),types=archetypeCandidates(r,picks,avgAge),primary=types[0],secondary=types[1],overall=Math.round(r.trade*.12+r.youth*.12+r.winNow*.16+r.draft*.11+r.waiver*.08+r.risk*.10+r.asset*.17+r.star*.14),traits=managerTraits(r,picks,avgAge),report=managerScoutReport(managerName(id),r,primary,secondary);
  const rows=keys.map(k=>({key:k,label:labels[k],icon:icons[k],rating:r[k],rank:rankForRating(k,id,league)})),weaknesses=managerWeaknesses(id,r,picks,avgAge);return{...league,r,rows,picks,avgAge,primary,secondary,overall,traits,weaknesses,report}
}
function gmProfileHTML(gm){const updated=gm.week?`Updated weekly · Through Week ${gm.week}`:'Pre-season profile · Recalculates weekly once games begin',weaknesses=Array.isArray(gm.weaknesses)&&gm.weaknesses.length?gm.weaknesses:['Needs to trade more','Leaves value on the waiver wire','Needs more reliable production'];return `<section class="manager-profile-card gm-profile-card"><div class="gm-profile-top"><div><span class="eyebrow">GM PROFILE</span><div class="gm-archetype-line"><span class="gm-archetype-icon">${gm.primary.icon}</span><div><h3>${esc(gm.primary.name)}</h3><p>Secondary: ${gm.secondary.icon} ${esc(gm.secondary.name)}</p></div></div></div><div class="gm-updated-note">${esc(updated)}</div></div><div class="gm-tendency-grid">${gm.rows.map(x=>`<div class="gm-tendency"><div class="gm-tendency-head"><span>${x.icon} ${esc(x.label)}</span><strong>${x.rating} <small>#${x.rank}</small></strong></div><div class="gm-rating-track"><i style="width:${x.rating}%"></i></div></div>`).join('')}</div><div class="gm-profile-bottom"><div class="gm-profile-character"><div class="gm-traits"><span class="eyebrow">TENDENCIES</span>${gm.traits.map(x=>`<span class="gm-trait">✓ ${esc(x)}</span>`).join('')||'<span class="profile-muted">Profile will sharpen as more league activity is recorded.</span>'}</div><div class="gm-traits gm-weaknesses"><span class="eyebrow">WEAKNESSES</span>${weaknesses.slice(0,5).map(x=>`<span class="gm-trait gm-weakness">✕ ${esc(x)}</span>`).join('')}</div></div><div class="gm-scout-report"><span class="eyebrow">SCOUT\'S REPORT</span><p>“${esc(gm.report)}”</p></div></div></section>`}


function draftGamesPlayed(playerId,season){
  return Number(state.seasonTotalMeta?.[String(season)]?.[String(playerId)]?.gamesPlayed||state.gameLogMeta?.[String(season)]?.[String(playerId)]?.gamesPlayed||0)
}
function latestDraftAverage(playerId){
  const seasons=[...new Set(state.bundles.map(b=>String(b.league?.season||'')))].filter(Boolean).sort((a,b)=>Number(b)-Number(a));
  for(const season of seasons){
    const avg=Number(seasonAverageMap(season)?.[String(playerId)]||0);
    if(avg>0)return avg
  }
  return Number(latestKnownAverage(String(playerId))||0)
}
function currentDraftValue(playerId){
  const avg=latestDraftAverage(playerId);
  return avg>0?playerDynastyValue(String(playerId),avg,Date.now()):0
}
function eligibleDraftClassRows(){
  const bySeason={};
  (state.draftSelections||[]).forEach(p=>{const season=String(p?.season||'');if((season==='2025'||season==='2026')&&p?.isRookieDraft===true&&p?.playerId&&p?.pickedBy)(bySeason[season]??=[]).push(p)});
  const rows=[];
  Object.entries(bySeason).forEach(([season,picks])=>{
    // A class remains completely excluded until at least one player from that
    // class has appeared in three NBA games.
    if(!picks.some(p=>draftGamesPlayed(p.playerId,season)>=3))return;
    const ranked=picks.map(p=>({...p,currentAverage:latestDraftAverage(p.playerId),currentValue:currentDraftValue(p.playerId)})).sort((a,b)=>b.currentValue-a.currentValue||b.currentAverage-a.currentAverage||a.overallPick-b.overallPick||a.playerId.localeCompare(b.playerId));
    ranked.forEach((p,index)=>rows.push({...p,redraftRank:index+1,draftScore:Number(p.overallPick)-(index+1)}))
  });
  return rows
}
function managerDraftResume(managerId){
  const id=String(managerId),picks=eligibleDraftClassRows().filter(p=>String(p.pickedBy)===id);
  const steals=picks.filter(p=>Number(p.draftScore)>0).sort((a,b)=>b.draftScore-a.draftScore||a.overallPick-b.overallPick);
  const busts=picks.filter(p=>Number(p.draftScore)<0).sort((a,b)=>a.draftScore-b.draftScore||a.overallPick-b.overallPick);
  const totalScore=picks.reduce((sum,p)=>sum+Number(p.draftScore||0),0),averageScore=picks.length?totalScore/picks.length:0;
  const hitRate=picks.length?picks.filter(p=>Number(p.draftScore)>0).length/picks.length:0,missRate=picks.length?picks.filter(p=>Number(p.draftScore)<0).length/picks.length:0;
  // Draft Star is the highest-current-average rookie selection made by this manager.
  // Use the currentAverage already calculated for each eligible class row; do not
  // display the average in the profile card, only use it to select the player.
  const draftStar=picks.slice().sort((a,b)=>Number(b.currentAverage||0)-Number(a.currentAverage||0)||Number(a.overallPick||999)-Number(b.overallPick||999))[0]||null;
  return{managerId:id,picks,count:picks.length,totalScore,averageScore,hitRate,missRate,draftStar,biggestSteal:steals[0]||null,biggestBust:busts[0]||null}
}
function managerTradeRecordScore(managerId){
  const id=String(managerId),trades=managerTrades(id);let score=0,wins=0,losses=0,ties=0;
  trades.forEach(t=>{const results=mids(t).map(mid=>({id:String(mid),net:Number(tradeSideMetrics(t,mid).net||0)}));if(results.length<2)return;const mine=results.find(x=>x.id===id);if(!mine)return;const max=Math.max(...results.map(x=>x.net)),min=Math.min(...results.map(x=>x.net));if(max-min<2){ties++;return}if(mine.net===max){score++;wins++}else if(mine.net===min){score--;losses++}else ties++});
  return{score,wins,losses,ties,total:trades.length}
}
function managerTradingRaw(managerId){return managerTradeRecordScore(managerId).score}
function managerTradeLetterGrade(score){const n=Number(score)||0;if(n>=15)return'A+';if(n>=10)return'A';if(n>=6)return'B+';if(n>=2)return'C+';if(n>=-1)return'C';if(n>=-5)return'D';if(n>=-10)return'D-';return'F'}
function managerDepthRaw(managerId){
  const season=String(currentBundle()?.league?.season||'2026'),current=seasonAverageMap(season),fallback=seasonAverageMap('2025');
  const values=currentRosterIds(managerId).map(pid=>{const avg=Number(current[pid]||fallback[pid]||latestKnownAverage(pid)||0);return playerDynastyValue(pid,avg,Date.now())}).filter(v=>v>0).sort((a,b)=>b-a);
  if(!values.length)return 0;
  const top12=values.slice(0,12),bench=top12.slice(4),benchAverage=bench.length?bench.reduce((a,b)=>a+b,0)/bench.length:0;
  const productive=values.filter(v=>v>=18).length,elite=values.filter(v=>v>=35).length;
  return benchAverage*1.8+productive*4+Math.min(elite,4)*2
}
function managerLetterGrade(rating){
  const n=Number(rating)||0;
  if(n>=94)return'A+';if(n>=88)return'A';if(n>=82)return'A-';if(n>=76)return'B+';if(n>=70)return'B';if(n>=64)return'B-';if(n>=58)return'C+';if(n>=52)return'C';if(n>=46)return'C-';if(n>=38)return'D';return'F'
}
function managerGradesLeague(){
  if(state.computedCache.managerGrades)return state.computedCache.managerGrades;
  const ids=[...state.managers.keys()],tendency=managerTendencyLeague(),raw={trading:{},drafting:{},development:{},building:{}},draftResumes={},depthRaw={};
  ids.forEach(id=>{
    const r=tendency.ratings,resume=managerDraftResume(id);draftResumes[id]=resume;
    raw.trading[id]=managerTradingRaw(id);
    const sampleConfidence=Math.min(1,Math.sqrt(resume.count/4));
    raw.drafting[id]=(resume.averageScore*2.2+(resume.hitRate-resume.missRate)*5)*(.55+.45*sampleConfidence);
    raw.development[id]=(r.youth[id]||25)*.55+(r.waiver[id]||25)*.25+(r.asset[id]||25)*.20;
    depthRaw[id]=managerDepthRaw(id);
    raw.building[id]=(r.asset[id]||25)*.28+(r.star[id]||25)*.18+(r.winNow[id]||25)*.20+(r.draft[id]||25)*.08
  });
  const depthRatings=leagueScale(depthRaw),ratings={trading:{...raw.trading},drafting:calibratedLeagueScale(raw.drafting,45,91),development:leagueScale(raw.development),building:{}},grades={};
  ids.forEach(id=>{ratings.building[id]=Math.round((leagueScale(raw.building)[id]||25)*.62+(depthRatings[id]||25)*.38)});
  ids.forEach(id=>grades[id]={trading:managerTradeLetterGrade(ratings.trading[id]),drafting:managerLetterGrade(ratings.drafting[id]),development:managerLetterGrade(ratings.development[id]),building:managerLetterGrade(ratings.building[id])});
  return state.computedCache.managerGrades={raw,ratings,grades,draftResumes}
}
function rookiePickLabel(pick){const teams=Math.max(1,Number(pick?.teamCount)||8),overall=Math.max(1,Number(pick?.overallPick)||1),round=Math.floor((overall-1)/teams)+1,slot=((overall-1)%teams)+1;return`${round}.${String(slot).padStart(2,'0')}`}
function managerGradePlayerHTML(label,pick){
  if(!pick)return`<div class="manager-draft-highlight empty"><span>${esc(label)}</span><small>—</small></div>`;
  const id=String(pick.playerId),name=playerName(id),avatar=`https://sleepercdn.com/content/nba/players/${id}.jpg`;
  return`<div class="manager-draft-highlight"><span>${esc(label)}</span><div><span class="manager-grade-player-avatar"><img src="${esc(avatar)}" alt="" loading="lazy" onerror="this.style.display='none'"></span>${playerLink(id,name,'manager-grade-player-name')}<small class="manager-grade-pick-label">${esc(rookiePickLabel(pick))}</small></div></div>`
}
function managerAllRookiePicks(managerId){
  const id=String(managerId),seen=new Set();
  return (state.draftSelections||[])
    .filter(p=>p?.isRookieDraft===true&&p?.playerId&&String(p?.pickedBy)===id)
    .filter(p=>{const key=`${p.draftId||p.season}|${p.playerId}|${p.overallPick}`;if(seen.has(key))return false;seen.add(key);return true})
    .sort((a,b)=>Number(b.season||0)-Number(a.season||0)||Number(a.overallPick||999)-Number(b.overallPick||999));
}
function managerPicksMadeHTML(managerId){
  const total=managerAllRookiePicks(managerId).length;
  return`<div class="manager-draft-highlight manager-picks-made"><span>Picks Made</span><button type="button" class="manager-picks-total" data-open-manager-picks="${esc(String(managerId))}" aria-label="View all ${total} rookie draft picks">${total}</button></div>`
}
function managerGradesHTML(managerId){
  const league=managerGradesLeague(),id=String(managerId),grades=league.grades[id]||{},resume=league.draftResumes[id]||managerDraftResume(id),items=[['Trading',grades.trading],['Drafting',grades.drafting],['Player Development',grades.development],['Team Building',grades.building]];
  return`<section class="manager-grades-row" aria-label="Manager grades"><div class="manager-grades-title"><span class="eyebrow">MANAGER GRADES</span></div><div class="manager-grade-items">${items.map(([label,grade])=>`<div class="manager-grade-item"><span>${esc(label)}</span><strong class="manager-grade-badge ${gradeClass(grade||'F')}">${esc(grade||'—')}</strong></div>`).join('')}</div><div class="manager-draft-highlights">${managerGradePlayerHTML('Draft Star',resume.draftStar)}${managerGradePlayerHTML('Draft Steal',resume.biggestSteal)}${managerGradePlayerHTML('Draft Bust',resume.biggestBust)}${managerPicksMadeHTML(id)}</div></section>`
}
function managerPicksMadeModalHTML(managerId){
  const picks=managerAllRookiePicks(managerId);
  const rows=picks.map(p=>`<div class="manager-picks-row"><span class="manager-picks-pick">${esc(String(p.season||'—'))} ${esc(rookiePickLabel(p))}</span><span class="manager-picks-player">${playerLink(String(p.playerId),playerName(String(p.playerId)),'manager-picks-player-link')}</span></div>`).join('');
  return`<div class="manager-picks-heading"><span class="eyebrow">ROOKIE DRAFT HISTORY</span><h2>${esc(managerName(managerId))} Picks Made</h2><p>${picks.length} total rookie draft pick${picks.length===1?'':'s'}.</p></div><div class="manager-picks-list">${rows||'<div class="profile-empty">No rookie draft selections found.</div>'}</div>`
}
function openManagerPicksMade(managerId){const modal=$("managerPicksMadeModal"),content=$("managerPicksMadeContent");if(!modal||!content)return;content.innerHTML=managerPicksMadeModalHTML(String(managerId));modal.classList.add("open");modal.setAttribute("aria-hidden","false");modal.dataset.managerId=String(managerId);document.body.classList.add("manager-picks-open")}
function closeManagerPicksMade(){const modal=$("managerPicksMadeModal");if(!modal)return;modal.classList.remove("open");modal.setAttribute("aria-hidden","true");document.body.classList.remove("manager-picks-open")}
function ensureManagerGradeStyles(){
  if(document.getElementById('managerGradeStyles'))return;
  const style=document.createElement('style');style.id='managerGradeStyles';style.textContent=`
  .manager-grades-row{margin:14px 0 16px;padding:12px 14px;display:grid;grid-template-columns:1fr;gap:12px;align-items:stretch;border:1px solid rgba(148,163,184,.18);border-radius:14px;background:rgba(15,23,42,.34)}
  .manager-grades-title{white-space:nowrap}.manager-grade-items{display:grid;grid-template-columns:repeat(4,minmax(86px,1fr));gap:8px}.manager-grade-item{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 9px;border-radius:10px;background:rgba(255,255,255,.035)}
  .manager-grade-item>span{font-size:11px;line-height:1.2;color:var(--muted,#94a3b8)}.manager-grade-badge{display:grid;place-items:center;min-width:34px;height:28px;padding:0 7px;border-radius:8px;font-size:14px;line-height:1;font-weight:900}
  .manager-grade-badge.grade-a{color:#052e16;background:#4ade80}.manager-grade-badge.grade-b{color:#172554;background:#60a5fa}.manager-grade-badge.grade-c{color:#422006;background:#facc15}.manager-grade-badge.grade-d{color:#431407;background:#fb923c}.manager-grade-badge.grade-f{color:#450a0a;background:#f87171}
  .manager-draft-highlights{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;grid-auto-rows:minmax(58px,auto);gap:8px;width:100%;height:auto!important;max-height:none!important;overflow:visible!important}.manager-draft-highlight{display:block!important;visibility:visible!important;opacity:1!important;min-width:0;min-height:58px;height:auto!important;max-height:none!important;overflow:visible!important;padding:6px 9px;border-left:1px solid rgba(148,163,184,.18)}.manager-draft-highlight>span{display:block;margin-bottom:4px;font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#94a3b8)}.manager-draft-highlight>div{display:flex;align-items:center;gap:7px}.manager-grade-player-avatar{width:26px;height:26px;border-radius:50%;overflow:hidden;background:rgba(148,163,184,.15);flex:0 0 auto}.manager-grade-player-avatar img{width:100%;height:100%;object-fit:cover}.manager-grade-player-name{padding:0;border:0;background:none;color:inherit;font:inherit;font-size:11px;font-weight:800;text-align:left}.manager-grade-pick-label{margin-left:auto;padding:3px 5px;border:1px solid rgba(148,163,184,.18);border-radius:6px;color:var(--muted,#94a3b8);font-size:9px;font-weight:900;letter-spacing:.04em;white-space:nowrap}.manager-draft-highlight.empty small{font-size:16px}
  @media(max-width:900px){.manager-grades-title{display:none}.manager-draft-highlights{grid-template-columns:repeat(2,minmax(0,1fr))!important;grid-auto-rows:minmax(64px,auto)}.manager-draft-highlight{border-left:0;border-top:1px solid rgba(148,163,184,.18);padding-top:9px}}
  @media(max-width:620px){.manager-grades-row{padding:10px;gap:10px;height:auto!important;max-height:none!important;overflow:visible!important}.manager-grade-items{grid-template-columns:repeat(2,1fr)}.manager-grade-item{padding:8px}.manager-draft-highlights{grid-template-columns:repeat(2,minmax(0,1fr))!important;grid-auto-flow:row!important;height:auto!important;max-height:none!important;overflow:visible!important}.manager-grade-player-name{font-size:10px}}
  .manager-picks-made{display:flex!important;visibility:visible!important;opacity:1!important;flex-direction:column;justify-content:center}.manager-picks-total{width:max-content;padding:0;border:0;background:none;color:#fff;font:inherit;font-size:28px;font-weight:1000;line-height:1;cursor:pointer;text-decoration:underline;text-decoration-color:rgba(143,115,255,.7);text-underline-offset:5px}.manager-picks-total:hover{color:#c9bbff}
  .manager-profile-hero-actions,.manager-profile-mobile-actions{display:flex;flex-wrap:nowrap;gap:7px;align-items:center}.manager-profile-mobile-actions{display:none}.manager-profile-utility-btn,.manager-share-card-btn{appearance:none;width:36px!important;height:36px!important;min-width:36px!important;min-height:36px!important;padding:0!important;border-radius:10px!important;font:700 17px/1 system-ui,sans-serif!important;letter-spacing:0!important;text-transform:none!important;cursor:pointer;white-space:nowrap;display:inline-flex!important;align-items:center;justify-content:center;gap:0!important;position:relative;z-index:3}.manager-profile-utility-btn{border:1px solid rgba(143,115,255,.38)!important;background:rgba(143,115,255,.08)!important;color:#e8e1ff!important}.manager-profile-utility-btn:hover,.manager-profile-utility-btn:focus-visible{background:rgba(143,115,255,.16)!important;border-color:rgba(143,115,255,.68)!important;outline:none}.manager-share-card-btn{border:1px solid rgba(52,211,153,.38)!important;background:rgba(16,185,129,.08)!important;color:#d1fae5!important}.manager-share-card-btn:hover,.manager-share-card-btn:focus-visible{background:rgba(16,185,129,.16)!important;border-color:rgba(52,211,153,.68)!important;outline:none}.manager-share-card-btn.is-loading{opacity:.72;pointer-events:none}.manager-share-card-btn.is-success{background:rgba(34,197,94,.18)!important;border-color:rgba(74,222,128,.72)!important;color:#dcfce7!important}.manager-share-card-btn.is-error{background:rgba(239,68,68,.16)!important;border-color:rgba(248,113,113,.72)!important;color:#fee2e2!important}
  @media(max-width:680px){.manager-profile-hero-actions{display:none!important}.manager-profile-mobile-actions{display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;gap:8px!important;margin-top:12px!important;width:max-content!important}.manager-profile-mobile-actions .manager-profile-utility-btn,.manager-profile-mobile-actions .manager-share-card-btn{display:inline-flex!important;width:36px!important;height:36px!important;min-width:36px!important;min-height:36px!important;margin:0!important;padding:0!important}.manager-share-card-btn-mobile{display:inline-flex!important}.manager-share-card-btn-desktop{display:none!important}}
  `;document.head.appendChild(style)
}

function managerPowerMovement(managerId){
  const weeks=meaningfulWeeks(state.modelBundle);if(weeks.length<2)return{move:0,previous:null};
  const currentWeek=weeks.at(-1),previousWeek=weeks.at(-2),current=modelRows(state.modelBundle,currentWeek,'power').find(x=>String(x.id)===String(managerId)),previous=modelRows(state.modelBundle,previousWeek,'power').find(x=>String(x.id)===String(managerId));
  return{move:current&&previous?Number(previous.rank)-Number(current.rank):0,previous:previous?.rank||null}
}
function managerAvatarHTML(managerId,className='result-opponent-avatar'){
  const manager=state.managers.get(String(managerId));if(!manager)return'';
  return manager.avatar?`<span class="${className}"><img src="${esc(manager.avatar)}" alt="" loading="lazy"></span>`:`<span class="${className} fallback">${esc(manager.initials||manager.name.slice(0,2).toUpperCase())}</span>`
}
function managerSwitcherHTML(managerId){
  const currentId=String(managerId),current=state.managers.get(currentId),options=[...state.managers.values()].sort((a,b)=>a.name.localeCompare(b.name));
  const nativeOptions=options.map(m=>`<option value="${esc(m.id)}" ${m.id===currentId?'selected':''}>${esc(m.name)}</option>`).join('');
  return `<div class="manager-switcher" data-manager-switcher>
    <button type="button" class="manager-switcher-trigger" data-manager-switcher-trigger aria-expanded="false"><span>${esc(current?.name||'Manager')}</span><i>⌄</i></button>
    <label class="manager-switcher-native-label">Switch manager<select class="manager-switcher-native" data-mobile-manager-select aria-label="Switch manager">${nativeOptions}</select></label>
    <div class="manager-switcher-menu" hidden>${options.map(m=>{const avatar=m.avatar?`<img src="${esc(m.avatar)}" alt="" loading="lazy">`:`<span>${esc(m.initials||m.name.slice(0,2).toUpperCase())}</span>`;return `<button type="button" class="manager-switcher-option ${m.id===currentId?'active':''}" data-switch-manager="${esc(m.id)}">${avatar}<b>${esc(m.name)}</b>${m.id===currentId?'<small>Current</small>':''}</button>`}).join('')}</div>
  </div>`
}
const ARCHETYPE_GUIDE=[
  {icon:'🏗️',name:'The Rebuilder',description:'Operating with a long horizon, this front office prioritizes young talent, developmental upside, and future roster flexibility over short-term wins.'},
  {icon:'🤝',name:'The Wheel & Dealer',description:'One of the most active front offices in the league. Always testing the market, floating offers, and continually reshaping the roster through trades.'},
  {icon:'🦖',name:'The Veteran Chaser',description:'Built around proven, immediate production. Prefers established veterans with proven track records who can contribute win-now points right away.'},
  {icon:'🏆',name:'The Contender',description:'Assembled explicitly to win a championship right now. Boasts high-end production across the roster with a clear focus on maximizing their title window.'},
  {icon:'🎯',name:'The Talent Collector',description:'Concentrates top-tier, elite talent at the very top of the roster. Built around superstar players capable of deciding weekly matchups single-handedly.'},
  {icon:'💎',name:'Draft Capital King',description:'A premier asset accumulator who holds a stockpile of future draft picks, maintaining ultimate leverage and long-term optionality.'},
  {icon:'🛡️',name:'Diamond Hands',description:'Runs a patient, steady front office. Values roster continuity, chemistry, and calculated long-term moves over constant turnover and roster churn.'},
  {icon:'🌱',name:'Prospect Hunter',description:'Committed to a youth-led build. Consistently targets young players and emerging prospects whose best fantasy years are still ahead of them.'},
  {icon:'🎲',name:'The Gambler',description:'Embraces volatility and variance. Comfortable taking on high-risk, high-reward moves and blockbuster trades in pursuit of a massive payoff.'}
];
function openArchetypeGuide(currentArchetype='',secondaryArchetype=''){
  const modal=$("archetypeGuideModal");if(!modal)return;
  const list=$("archetypeGuideList");
  const current=String(currentArchetype||'').trim().toLowerCase(),secondary=String(secondaryArchetype||'').trim().toLowerCase();
  if(list){
    list.innerHTML=ARCHETYPE_GUIDE.map(x=>{const key=x.name.toLowerCase(),active=current&&key===current,isSecondary=!active&&secondary&&key===secondary,label=active?'<small>Current profile</small>':isSecondary?'<small class="secondary-label">Secondary profile</small>':'';return `<article class="archetype-guide-item${active?' current':isSecondary?' secondary':''}"${active?' aria-current="true"':''}><span>${x.icon}</span><div><h3>${esc(x.name)}${label}</h3><p>${esc(x.description)}</p></div></article>`}).join('');
  }
  modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.classList.add('modal-open');
  requestAnimationFrame(()=>$("archetypeGuideClose")?.focus({preventScroll:true}));
}
function closeArchetypeGuide(){const modal=$("archetypeGuideModal");if(!modal)return;modal.classList.remove('open');modal.setAttribute('aria-hidden','true');if(!document.querySelector('.manager-profile-modal.open,.player-history-modal.open,.manager-directory-modal.open,.headlines-modal.open'))document.body.classList.remove('modal-open')}

function managerProfileHTML(managerId){
  const id=String(managerId),manager=state.managers.get(id);if(!manager)return `<div class="profile-empty">Manager profile unavailable.</div>`;
  const weeks=meaningfulWeeks(state.modelBundle),through=weeks.at(-1)||Infinity,power=modelRows(state.modelBundle,through,"power").find(x=>x.id===id),odds=priceRows(through).find(x=>x.id===id),form=managerFormData(id),roster=managerRosterPlayers(id,state.profileAverageSeason),trades=managerTrades(id),biggest=[...trades].map(t=>({t,value:tradeValue(t)})).sort((a,b)=>b.value-a.value||(b.t.created||0)-(a.t.created||0)).slice(0,5),recent=trades.slice(0,5),badges=managerBadges(id),avgAge=managerAverageAge(id),partners=favouriteTradePartners(id),teamForm=teamFormPlayers(id),allTimeHigh=teamHighestScore(id,state.bundles),seasonBundle=state.bundles.find(b=>String(b.league.league_id)===CONFIG.currentLeagueId),seasonHigh=teamHighestScore(id,seasonBundle?[seasonBundle]:[]),matchups=managerRecentMatchups(id),headToHead=managerHeadToHead(id),eligible=allNBAEligible(id),biggestResult=managerBiggestResult(id),gm=managerGMProfile(id),managerGrades=managerGradesHTML(id),powerMovement=managerPowerMovement(id);
  const formPills=matchups.map(g=>`<details class="profile-form-result"><summary class="profile-form-pill ${g.result==="W"?"win":g.result==="D"?"draw":"loss"}">${g.result}</summary><div>${esc(manager.name)} <b>${g.result}</b> ${g.myPts.toFixed(2)} v ${esc(managerName(g.oppId))} ${g.oppPts.toFixed(2)}<small>Week ${g.week}</small></div></details>`).join("")||'<span class="profile-muted">No completed games</span>';
  const rosterRow=(p,i)=>`<div class="profile-roster-row"><span class="profile-roster-rank">${i+1}</span><span class="player-avatar-wrap"><img src="${esc(p.avatar)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span class="player-avatar-fallback">${esc(p.name.split(/\s+/).map(x=>x[0]).slice(0,2).join(""))}</span></span><div>${playerLink(p.id,p.name,"profile-player-name")}<small>${esc(p.position)}${p.age?` · Age ${p.age}`:""}</small></div><b class="profile-player-average">${p.avg.toFixed(2)}${p.avgRank?` <small>#${p.avgRank}</small>`:""}</b></div>`;
  const topRoster=roster.slice(0,10).map(rosterRow).join(""),remainingRoster=roster.slice(10).map((p,i)=>rosterRow(p,i+10)).join("");
  const rosterRows=topRoster+(remainingRoster?`<details class="profile-roster-more"><summary>Show remaining ${roster.length-10} players</summary><div class="profile-roster-list">${remainingRoster}</div></details>`:'')||'<div class="profile-empty">No current roster data.</div>';
  const managerAvatar=manager.avatar?`<img src="${esc(manager.avatar)}" alt="${esc(manager.name)} team avatar">`:esc(manager.initials||manager.name.slice(0,2).toUpperCase());
  const partnerRows=partners.map((p,i)=>`<div class="profile-partner-row"><b>${i+1}</b><button class="manager-profile-link" type="button" data-manager-id="${esc(p.partner)}">${esc(managerName(p.partner))}</button><span>${p.count} trades · ${p.percent.toFixed(0)}%</span></div>`).join("")||'<div class="profile-empty">No trade partners yet.</div>';
  const h2hRows=headToHead.map(r=>{const recordClass=r.wins>r.losses?"winning":r.wins<r.losses?"losing":"even",drawText=r.draws?` <span>(${r.draws} ${r.draws===1?"draw":"draws"})</span>`:"";return `<div class="profile-h2h-row ${recordClass}"><button class="manager-profile-link" type="button" data-manager-id="${esc(r.oppId)}">vs ${esc(managerName(r.oppId))}</button><strong>${r.wins}-${r.losses}${drawText}</strong><small>${r.games} games · includes finals</small></div>`}).join("")||'<div class="profile-empty">No completed head-to-head matchups.</div>';
  const eligibleRows=eligible.map(p=>`<div class="eligible-player">${playerLink(p.id,p.name)}<span>${p.avg.toFixed(2)}</span></div>`).join("")||'<div class="profile-empty">No current top-50 players.</div>';
  return `<div class="manager-profile-top-tools" aria-label="Manager profile tools"><button type="button" class="manager-profile-top-tool" data-open-archetype-guide data-current-archetype="${esc(gm.primary.name)}" data-secondary-archetype="${esc(gm.secondary.name)}">Archetypes</button><button type="button" class="manager-profile-top-tool manager-share-card-btn" data-download-manager-share-card="${esc(id)}" aria-label="Download manager snapshot PNG" title="Download manager snapshot">↓</button></div><header class="manager-profile-hero"><div class="manager-profile-avatar">${managerAvatar}</div><div class="manager-profile-hero-copy"><div class="manager-profile-kicker"><span class="eyebrow">TEAM PROFILE</span></div><div class="profile-name-line">${managerSwitcherHTML(id)}<div class="profile-badge-icons">${badgeIconsHTML(badges)}</div></div><p>Current franchise overview and league history</p></div></header>
  <div class="manager-profile-stat-grid"><div><span>Power rank</span><strong class="power-rank-with-move">${power?`#${power.rank}`:"—"}${power&&powerMovement.move?` <em class="rank-move ${powerMovement.move>0?'up':'down'}">${powerMovement.move>0?'↑':'↓'}${Math.abs(powerMovement.move)}</em>`:""}</strong></div><div><span>Ladder</span><strong>${power?`#${power.standingRank}`:"—"}</strong></div><div><span>Record</span><strong>${form.games?`${form.wins}-${form.games-form.wins}`:"—"}</strong></div><div><span>Championship odds</span><strong>${odds?championshipOddsLabel(odds):"—"}</strong></div><div><span>Team average age</span><strong>${avgAge?avgAge.toFixed(1):"—"}</strong></div><div><span>Career trades</span><strong>${trades.length}</strong></div></div>
  ${managerGrades}
  <div class="manager-profile-grid">
    ${gmProfileHTML(gm)}
    <section class="manager-profile-card profile-roster-card"><div class="manager-profile-card-heading"><div><span class="eyebrow">CURRENT TEAM</span><h3>Roster</h3></div><div class="roster-season-toggle"><button type="button" class="${state.profileAverageSeason==="2025"?"active":""}" data-profile-season="2025">2025 averages</button><button type="button" class="${state.profileAverageSeason==="2026"?"active":""}" data-profile-season="2026">2026 season averages</button></div></div><div class="profile-roster-list">${rosterRows}</div></section>
    ${managerDraftPicksHTML(id)}
    <section class="manager-profile-card profile-form-guide-card"><div class="manager-profile-card-heading"><div><span class="eyebrow">FORM GUIDE</span><h3>Last Five</h3></div></div><div class="profile-form-strip interactive">${formPills}</div></section>
    <section class="manager-profile-card"><div class="manager-profile-card-heading"><div><span class="eyebrow">LAST FIVE WATCH</span><h3>Poor Form</h3></div></div>${playerFormMini(teamForm.poor,false)}</section>
    <section class="manager-profile-card"><div class="manager-profile-card-heading"><div><span class="eyebrow">LAST FIVE WATCH</span><h3>Good Form</h3></div></div>${playerFormMini(teamForm.good,true)}</section>
    <section class="manager-profile-card"><div class="manager-profile-card-heading"><div><span class="eyebrow">ALL-NBA BALLOT</span><h3>Eligible Players</h3></div><span class="period-pill">Top 50 average</span></div><div class="eligible-player-list">${eligibleRows}</div></section>
    <section class="manager-profile-card"><div class="manager-profile-card-heading"><div><span class="eyebrow">LATEST ACTIVITY</span><h3>Recent Trades</h3></div></div><div class="profile-trades-list">${recent.map(t=>managerTradeSummaryHTML(t,id)).join("")||'<div class="profile-empty">No trades found.</div>'}</div></section>
    <section class="manager-profile-card profile-power-trend-card"><div class="manager-profile-card-heading"><div><span class="eyebrow">SEASON JOURNEY</span><h3>Power Ranking Trend</h3></div><span class="period-pill">Week by week</span></div>${powerTrendHTML(id)}</section>
    <div class="profile-history-divider"><span>LEAGUE HISTORY</span></div>
    <section class="manager-profile-card"><div class="manager-profile-card-heading"><div><span class="eyebrow">HEAD TO HEAD</span><h3>All-Time Records</h3></div></div><div class="profile-h2h-list">${h2hRows}</div></section>
    <section class="manager-profile-card profile-biggest-results"><div class="compact-result-card win"><span>BIGGEST WIN</span><strong>${biggestResult.win?`+${biggestResult.win.margin.toFixed(1)}`:'—'}</strong><div class="result-opponent">${biggestResult.win?managerAvatarHTML(biggestResult.win.oppId):''}<small>${biggestResult.win?`vs ${esc(managerName(biggestResult.win.oppId))}<br>Week ${biggestResult.win.week} · ${biggestResult.win.season}`:'No completed win'}</small></div></div><div class="compact-result-card loss"><span>BIGGEST LOSS</span><strong>${biggestResult.loss?`−${biggestResult.loss.margin.toFixed(1)}`:'—'}</strong><div class="result-opponent">${biggestResult.loss?managerAvatarHTML(biggestResult.loss.oppId):''}<small>${biggestResult.loss?`vs ${esc(managerName(biggestResult.loss.oppId))}<br>Week ${biggestResult.loss.week} · ${biggestResult.loss.season}`:'No completed loss'}</small></div></div></section>
    <section class="manager-profile-card"><div class="manager-profile-card-heading"><div><span class="eyebrow">TRADE DNA</span><h3>Favourite Trade Partners</h3></div><span class="period-pill">Top 7</span></div><div class="profile-partner-list">${partnerRows}</div></section>
    <section class="manager-profile-card score-records"><div class="manager-profile-card-heading"><div><span class="eyebrow">SCORING RECORDS</span><h3>Franchise Highs</h3></div></div><div class="profile-record-row"><span>Highest ever team score</span><strong>${allTimeHigh?allTimeHigh.pts.toFixed(2):"—"}</strong><small>${allTimeHigh?`Week ${allTimeHigh.week}, ${allTimeHigh.season}`:"No completed matchup"}</small></div><div class="profile-record-row"><span>Highest 2026 season score</span><strong>${seasonHigh?seasonHigh.pts.toFixed(2):"—"}</strong><small>${seasonHigh?`Week ${seasonHigh.week}`:"Season not started"}</small></div></section>
    <section class="manager-profile-card"><div class="manager-profile-card-heading"><div><span class="eyebrow">FRANCHISE HISTORY</span><h3>Biggest Ever Trades</h3></div><span class="period-pill">Top 5</span></div><div class="profile-trades-list">${biggest.map((row,i)=>`<div class="profile-big-trade"><span class="profile-big-rank">${i+1}</span>${managerTradeSummaryHTML(row.t,id)}</div>`).join("")||'<div class="profile-empty">No trades found.</div>'}</div></section>
    <section class="manager-profile-card profile-trophy-card"><div class="manager-profile-card-heading"><div><span class="eyebrow">CAREER HONOURS</span><h3>Trophy Cabinet</h3></div><span class="period-pill">Permanent achievements</span></div>${trophyCabinetHTML(id)}</section>
  </div>`
}

function playerTrades(playerId){const id=String(playerId);return state.trades.filter(t=>Object.prototype.hasOwnProperty.call(t.adds||{},id)||Object.prototype.hasOwnProperty.call(t.drops||{},id))}
function playerInterestRows(){const now=Date.now();let rows=[];try{rows=JSON.parse(localStorage.getItem("imoPlayerInterest")||"[]")}catch{}rows=(Array.isArray(rows)?rows:[]).filter(x=>x&&Number(x.expires)>now);state.playerInterest=rows;try{localStorage.setItem("imoPlayerInterest",JSON.stringify(rows))}catch{}return rows}
function isPlayerStarred(playerId){return playerInterestRows().some(x=>String(x.playerId)===String(playerId))}
function togglePlayerInterest(playerId){const id=String(playerId),rows=playerInterestRows(),existing=rows.find(x=>String(x.playerId)===id);let next;if(existing)next=rows.filter(x=>String(x.playerId)!==id);else next=[...rows,{playerId:id,created:Date.now(),expires:Date.now()+48*3600*1000,template:Math.floor(Math.random()*3),managerId:[...state.managers.keys()][Math.floor(Math.random()*Math.max(1,state.managers.size))]||null}];state.playerInterest=next;try{localStorage.setItem("imoPlayerInterest",JSON.stringify(next))}catch{}const modal=$("playerHistoryModal");if(modal?.classList.contains("open"))openPlayerHistory(id);renderTicker()}
function playerCurrentAverage(playerId){const current=state.bundles.find(b=>String(b.league?.league_id)===CONFIG.currentLeagueId),season=String(current?.league?.season||"2026"),weeks=current?meaningfulWeeks(current):[],avg=Number((state.gameLogAverages?.[season]?.[playerId]??state.seasonTotalAverages?.[season]?.[playerId]??(current&&weeks.length?buildPlayerAverages(current,weeks.at(-1))[playerId]:0))||0);return {season,avg,games:Number(state.gameLogMeta?.[season]?.[playerId]?.gamesPlayed||state.seasonTotalMeta?.[season]?.[playerId]?.gamesPlayed||0)}}

function playerDraftOrigin(playerId){
  const rows=(state.allDraftSelections||[]).filter(x=>String(x.playerId)===String(playerId)).sort((a,b)=>Number(a.created||0)-Number(b.created||0)||Number(a.season)-Number(b.season));
  const row=rows[0];if(!row)return null;
  const slot=Number(row.draftSlot)||(((Number(row.pickNo)||1)-1)%Math.max(1,Number(row.teamCount)||8))+1;
  const pick=`${Number(row.round)}.${String(slot).padStart(2,'0')}`;
  return {...row,pick,label:row.isRookieDraft?`${row.season} ${pick} rookie draft`:`${pick} startup draft`};
}
function returnTreeManagers(playerId){
  const id=String(playerId),seen=new Map();
  state.trades.forEach(t=>{const roster=(t.drops||{})[id];if(roster==null)return;const mid=t.roster_owner_map?.[String(roster)];if(!mid)return;const key=String(mid),old=seen.get(key);if(!old||Number(t.created)>Number(old.trade.created))seen.set(key,{id:key,name:managerName(key,t),trade:t})});
  return [...seen.values()].sort((a,b)=>Number(b.trade.created)-Number(a.trade.created));
}
function pickAssetKey(p){return `${String(p.season||'Future')}|${String(p.roster_id??p.original_roster_id??'')}|${String(Number(p.round)||1)}`}
function pickAssetLabel(p){const original=pickOriginalOwner(p,p._trade||null);return `${String(p.season||'Future')} Round ${Number(p.round)||1} Pick${original?` (${original}'s pick)`:''}`}
function pickHistoryLink(key,label,className='pick-history-link'){return `<button type="button" class="${className}" data-pick-history-key="${esc(String(key))}">${esc(label)}</button>`}
function pickOriginalOwnerNameByKey(key){const [season,rosterId,round]=String(key).split('|');for(const bundle of state.bundles){const owner=bundle.ownerByRoster?.[String(rosterId)];if(owner)return managerName(owner)}for(const trade of state.trades){const pick=(trade.draft_picks||[]).find(p=>pickAssetKey(p)===String(key));if(pick){const owner=trade.roster_owner_map?.[String(pick.roster_id??pick.original_roster_id)];if(owner)return managerName(owner,trade)}}return `Original roster ${rosterId}`}
function pickHistoryData(key){const [season,rosterId,round]=String(key).split('|'),rows=[];[...state.trades].sort((a,b)=>Number(a.created)-Number(b.created)).forEach(trade=>{(trade.draft_picks||[]).forEach(p=>{if(pickAssetKey(p)!==String(key))return;const fromId=trade.roster_owner_map?.[String(p.previous_owner_id)],toId=trade.roster_owner_map?.[String(p.owner_id)];rows.push({trade,fromId:String(fromId||''),toId:String(toId||''),from:fromId?managerName(fromId,trade):'Unknown manager',to:toId?managerName(toId,trade):'Unknown manager'})})});const drafted=state.draftPickMap?.[String(key)]||null,origin=drafted?playerDraftOrigin(drafted):null;let currentOwner=rows.at(-1)?.to||pickOriginalOwnerNameByKey(key);return{key:String(key),season,round:Number(round)||1,originalOwner:pickOriginalOwnerNameByKey(key),currentOwner,rows,drafted,origin}}
function pickHistoryHTML(key){const data=pickHistoryData(key),title=`${data.season} Round ${data.round} Pick (${data.originalOwner}'s pick)`,outcome=data.drafted?`<section class="pick-history-outcome"><span>EVENTUAL DRAFT OUTCOME</span><strong>${playerLink(data.drafted,playerName(data.drafted),'pick-history-player')}</strong><small>${esc(data.origin?.label||`${data.season} rookie draft`)}</small></section>`:`<section class="pick-history-status"><span>CURRENT STATUS</span><strong>${esc(data.currentOwner)}</strong><small>Future draft capital · not yet converted into a player</small></section>`,timeline=data.rows.length?data.rows.map((row,i)=>`<article class="pick-history-event"><span class="pick-history-index">${i+1}</span><div><small>${esc(fmt(row.trade.created))} · ${esc(row.trade.season_label||'')}</small><strong>${esc(row.from)} → ${esc(row.to)}</strong><p>${esc(row.from)} traded this pick to ${esc(row.to)}.</p><details><summary>View complete trade</summary><div class="trade-detail-body">${tradeDetailsHTML(row.trade)}</div></details></div></article>`).join(''):'<div class="profile-empty">This pick has not been traded in the loaded league history.</div>';return `<header class="pick-history-header"><span class="eyebrow">DRAFT PICK TRANSACTION FILE</span><h2 id="pickHistoryTitle">${esc(title)}</h2><p>Tracks every recorded transfer before the pick is eventually used.</p></header><div class="pick-history-summary"><div><span>Original owner</span><strong>${esc(data.originalOwner)}</strong></div><div><span>Current owner</span><strong>${esc(data.currentOwner)}</strong></div><div><span>Transfers</span><strong>${data.rows.length}</strong></div></div>${outcome}<section class="pick-history-timeline">${timeline}</section>`}
function openPickHistory(key){const modal=$("pickHistoryModal"),content=$("pickHistoryContent");if(!modal||!content)return;content.innerHTML=pickHistoryHTML(key);modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.classList.add('pick-history-open')}
function closePickHistory(){const modal=$("pickHistoryModal");if(!modal)return;modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.classList.remove('pick-history-open')}
function returnAssetsForManager(t,managerId){
  const id=String(managerId),out=[];
  Object.entries(t.adds||{}).forEach(([pid,rid])=>{if(String(t.roster_owner_map?.[String(rid)]||'')===id)out.push({type:'player',id:String(pid),name:playerName(pid),after:Number(t.created)||0})});
  (t.draft_picks||[]).forEach(p=>{if(String(t.roster_owner_map?.[String(p.owner_id)]||'')!==id)return;const copy={...p,_trade:t};out.push({type:'pick',id:pickAssetKey(p),pick:p,name:pickAssetLabel(copy),after:Number(t.created)||0})});
  return out;
}
function sentAssetsForManager(t,managerId){
  const id=String(managerId),out=[];
  Object.entries(t.drops||{}).forEach(([pid,rid])=>{if(String(t.roster_owner_map?.[String(rid)]||'')===id)out.push({type:'player',id:String(pid),name:playerName(pid),after:Number(t.created)||0})});
  (t.draft_picks||[]).forEach(p=>{if(String(t.roster_owner_map?.[String(p.previous_owner_id)]||'')!==id)return;const copy={...p,_trade:t};out.push({type:'pick',id:pickAssetKey(p),pick:p,name:pickAssetLabel(copy),after:Number(t.created)||0})});
  return out;
}
function laterAssetTrade(asset,managerId){
  const id=String(managerId),after=Number(asset.after)||0;
  return [...state.trades].sort((a,b)=>Number(a.created)-Number(b.created)).find(t=>{
    if(Number(t.created)<=after)return false;
    if(asset.type==='player'){
      const rid=(t.drops||{})[String(asset.id)];return rid!=null&&String(t.roster_owner_map?.[String(rid)]||'')===id;
    }
    return (t.draft_picks||[]).some(p=>pickAssetKey(p)===String(asset.id)&&String(t.roster_owner_map?.[String(p.previous_owner_id)]||'')===id);
  })||null;
}
function currentPlayerOwnerName(playerId){
  const bundle=state.bundles.find(b=>String(b.league?.league_id)===CONFIG.currentLeagueId)||state.bundles[0];
  const roster=(bundle?.rosters||[]).find(r=>(r.players||[]).map(String).includes(String(playerId))||(r.reserve||[]).map(String).includes(String(playerId))||(r.taxi||[]).map(String).includes(String(playerId)));
  const mid=roster?bundle?.ownerByRoster?.[String(roster.roster_id)]:null;return mid?managerName(mid):'Not currently rostered';
}
function returnChainAssetName(asset){return asset?.type==='player'?playerName(asset.id):String(asset?.name||'Draft pick')}
function returnChainAssetToken(asset){return `${String(asset?.type||'')}|${String(asset?.id||'')}|${Number(asset?.after)||0}`}
function returnChainAssetMatches(a,b){return Boolean(a&&b&&String(a.type)===String(b.type)&&String(a.id)===String(b.id))}
function returnChainPickConversion(asset){
  if(asset?.type!=='pick')return null;
  const drafted=state.draftPickMap?.[String(asset.id)]||null;if(!drafted)return null;
  const origin=playerDraftOrigin(drafted),player={type:'player',id:String(drafted),name:playerName(drafted),after:Number(origin?.created)||Number(asset.after)||0};
  return{player,origin,label:origin?.label||'completed rookie draft pick'};
}
function returnChainNext(asset,managerId){
  const direct=laterAssetTrade(asset,managerId);if(direct)return{asset,trade:direct,conversion:null};
  const conversion=returnChainPickConversion(asset);if(!conversion)return null;
  const next=laterAssetTrade(conversion.player,managerId);return next?{asset:conversion.player,trade:next,conversion,sourceAsset:asset}:null;
}
function returnChainAssetIcon(asset){
  return asset.type==='player'?`<span class="return-chain-avatar"><img src="https://sleepercdn.com/content/nba/players/${esc(asset.id)}.jpg" alt="" loading="lazy" onerror="this.style.display='none'"></span>`:'<span class="return-chain-pick-icon">◆</span>';
}
function returnChainAssetTitle(asset,className='return-chain-player'){
  return asset.type==='player'?playerLink(asset.id,returnChainAssetName(asset),className):pickHistoryLink(asset.id,returnChainAssetName(asset),'pick-history-link return-chain-pick-link');
}
function returnChainPackageAssetHTML(asset,followed){
  const active=returnChainAssetMatches(asset,followed),conversion=returnChainPickConversion(asset);
  const outcome=conversion?`<div class="return-chain-inline-outcome"><span>BECAME</span><strong>${playerLink(conversion.player.id,returnChainAssetName(conversion.player),'return-chain-player')}</strong><small>${esc(conversion.label)}</small></div>`:'';
  return `<div class="return-chain-package-asset ${asset.type} ${active?'followed':''}">${returnChainAssetIcon(asset)}<div class="return-chain-package-copy"><strong>${returnChainAssetTitle(asset)}</strong><small>${asset.type==='player'?'Player':'Draft capital'}</small>${outcome}</div>${active?'<span class="return-chain-followed-badge">FOLLOWED ASSET</span>':''}</div>`;
}
function playerAcquisitionTrade(playerId,managerId,beforeCreated){
  const id=String(playerId),mid=String(managerId),before=Number(beforeCreated)||Infinity;
  return [...state.trades].filter(t=>{
    if(Number(t.created)>=before)return false;
    const rid=(t.adds||{})[id];
    return rid!=null&&String(t.roster_owner_map?.[String(rid)]||'')===mid;
  }).sort((a,b)=>Number(b.created)-Number(a.created))[0]||null;
}
function returnChainAcquisitionHTML(session,origin){
  const mid=String(session.managerId),manager=managerName(mid,session.rootTrade),root={type:'player',id:String(session.rootPlayerId),name:playerName(session.rootPlayerId)},draftedBy=origin?.pickedBy?String(origin.pickedBy):'',draftedByName=draftedBy?managerName(draftedBy):'',draftedByManager=draftedBy&&draftedBy===mid,acquisition=playerAcquisitionTrade(session.rootPlayerId,mid,session.rootTrade?.created);
  let originLine='Acquired before the loaded draft history';
  if(origin){
    originLine=draftedByManager?`Drafted by ${esc(manager)} at ${esc(origin.label)}`:`Originally drafted by ${esc(draftedByName||'another manager')} at ${esc(origin.label)}`;
  }
  if(draftedByManager&&!acquisition){
    return `<div class="return-tree-origin"><span>STARTING ASSET</span><strong>${playerLink(session.rootPlayerId,playerName(session.rootPlayerId),'return-chain-player')}</strong><small>${originLine}</small></div>`;
  }
  if(!acquisition){
    return `<div class="return-tree-origin"><span>STARTING ASSET</span><strong>${playerLink(session.rootPlayerId,playerName(session.rootPlayerId),'return-chain-player')}</strong><small>${originLine}</small><em>How ${esc(manager)} acquired this player is not available in the loaded trade history.</em></div>`;
  }
  const sent=sentAssetsForManager(acquisition,mid),received=returnAssetsForManager(acquisition,mid),tradeManagerIds=[...new Set((acquisition.manager_ids||[]).map(String))],others=tradeManagerIds.filter(x=>x!==mid).map(x=>managerName(x,acquisition));
  return `<div class="return-tree-origin"><span>STARTING ASSET</span><strong>${playerLink(session.rootPlayerId,playerName(session.rootPlayerId),'return-chain-player')}</strong><small>Acquired by ${esc(manager)} via trade on ${esc(fmt(acquisition.created))}</small>${origin?`<em>${originLine}</em>`:''}</div>
  <section class="return-chain-acquisition"><div class="return-chain-acquisition-head"><span>HOW ${esc(manager.toUpperCase())} ACQUIRED ${esc(playerName(session.rootPlayerId).toUpperCase())}</span><h3>${esc(fmt(acquisition.created))} trade with ${esc(others.join(' and ')||'another manager')}</h3></div><div class="return-chain-package-grid"><section class="return-chain-side sent"><div class="return-chain-side-heading"><span>PACKAGE SENT</span><h4>${esc(manager)} sent</h4><small>${sent.length} asset${sent.length===1?'':'s'}</small></div><div class="return-chain-side-assets">${sent.length?sent.map(a=>returnChainPackageAssetHTML(a,null)).join(''):'<div class="profile-empty">No outgoing assets resolved.</div>'}</div></section><section class="return-chain-side received"><div class="return-chain-side-heading"><span>PACKAGE RECEIVED</span><h4>${esc(manager)} received</h4><small>${received.length} asset${received.length===1?'':'s'}</small></div><div class="return-chain-side-assets">${received.length?received.map(a=>returnChainPackageAssetHTML(a,root)).join(''):'<div class="profile-empty">No incoming assets resolved.</div>'}</div></section></div><details class="return-chain-full-trade"><summary>View complete acquisition trade</summary><div class="trade-detail-body">${tradeDetailsHTML(acquisition)}</div></details></section>`;
}
function returnChainReceivedAssetHTML(asset,index,managerId){
  const next=returnChainNext(asset,managerId),conversion=returnChainPickConversion(asset);
  let status='';
  if(next){
    if(next.conversion)status=`<div class="return-chain-conversion"><span>BECAME</span><strong>${playerLink(next.asset.id,returnChainAssetName(next.asset),'return-chain-player')}</strong><small>${esc(next.conversion.label)} · later included in another trade package</small></div>`;
    else if(asset.type==='pick'&&conversion)status=`<div class="return-chain-conversion"><span>EVENTUAL DRAFT OUTCOME</span><strong>${playerLink(conversion.player.id,returnChainAssetName(conversion.player),'return-chain-player')}</strong><small>${esc(conversion.label)} · this pick changed hands before the draft</small></div><div class="return-chain-status">${esc(managerName(managerId,next.trade))} later included this pick in another trade package on ${esc(fmt(next.trade.created))}.</div>`;
    else status=`<div class="return-chain-status">Later included in another trade package on ${esc(fmt(next.trade.created))}.</div>`;
  }else if(conversion){
    status=`<div class="return-chain-conversion"><span>BECAME</span><strong>${playerLink(conversion.player.id,returnChainAssetName(conversion.player),'return-chain-player')}</strong><small>${esc(conversion.label)} · Current status: ${esc(currentPlayerOwnerName(conversion.player.id))}</small></div>`;
  }else if(asset.type==='player')status=`<div class="return-chain-status">Current status: ${esc(currentPlayerOwnerName(asset.id))}</div>`;
  else status='<div class="return-chain-status">Awaiting draft or still held as future draft capital.</div>';
  const followLabel=next?(next.conversion?`Follow ${returnChainAssetName(next.asset)}`:asset.type==='player'?`Follow ${returnChainAssetName(asset)}`:'Follow this pick'):'';
  return `<article class="return-chain-received-card"><div class="return-chain-package-asset ${asset.type}">${returnChainAssetIcon(asset)}<div><strong>${returnChainAssetTitle(asset)}</strong><small>${asset.type==='player'?'Player':'Draft capital'}</small></div></div>${status}${next?`<button type="button" class="return-chain-follow-btn" data-follow-return-chain="${index}">${esc(followLabel)} <span>→</span></button>`:''}</article>`;
}
function returnChainTradeKey(t){return String(t?.transaction_id||`${t?.league_id||''}|${t?.created||''}`)}
let returnChainSession=null;
function returnChainBreadcrumbHTML(session){
  return `<nav class="return-chain-breadcrumbs" aria-label="Trade return chain">${session.steps.map((step,index)=>{const label=returnChainAssetName(step.asset);return `${index?'<span>›</span>':''}${index===session.steps.length-1?`<b>${esc(label)}</b>`:`<button type="button" data-return-chain-step="${index}">${esc(label)}</button>`}`}).join('')}</nav>`;
}
function returnChainHTML(){
  const session=returnChainSession;if(!session)return '<div class="profile-empty">Trade return chain unavailable.</div>';
  const step=session.steps.at(-1),trade=step.trade,mid=session.managerId,manager=managerName(mid,trade),sent=sentAssetsForManager(trade,mid),received=returnAssetsForManager(trade,mid),origin=playerDraftOrigin(session.rootPlayerId),tradeManagerIds=[...new Set((trade.manager_ids||[]).map(String))],otherManagers=tradeManagerIds.filter(x=>String(x)!==String(mid)).map(x=>managerName(x,trade)),teamCount=Math.max(2,tradeManagerIds.length),assetName=returnChainAssetName(step.asset);
  session.currentReceived=received;
  const conversionNotice=step.conversion?`<div class="return-chain-step-conversion"><span>PICK CONVERSION</span><strong>${esc(returnChainAssetName(step.sourceAsset))} became ${playerLink(step.asset.id,assetName,'return-chain-player')}</strong><small>${esc(step.conversion.label)}</small></div>`:'';
  return `<header class="return-tree-header"><span class="eyebrow">TRADE RETURN CHAIN</span><h2 id="tradeReturnTreeTitle">${esc(manager)} — ${esc(playerName(session.rootPlayerId))}</h2><p>Shows the full trade package at each step. Follow one returned asset at a time to see what happened next.</p></header>
  ${returnChainBreadcrumbHTML(session)}
  ${returnChainAcquisitionHTML(session,origin)}
  ${conversionNotice}
  <section class="return-chain-transaction">
    <div class="return-chain-transaction-head"><div><span>${esc(fmt(trade.created))}</span><h3>${esc(assetName)} was included in a ${teamCount}-team trade package</h3><p>${esc(manager)} traded with ${esc(otherManagers.join(' and ')||'another manager')}.</p></div>${session.steps.length>1?'<button type="button" class="return-chain-back" data-return-chain-back>← Previous step</button>':''}</div>
    <div class="return-chain-package-grid">
      <section class="return-chain-side sent"><div class="return-chain-side-heading"><span>PACKAGE SENT</span><h4>${esc(manager)} sent</h4><small>${sent.length} asset${sent.length===1?'':'s'}</small></div><div class="return-chain-side-assets">${sent.length?sent.map(a=>returnChainPackageAssetHTML(a,step.asset)).join(''):'<div class="profile-empty">No outgoing assets resolved.</div>'}</div></section>
      <section class="return-chain-side received"><div class="return-chain-side-heading"><span>RETURN RECEIVED</span><h4>${esc(manager)} received</h4><small>${received.length} asset${received.length===1?'':'s'}</small></div><div class="return-chain-received-list">${received.length?received.map((a,i)=>returnChainReceivedAssetHTML(a,i,mid)).join(''):'<div class="profile-empty">No incoming assets resolved.</div>'}</div></section>
    </div>
    <details class="return-chain-full-trade"><summary>View complete ${teamCount}-team trade</summary><div class="trade-detail-body">${tradeDetailsHTML(trade)}</div></details>
  </section>`;
}
function renderTradeReturnChain(){const html=returnChainHTML(),content=$("tradeReturnTreeContent");if(content)content.innerHTML=html;return html}
function openTradeReturnTree(playerId,managerId){
  const id=String(playerId),mid=String(managerId),managerRow=returnTreeManagers(id).find(x=>String(x.id)===mid),trade=managerRow?.trade,modal=$("tradeReturnTreeModal");if(!modal||!trade)return;
  returnChainSession={rootPlayerId:id,managerId:mid,rootTrade:trade,currentReceived:[],steps:[{asset:{type:'player',id,name:playerName(id),after:Number(trade.created)||0},trade,conversion:null,sourceAsset:null}]};
  renderTradeReturnChain();modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.classList.add('trade-return-tree-open');
}
function followTradeReturnChainAsset(index){
  const session=returnChainSession,asset=session?.currentReceived?.[Number(index)];if(!session||!asset||session.steps.length>=8)return;
  const next=returnChainNext(asset,session.managerId);if(!next)return;
  const token=`${returnChainAssetToken(next.asset)}|${returnChainTradeKey(next.trade)}`;
  if(session.steps.some(step=>`${returnChainAssetToken(step.asset)}|${returnChainTradeKey(step.trade)}`===token))return;
  session.steps.push({asset:next.asset,trade:next.trade,conversion:next.conversion||null,sourceAsset:next.sourceAsset||asset});renderTradeReturnChain();$("tradeReturnTreeModal")?.querySelector?.(".trade-return-tree-sheet")?.scrollTo?.({top:0,behavior:'smooth'});
}
function goToReturnChainStep(index){if(!returnChainSession)return;const n=Math.max(0,Math.min(Number(index)||0,returnChainSession.steps.length-1));returnChainSession.steps=returnChainSession.steps.slice(0,n+1);renderTradeReturnChain();$("tradeReturnTreeModal")?.querySelector?.(".trade-return-tree-sheet")?.scrollTo?.({top:0,behavior:'smooth'})}
function closeTradeReturnTree(){const modal=$("tradeReturnTreeModal");if(!modal)return;modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.classList.remove('trade-return-tree-open');returnChainSession=null}
function playerHistoryHTML(playerId){const id=String(playerId),name=playerName(id),trades=playerTrades(id),avatar=`https://sleepercdn.com/content/nba/players/${id}.jpg`,seasonAvg=playerCurrentAverage(id),starred=isPlayerStarred(id),treeManagers=returnTreeManagers(id),treeControl=treeManagers.length?`<div class="return-tree-launch"><div><span class="eyebrow">TRADE RETURN CHAIN</span><strong>Follow a former owner's return one asset at a time</strong></div>${treeManagers.length>1?`<select data-return-tree-manager aria-label="Choose manager return chain">${treeManagers.map(x=>`<option value="${esc(x.id)}">${esc(x.name)} · traded ${fmt(x.trade.created,true)}</option>`).join('')}</select>`:`<input type="hidden" data-return-tree-manager value="${esc(treeManagers[0].id)}">`}<button type="button" data-open-return-tree="${esc(id)}">View Trade Return Chain</button></div>`:'';return `<div class="player-history-hero"><span class="player-history-avatar"><img src="${esc(avatar)}" alt="" onerror="this.style.display='none'"></span><div class="player-history-main"><span class="eyebrow">PLAYER TRANSACTION FILE</span><div class="player-title-row"><h2 id="playerHistoryTitle">${esc(name)}</h2><div class="player-interest-control"><button type="button" class="player-star-btn ${starred?'active':''}" data-star-player="${esc(id)}" aria-pressed="${starred}" title="${starred?'Remove trade interest':'Signal trade interest'}">${starred?'★':'☆'}</button><small>Tap the star if you're interested in acquiring this player</small></div></div><p>${trades.length} all-time trade${trades.length===1?'':'s'} recorded across loaded IMO Dynasty seasons.</p></div><div class="player-current-average"><span>${esc(seasonAvg.season)} FANTASY AVG</span><strong>${seasonAvg.avg>0?seasonAvg.avg.toFixed(2):'—'}</strong><small>${seasonAvg.games?`${seasonAvg.games} games`:'Season not started'}</small></div></div>${treeControl}<div class="player-history-timeline">${trades.length?trades.map((t,i)=>`<details class="player-history-trade" ${i===0?'open':''}><summary><span class="player-history-index">${trades.length-i}</span><span><strong>${mids(t).map(mid=>esc(managerName(mid,t))).join(' ↔ ')}</strong><small>${fmt(t.created)} · ${esc(t.season_label||'')}</small></span><span class="player-history-view">View trade</span></summary><div class="trade-detail-body">${tradeDetailsHTML(t)}</div></details>`).join(''):'<div class="profile-empty">No trades involving this player were found in the loaded league history.</div>'}</div>`}
function openPlayerHistory(playerId){const modal=$("playerHistoryModal"),content=$("playerHistoryContent");if(!modal||!content)return;content.innerHTML=playerHistoryHTML(playerId);modal.classList.add("open");modal.setAttribute("aria-hidden","false");modal.dataset.playerId=String(playerId);document.body.classList.add("player-history-open")}
function closePlayerHistory(){const modal=$("playerHistoryModal");if(!modal)return;modal.classList.remove("open");modal.setAttribute("aria-hidden","true");document.body.classList.remove("player-history-open")}

function managerDirectoryHTML(){
  const weeks=meaningfulWeeks(state.modelBundle),through=weeks.at(-1)||Infinity,powerById=Object.fromEntries(modelRows(state.modelBundle,through,"power").map(x=>[String(x.id),x]));
  return [...state.managers.values()].sort((a,b)=>(powerById[a.id]?.rank||99)-(powerById[b.id]?.rank||99)||a.name.localeCompare(b.name)).map(m=>{
    const avatar=m.avatar?`<img src="${esc(m.avatar)}" alt="" loading="lazy">`:`<span>${esc(m.initials)}</span>`,rank=powerById[m.id]?.rank;
    return `<button class="manager-directory-item manager-profile-link" type="button" data-manager-id="${esc(m.id)}"><span class="manager-directory-rank">${rank?`#${rank}`:"—"}</span><span class="manager-directory-avatar">${avatar}</span><span class="manager-directory-copy"><strong>${esc(m.name)}</strong><small>Open manager profile</small></span><span class="manager-directory-arrow">→</span></button>`
  }).join("")||'<div class="profile-empty">No managers available.</div>'
}
function openManagerDirectory(){const modal=$("managerDirectoryModal"),list=$("managerDirectoryList");if(!modal||!list)return;list.innerHTML=managerDirectoryHTML();modal.classList.add("open");modal.setAttribute("aria-hidden","false");document.body.classList.add("manager-directory-open");requestAnimationFrame(()=>{observeManagerProfileLinks();$('managerDirectoryClose')?.focus()})}
function closeManagerDirectory(){const modal=$("managerDirectoryModal");if(!modal)return;modal.classList.remove("open");modal.setAttribute("aria-hidden","true");document.body.classList.remove("manager-directory-open")}

function managerProfileCacheKey(managerId){return `${String(managerId)}|${String(state.profileAverageSeason||"")}`}
function managerProfileDataFingerprint(){const latest=state.trades?.[0]?.created||0,current=state.modelBundle?.league?.season||'';return `${CONFIG.currentLeagueId}|${current}|${latest}|${state.trades.length}|${state.managers.size}|${state.draftSelections.length}`}
function managerProfileSessionKey(key){return `imo-profile-v3312-weakness-rules-typography|${managerProfileDataFingerprint()}|${key}`}
function cachedManagerProfileHTML(managerId){
  const key=managerProfileCacheKey(managerId);
  if(state.profileHTMLCache.has(key))return state.profileHTMLCache.get(key);
  try{const saved=sessionStorage.getItem(managerProfileSessionKey(key));if(saved){state.profileHTMLCache.set(key,saved);return saved}}catch(_){ }
  const html=managerProfileHTML(managerId);
  state.profileHTMLCache.set(key,html);
  try{sessionStorage.setItem(managerProfileSessionKey(key),html)}catch(_){ }
  return html;
}
const managerProfilePrewarmQueue=[];
const managerProfilePrewarmIds=new Set();
let managerProfilePrewarmBusy=false;
let managerProfileObserver=null;
function drainManagerProfilePrewarmQueue(){
  if(managerProfilePrewarmBusy||!managerProfilePrewarmQueue.length)return;
  managerProfilePrewarmBusy=true;
  const id=managerProfilePrewarmQueue.shift();managerProfilePrewarmIds.delete(id);
  const run=()=>{try{if(!state.computedCache.tendencyLeague)managerTendencyLeague();if(!state.profileHTMLCache.has(managerProfileCacheKey(id)))cachedManagerProfileHTML(id)}catch(error){console.warn('Profile prewarm failed:',error)}finally{managerProfilePrewarmBusy=false;setTimeout(drainManagerProfilePrewarmQueue,40)}};
  if('requestIdleCallback' in window)requestIdleCallback(run,{timeout:700});else setTimeout(run,40);
}
function queueManagerProfilePrewarm(managerId){
  const id=String(managerId||"");
  if(!id||state.profileHTMLCache.has(managerProfileCacheKey(id))||managerProfilePrewarmIds.has(id))return;
  managerProfilePrewarmIds.add(id);managerProfilePrewarmQueue.push(id);drainManagerProfilePrewarmQueue();
}
function observeManagerProfileLinks(){
  if(!('IntersectionObserver' in window)){document.querySelectorAll('.manager-profile-link').forEach(link=>queueManagerProfilePrewarm(link.dataset.managerId));return}
  if(!managerProfileObserver)managerProfileObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){queueManagerProfilePrewarm(entry.target.dataset.managerId);managerProfileObserver.unobserve(entry.target)}}),{rootMargin:'500px 0px'});
  document.querySelectorAll('.manager-profile-link').forEach(link=>{if(!link.dataset.profileObserved){link.dataset.profileObserved='1';managerProfileObserver.observe(link)}})
}
function closeManagerSwitchers(except=null){document.querySelectorAll('[data-manager-switcher].open').forEach(sw=>{if(sw===except)return;sw.classList.remove('open');const trigger=sw.querySelector('[data-manager-switcher-trigger]');const menu=sw.querySelector('.manager-switcher-menu');if(trigger)trigger.setAttribute('aria-expanded','false');if(menu)menu.hidden=true})}
function openMobileProfileInfo(title,html){
  let sheet=document.getElementById('mobileProfileInfoSheet');
  if(!sheet){sheet=document.createElement('div');sheet.id='mobileProfileInfoSheet';sheet.className='mobile-profile-info-sheet';sheet.innerHTML='<button type="button" class="mobile-profile-info-backdrop" data-close-mobile-profile-info aria-label="Close"></button><div class="mobile-profile-info-card" role="dialog" aria-modal="true"><button type="button" class="mobile-profile-info-close" data-close-mobile-profile-info aria-label="Close">×</button><strong class="mobile-profile-info-title"></strong><div class="mobile-profile-info-body"></div></div>';document.body.appendChild(sheet)}
  sheet.querySelector('.mobile-profile-info-title').textContent=title||'Details';sheet.querySelector('.mobile-profile-info-body').innerHTML=html||'';sheet.classList.add('open');document.body.classList.add('mobile-profile-info-open')
}
function closeMobileProfileInfo(){const sheet=document.getElementById('mobileProfileInfoSheet');if(sheet)sheet.classList.remove('open');document.body.classList.remove('mobile-profile-info-open')}
function openManagerProfile(managerId,pushState=true){
  const modal=$("managerProfileModal"),content=$("managerProfileContent");
  if(!modal||!content)return;
  const id=String(managerId);
  modal.classList.add("open");
  modal.setAttribute("aria-hidden","false");
  document.body.classList.add("manager-profile-open");
  modal.dataset.managerId=id;
  const key=managerProfileCacheKey(id);
  if(state.profileHTMLCache.has(key)){
    content.innerHTML=state.profileHTMLCache.get(key);
    bindSparklineTooltips(content);
  }else{
    const manager=state.managers.get(id),avatar=manager?.avatar?`<img src="${esc(manager.avatar)}" alt="" loading="eager">`:`<span>${esc(manager?.initials||'GM')}</span>`;
    content.innerHTML=`<div class="manager-profile-loading manager-profile-loading-fast"><div class="manager-loading-identity">${avatar}<div><small>MANAGER PROFILE</small><strong>${esc(manager?.name||'Loading profile')}</strong></div></div><span></span><strong>Loading live profile…</strong><small>Current roster and league history are being assembled.</small></div>`;
    let build=state.profileBuilds.get(key);
    if(!build){build=new Promise(resolve=>setTimeout(()=>resolve(cachedManagerProfileHTML(id)),20));state.profileBuilds.set(key,build);build.finally(()=>state.profileBuilds.delete(key))}
    build.then(html=>{if(modal.dataset.managerId!==id)return;content.innerHTML=html;bindSparklineTooltips(content)}).catch(error=>{console.error('Manager profile failed:',error);if(modal.dataset.managerId===id)content.innerHTML='<div class="profile-empty">Profile could not be loaded. Please close and try again.</div>'});
  }
  if(pushState)history.pushState({managerProfile:id},"",`#manager=${encodeURIComponent(id)}`);
  requestAnimationFrame(()=>$('managerProfileClose')?.focus());
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


function currentRosterOwner(playerId){for(const roster of state.currentRosters||[]){if((roster.players||[]).map(String).includes(String(playerId)))return String(roster.owner_id)}return null}
function tickerTopPerformer(){
  const rostered=new Set((state.currentRosters||[]).flatMap(r=>(r.players||[]).map(String))),seasons=["2026","2025",String(state.modelBundle?.league?.season||"")].filter((v,i,a)=>v&&a.indexOf(v)===i);
  for(const season of seasons){const candidates=[];Object.entries(state.gameLogs?.[season]||{}).forEach(([id,rows])=>{if(!rostered.has(String(id)))return;(rows||[]).forEach(row=>{const date=gameDateValue(row),fpts=rawFantasyPoints(row,state.modelBundle?.league?.scoring_settings||{});if(date&&gameWasPlayed(row)&&Number.isFinite(fpts))candidates.push({id,date,fpts})})});if(!candidates.length)continue;const latest=Math.max(...candidates.map(x=>x.date)),day=candidates.filter(x=>Math.abs(x.date-latest)<43200000).sort((a,b)=>b.fpts-a.fpts)[0];if(day){const owner=currentRosterOwner(day.id);return `🔥 ${playerName(day.id)}: ${day.fpts.toFixed(1)} FPTS${owner?` for ${managerName(owner)}`:''}`}}
  const bundle=state.modelBundle,weeks=meaningfulWeeks(bundle);if(!weeks.length)return null;const week=weeks.at(-1),rows=bundle.matchups.filter(x=>x.week===week),best=[];rows.forEach(row=>Object.entries(row.players_points||{}).forEach(([id,v])=>{if(rostered.has(String(id))&&Number(v)>0)best.push({id,fpts:Number(v)})}));best.sort((a,b)=>b.fpts-a.fpts);return best[0]?`🔥 Latest leader: ${playerName(best[0].id)} ${best[0].fpts.toFixed(1)} FPTS`:null
}
function tickerMatchup(){const bundle=state.bundles.find(b=>String(b.league?.league_id)===CONFIG.currentLeagueId)||state.modelBundle;if(!bundle)return null;const played=meaningfulWeeks(bundle),nextWeek=(played.at(-1)||0)+1,rows=bundle.matchups.filter(x=>x.week===nextWeek&&x.matchup_id!=null),groups={};rows.forEach(x=>(groups[x.matchup_id]??=[]).push(x));const standings=Object.fromEntries(standingsTable(bundle).map(x=>[x.id,x.standingRank]));const options=Object.values(groups).filter(g=>g.length>=2).map(g=>{const ids=g.map(x=>bundle.ownerByRoster[String(x.roster_id)]).filter(Boolean);return{ids,score:ids.reduce((sum,id)=>sum+(standings[id]||99),0)}}).filter(x=>x.ids.length>=2).sort((a,b)=>a.score-b.score);const pick=options[0];return pick?`Matchup of the Week: #${standings[pick.ids[0]]||'—'} ${managerName(pick.ids[0])} vs #${standings[pick.ids[1]]||'—'} ${managerName(pick.ids[1])}`:null}
function tickerStreak(){const outcomes=outcomesForBundle(state.modelBundle),rows=[];Object.entries(outcomes).forEach(([id,games])=>{let type=null,count=0;for(let i=games.length-1;i>=0;i--){const next=games[i].result===1?'W':games[i].result===0?'L':'T';if(next==='T')break;if(type===null)type=next;if(next!==type)break;count++}if(count>=2)rows.push({id,type,count})});rows.sort((a,b)=>b.count-a.count);const x=rows[0];return x?`${x.type==='W'?'Hot streak':'Cold streak'}: ${managerName(x.id)} ${x.type==='W'?'has won':'has lost'} ${x.count} straight`:null}
function tickerDrought(){let best=null;for(const m of state.managers.values()){const last=state.trades.find(t=>mids(t).includes(m.id))?.created||0,days=last?Math.floor((Date.now()-last)/864e5):null;if(days!==null&&(!best||days>best.days))best={m,days}}return best?`${best.m.name} owns the longest fun drought at ${best.days} days without a trade`:null}
function tickerRankingOrRecord(){const weeks=meaningfulWeeks(state.modelBundle);if(weeks.length<2)return null;const last=weeks.at(-1),prior=weeks.at(-2),now=modelRows(state.modelBundle,last,'power'),before=Object.fromEntries(modelRows(state.modelBundle,prior,'power').map(x=>[x.id,x.rank])),moves=now.map(x=>({...x,move:(before[x.id]||x.rank)-x.rank})).sort((a,b)=>Math.abs(b.move)-Math.abs(a.move));const top=moves[0];if(top&&Math.abs(top.move)>=2)return `${top.name} jumps ${Math.abs(top.move)} spot${Math.abs(top.move)===1?'':'s'} to #${top.rank} in the Power Rankings`;const currentRows=state.modelBundle.matchups.filter(x=>x.week===last),best=currentRows.filter(x=>Number(x.points)>0).sort((a,b)=>Number(b.points)-Number(a.points))[0],all=highestTeamScore(state.bundles);if(best&&all&&Number(best.points)>=all.pts)return `New league record: ${managerName(state.modelBundle.ownerByRoster[String(best.roster_id)])} posts ${Number(best.points).toFixed(1)} points`;return null}
function tickerPlayerRumours(){const templates=[x=>`SHAMS: Unnamed sources indicate growing trade chatter surrounding ${playerName(x.playerId)}.`,x=>`SOURCES: Rival GMs believe ${x.managerId?managerName(x.managerId):'a mystery team'} is exploring trade packages involving ${playerName(x.playerId)}.`,x=>`REPORTS: ${playerName(x.playerId)} has featured heavily in recent trade inquiries.`];return playerInterestRows().slice(-3).reverse().map(x=>(templates[Number(x.template)%templates.length]||templates[0])(x))}
function shortTradeHeadline(t){if(!t)return null;const names=mids(t).map(id=>managerName(id,t));return names.length?`${names.join(' and ')} complete a deal involving ${tradeSummary(t)}`:null}
function stripTickerEmoji(text){return String(text||'').replace(/[\p{Extended_Pictographic}\uFE0F]/gu,'').replace(/\s{2,}/g,' ').trim()}
function renderTicker(){const root=$('leagueTicker');if(!root)return;const good=recentPlayerForm().good.slice(0,2),stories=[...tickerPlayerRumours(),tickerTopPerformer(),...good.map(x=>`${x.name} is in good form, averaging ${x.recentAvg.toFixed(1)} FPTS over the last 5`),...state.trades.slice(0,2).map(t=>shortTradeHeadline(t)),tickerMatchup(),tickerStreak(),'IMO Awards voting opens 23 February · closes 28 February',tickerRankingOrRecord(),tickerDrought()].filter(Boolean);const unique=[...new Set(stories.map(stripTickerEmoji).filter(Boolean))].slice(0,10);if(!unique.length){root.hidden=true;return}root.hidden=false;const group=unique.map((text,i)=>`<span class="ticker-item">${esc(text)}</span>${i<unique.length-1?'<span class="ticker-dot">•</span>':''}`).join('');root.innerHTML=`<span class="ticker-live">LIVE</span><div class="ticker-window"><div class="ticker-track"><div class="ticker-group">${group}</div><div class="ticker-group" aria-hidden="true">${group}</div></div></div>`}
async function loadTickerGameLogs(){const season=String(state.modelBundle?.league?.season||'2025'),ids=[...new Set((state.currentRosters||[]).flatMap(r=>(r.players||[]).map(String)))],scoring=state.modelBundle?.league?.scoring_settings||{};if(!ids.length)return;const rows=await limitedMap(ids,8,async id=>{const result=await loadPlayerGameLogAverage(id,season,scoring);return result?{id,...result}:null});state.gameLogs[season]??={};rows.filter(Boolean).forEach(row=>state.gameLogs[season][row.id]=row.rows||[]);renderPlayerForm();renderTicker();renderHeadToHead()}


function insiderEventKey(){
  const latestTrade=state.trades[0];
  const current=state.bundles.find(b=>String(b.league?.league_id)===CONFIG.currentLeagueId)||state.modelBundle;
  const latestWeek=meaningfulWeeks(current).at(-1)||0;
  return `${latestTrade?.transaction_id||latestTrade?.created||'no-trade'}|${latestWeek}`;
}
function insiderPlayerImage(id){return id?`https://sleepercdn.com/content/nba/players/${id}.jpg`:null}
function marketSnapshot(){
  const current=state.bundles.find(b=>String(b.league?.league_id)===CONFIG.currentLeagueId)||state.modelBundle;
  const week=meaningfulWeeks(current).at(-1)||Infinity;
  return{savedAt:Date.now(),latestTradeId:String(state.trades[0]?.transaction_id||state.trades[0]?.created||'none'),power:Object.fromEntries(modelRows(state.modelBundle,week,'power').map(x=>[String(x.id),{rank:x.rank}])),odds:Object.fromEntries(priceRows(week).map(x=>[String(x.id),{odds:x.odds,eliminated:x.eliminated}]))};
}
function marketReactionStory(trade,powerRows,oddsRows){
  if(!trade)return null;
  const ids=mids(trade),powerBy=Object.fromEntries(powerRows.map(x=>[String(x.id),x])),oddsBy=Object.fromEntries(oddsRows.map(x=>[String(x.id),x])),grades=Object.fromEntries(tradeGrades(trade).map(x=>[String(x.id),x]));
  let previous=null;try{previous=JSON.parse(localStorage.getItem('imoMarketSnapshotV1')||'null')}catch{}
  const tradeId=String(trade.transaction_id||trade.created||'none'),canCompare=previous&&String(previous.latestTradeId)!==tradeId;
  const players=Object.values(tradeAssets(trade)).flat().filter(a=>a.type==='player').sort((a,b)=>Number(b.value||0)-Number(a.value||0)),hero=players[0];
  const lines=ids.map(id=>{
    const nowP=powerBy[String(id)],nowO=oddsBy[String(id)],grade=grades[String(id)]?.grade||'—',metrics=tradeSideMetrics(trade,id),oldP=canCompare?previous.power?.[String(id)]?.rank:null,oldO=canCompare?previous.odds?.[String(id)]?.odds:null;
    const rankText=oldP&&nowP?`Power Ranking ${oldP===nowP.rank?`holds at #${nowP.rank}`:`moves from #${oldP} to #${nowP.rank}`}`:nowP?`currently sits #${nowP.rank} in the Power Rankings`:'has no current ranking';
    const oddsText=Number.isFinite(oldO)&&Number.isFinite(nowO?.odds)?`title price ${oldO===nowO.odds?`holds at $${Number(nowO.odds).toFixed(2)}`:`moves from $${Number(oldO).toFixed(2)} to $${Number(nowO.odds).toFixed(2)}`}`:nowO?`is priced at ${championshipOddsLabel(nowO)}`:'has no active title price';
    const valueText=metrics.net>1?`a modelled value gain of ${metrics.net.toFixed(1)}`:metrics.net<-1?`a modelled value deficit of ${Math.abs(metrics.net).toFixed(1)}`:'a near-even modelled value return';
    return `${managerName(id,trade)} ${rankText}, ${oddsText}, and earns a ${grade} grade with ${valueText}.`;
  });
  const strongest=ids.map(id=>({id,net:tradeSideMetrics(trade,id).net})).sort((a,b)=>b.net-a.net)[0];
  return{kicker:'MARKET REACTION',headline:`${hero?.name||'The latest trade'} sends the IMO market into overdrive`,image:hero?insiderPlayerImage(hero.id):state.managers.get(ids[0])?.avatar||null,body:`The deal is official, and the model has already repriced the fallout. ${lines.join(' ')} ${strongest?`The early market verdict leans toward ${managerName(strongest.id,trade)}, but the next completed gameweek will decide whether the model was sharp or merely loud.`:'The league now waits for the first real results.'}`};
}
function currentTopPlayer(){const avg=seasonAverageMap(String(state.modelBundle?.league?.season||'2026'));const rostered=new Set((state.currentRosters||[]).flatMap(r=>(r.players||[]).map(String)));const row=Object.entries(avg).filter(([id,v])=>rostered.has(String(id))&&Number(v)>0).sort((a,b)=>Number(b[1])-Number(a[1]))[0];return row?{id:String(row[0]),name:playerName(row[0]),avg:Number(row[1])}:null}
function buildInsiderEdition(){
  const eventKey=insiderEventKey(),storageKey='imoInsiderEditionV313';
  try{const cached=JSON.parse(localStorage.getItem(storageKey)||'null');if(cached?.eventKey===eventKey)return cached}catch{}
  const current=state.bundles.find(b=>String(b.league?.league_id)===CONFIG.currentLeagueId)||state.modelBundle;
  const weeks=meaningfulWeeks(current),lastWeek=weeks.at(-1)||0,power=modelRows(state.modelBundle,weeks.at(-1)||Infinity,'power'),oddsRows=priceRows(lastWeek||Infinity),leader=power[0],latest=state.trades[0],topPlayer=currentTopPlayer(),streakText=tickerStreak(),rankingText=tickerRankingOrRecord();
  const streakRows=[];
  Object.entries(outcomesForBundle(current)).forEach(([id,games])=>{let type=null,count=0;for(let i=games.length-1;i>=0;i--){const next=games[i].result===1?'W':games[i].result===0?'L':'T';if(next==='T')break;if(type===null)type=next;if(next!==type)break;count++}if(type==='W'&&count>=3)streakRows.push({id:String(id),count})});
  streakRows.sort((a,b)=>b.count-a.count);const hotTeam=streakRows[0],hotOdds=hotTeam?priceRows(lastWeek||Infinity).find(x=>String(x.id)===hotTeam.id):null;
  const stories=[],eventSeed=[...eventKey].reduce((sum,ch)=>sum+ch.charCodeAt(0),0);
  const washedCandidates=allGameLogFormRows().filter(x=>Number(x.priorAvg)>23&&Number(x.recentAvg)>0&&Number(x.recentAvg)<18).sort((a,b)=>a.recentAvg-b.recentAvg),washed=washedCandidates[0];
  if(latest){const playerAssets=Object.values(tradeAssets(latest)).flat().filter(a=>a.type==='player');const hero=playerAssets.sort((a,b)=>Number(b.value||0)-Number(a.value||0))[0];const teams=mids(latest).map(id=>managerName(id,latest));stories.push({kicker:'BLOCKBUSTER',headline:`${hero?.name||'The latest deal'} just changed the temperature of the league`,image:hero?insiderPlayerImage(hero.id):state.managers.get(mids(latest)[0])?.avatar||null,body:`${teams.join(' and ')} have forced every rival GM to reassess the market after completing the newest deal on the board. ${hero?.name?`${hero.name} is the name that sells the headline, but this is not a move that can be judged on reputation alone.`:'The move carries immediate consequences for roster construction and the next wave of negotiations.'} The early grades may call it balanced, but balanced trades do not always produce balanced outcomes. One side will eventually look brave; the other may look like it blinked first.`});}
  if(washed&&stories.length<3&&eventSeed%3!==0){const owner=currentRosterOwner(washed.id);stories.push({kicker:'THE BIG QUESTION',headline:`Is ${washed.name} washed — or is the panic getting ridiculous?`,image:insiderPlayerImage(washed.id),body:`The box score is starting to look uncomfortable. ${washed.name} owns a season average of ${washed.priorAvg.toFixed(1)} fantasy points, yet has managed only ${washed.recentAvg.toFixed(1)} across the last five games. For a player with an established fantasy profile, that is not a harmless dip — it is the kind of slide that invites trade offers, buy-low messages and some truly disrespectful group-chat takes. ${owner?`${managerName(owner)} now has a decision to make: trust the résumé, or move before concern turns into consensus.`:'The league is watching closely.'} Calling him finished may be premature. Pretending nothing is wrong would be worse.`});}
  if(hotTeam&&stories.length<3){const hotName=managerName(hotTeam.id),oddsLabel=hotOdds&&!hotOdds.eliminated?championshipOddsLabel(hotOdds):'long odds',stake=[25000,50000,75000][Math.min(2,Math.max(0,hotTeam.count-3))];stories.push({kicker:'MARKET BUZZ',headline:`A punter has reportedly dropped $${stake.toLocaleString()} on ${hotName} at ${oddsLabel}`,image:state.managers.get(hotTeam.id)?.avatar||null,body:`Someone has decided the hot streak is more than a cute story. After ${hotName} ripped off ${hotTeam.count} consecutive wins, league chatter claims a bold punter has taken a five-figure position on the franchise to win it all. It is reckless, dramatic and exactly the sort of wager that becomes legendary if the run continues. Rival GMs can laugh at the ticket now, but another statement win would turn today's price into the kind of number everyone claims they almost backed.`});}
  if(leader&&stories.length<3){const move=(state.previousPowerRanks[leader.id]||leader.rank)-leader.rank;stories.push({kicker:'POWER SURGE',headline:`${leader.name} ${move>0?'storms to':'refuses to surrender'} the No. 1 spot`,image:state.managers.get(String(leader.id))?.avatar||null,body:`${leader.name} owns the strongest all-round profile in IMO Dynasty right now, and the rest of the league is running out of excuses. ${move>0?`A jump of ${move} place${move===1?'':'s'} has turned momentum into a statement.`:'Holding the top spot is now less of a surprise and more of a warning.'} Results, form and title outlook all point in the same direction. The only real question is whether this is a temporary peak — or the beginning of a gap nobody else can close.`});}
  if(topPlayer&&stories.length<3){const owner=currentRosterOwner(topPlayer.id);stories.push({kicker:'AWARD WATCH',headline:`The MVP race may already belong to ${topPlayer.name}`,image:insiderPlayerImage(topPlayer.id),body:`At ${topPlayer.avg.toFixed(1)} fantasy points per game, ${topPlayer.name} is not merely leading the early conversation — he is threatening to make it boring. ${owner?`${managerName(owner)} has built a weekly advantage around that production, and every opponent now enters the matchup knowing the margin for error is almost nonexistent.`:'The numbers have pushed him to the centre of the awards race.'} There is plenty of season left, but anyone waiting for the pace to collapse may be waiting a very long time.`});}
  while(stories.length<3){stories.push({kicker:'LEAGUE WATCH',headline:rankingText||streakText||'The next gameweek could reshape the league',image:null,body:`With Week ${lastWeek+1} approaching, the margins between contenders are beginning to matter. Power-ranking movement, changing roster identities and the next trade call could all alter the league's direction before the next edition. Front offices are watching the market closely, and one decisive move may be enough to turn quiet momentum into the week's defining story.`})}
  const coming=[];if(topPlayer)coming.push(`${topPlayer.name}'s MVP case under the microscope`);if(latest)coming.push('Trade market reaction and potential follow-up deals');coming.push(lastWeek?`Week ${lastWeek+1} matchup pressure builds`:'Opening-week power picture takes shape');coming.push('Awards watch and emerging breakout candidates');
  let issue=1;try{const prev=JSON.parse(localStorage.getItem(storageKey)||'null');issue=(prev?.issue||0)+1}catch{}
  const edition={eventKey,issue,date:new Date().toISOString(),stories:stories.slice(0,3),coming:coming.slice(0,3)};try{localStorage.setItem(storageKey,JSON.stringify(edition));localStorage.setItem('imoMarketSnapshotV1',JSON.stringify(marketSnapshot()))}catch{}return edition;
}
function renderHeadlines(){const root=$('headlinesContent');if(!root)return;const ed=buildInsiderEdition();root.innerHTML=`<header class="insider-header"><div><span class="insider-brand"><img src="assets/imo-insider.svg" alt=""><span><b>IMO INSIDER</b><small>DAILY LEAGUE EDITION</small></span></span><h2 id="headlinesTitle">Today's Headlines</h2><p>${fmt(new Date(ed.date).getTime())} · Issue #${String(ed.issue).padStart(3,'0')}</p></div><span class="insider-live">LATEST EDITION</span></header><div class="insider-stories">${ed.stories.map((story,i)=>`<article class="insider-story">${story.image?`<div class="insider-image"><img src="${esc(story.image)}" alt="" loading="lazy" onerror="this.parentElement.remove()"></div>`:''}<div class="insider-copy"><span>${esc(story.kicker)}</span><h3>${esc(story.headline)}</h3><p>${esc(story.body)}</p></div></article>`).join('')}</div><aside class="coming-tomorrow"><span>COMING TOMORROW</span><ul>${ed.coming.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></aside>`}
function openHeadlines(){renderHeadlines();const modal=$('headlinesModal');modal?.classList.add('open');modal?.setAttribute('aria-hidden','false');document.body.classList.add('headlines-open')}
function closeHeadlines(){const modal=$('headlinesModal');modal?.classList.remove('open');modal?.setAttribute('aria-hidden','true');document.body.classList.remove('headlines-open')}


const MOCK_DRAFT_2027_PROSPECTS=[
  {rank:1,name:"Tyran Stokes",position:"SF",team:"Kansas",height:"6'7\"",weight:"230 lbs",age:"19.7 yrs"},
  {rank:2,name:"Caleb Holt",position:"SG",team:"Arizona",height:"6'5\"",weight:"200 lbs",age:"19.6 yrs"},
  {rank:3,name:"Jordan Smith Jr.",position:"SG/PG",team:"Arkansas",height:"6'2\"",weight:"200 lbs",age:"19.8 yrs"},
  {rank:4,name:"Cameron Williams",position:"PF",team:"Duke",height:"6'11\"",weight:"200 lbs",age:"19.7 yrs"},
  {rank:5,name:"Anthony Thompson",position:"SF",team:"Ohio State",height:"6'9\"",weight:"215 lbs",age:"18.9 yrs"},
  {rank:6,name:"Bruce Branch III",position:"SF",team:"BYU",height:"6'7\"",weight:"190 lbs",age:"18.7 yrs"},
  {rank:7,name:"Braylon Mullins",position:"SG",team:"UConn",height:"6'6\"",weight:"196 lbs",age:"21.2 yrs"},
  {rank:8,name:"Stefan Joksimović",position:"PG/SG",team:"Baskonia",height:"6'7\"",weight:"205 lbs",age:"18.6 yrs"},
  {rank:9,name:"Baba Oladotun",position:"SF/PF",team:"Maryland",height:"6'10\"",weight:"195 lbs",age:"18.5 yrs"},
  {rank:10,name:"Brandon McCoy Jr.",position:"PG/SG",team:"Michigan",height:"6'5\"",weight:"190 lbs",age:"19.6 yrs"},
  {rank:11,name:"Sayon Keita",position:"C",team:"North Carolina",height:"7'0\"",weight:"215 lbs",age:"19.3 yrs"},
  {rank:12,name:"Dylan Mingo",position:"PG",team:"Baylor",height:"6'5\"",weight:"185 lbs",age:"18.7 yrs"},
  {rank:13,name:"Amari Allen",position:"SF",team:"Alabama",height:"6'6.5\"",weight:"205 lbs",age:"21.4 yrs"},
  {rank:14,name:"Hugo Yimga-Moukouri",position:"SF",team:"Nanterre 92",height:"6'9\"",weight:"218 lbs",age:"18.9 yrs"},
  {rank:15,name:"Thomas Haugh",position:"PF",team:"Florida",height:"6'9\"",weight:"215 lbs",age:"23.9 yrs"},
  {rank:16,name:"Patrick Ngongba II",position:"C",team:"Duke",height:"6'11\"",weight:"250 lbs",age:"21.3 yrs"},
  {rank:17,name:"Ivan Kharchenkov",position:"SF",team:"Arizona",height:"6'7\"",weight:"230 lbs",age:"20.7 yrs"},
  {rank:18,name:"Tounde Yessoufou",position:"SG/SF",team:"St. John's",height:"6'5.5\"",weight:"220 lbs",age:"21.1 yrs"},
  {rank:19,name:"Miikka Muurinen",position:"PF",team:"Arkansas",height:"6'11\"",weight:"200 lbs",age:"20.3 yrs"},
  {rank:20,name:"Luigi Suigo",position:"C",team:"Villanova",height:"7'4\"",weight:"289 lbs",age:"20.4 yrs"},
  {rank:21,name:"JJ Andrews",position:"SF",team:"Arkansas",height:"6'6\"",weight:"220 lbs",age:"19.3 yrs"},
  {rank:22,name:"Motiejus Krivas",position:"C",team:"Arizona",height:"7'2\"",weight:"260 lbs",age:"22.6 yrs"},
  {rank:23,name:"Christian Collins",position:"SF/PF",team:"USC",height:"6'9\"",weight:"200 lbs",age:"19.8 yrs"},
  {rank:24,name:"Davis Fogle",position:"SG",team:"Gonzaga",height:"6'7\"",weight:"200 lbs",age:"21.0 yrs"},
  {rank:25,name:"Billy Richmond III",position:"SG/SF",team:"Arkansas",height:"6'7\"",weight:"195 lbs",age:"21.2 yrs"},
  {rank:26,name:"Jason Crowe Jr.",position:"PG",team:"Missouri",height:"6'3\"",weight:"170 lbs",age:"18.9 yrs"},
  {rank:27,name:"Milan Momcilovic",position:"SF/PF",team:"Kentucky",height:"6'9.25\"",weight:"218 lbs",age:"22.7 yrs"},
  {rank:28,name:"Alijah Arenas",position:"SG",team:"USC",height:"6'6\"",weight:"197 lbs",age:"20.3 yrs"},
  {rank:29,name:"Malachi Moreno",position:"C",team:"Kentucky",height:"7'0.5\"",weight:"243 lbs",age:"20.7 yrs"},
  {rank:30,name:"David Mirkovic",position:"PF",team:"Illinois",height:"6'9\"",weight:"250 lbs",age:"21.5 yrs"}
];
function mockDraftWeekKey(date=new Date()){
  const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
  const day=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+4-day);
  const yearStart=new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return `${d.getUTCFullYear()}-${Math.ceil((((d-yearStart)/86400000)+1)/7)}`;
}
function seededNumber(seed){let h=2166136261;for(const ch of String(seed)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return ()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function weeklyMockProspects(){
  const week=mockDraftWeekKey(),rand=seededNumber(`imo-2027-${week}`);
  const topTwenty=MOCK_DRAFT_2027_PROSPECTS.slice(0,20);

  // Keep the leading board credible while allowing controlled weekly movement.
  // Only non-overlapping adjacent pairs can swap, so every top-20 prospect
  // moves by no more than one position in either direction during a week.
  const candidatePairs=[];
  for(let i=0;i<topTwenty.length-1;i++)candidatePairs.push(i);
  for(let i=candidatePairs.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[candidatePairs[i],candidatePairs[j]]=[candidatePairs[j],candidatePairs[i]]}
  const used=new Set(),swapCount=3+Math.floor(rand()*3);
  let completed=0;
  for(const i of candidatePairs){
    if(completed>=swapCount)break;
    if(used.has(i)||used.has(i+1))continue;
    [topTwenty[i],topTwenty[i+1]]=[topTwenty[i+1],topTwenty[i]];
    used.add(i);used.add(i+1);completed++;
  }

  // Picks 21-24 continue to rotate from the wider 21-30 prospect pool.
  const pool=MOCK_DRAFT_2027_PROSPECTS.slice(20),shuffled=[...pool];
  for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]]}
  return [...topTwenty,...shuffled.slice(0,4)];
}
function currentLeagueBundle(){return state.bundles.find(b=>String(b.league?.league_id)===String(CONFIG.currentLeagueId))||state.modelBundle||state.bundles[0]}
function projected2027DraftSlots(){
  const bundle=currentLeagueBundle();if(!bundle)return[];
  const weeks=meaningfulWeeks(bundle),through=weeks.at(-1)||Infinity;
  const worstToBest=[...priceRowsForBundle(bundle,through)].sort((a,b)=>Number(b.odds)-Number(a.odds)||Number(a.rank)-Number(b.rank));
  return worstToBest.map((row,index)=>{const manager=state.managers.get(String(row.id)),rosterId=String(manager?.roster?.roster_id||'');return{slot:index+1,originalRosterId:rosterId,originalManagerId:String(row.id)}}).filter(x=>x.originalRosterId);
}
function ownerManagerFor2027Pick(originalRosterId,round){
  const bundle=currentLeagueBundle(),traded=(bundle?.tradedPicks||[]).find(p=>String(p.season)==='2027'&&Number(p.round)===Number(round)&&String(p.roster_id??p.original_roster_id)===String(originalRosterId));
  const ownerRosterId=String(traded?.owner_id??originalRosterId),managerId=String(bundle?.ownerByRoster?.[ownerRosterId]||'');
  return state.managers.get(managerId)||[...state.managers.values()].find(m=>String(m.roster?.roster_id)===ownerRosterId)||null;
}
function mockDraftRows(){
  const slots=projected2027DraftSlots(),prospects=weeklyMockProspects(),rows=[];
  for(let round=1;round<=3;round++)for(const slot of slots){const overall=(round-1)*8+slot.slot,prospect=prospects[overall-1],owner=ownerManagerFor2027Pick(slot.originalRosterId,round);rows.push({round,slot:slot.slot,pick:`${round}.${String(slot.slot).padStart(2,'0')}`,overall,prospect,owner})}
  return rows;
}
function renderMockDraft(){
  const root=$("mockDraftContent");if(!root)return;const rows=mockDraftRows(),updated=new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'long',year:'numeric'}).format(new Date());
  root.innerHTML=`<header class="mock-draft-header"><div><span class="eyebrow">IMO DYNASTY DRAFT ROOM</span><h2 id="mockDraftTitle">2027 Rookie Mock Draft</h2><p>Projected order uses reverse championship odds and live Sleeper pick ownership.</p></div><div class="mock-draft-update"><span>Weekly board</span><strong>${esc(updated)}</strong></div></header><div class="mock-draft-round-nav"><button type="button" data-mock-round="1" class="active">Round 1</button><button type="button" data-mock-round="2">Round 2</button><button type="button" data-mock-round="3">Round 3</button></div><div class="mock-draft-board">${rows.map(row=>{const p=row.prospect,m=row.owner,avatar=m?.avatar?`<img src="${esc(m.avatar)}" alt="" loading="lazy">`:`<span>${esc(m?.initials||'—')}</span>`;return `<details class="mock-pick-card" data-mock-round-card="${row.round}"><summary><div class="mock-pick-number">${row.pick}</div><div class="mock-owner">${avatar}<b>${esc(m?.name||'Unassigned')}</b></div><div class="mock-player-compact"><strong>${esc(p?.name||'TBD')}</strong><span>${esc(p?.position||'')}</span></div><span class="mock-expand-indicator" aria-hidden="true">+</span></summary><div class="mock-player-details"><div><span>School / Team</span><strong>${esc(p?.team||'—')}</strong></div><div><span>Height</span><strong>${esc(p?.height||'—')}</strong></div><div><span>Weight</span><strong>${esc(p?.weight||'—')}</strong></div><div><span>Age</span><strong>${esc(p?.age||'—')}</strong></div></div></details>`}).join('')}</div>`;
}
function openMockDraft(){renderMockDraft();const modal=$("mockDraftModal");modal?.classList.add('open');modal?.setAttribute('aria-hidden','false');document.body.classList.add('mock-draft-open')}
function closeMockDraft(){const modal=$("mockDraftModal");modal?.classList.remove('open');modal?.setAttribute('aria-hidden','true');document.body.classList.remove('mock-draft-open')}

function safeRender(name,fn){try{fn()}catch(error){console.error(`Failed to render ${name}:`,error)}}
function renderAll(){
  ensureManagerGradeStyles();
  safeRender("summary",renderSummary);
  safeRender("leaderboard",renderLeaderboard);
  safeRender("power rankings",renderPower);
  safeRender("odds",renderOdds);
  safeRender("trade of the week",renderTradeWeek);
  safeRender("trade partners",renderHeatmap);
  safeRender("player form",renderPlayerForm);
  safeRender("most traded players",renderBlock);
  safeRender("most waived players",renderWaivedBlock);
  safeRender("head to head",renderHeadToHead);
  safeRender("league records",renderRecords);
  safeRender("recent trades",renderRecent);
  safeRender("biggest trades",renderBiggestTrades);
  safeRender("voting",renderVoting);
  safeRender("ticker",renderTicker);
  requestAnimationFrame(observeManagerProfileLinks);
}

function relevantPlayerIds(){
  const ids=new Set();
  state.bundles.forEach(bundle=>{
    (bundle.rosters||[]).forEach(r=>(r.players||[]).forEach(id=>ids.add(String(id))));
    (bundle.trades||[]).forEach(t=>{
      Object.keys(t.adds||{}).forEach(id=>ids.add(String(id)));
      Object.keys(t.drops||{}).forEach(id=>ids.add(String(id)));
    });
    Object.values(bundle.draftPickMap||{}).forEach(id=>ids.add(String(id)));
    (bundle.draftSelections||[]).forEach(p=>{if(p?.playerId)ids.add(String(p.playerId))});
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
  // Sleeper is the single source of truth for FPTS. The stats service returns
  // Sleeper's own fantasy-points result on each game row; use it unchanged so
  // averages match the Sleeper app rather than re-scoring box-score fields here.
  const direct=numericValue(row,["fantasy_points","fantasy_pts","fpts","fp","pts_fantasy"]);
  if(direct!==null)return direct;

  // Defensive fallback only for an incomplete API row. This is deliberately
  // secondary and is never allowed to override a Sleeper-provided FPTS value.
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
  const payload=await statsJSON(url);
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
}


function statNumber(stats,keys){
  for(const key of keys){
    const n=Number(stats?.[key]);
    if(Number.isFinite(n))return n;
  }
  return 0;
}
function seasonStatsObject(payload){
  if(!payload)return null;
  if(payload.stats&&typeof payload.stats==="object")return payload.stats;
  if(Array.isArray(payload)){
    const row=payload.find(x=>x?.stats&&typeof x.stats==="object")||payload[0];
    return row?.stats||row||null;
  }
  return typeof payload==="object"?payload:null;
}
function scoreSeasonStats(stats,scoring){
  let total=0,matched=0;
  const aliases={
    pts:["pts"],reb:["reb"],ast:["ast"],stl:["stl"],blk:["blk"],to:["to","turnovers"],
    fgm:["fgm"],fga:["fga"],fgmi:["fgmi"],ftm:["ftm"],fta:["fta"],ftmi:["ftmi"],
    tpm:["tpm"],tpa:["tpa"],tpmi:["tpmi"],oreb:["oreb"],dreb:["dreb"],
    pf:["pf"],tf:["tf"],ff:["ff"],dd:["dd"],td:["td"],
    bonus_double_double:["bonus_double_double","dd"],
    bonus_triple_double:["bonus_triple_double","td"],
    bonus_pt_15p:["bonus_pt_15p"],bonus_pt_20p:["bonus_pt_20p"],bonus_pt_25p:["bonus_pt_25p"],
    bonus_pt_30p:["bonus_pt_30p"],bonus_pt_35p:["bonus_pt_35p"],bonus_pt_40p:["bonus_pt_40p"],
    bonus_pt_45p:["bonus_pt_45p"],bonus_pt_50p:["bonus_pt_50p"],
    bonus_ast_10p:["bonus_ast_10p"],bonus_ast_15p:["bonus_ast_15p"],bonus_ast_20p:["bonus_ast_20p"],
    bonus_reb_10p:["bonus_reb_10p"],bonus_reb_15p:["bonus_reb_15p"],bonus_reb_20p:["bonus_reb_20p"],
    bonus_stl_5p:["bonus_stl_5p"],bonus_blk_5p:["bonus_blk_5p"],
    bonus_3pm_5p:["bonus_3pm_5p"],bonus_3pm_10p:["bonus_3pm_10p"],
    plus_minus:["plus_minus"],pts_reb_ast:["pts_reb_ast"],reb_ast:["reb_ast"],blk_stl:["blk_stl"]
  };
  Object.entries(scoring||{}).forEach(([key,multiplier])=>{
    const mult=Number(multiplier);
    if(!Number.isFinite(mult)||mult===0)return;
    const keys=aliases[key]||[key];
    let found=false,value=0;
    for(const statKey of keys){
      const n=Number(stats?.[statKey]);
      if(Number.isFinite(n)){value=n;found=true;break}
    }
    if(!found)return;
    total+=value*mult;
    matched+=1;
  });
  return matched?total:null;
}
async function loadPlayerSeasonAverage(playerId,season,scoring){
  // Sleeper's player season endpoint provides the exact aggregate box-score and
  // bonus counters used by its app. Apply the scoring settings from the matching
  // league season, then divide by Sleeper's own GP value. This reproduces the
  // league-specific FPTS/game shown in Sleeper and automatically works for future seasons.
  const url=`${CONFIG.statsApi}/${encodeURIComponent(playerId)}?season_type=regular&season=${encodeURIComponent(season)}`;
  const payload=await statsJSON(url);
  const stats=seasonStatsObject(payload);
  const gamesPlayed=Number(stats?.gp);
  const totalFantasyPoints=scoreSeasonStats(stats,scoring);
  if(Number.isFinite(gamesPlayed)&&gamesPlayed>0&&Number.isFinite(totalFantasyPoints)){
    return {average:totalFantasyPoints/gamesPlayed,totalFantasyPoints,gamesPlayed,source:"league-season-stats"};
  }
  // Defensive fallback only when the aggregate endpoint is incomplete.
  const fallback=await loadPlayerGameLogAverage(playerId,season,scoring);
  return fallback?{average:fallback.average,totalFantasyPoints:fallback.points,gamesPlayed:fallback.games,source:"game-log-fallback"}:null;
}
async function loadBulkSeasonPayload(season){
  const positions=['PG','SG','SF','PF','C','G','F'];
  const query=new URLSearchParams({season_type:'regular',order_by:'pts_std'});
  positions.forEach(position=>query.append('position[]',position));
  const url=`${CONFIG.bulkStatsApi}/${encodeURIComponent(season)}?${query.toString()}`;
  return await statsJSON(url);
}
function bulkSeasonRows(payload){
  if(Array.isArray(payload))return payload;
  if(Array.isArray(payload?.data))return payload.data;
  if(Array.isArray(payload?.players))return payload.players;
  if(Array.isArray(payload?.stats))return payload.stats;
  if(payload&&typeof payload==='object'){
    return Object.entries(payload).map(([key,value])=>{
      if(value&&typeof value==='object')return {...value,player_id:value.player_id??value.playerId??key};
      return null;
    }).filter(Boolean);
  }
  return [];
}
function bulkRowPlayerId(row){
  return String(row?.player_id??row?.playerId??row?.id??row?.metadata?.player_id??'');
}
function bulkRowStats(row){
  if(row?.stats&&typeof row.stats==='object')return row.stats;
  if(row?.stat&&typeof row.stat==='object')return row.stat;
  return row||{};
}
async function loadSeasonTotalAverages(){
  const rostered=new Set(relevantPlayerIds().map(String));
  const bySeason={},meta={};
  const seasonJobs=state.bundles.map(async bundle=>{
    const season=String(bundle.league.season),scoring=bundle.league.scoring_settings||{};
    const payload=await loadBulkSeasonPayload(season);
    const rows=bulkSeasonRows(payload);
    const averages={},seasonMeta={};
    for(const row of rows){
      const id=bulkRowPlayerId(row);
      if(!id||!rostered.has(id))continue;
      const stats=bulkRowStats(row),gamesPlayed=Number(stats?.gp),totalFantasyPoints=scoreSeasonStats(stats,scoring);
      if(!Number.isFinite(gamesPlayed)||gamesPlayed<=0||!Number.isFinite(totalFantasyPoints))continue;
      const average=totalFantasyPoints/gamesPlayed;
      averages[id]=average;
      seasonMeta[id]={gamesPlayed,totalFantasyPoints,average,source:'sleeper-bulk-season'};
    }
    console.info(`[IMO Dynasty] ${season} bulk averages loaded: ${Object.keys(averages).length}`);
    if(season==='2025'){
      const kp=seasonMeta['2009'];
      console.info('[IMO Dynasty] Kevin Porter Jr 2025:',kp||'not found in bulk response');
    }
    return {season,averages,seasonMeta,rowCount:rows.length};
  });
  const results=await Promise.all(seasonJobs);
  results.forEach(({season,averages,seasonMeta})=>{bySeason[season]=averages;meta[season]=seasonMeta});
  state.seasonTotalAverages=bySeason;
  state.seasonTotalMeta=meta;
  return results;
}

async function loadSeason(id){
  const [league,users,rosters,drafts,tradedPicks,winnersBracket]=await Promise.all([
    getJSON(`${CONFIG.api}/league/${id}`,true),getJSON(`${CONFIG.api}/league/${id}/users`,true),
    getJSON(`${CONFIG.api}/league/${id}/rosters`,true),getJSON(`${CONFIG.api}/league/${id}/drafts`,true),
    getJSON(`${CONFIG.api}/league/${id}/traded_picks`,true),getJSON(`${CONFIG.api}/league/${id}/winners_bracket`,true)
  ]);
  if(!league||!users||!rosters)return null;

  // Resolve each roster to its franchise name before building the draft map.
  // For seasons with a verified board, the manager column determines the
  // original pick slot regardless of who ultimately made the selection.
  const earlyUserById=Object.fromEntries(users.map(u=>[String(u.user_id),u]));
  const rosterNameById={};
  rosters.forEach(r=>{
    const u=earlyUserById[String(r.owner_id)]||{};
    rosterNameById[String(r.roster_id)]=u.metadata?.team_name||u.display_name||`Team ${r.roster_id}`;
  });

  const draftResults=await Promise.all((drafts||[]).map(async draft=>({
    draft,picks:(await getJSON(`${CONFIG.api}/draft/${draft.draft_id}/picks`,true))||[]
  })));
  // Preserve every completed draft selection for player-origin labels and
  // return-tree lineage. Rookie-only grading continues to use draftSelections.
  const allDraftSelections=[];
  draftResults.forEach(({draft,picks})=>{
    const draftName=String(draft?.metadata?.name||draft?.name||'').toLowerCase();
    const configuredRounds=Number(draft?.settings?.rounds)||0;
    const observedRounds=Math.max(0,...picks.map(p=>Number(p.round)||0));
    const isRookieDraft=draftName.includes('rookie')||((configuredRounds||observedRounds)>0&&(configuredRounds||observedRounds)<=5);
    const season=String(draft?.season||league.season);
    const teamCount=Number(draft?.settings?.teams)||Number(league?.total_rosters)||rosters.length||8;
    picks.forEach(p=>{
      if(p.player_id==null||p.round==null)return;
      const round=Number(p.round),pickNo=Number(p.pick_no);
      const overallPick=Number.isFinite(pickNo)&&pickNo>0?pickNo:(round-1)*teamCount+Number(p.draft_slot||0);
      const slot=Number.isFinite(pickNo)&&pickNo>0?((pickNo-1)%teamCount)+1:Number(p.draft_slot||0);
      allDraftSelections.push({
        season,draftId:String(draft?.draft_id||''),playerId:String(p.player_id),pickedBy:p.picked_by!=null?String(p.picked_by):'',
        overallPick,pickNo:Number.isFinite(pickNo)&&pickNo>0?pickNo:overallPick,round,draftSlot:slot||null,teamCount,
        isRookieDraft,draftKind:isRookieDraft?'rookie':'startup',created:Number(draft?.created||draft?.start_time||0)
      });
    });
  });
  // Prefer true rookie drafts (short drafts or explicitly named rookie drafts).
  // This prevents a startup/supplemental draft in the same league from
  // overwriting the rookie-slot attribution.
  const rookieDrafts=draftResults.filter(({draft,picks})=>{
    const name=String(draft?.metadata?.name||draft?.name||'').toLowerCase();
    const configuredRounds=Number(draft?.settings?.rounds)||0;
    const observedRounds=Math.max(0,...picks.map(p=>Number(p.round)||0));
    return name.includes('rookie')||((configuredRounds||observedRounds)>0&&(configuredRounds||observedRounds)<=5);
  });
  const relevantDrafts=rookieDrafts.length?rookieDrafts:draftResults;
  const draftPickMap={},draftSelections=[];
  relevantDrafts.forEach(({draft,picks})=>{
    const draftName=String(draft?.metadata?.name||draft?.name||'').toLowerCase();
    const configuredRounds=Number(draft?.settings?.rounds)||0;
    const observedRounds=Math.max(0,...picks.map(p=>Number(p.round)||0));
    const isRookieDraft=draftName.includes('rookie')||((configuredRounds||observedRounds)>0&&(configuredRounds||observedRounds)<=5);
    const season=String(draft?.season||league.season);
    const teamCount=Number(draft?.settings?.teams)||Number(league?.total_rosters)||rosters.length||8;
    const draftType=String(draft?.type||draft?.settings?.type||'linear').toLowerCase();
    // Sleeper draft payloads are not consistent across seasons. Newer drafts
    // may expose slot_to_roster_id, while older drafts (including 2025) often
    // expose draft_order as user_id -> slot. Build one canonical slot ->
    // ORIGINAL roster_id map so historical traded picks resolve to the player
    // selected with that exact franchise pick.
    const slotToRoster={...(draft?.slot_to_roster_id||draft?.metadata?.slot_to_roster_id||{})};
    const rosterByOwner=Object.fromEntries(rosters.filter(r=>r.owner_id!=null).map(r=>[String(r.owner_id),String(r.roster_id)]));
    Object.entries(draft?.draft_order||draft?.metadata?.draft_order||{}).forEach(([userId,slot])=>{
      const rosterId=rosterByOwner[String(userId)];
      if(rosterId!=null&&slot!=null)slotToRoster[String(slot)]=String(rosterId);
    });
    picks.forEach(p=>{
      if(p.player_id==null||p.round==null)return;
      const round=Number(p.round);
      const pickNo=Number(p.pick_no);
      const overallPick=Number.isFinite(pickNo)&&pickNo>0?pickNo:(round-1)*teamCount+Number(p.draft_slot||0);
      // Draft grading permanently credits the Sleeper user who actually made
      // the selection. Never infer this from roster ownership, pick origin or
      // the player's current team.
      if(p.picked_by!=null&&Number.isFinite(overallPick)&&overallPick>0){
        draftSelections.push({
          season,
          draftId:String(draft?.draft_id||''),
          playerId:String(p.player_id),
          pickedBy:String(p.picked_by),
          overallPick,
          pickNo:Number.isFinite(pickNo)&&pickNo>0?pickNo:overallPick,
          round,
          draftSlot:Number(p.draft_slot)||null,
          teamCount,
          isRookieDraft
        });
      }
      let originalSlot=null;

      // Work out the slot at which the selection was made. The pick payload's
      // draft_slot can describe the drafter after trades, so pick_no is the
      // safest source for the actual position in the round.
      if(Number.isFinite(pickNo)&&pickNo>0&&teamCount>0){
        const positionInRound=((pickNo-1)%teamCount)+1;
        originalSlot=(draftType==='snake'&&round%2===0)
          ? teamCount-positionInRound+1
          : positionInRound;
      }else if(p.draft_slot!=null){
        originalSlot=Number(p.draft_slot);
      }

      if(!Number.isFinite(originalSlot)||originalSlot<1)return;

      // Historical trade assets identify a pick by its ORIGINAL roster_id,
      // not by the numerical draft slot. Convert the final slot back to the
      // franchise whose pick created that slot before storing the player.
      // This keeps traded selections correct everywhere the shared trade
      // formatter is used (Trade Centre, manager Recent Trades and Biggest
      // Ever Trades).
      let originalRosterId=null;

      // Verified completed-draft board: the column is the original franchise
      // pick. Find the roster whose team name owns this column. This is what
      // makes, for example, Chetanyahu R1 -> 1.03 -> AJ Dybantsa and Thanos
      // R1 -> 1.08 -> Mikel Brown, even when another team made the selection.
      if(CANONICAL_DRAFT_COLUMNS[season]){
        originalRosterId=Object.keys(rosterNameById).find(rid=>
          Number(canonicalDraftSlot(season,rosterNameById[rid]))===Number(originalSlot)
        )||null;
      }

      // Generic fallback for other completed rookie drafts, including 2025.
      if(originalRosterId==null){
        originalRosterId=slotToRoster[String(originalSlot)]??slotToRoster[originalSlot]??null;
      }

      if(originalRosterId!=null){
        draftPickMap[`${season}|${String(originalRosterId)}|${String(round)}`]=String(p.player_id);
      }else{
        // Final fallback for older payloads that expose only a numerical slot.
        draftPickMap[`${season}|${String(originalSlot)}|${String(round)}`]=String(p.player_id);
      }
    });
  });

  const ownerByRoster={},userById=Object.fromEntries(users.map(u=>[String(u.user_id),u])),managerNameMap={};
  rosters.forEach(r=>{if(r.owner_id!=null){ownerByRoster[String(r.roster_id)]=String(r.owner_id);const u=userById[String(r.owner_id)]||{};managerNameMap[String(r.owner_id)]=u.metadata?.team_name||u.display_name||`Team ${r.roster_id}`}});
  const rounds=Array.from({length:CONFIG.roundsToCheck},(_,i)=>i+1),weeks=await limitedMap(rounds,8,async wk=>{
    const [tx,match]=await Promise.all([getJSON(`${CONFIG.api}/league/${id}/transactions/${wk}`,true),getJSON(`${CONFIG.api}/league/${id}/matchups/${wk}`,true)]);
    const completedTransactions=(tx||[]).filter(t=>!t.status||t.status==='complete');
    const trades=completedTransactions.filter(t=>t.type==='trade').map(t=>{
      const participantRosters=new Set((t.roster_ids||[]).map(String));
      if(!participantRosters.size){Object.values(t.adds||{}).forEach(x=>participantRosters.add(String(x)));Object.values(t.drops||{}).forEach(x=>participantRosters.add(String(x)));(t.draft_picks||[]).forEach(p=>{if(p.owner_id!=null)participantRosters.add(String(p.owner_id));if(p.previous_owner_id!=null)participantRosters.add(String(p.previous_owner_id))})}
      return {...t,manager_ids:[...participantRosters].map(r=>ownerByRoster[r]).filter(Boolean),roster_owner_map:ownerByRoster,manager_name_map:managerNameMap,season_label:`${league.season} season`,league_id:id}
    });
    return{trades,transactions:completedTransactions.map(t=>({...t,week:wk,league_id:id,season_label:`${league.season} season`,roster_owner_map:ownerByRoster,manager_name_map:managerNameMap})),matchups:(match||[]).map(x=>({...x,week:wk}))}
  });
  return{league,users,rosters,ownerByRoster,draftPickMap,draftSelections,allDraftSelections,tradedPicks:tradedPicks||[],winnersBracket:winnersBracket||[],trades:weeks.flatMap(x=>x?.trades||[]),transactions:weeks.flatMap(x=>x?.transactions||[]),matchups:weeks.flatMap(x=>x?.matchups||[])}
}
async function load(){
  const status=$("statusText");
  if(status)status.textContent='Connecting to Sleeper…';
  try{
    const [bundles,players]=await Promise.all([
      Promise.all(CONFIG.leagueIds.map(loadSeason)),
      getJSON(`${CONFIG.api}/players/nba`,true)
    ]);
    const valid=(bundles||[]).filter(Boolean);
    const cur=valid.find(x=>String(x.league.league_id)===CONFIG.currentLeagueId)||valid[0];
    if(!cur)throw new Error('No Sleeper league data could be loaded');
    state.exactSeasonAverages={};
    state.sportState=await getJSON(`${CONFIG.api}/state/nba`,true);
    state.bundles=valid;
    state.league=cur.league;
    state.currentUsers=cur.users||[];
    state.currentRosters=cur.rosters||[];
    state.players=players||{};
    state.draftPickMap=Object.assign({},...valid.map(b=>b.draftPickMap||{}));
    state.draftSelections=valid.flatMap(b=>b.draftSelections||[]);
    state.allDraftSelections=valid.flatMap(b=>b.allDraftSelections||[]);
    buildManagers();
    const unique=new Map();
    valid.flatMap(x=>x.trades||[]).forEach(t=>unique.set(t.transaction_id||`${t.league_id}-${t.created}`,t));
    state.trades=[...unique.values()].sort((a,b)=>(b.created||0)-(a.created||0));
    if(status)status.textContent='Loading exact Sleeper season averages…';
    await loadSeasonTotalAverages();
    prepareModels();
    resetComputedCaches();
    prepareOddsMovement();
    state.profilePrewarmQueued=false;
    renderAll();
    setupHeadToHeadRefresh();
    if(status)status.textContent=`Live · ${valid.length} seasons loaded`;
    const runWhenIdle=(fn,timeout=2500)=>{
      if('requestIdleCallback' in window)requestIdleCallback(fn,{timeout});
      else setTimeout(fn,900);
    };
    runWhenIdle(()=>loadTickerGameLogs().catch(error=>console.warn("Ticker game logs unavailable:",error)),1800);
    const averageCount=Object.values(state.seasonTotalMeta||{}).reduce((sum,season)=>sum+Object.keys(season||{}).length,0);
    if(status)status.textContent=`Live · ${valid.length} seasons loaded · ${averageCount} exact player averages`;
  }catch(e){
    console.error('IMO DYNASTY load failed:',e);
    if(status)status.textContent='Could not load Sleeper data';
  }finally{
    // Automatic loading only; manual refresh control intentionally removed.
  }
}
document.querySelectorAll('.active-window-btn').forEach(b=>b.addEventListener('click',()=>{state.activeWindow=b.dataset.activeWindow;document.querySelectorAll('.active-window-btn').forEach(x=>x.classList.toggle('active',x===b));renderSummary();renderLeaderboard()}));$("biggestTradesToggle").addEventListener('click',()=>{state.biggestTradesExpanded=!state.biggestTradesExpanded;renderBiggestTrades()});
let lastManagerPointerAction=0;
function closeMobileManagerSwitcher(){
  const sheet=document.getElementById('mobileManagerSwitcherSheet');
  if(sheet)sheet.remove();
  document.body.classList.remove('mobile-manager-switcher-open');
  document.querySelectorAll('[data-manager-switcher-trigger][aria-expanded="true"]').forEach(btn=>btn.setAttribute('aria-expanded','false'));
}
function openMobileManagerSwitcher(trigger){
  closeMobileManagerSwitcher();
  const currentId=String($("managerProfileModal")?.dataset.managerId||'');
  const options=[...state.managers.values()].sort((a,b)=>a.name.localeCompare(b.name));
  const sheet=document.createElement('div');
  sheet.id='mobileManagerSwitcherSheet';
  sheet.className='mobile-manager-switcher-sheet open';
  sheet.innerHTML=`<button type="button" class="mobile-manager-switcher-backdrop" data-close-mobile-manager-switcher aria-label="Close manager switcher"></button><section class="mobile-manager-switcher-card" role="dialog" aria-modal="true" aria-label="Switch manager"><div class="mobile-manager-switcher-head"><div><span class="eyebrow">TEAM PROFILES</span><h3>Switch Manager</h3></div><button type="button" class="mobile-manager-switcher-close" data-close-mobile-manager-switcher aria-label="Close">×</button></div><div class="mobile-manager-switcher-list">${options.map(m=>{const avatar=m.avatar?`<img src="${esc(m.avatar)}" alt="" loading="lazy">`:`<span>${esc(m.initials||m.name.slice(0,2).toUpperCase())}</span>`;return `<button type="button" class="mobile-manager-switcher-option ${m.id===currentId?'active':''}" data-mobile-switch-manager="${esc(m.id)}">${avatar}<b>${esc(m.name)}</b>${m.id===currentId?'<small>Current</small>':''}</button>`}).join('')}</div></section>`;
  document.body.appendChild(sheet);
  document.body.classList.add('mobile-manager-switcher-open');
  trigger.setAttribute('aria-expanded','true');
  requestAnimationFrame(()=>sheet.querySelector('.mobile-manager-switcher-option:not(.active)')?.focus({preventScroll:true}));
}
function toggleManagerSwitcher(trigger){
  if(window.matchMedia('(max-width: 620px)').matches){
    openMobileManagerSwitcher(trigger);
    return;
  }
  const sw=trigger?.closest('[data-manager-switcher]'),menu=sw?.querySelector('.manager-switcher-menu');
  if(!sw||!menu)return;
  const opening=!sw.classList.contains('open');
  closeManagerSwitchers(sw);
  sw.classList.toggle('open',opening);
  menu.hidden=!opening;
  trigger.setAttribute('aria-expanded',String(opening));
}

let lastArchetypePointerAction=0;
// Use one pointer-up path on touch devices so a single tap always opens the profile or switcher.
document.addEventListener("pointerup",e=>{
  if(e.pointerType==='mouse'&&e.button!==0)return;
  const archetypeButton=e.target.closest?.('[data-open-archetype-guide]');
  if(archetypeButton){e.preventDefault();e.stopPropagation();lastArchetypePointerAction=Date.now();openArchetypeGuide(archetypeButton.dataset.currentArchetype||'',archetypeButton.dataset.secondaryArchetype||'');return}
  const switchTrigger=e.target.closest?.('[data-manager-switcher-trigger]');
  if(switchTrigger){e.preventDefault();e.stopPropagation();lastManagerPointerAction=Date.now();toggleManagerSwitcher(switchTrigger);return}
  const switchOption=e.target.closest?.('[data-switch-manager]');
  if(switchOption){e.preventDefault();e.stopPropagation();lastManagerPointerAction=Date.now();closeManagerSwitchers();openManagerProfile(switchOption.dataset.switchManager);return}
  const link=e.target.closest?.('.manager-profile-link');
  if(link){e.preventDefault();e.stopPropagation();lastManagerPointerAction=Date.now();closeManagerDirectory();openManagerProfile(link.dataset.managerId);return}
});

document.addEventListener("click",e=>{
  if(e.target.closest('[data-close-mobile-manager-switcher]')){e.preventDefault();closeMobileManagerSwitcher();return}
  const mobileSwitchOption=e.target.closest('[data-mobile-switch-manager]');
  if(mobileSwitchOption){e.preventDefault();e.stopPropagation();const managerId=mobileSwitchOption.dataset.mobileSwitchManager;closeMobileManagerSwitcher();openManagerProfile(managerId);return}
  if(e.target.closest('[data-close-mobile-profile-info]')){closeMobileProfileInfo();return}
  const switchTrigger=e.target.closest('[data-manager-switcher-trigger]');if(switchTrigger){if(Date.now()-lastManagerPointerAction<700)return;toggleManagerSwitcher(switchTrigger);return}
  const switchOption=e.target.closest('[data-switch-manager]');if(switchOption){if(Date.now()-lastManagerPointerAction<700)return;closeManagerSwitchers();openManagerProfile(switchOption.dataset.switchManager);return}
  if(window.matchMedia('(max-width: 620px)').matches){const badgeSummary=e.target.closest('.profile-badge-pop > summary');if(badgeSummary){e.preventDefault();const details=badgeSummary.parentElement,body=details?.querySelector(':scope > div');openMobileProfileInfo(body?.querySelector('strong')?.textContent||'Badge',body?.innerHTML||'');details.open=false;return}const formSummary=e.target.closest('.profile-form-result > summary');if(formSummary){e.preventDefault();const details=formSummary.parentElement,body=details?.querySelector(':scope > div');openMobileProfileInfo('Match result',body?.innerHTML||'');details.open=false;return}}
  const archetypeButton=e.target.closest('[data-open-archetype-guide]');if(archetypeButton){e.preventDefault();if(Date.now()-lastArchetypePointerAction<700)return;openArchetypeGuide(archetypeButton.dataset.currentArchetype||'',archetypeButton.dataset.secondaryArchetype||'');return}
  if(e.target.closest('[data-close-archetype-guide]')||e.target.closest('#archetypeGuideClose')){closeArchetypeGuide();return}
  const managerPicksBtn=e.target.closest("[data-open-manager-picks]");if(managerPicksBtn){openManagerPicksMade(managerPicksBtn.dataset.openManagerPicks);return}
  const shareCardBtn=e.target.closest("[data-download-manager-share-card]");if(shareCardBtn){downloadManagerShareCard(shareCardBtn.dataset.downloadManagerShareCard,shareCardBtn);return}
  if(e.target.closest("[data-close-manager-picks]")||e.target.closest("#managerPicksMadeClose")){closeManagerPicksMade();return}
  if(e.target.closest("#mockDraftBtn")){openMockDraft();return}
  if(e.target.closest("[data-close-mock-draft]")||e.target.closest("#mockDraftClose")){closeMockDraft();return}
  const mockRoundBtn=e.target.closest("[data-mock-round]");if(mockRoundBtn){const round=mockRoundBtn.dataset.mockRound;document.querySelectorAll("[data-mock-round]").forEach(b=>b.classList.toggle("active",b===mockRoundBtn));document.querySelectorAll("[data-mock-round-card]").forEach(card=>card.classList.toggle("round-focus",card.dataset.mockRoundCard===round));document.querySelector(`[data-mock-round-card="${round}"]`)?.scrollIntoView({behavior:"smooth",block:"start"});return}
  if(e.target.closest("#headlinesBtn")){openHeadlines();return}
  if(e.target.closest("[data-close-headlines]")||e.target.closest("#headlinesClose")){closeHeadlines();return}
  const starEl=e.target.closest("[data-star-player]");if(starEl){togglePlayerInterest(starEl.dataset.starPlayer);return}
  const returnTreeBtn=e.target.closest("[data-open-return-tree]");if(returnTreeBtn){const launch=returnTreeBtn.closest(".return-tree-launch"),managerId=launch?.querySelector("[data-return-tree-manager]")?.value;if(managerId)openTradeReturnTree(returnTreeBtn.dataset.openReturnTree,managerId);return}
  const followReturnChain=e.target.closest("[data-follow-return-chain]");if(followReturnChain){followTradeReturnChainAsset(followReturnChain.dataset.followReturnChain);return}
  const returnChainStep=e.target.closest("[data-return-chain-step]");if(returnChainStep){goToReturnChainStep(returnChainStep.dataset.returnChainStep);return}
  if(e.target.closest("[data-return-chain-back]")){goToReturnChainStep((returnChainSession?.steps.length||1)-2);return}
  if(e.target.closest("[data-close-return-tree]")||e.target.closest("#tradeReturnTreeClose")){closeTradeReturnTree();return}
  const pickLinkEl=e.target.closest("[data-pick-history-key]");if(pickLinkEl){openPickHistory(pickLinkEl.dataset.pickHistoryKey);return}
  if(e.target.closest("[data-close-pick-history]")||e.target.closest("#pickHistoryClose")){closePickHistory();return}
  const playerLinkEl=e.target.closest(".player-history-link");if(playerLinkEl){if(playerLinkEl.closest("#managerPicksMadeModal"))closeManagerPicksMade();if(playerLinkEl.closest("#tradeReturnTreeModal"))closeTradeReturnTree();openPlayerHistory(playerLinkEl.dataset.playerId);return}
  if(e.target.closest("[data-close-player-history]")||e.target.closest("#playerHistoryClose")){closePlayerHistory();return}
  if(e.target.closest("#managerDirectoryBtn")){openManagerDirectory();return}
  if(e.target.closest("[data-close-manager-directory]")||e.target.closest("#managerDirectoryClose")){closeManagerDirectory();return}
  const seasonBtn=e.target.closest("[data-profile-season]");if(seasonBtn){state.profileAverageSeason=seasonBtn.dataset.profileSeason;const id=$("managerProfileModal")?.dataset.managerId;if(id){const content=$("managerProfileContent");content.innerHTML=cachedManagerProfileHTML(id);bindSparklineTooltips(content)}return}
  const link=e.target.closest(".manager-profile-link");if(link){if(Date.now()-lastManagerPointerAction<700)return;closeManagerDirectory();openManagerProfile(link.dataset.managerId);return}
  if(e.target.closest("[data-close-manager-profile]")||e.target.closest("#managerProfileClose"))closeManagerProfile()
});
document.addEventListener("toggle",e=>{const detail=e.target;if(!(detail instanceof HTMLDetailsElement)||!detail.open)return;if(detail.matches(".profile-badge-pop")){detail.closest(".profile-badge-icons")?.querySelectorAll(".profile-badge-pop[open]").forEach(x=>{if(x!==detail)x.open=false})}if(detail.matches(".profile-form-result")){detail.closest(".profile-form-strip")?.querySelectorAll(".profile-form-result[open]").forEach(x=>{if(x!==detail)x.open=false})}if(detail.matches(".player-history-trade")){detail.closest(".player-history-timeline")?.querySelectorAll(".player-history-trade[open]").forEach(x=>{if(x!==detail)x.open=false})}},true);
document.addEventListener('change',e=>{
  const select=e.target.closest?.('[data-mobile-manager-select]');
  if(!select)return;
  const managerId=select.value;
  if(!managerId)return;
  closeManagerSwitchers();
  closeMobileManagerSwitcher();
  openManagerProfile(managerId);
});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('[data-manager-switcher]')&&!e.target.closest('#mobileManagerSwitcherSheet'))closeManagerSwitchers()},{passive:true});
document.addEventListener("pointerover",e=>{const link=e.target.closest?.(".manager-profile-link");if(link)queueManagerProfilePrewarm(link.dataset.managerId)},{passive:true});
document.addEventListener("focusin",e=>{const link=e.target.closest?.(".manager-profile-link");if(link)queueManagerProfilePrewarm(link.dataset.managerId)});
document.addEventListener("keydown",e=>{if(e.key!=="Escape")return;if($("pickHistoryModal")?.classList.contains("open"))closePickHistory();else if($("tradeReturnTreeModal")?.classList.contains("open"))closeTradeReturnTree();else if($("managerPicksMadeModal")?.classList.contains("open"))closeManagerPicksMade();else if($("mockDraftModal")?.classList.contains("open"))closeMockDraft();else if($("archetypeGuideModal")?.classList.contains("open"))closeArchetypeGuide();else if(document.getElementById('mobileManagerSwitcherSheet'))closeMobileManagerSwitcher();else if(document.getElementById('mobileProfileInfoSheet')?.classList.contains('open'))closeMobileProfileInfo();else if(document.querySelector('[data-manager-switcher].open'))closeManagerSwitchers();else if($("headlinesModal")?.classList.contains("open"))closeHeadlines();else if($("playerHistoryModal")?.classList.contains("open"))closePlayerHistory();else if($("managerProfileModal")?.classList.contains("open"))closeManagerProfile();else if($("managerDirectoryModal")?.classList.contains("open"))closeManagerDirectory()});
document.addEventListener("visibilitychange",()=>{if(!document.hidden)refreshHeadToHeadData()});
window.addEventListener("popstate",openManagerFromHash);
load().then?.(()=>openManagerFromHash());
