IMO DYNASTY V3.2.13 — Manager Draft Summary Visibility Fix

- Fixed stale manager-profile session caches that could show different draft cards on desktop and mobile.
- Draft Star, Draft Steal, Draft Bust and Picks Made now always render in the manager profile.
- Desktop uses four equal columns. Mobile uses two columns across two rows.
- Picks Made remains clickable and opens the complete rookie draft history modal.
- Cache-busting updated to V3.2.13.

IMO DYNASTY V3.2.10 — Refresh Button Removal

- Removed the manual Refresh button from the site header.
- Live league data continues to load automatically when the page opens.

IMO DYNASTY V3.2.8

2027 mock draft weekly movement update:
- Prospects 1-20 can change via non-overlapping adjacent swaps only.
- No top-20 prospect can move more than one position up or down per weekly board.
- Three to five adjacent swaps are applied each week using a deterministic weekly seed.
- Picks 21-24 continue to rotate from prospects 21-30.
- The same weekly board is shown to every visitor and remains stable on refresh.

IMO DYNASTY V3.1.8

IMO DYNASTY V3.1.6 — Manager Switcher + Mobile Profile Fix

V3.1.6 UPDATES
- Clicking the current manager name inside a profile opens a manager switcher dropdown.
- Selecting another manager swaps to that manager profile without closing the modal.
- Mobile badge and recent W/L taps now open a viewport-safe information sheet.
- Long descriptions wrap and remain fully visible within mobile dimensions.

IMO DYNASTY V3.1.3 — Minimal CSS Polish Pass

V3.1.3 UPDATES

- Fixed manager badge and recent-result detail popovers being clipped on mobile.
- Mobile popovers now open as centred, safe-area-aware bottom cards within the viewport.
- Added reliable text wrapping and removed paint containment that could crop overlays.

V3.0.3 UPDATES
- Removed article reading-time labels from IMO Insider.
- Trade of the Week now has a slow, continuous golden border glow.
- Insider copy is more opinionated and Bleacher Report-style.
- Added occasional “Is [player] washed?” stories for established players averaging over 23 FPTS who fall below 18 FPTS across their last five games.

V3.0.3 — LEAGUE HQ / IMO INSIDER

V2.7.12 — MANAGER PROFILE POLISH

Manager profile updates:
- Colour-coded weekly Power Rank movement in the header.
- More natural, archetype-aware NBA-style scouting reports.
- League per-game average rank shown beside every roster average.
- Larger Last Five result pills.
- Colour-coded arrows added to Good Form and Poor Form.
- Opponent avatars added to Biggest Win and Biggest Loss.
- Lightweight transform/opacity micro-animations with reduced-motion support.
- No additional network requests were introduced.

- Memoized season averages, trade metrics, matchup history and GM tendency calculations.
- Manager modal still opens instantly and now shows the selected manager identity while loading.
- Prevents duplicate profile builds when pointer and click events fire together.
- Clears computed caches only when live data changes.


- Manager profile modal opens immediately on pointer-down.
- Profile calculations wait until the loading state has visibly painted.
- Heavy player-stat requests are staggered until browser idle time.
- Background stat loading uses lower concurrency.
- Stat completion refreshes only affected sections, not the whole page.
- Added layout/paint containment for faster expansion and scrolling.

V2.7.8 — PERFORMANCE OPTIMISATION

- Removed unused Chart.js download.
- Dashboard now renders before the large player-season-average fetch completes.
- Season averages load in the background, then refresh the affected calculations.
- Removed eager generation of every manager profile on page load.
- Manager profiles now prewarm only when a user hovers or focuses a profile link.
- Added in-session caching for repeated Sleeper player-stat requests.
- No dashboard features were removed.

V2.7.7 — LATE-PICK VALUES + A+ SAFEGUARD

CHANGES
- Future third-round picks now carry a trade value of 2.00.
- Future fourth-round picks now carry a trade value of 1.00.
- Future fifth-round picks now carry a trade value of 0.50.
- Added a low-value trade safeguard so large percentage swings alone cannot produce an A+.
- A+ now requires a meaningful absolute value gain and either a major overall advantage or a genuinely premium centrepiece.
- Small steals, such as a fringe player acquired for a fifth-round pick, can still grade strongly but should generally top out at A.
- All Recent Trades and Trade of the Week grades recalculate automatically with the updated values.

