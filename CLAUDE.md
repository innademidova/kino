# My movies (Kino): project context for Claude

A personal PWA for one user (the owner, not a developer): films and series she wants to watch, is watching and has
watched, so recommendations from reels, friends and memory stop getting lost, and she can quickly pick something for
tonight. Claude does all technical work; the owner writes in Russian/Ukrainian and decides on features and design.

Local: `~/projects/kino`. Live: https://innademidova.github.io/kino/. Sister projects with the same stack:
`~/projects/travels` (the template for this one), `~/projects/capsule`, `~/projects/perfume-diary`.

## Hard rules from the owner

- Everything in the repo is English (code, comments, docs, commits). **No Cyrillic in code.** Ukrainian text lives only
  in `src/locales/uk.json`. Never Russian anywhere. Chat replies to the owner: her language, plain and non-technical.
- UI languages: Ukrainian (default) and English, via `t('key')` from `src/i18n.ts`. Every new text goes into BOTH locale files.
- Everything must stay free (GitHub Pages + Supabase free tier + Wikimedia APIs). Ask before anything that costs money.
- She is often on limited mobile internet: `npm install --prefer-offline`, warn before big downloads.
- Context she shares is not a feature request: build what she asks, offer ideas in one line.

## Data (Supabase project "Perfumes", ref `eyczhhvxuofvfeoqwfbg`, shared with the perfume diary)

The free plan allows only 2 projects (Style, Perfumes), so the kino tables live in Perfumes next to the perfume diary.
**Never touch the diary's tables.** Kino tables/buckets use the prefix `watch`. Same login as the diary; on
innademidova.github.io the session is even shared, so she is signed in already. Free projects pause after a week
without use: if `scripts/sql.mjs` says "Database is possibly not accessible", restore it
(`POST https://api.supabase.com/v1/projects/eyczhhvxuofvfeoqwfbg/restore` with the CLI token) and wait a few minutes.
`supabase/schema.sql` = full schema (append changes); `node scripts/sql.mjs "<sql>"` or `node scripts/sql.mjs file.sql`.

- `watch_items`: title (Ukrainian if Wikidata has it), original_title, kind `film|series`, year, genres[] (keys from
  `GENRES` in `src/lib.ts`), status `want|watching|watched`, favorite (❤️), rewatch (seen it, wants to rewatch),
  where_to_watch, source (who recommended / where from), url, note, poster_url (Wikimedia image link), photos[]
  (her screenshots, storage paths), rating **1–10**, impression, watched_on, length `short|medium|long`, runtime (min),
  moods[] (`light|cry|think|scary`; empty = guessed from genres by `moodsOf`), wikidata (Q-id), wiki_url.
- Storage bucket `watch` (private, signed URLs): `<uid>/<uuid>.webp` + thumbnail `<uuid>_t.webp`.
- Her user id: `7b26ed3f-e90a-47cd-ba1d-fd7ff640f2f6` (for inserting films from chat).

## Posters and details: `src/wiki.ts` (Wikidata + Wikipedia, no key)

She asked for automatic covers. TMDB was offered (needs her account + key); Wikidata was chosen as the free no-signup
option. `searchTitles` = Wikidata prefix search (uk + en) + full-text search limited to film/series types; `findByUrl`
matches IMDb / Letterboxd / Netflix / Wikipedia links exactly; posters = Commons P3383 or the lead image of the
English (then Ukrainian) Wikipedia article, batched. **Wikimedia rate-limits hard (429)**: from scripts send a
User-Agent, go one film at a time with pauses; `api()` retries with Retry-After.

## Owner's way of using it

She sends film names in chat ("додай X в хочу подивитись"); Claude adds them: look up with `byId`/`searchTitles` from a
node script (`node --experimental-strip-types` importing `src/wiki.ts`, with `globalThis.fetch` wrapped to send a
User-Agent) and insert with SQL using her user id, or she adds them herself in the app.
She does NOT want a "recommend to friends" section (dropped 2026-11-22); "Watched" with rating sort/filter replaces it.

## Code

React 19 + Vite + TS, `vite-plugin-pwa`, hash routes: `#/` want, `#/watching`, `#/watched`, `#/today`, `#/i/<id>` card.
`src/lib.ts` client, types, constants, link helpers, photo upload, `moodsOf`. `src/store.tsx` data context.
`src/Lists.tsx` lists + poster card + filters/sort. `src/Add.tsx` quick add sheet (type or paste, tap a found film = saved)
and the lookup sheet. `src/Item.tsx` film page (status, 10 stars, fields). `src/Today.tsx` filters + random pick.
`src/ui.tsx` icons, Poster, Sheet, photos, Stars (10).

## Deploy

`npm run deploy` (builds and force-pushes `dist` to `gh-pages` of github.com/innademidova/kino through
`gh auth git-credential`; don't touch global git config). Then commit + push `main`.
