# Goalfeed

Every NHL goal, per day, player and nationality. Dark-mode web app with generated goal descriptions
("Pettersson scores from the right circle with a slap shot past Levi on the power play…"), highlight clips,
favourite teams and views such as *all Swedish goals this week*.

## Views
- **Scores** – games per day, scorers per game, favourites filter. **Game** page with *Short summary* (≈5 min recap video) and *Full summary* (≈10 min condensed game), stars and every goal. Every goal has a 📺 clip.
- **Goals** – the main feed. Filter by range (latest day / 7 / 30 days / season / custom), nationality, team, player,
  strength (PP/SH/EN/penalty shot), game-winners, OT winners, hat tricks, period. Filters live in the URL, so every view is a link.
- **Highlights** – OT winners, hat tricks, last-3-minute drama, shorthanded, penalty shots, long-range bombs, hottest shooters.
- **Players** / player page – goal scorers table; per-player goals/assists, shot types, where from, opponents.
- **Nations** – goals per nationality for any range, top scorer per nation, click through to the feed.
- **Teams** – star your favourites (kept in localStorage), standings.

## Spoiler mode (on by default)
For watching games afterwards: scores, summaries, scorers and goal texts are hidden until you reveal them, per game
(button on the card, the game page or a masked goal), or for a whole day ("Reveal day"). Pages built from aggregated
results (Highlights, Players, Nations) sit behind a "Show anyway" gate, and team records are hidden. Toggle in the header;
reveals are remembered in localStorage, and the footer link hides everything again.

## API choice
The old `statsapi.web.nhl.com` is dead. The current, unofficial-but-public API is **`api-web.nhle.com/v1`**
(schedule, `gamecenter/{id}/landing` + `play-by-play`, standings, player landing) plus
**`api.nhle.com/stats/rest/en`** (skater/goalie bios incl. `nationalityCode`, country names). Community reference:
[Zmalski/NHL-API-Reference](https://github.com/Zmalski/NHL-API-Reference). No auth, no documented rate limit or licence terms.

It sends **no CORS headers**, so a browser app cannot call it directly. `scripts/build-data.ts` therefore fetches server-side
and writes static JSON to `public/data/` (nothing there is committed); a GitHub Action rebuilds and deploys every ~20 minutes.
Finished games are cached; goal text, strength (from `situationCode`) and location (from x/y) are derived in `shared/describe.ts`.
Helper libs (`nhl-api-py`, `nhl-api-client`) just wrap the same endpoints, so we call them directly.

## Develop
```bash
npm install
npm run data:full     # fetch current + previous season (~1 min first time, then cached)
npm run dev           # http://localhost:5173/nhl-goals/
npm test
```

## Limits
- Data is as fresh as the last build (≤ ~20 min), so live games show progress with a delay. A tiny CORS proxy (e.g. Cloudflare Worker) would enable true live.
- Nationality = `nationalityCode` from NHL bios (not always the national-team country).
- Locations ("the slot", "the point") are heuristics derived from coordinates.
- Shootout goals are not listed as goals.