NEW IN THIS UPDATE
- Removed the trophy emoji from the #1 Power Rankings row while preserving the gold featured accent.
- Increased spacing between ranking numbers, manager avatars and team names.
- Players ranked inside the top 10 for fantasy scoring average in the relevant season now receive a 20% trade-value premium.
- Recent Trades and Trade of the Week grades automatically recalculate through the shared trade valuation functions.

Key changes:
- Championship odds use 2025 standings plus current player-only roster value in preseason.
- Prior-season influence fades after games begin: 30% in Week 1, 20% in Week 2, 10% in Week 3 and 0% from Week 4 onward.
- Current-season odds always use the 2026 league bundle rather than falling back to a completed prior season.
- Primary dashboard figures are larger and extra-bold; labels are smaller and uppercase.
- Power Rankings #1 and Trade of the Week receive subtle gold featured treatment.
- GM Overall has been removed from Manager Profiles.
- Sleeper manager avatars now use the current full avatar endpoint, including Muz and Muz Pty Ltd when provided by Sleeper.
- Player transaction pages show the current-season fantasy average and games played.
- Player pages include a star button. Starred players generate rotating SHAMS/SOURCES/REPORTS ticker rumours for 48 hours.
- Player-interest rumours are stored in the current browser via localStorage. A shared cross-device league rumour feed would require a writable backend.

Upload index.html, app.js and styles.css to the GitHub Pages repository.
V2.7.2 — WEEKLY GM ARCHETYPES + 2K-STYLE TENDENCIES

NEW IN THIS UPDATE
- Added a GM Profile section at the top of every Manager Profile.
- Eight 0–99 ratings: Trade Activity, Youth Focus, Win-Now Focus, Draft Capital, Waiver Activity, Risk Appetite, Asset Management and Star Power.
- Every rating includes a live league rank.
- Automatic primary and secondary archetypes including Rebuilder, Wheel & Dealer, Veteran Chaser, Contender, Talent Collector, Draft Capital King, Diamond Hands, Prospect Hunter and Gambler.
- Added an overall GM rating, automatic tendencies and an ESPN-style Scout's Report.
- Profiles recalculate from live Sleeper data every time the dashboard refreshes and are labelled by the latest completed week.
- Waiver and free-agent transactions are now retained from the Sleeper feed for the Waiver Activity rating.


- Added automatic grades for every team in Trade of the Week and Recent Trades.
- Grades use private dynasty values internally, with no public reference to a model or algorithm.
- Added varied, deterministic editorial commentary so identical grades do not repeat the same wording.
- Added independent strategic-fit credit for consolidation, depth, draft capital, roster timeline, contender moves and premium centrepieces.
- Genuine win-win trades are now possible, including rare A+/A+ results when both sides receive strong strategic outcomes.
- Added a WIN-WIN TRADE label when every participating team earns B or higher and receives a clear strategic benefit.
- Retained absolute-value safeguards so small trades cannot receive exaggerated extreme grades.
- Cache/version updated to V2.7.2.

V2.6.6 — TROPHY CABINET + INTERACTIVE SEASON JOURNEY

- Added permanent Manager Profile Trophy Cabinets for championships, regular-season titles, runner-up finishes, Trade King seasons, longest win streak, highest weekly score and largest margin of victory.
- Added compact Biggest Win and Biggest Loss cards beneath Head-to-Head records.
- Added hover, keyboard-focus and tap detail tooltips to every weekly Power Ranking sparkline point.
- Sparkline tooltip includes week, power rank, record, weekly score and historical championship odds.
- Sparkline automatically switches to the current season once its first completed non-0–0 matchup week exists; otherwise it retains the latest completed season.
- Unplayed 0–0 matchups are excluded from trophies, records, streaks and sparkline data.
- Cache/version updated to V2.6.6.

IMO FUN SCALE — HISTORY & FORM UPDATE

- All-NBA and ROTY: 35% fan vote / 65% season average.
- MIP: 50% fan vote / 50% increase from 2025 to 2026.
- Championship Odds desktop presentation widened and text wrapping fixed.
- NO ONE WANTS HIM removed as a standalone section.
- Most Traded Players moved into a dropdown within League Records.
- Poor Form requires prior average >=20.00 and recent two-week average >=10.00.
- Good Form requires prior average >=15.00 and recent two-week average >=18.00.
- Zero-average players are excluded.
- Offseason form uses the completed 2025 season and its final two regular-season weeks.
- Most Active GM has independent 14 / 28 / 90 / 2026 season / all-time controls.
- Biggest Ever Trades shows five by default and expands to eight.
- Completed historical picks show the player drafted when Sleeper draft data can match the pick.

