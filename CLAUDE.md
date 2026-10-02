# Goalfeed (nhl-goals)

Personligt hobbyprojekt: webbapp som visar alla NHL-mål per dag, spelare och nationalitet.
Repo: https://github.com/joggs/nhl-goals · Sajt: https://joggs.github.io/nhl-goals/
Svara på svenska, kort och direkt. Appens egen text är engelska.

Repot är publikt. Skriv inget i filer, commits eller kommentarer som pekar ut vem som äger det: inga riktiga namn,
arbetsgivare, jobb- eller privatmejl, interna värdnamn, domäner eller IP-adresser.

## Kom igång

```bash
npm install
npm run data:full   # hämtar nuvarande + förra säsongen, cachar i .cache/ (~1 min första gången)
npm run dev         # http://localhost:5173/nhl-goals/
npm test            # vitest (shared/describe.test.ts)
npm run build       # tsc + vite build
```

Git: lokal identitet ska vara `joggs` / `308445+joggs@users.noreply.github.com`. Kontrollera med
`git config user.email` i en ny klon innan första commit. Varje push till `main` bygger och publicerar sajten (GitHub Actions, `.github/workflows/deploy.yml`,
som även körs var 20:e minut för att hämta ny data). Fråga innan du ändrar repots synlighet.

## Arkitektur

- **Webbläsaren kan inte anropa NHL:s API direkt** (`api-web.nhle.com` skickar inga CORS-headers). `scripts/build-data.ts` hämtar
  serverside och skriver statiska JSON-filer till `public/data/` (gitignorerade, byggs om av CI). SPA:n läser bara dem.
- Källor: `api-web.nhle.com/v1` (schema, `gamecenter/{id}/landing`, `play-by-play`, `right-rail`, standings) och
  `api.nhle.com/stats/rest/en` (skater/goalie bios med `nationalityCode`, `country`). Gamla `statsapi.web.nhl.com` är dött.
  Inget dokumenterat rate limit eller licens. Håll nere samtidighet (8) och cacha. Referens: github.com/Zmalski/NHL-API-Reference.
- `shared/describe.ts` genererar måltexten ("X scores from the slot with a wrist shot…"), styrka från `situationCode`, plats från x/y.
  Platsorden är heuristik. Ändrar du den: uppdatera testerna och kör om `npm run data:full`.
- `shared/types.ts` är datamodellen som pipeline och app delar. Ändra den på båda sidor.
- Färdiga matcher cachas i `.cache/` och hämtas aldrig om. Videor (`right-rail`) cachas först när de finns eller matchen är en vecka gammal.
- Appen: Vite + React + TypeScript, `HashRouter` (fungerar på GitHub Pages), ren CSS i `src/styles.css`, `base: /nhl-goals/`
  (styrs av `VITE_BASE`, sätt `/` vid rotdomän). Filter ligger i URL:en (`src/lib/filters.ts`) så varje vy är en länk.

## Måste bevaras

- **Spoilerläge är på som standard** (`src/lib/spoilers.tsx`). Ägaren tittar på matcherna i efterhand. Resultat, ställning, målgörare,
  måltexter, videor, stjärnor och tabeller ska vara dolda tills man avslöjar matchen. Nya vyer som visar resultat måste använda
  `useSpoilers().hidden(game)` eller ligga bakom `SpoilerGate`. Testa med spoilerläget på.
- **Videouppspelning utan reklam:** `src/lib/clip.ts` hämtar MP4 från Brightcoves Playback API med den publika nyckeln ur NHL:s
  spelarkonfiguration, hämtad vid körning (lägg aldrig nyckeln i repot). Signerade URL:er går ut, cacha dem aldrig. NHL:s villkor kan
  förbjuda detta och det kan sluta fungera, så fallback är länk till `clipUrl` på NHL.com.
- Mål: 📺-ikonen (liten SVG, ändrar inte radhöjden) spelar klippet inline. "Short summary" = recap (~5 min), "Full summary" = condensed game (~10 min).
- Varje mål visar ställningen efter målet (`PHI 1 – 0 NJD`).
- Inga nycklar, lösenord eller personuppgifter i repot. Repot är publikt.

## Fällor

- Sätt aldrig plats eller nationalitet ur namn. Nationalitet kommer från `nationalityCode` (inte alltid landslagsland).
- Shootout-mål listas inte som mål. Eget mål och straffskott identifieras via `goalModifier` i `landing`.
- Extra anfallare mot tom kasse räknas inte som powerplay (se `parseSituation`).
- macOS: `sed -i` kräver `''`. Använd python eller Edit för filändringar. `.claude/launch.json` finns inte, starta dev-servern med `npx vite --port 5199`.
- Lägg inte till saker som inte efterfrågats. Verifiera i webbläsaren innan du påstår att något fungerar, och säg om du inte kollat.
