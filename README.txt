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