Replace index.html, styles.css and app.js in the root of the GitHub repository.


UPDATE — DYNASTY TRADE VALUE + ODDS LAYOUT
- Trade of the Week and Biggest Ever Trades now use the same private dynasty-value model.
- Historical players use their season average from the trade season.
- Player value applies the agreed age curve and elite-production multiplier.
- Future picks remain valued at 23.50 / 5.00 / 0.00 until they convey.
- Conveyed picks use the drafted player's rookie-season average when available.
- Numeric trade values are no longer displayed publicly.
- Championship Odds now sits in its own full-width row below Trade of the Week.


UPDATE — MANAGER PROFILE MODAL
- Manager names in Power Rankings are now clickable.
- Clicking a manager opens a full-screen profile landing modal without leaving the homepage.
- Profiles include current roster, power rank, ladder rank, record, championship odds, form, recent trades and biggest-ever trades.
- Biggest trade values remain private and are used only for ranking.
- Profiles support direct hash links such as #manager=USER_ID and browser back/forward navigation.


UPDATE — HOLY GRAIL POWER RANKINGS / ODDS / PROFILES / HISTORY
- Power Rankings now sit at the top of the dashboard and are the main entry point into manager profiles.
- Power Rankings include manager avatars and a visible “View manager profile” cue.
- Championship Odds has no internal scrolling.
- Favourite styling has been redesigned.
- Smokey is automatically awarded to the non-favourite with the strongest recent improvement in odds.
- Player season averages now ignore zero/inactive matchup entries and align with Sleeper active-game averages.
- Corrected averages flow through every feature that uses the shared season-average engine.
- Historical traded picks now use a broader draft-result lookup to resolve the selected rookie.
- Manager profiles include player headshots.
- Current rosters can toggle between 2025 averages and 2026 season averages.
- 2026 remains 0.00 until valid scoring games are recorded.
- Manager profiles now include GM Badges & Achievement Wall:
  Day Trader, Draft Capital Hoarder, Negotiator, Champion, Pancakes and MVP.
- Historical naming note retained: PritchPlease later became Mara Juana after JChristie replaced the former manager.


UPDATE — AUTHORITATIVE SEASON AVERAGES
- Added season-averages.json as the website's authoritative player-average source.
- Values in this file override calculated matchup averages everywhere.
- Nikola Jokic's 2025 average is locked to exactly 41.55.
- The same source now feeds manager profiles, roster sorting, MVP badge, voting, trade valuation and every other player-average feature.
- 2026 is intentionally empty and therefore remains 0.00 until exact Sleeper-displayed values are added.
- Sleeper's documented public API does not expose the exact in-app fantasy average dataset. To make every player exact, populate season-averages.json with the Sleeper displayed/exported values.


UPDATE — INDIVIDUAL SLEEPER GAME-LOG AVERAGES
- Player averages now use individual NBA game logs rather than fantasy matchup weeks.
- Formula: total regular-season fantasy points divided by actual games played.
- DNP/inactive rows are excluded.
- Requests specify season_type=regular, excluding Play-In, playoffs and All-Star games.
- Each game's returned FPTS is used where available. If unavailable, FPTS is rebuilt from the league scoring_settings and raw game stats.
- These averages now feed every website section.
- season-averages.json is retained only for optional emergency overrides and is empty by default.
- Upload every file in this ZIP to GitHub Pages, replacing the current files.


UPDATE — MANAGER INTELLIGENCE
- Manager profiles now use Sleeper team avatars where available.
- Badge emojis appear beside the team name and expand on click/hover; the standalone GM Identity section was removed.
- Added average team age, favourite trade partners, team-specific form, franchise scoring records, clickable last-five results and All-NBA eligibility.
- Added Win-Now, Locked, Young Pups and Old Dogs badges.
- Replaced 90-day controls with 2026 season.
- Trade partner cards now expand to show their most recent trade.
- Good/Poor Form now derives from dated individual regular-season game logs.
- Nikola Jokic's 2025 average is safeguarded at exactly 41.55.


UPDATE — CONFIRMED SLEEPER SEASON-TOTAL AVERAGES
Confirmed endpoint:
https://api.sleeper.com/stats/nba/player/{player_id}?season_type=regular&season={season}

