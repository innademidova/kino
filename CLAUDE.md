# My movies & books (Kino): project context for Claude

A personal PWA for one user (the owner, not a developer): films and series (and, since 2026-11-22, books) she wants to
watch/read, is watching/reading and has finished, so recommendations from reels, friends and memory stop getting lost, and she can quickly pick something for
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
- Series matter to her: a book's `series` name must be identical across its books (that is how they link). Cards show
  📚 n/total and the series name, lists keep a series together in order, the book page has a series block linking the
  others. Always fill series + series_no when adding a series book; look up Ukrainian titles/editions on the web.
- Books: Open Library rarely has Ukrainian editions. Before saying "not found / no cover / not in Ukrainian", search
  Yakaboo (yakaboo.ua/ua/search?q=...) and Книгарня «Є» (book-ye.com.ua) in Chrome; take the cover from the product
  page's og:image, plus author, pages and the product link (url). She was annoyed when this was skipped.
- Books are rows with kind `book` plus author, series, series_no, pages, ol_key (Open Library work key). The app has two
  sections (switch in the header, remembered per device): 🎬 Кіно and 📚 Книги; the same statuses get book labels
  (`sk(section, key)` reads `book.<key>` from the locales for books). Ukrainian book titles are kept as she gives them;
  the cover usually comes from the original edition.
- Storage bucket `watch` (private, signed URLs): `<uid>/<uuid>.webp` + thumbnail `<uuid>_t.webp`.
- Her user id: `7b26ed3f-e90a-47cd-ba1d-fd7ff640f2f6` (for inserting films from chat).

## Posters and details: `src/wiki.ts` (Wikidata + Wikipedia, no key), `src/books.ts` (Open Library, no key)

Google Books' keyless quota is shared and was exhausted on 2026-11-22, so books use Open Library.

She asked for automatic covers. TMDB was offered (needs her account + key); Wikidata was chosen as the free no-signup
option. `searchTitles` = Wikidata prefix search (uk + en) + full-text search limited to film/series types; `findByUrl`
matches IMDb / Letterboxd / Netflix / Wikipedia links exactly; posters = Commons P3383 or the lead image of the
English (then Ukrainian) Wikipedia article, batched. **Wikimedia rate-limits hard (429)**: from scripts send a
User-Agent, go one film at a time with pauses; `api()` retries with Retry-After.

## Owner's way of using it

She sends titles in chat, often many in a row, in Russian/Ukrainian/English ("X посмотреть", "почитать Y", "Z — смотрела,
10 из 10"). No verb = want to watch. Claude adds them with `scripts/add.mts` (spec format in its header: films/series by
Wikidata search or exact Q-id, `"dry": true` to see candidates first, books with `"book": true` via Open Library).
Russian titles: search Wikidata with `language=ru` to find the Q-id. Check ambiguous ones (same title, several years)
with a dry run and tell her which one was picked.
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