Calculation:
1. Pull each player's raw regular-season totals from payload.stats.
2. Apply the league's own scoring_settings to those totals.
3. Divide the resulting fantasy-point total by payload.stats.gp.
4. Use the unrounded value throughout the model and round only when displayed.

This replaces fantasy matchup-week averaging and individual game-log averaging for season averages.
Playoffs, Play-In and All-Star games are excluded because the endpoint explicitly requests season_type=regular.
Nikola Jokic's 2025 value also retains a 41.55 emergency safeguard in season-averages.json.


V2.5.2 FIXED BUILD
- Rebuilt from the last working files supplied by the user.
- app.js is complete and syntax-checked, not the broken ~5.7 KB copy.
- Cache-busting updated to 2.5.2-fixed.
- Inline empty favicon prevents the harmless favicon.ico 404.
- Upload the extracted files individually to the repository root.

FILE VERIFICATION:
- index.html: 10368 bytes; SHA-256 26b4d7204371193a916b8c87fcc69010643ff9c6f92ef8272a5a8f71ea2f837b
- app.js: 67795 bytes; SHA-256 8e9046fcf31ff28bd655ab7c75688e2a060792f1cdcf6f4f3bae9a157c7d26be
- styles.css: 46073 bytes; SHA-256 71cf1fcf60637bfd37537c4277242d09e5da14f8333ddd071ff9b0cdba2c5eae
- season-averages.json: 227 bytes; SHA-256 1732e3ccb6a86142342b2acce32e506c5728c2334d105c1e066c9fda60213ba5


V2.6.1 — STABILITY + COMPACT LAYOUT
- Power Rankings are now a single vertical list from 1 to 8.
- Favourite Trade Partners is a compact top-eight team-name list.
- Removed heatmap expansion, avatar stacks and most-recent-trade details.
- Fixed the missing heatmapToggle reference that stopped later sections from rendering.
- Added isolated render error handling so one panel cannot stop League Records, Recent Trades or Biggest Trades.
- Hardened the main load routine and allowed optional season-total failures without taking down the page.
- Cache-busting updated to 2.6.1.


V2.6.2 MANAGER PROFILE + HOMEPAGE UPDATE
- Manager Form Guide compacted.
- Favourite partners expanded to Top 7.
- Manager biggest trades expanded to Top 5.
- Current roster shows Top 10 with remaining players in an expandable dropdown.
- Added all-time head-to-head records versus every manager.
- Day Trader now requires 5+ trades in the last 28 days.
- Removed Locked badge.
- Good/Poor Form falls back to completed 2025 data when 2026 logs are unavailable.
- Trade of the Week player names are clickable; recent-trade player names remain clickable.
- Favourite Trade Partners moved below Biggest Ever Trades.
- League Records moved to the bottom below awards voting.

V2.6.4 FORM + HEAD-TO-HEAD + BADGES
- Good/Poor Form compares each player's full-season average (including their latest five games) against their last-five-game average.
- Players need at least five completed games to qualify.
- Existing Good Form (15.00+) and Poor Form (20.00+) thresholds remain.
- Head-to-head displays wins-losses only, with draws shown separately in brackets.
- Head-to-head includes all completed matchup weeks, including finals, and excludes former managers.
- Head-to-head records are green when winning, red when losing and yellow when even.
- Added Infinity Stones badge: five current players averaging above 28.00 this season.
- Added Cancun badge: five consecutive matchup losses.


V2.6.6 ZERO-SUM LUCK + COMPACT TRADE SECTIONS
- Luck Rating now uses completed weekly matchups and all-play expected wins.
- League-wide Luck Ratings are normalised to total exactly 0.
- Unplayed 0-0 matchups remain excluded.
- Biggest Ever Trades shows Top 5 by default and expands to Top 10.
- Favourite Trade Partners is now a compact Top 5 on the homepage and in manager profiles.


V2.7.2
- Rebalanced trade grades toward B/C outcomes, with rare A+, F and Fleece Alert results.
- Added measurable best-player and elite-centrepiece bonuses plus consolidation allowance.
- Added compact ESPN-style live ticker beneath the header with player form, trades, matchups, streaks, announcements, rankings/records and the longest fun drought.


V2.7.2
- Rebalanced trade grades around package value, a 10% clear-best-player premium, and a controlled consolidation premium.
- Reserved FLEECE ALERT for only the most extreme outcomes; compact recent-trade cards display FLEECE.
- Removed the top summary timeframe toggle. League Trades now shows the last 7 days; Average Trades per Week uses the current season.


V2.7.2 changes
- Clear best-player floor: 15%+ advantage cannot grade below C.
- Elite clear best-player consolidation floor: 30%+ advantage cannot grade below B.
- Featured Trade of the Week grades are displayed prominently on each package.
- All-NBA, MIP and ROY voting opens 23 February, closes 28 February and winners are announced 1 March.
- Manager Profile Favourite Trade Partners expanded to Top 7.
- Championship odds progressively weight ladder position more heavily through Week 19; teams outside the Top 6 after Week 19 show 0% championship chance.


V2.7.2 updates:
- Future first-round picks valued at 17.50 and future second-round picks at 2.50 in trade grading.
- IMO Awards moved directly below Recent Trades; League History divider added before historical sections.
- Championship odds reverted to the prior in-season calculation; preseason 2026 projection uses 2025 standings and current player-only roster value.
- Manager Profiles reordered with current-season information first and historical sections last.
- Old Dogs badge now requires 8 or more players over age 30.

V3.1.7 — Mobile manager switching now uses a native select input on screens 620px and below for reliable single-tap behaviour on iOS and Android. Desktop dropdown remains unchanged.


V3.1.8 CHANGES
- Player season averages are now rebuilt from individual regular-season game logs using the league's exact scoring settings. This fixes the incorrect Zach Edey average and prevents default-provider fantasy scoring from overriding league scoring.
- Added an Archetype Guide button to every manager profile with definitions for all nine manager archetypes.


V3.1.13
- Reverted rookie-value changes so historical trade grades use the original valuation model again.
- Future draft-pick values remain unchanged.
- Fixed drafted-player attribution by using Sleeper draft_slot only (the original pick slot), never the manager who made the selection.
- Filters out startup/long drafts when identifying rookie selections, preventing cross-draft overwrites.


V3.1.13
- Corrected drafted-player attribution for traded rookie picks.
- Rookie selections are now mapped from overall pick_no to the original franchise slot, rather than Sleeper draft_slot (which may identify the manager who made a traded selection).
- Example: original 1.08 maps to the player taken eighth, while original 1.05 maps to the player taken fifth, regardless of which manager submitted the pick.


V3.1.14
- Corrected historical rookie-pick attribution by mapping each final rookie draft slot back to the original roster_id via Sleeper slot_to_roster_id.
- Applies through the shared trade formatter used by manager Recent Trades, Biggest Ever Trades and trade details.
- Trade grading and valuation logic unchanged.

V3.1.15 — Historical rookie-pick attribution
- Uses the verified completed 2026 rookie-draft column order as the canonical original-pick ownership map.
- Historical 2026 traded picks now resolve original franchise + round to the player selected in that franchise column.
- 2025 and other seasons continue to use Sleeper's completed-draft slot mapping as the generic fallback.
- Attribution is display-only: converting a past pick to a player name does not alter the original pick value used by trade grades.


V3.2.0 — Sleeper FPTS source of truth
- Player season averages now use Sleeper-provided per-game fantasy-points values directly.
- Local box-score re-scoring is only a defensive fallback when Sleeper omits FPTS.
- Removed the one-player manual average override so one API source feeds profiles, roster values, rankings, odds and trade calculations.


V3.2.1 — Exact league-scored season averages
- Uses each season's matching Sleeper league scoring_settings.
- Fetches aggregate regular-season player stats from api.sleeper.com/stats/nba/player/{id}.
- Calculates league-specific total FPTS from Sleeper aggregate stats and divides by Sleeper GP.
- Supports the configured 2024, 2025 and current 2026 league IDs automatically.
- Uses game-log reconstruction only as a fallback when aggregate stats are unavailable.
- Removed the Zach Edey hard-coded override so Sleeper is the single source of truth.

V3.2.2 — Bulk Sleeper Season Averages
- Loads one bulk Sleeper NBA regular-season stats payload per season.
- Applies that season league's scoring_settings to Sleeper aggregate stats.
- Divides by Sleeper gp to produce league-specific FPTS/game.
- Loads exact averages before the initial dashboard render.
- Removes the local season-averages.json dependency from runtime.
- Console diagnostics include the number of bulk averages loaded and Kevin Porter Jr's 2025 result.
