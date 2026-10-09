# Haora Bari · হাওড়া বাড়ি

**A 3D farming game set in the real streets of Agartala, Tripura.**

You fly home from wherever you live now to your grandfather's bari on the bank of the Haora river, behind Maharaja Bir Bikram (MBB) Stadium. When the game is deployed, your hometown comes from where you log in (Cloudflare or Vercel IP geolocation), and you can change it on the title screen.

The game covers a small, detailed part of Agartala: **Shibnagar, Math Chowmuhani, MBB Stadium, Ramnagar and Joynagar**, about 1.9 × 1.9 km. You arrive at the stadium gate and ride your first tomtom to the fields by the river. Then you grow paddy and Queen pineapple, tap rubber at dawn, and help neighbours across the paras with daily kaam. The festivals run from Garia Puja to Durga Puja at Modern Club.

Every road, lane, pond and lake, and the river, come from OpenStreetMap and sit where they really are. About 6,800 real building footprints are filled out to about 8,900 houses (see *A fuller city* below).

It runs in the browser, with no install and no sign-up. The game is modelled on [Tanda](https://github.com/gajanansr/tanda-an-village) by Gajanan Rathod: Three.js on the front, a small server with one set of rules shared by the browser and the server.

## Run it locally

```bash
npm install
npm run dev          # → http://localhost:5191
```

That's the whole game, server included. The Vite dev server also runs the API (`api/*.ts`), and saves go to JSON files in `.data/`, so you need no database or account to develop.

```bash
npm run typecheck    # TypeScript, strict
npm test             # unit tests: rules, story, economy, storage contract, API
npm run build        # production build → dist/
npm run assets       # rebuild the 3D asset kit → public/models/kit.glb
```

If you deploy only `dist/` to a static host with no API, the game still works: it notices there's no server and saves in the browser.

## Controls

| Key | What it does |
| --- | --- |
| **WASD** / arrows | walk; hold **Shift** or press **R** to run (faster still on a bicycle) |
| **Mouse drag**, wheel | look, zoom |
| **E** | do the thing in front of you: till, sow, water, harvest, tap, cut, talk, trade, take a tomtom |
| **Z** | sleep till 06:00 (after 19:00) |
| **M** | city map: type a place and press Jump, or click anywhere on it to jump there |
| **L** | your farm: farm, people, Grandpa's album and the boards |
| **P** | photo mode: hide the HUD and save a postcard |
| **E** by a vehicle | get on; then **W**/**S** throttle, brake and reverse, **A**/**D** steer, **Space** brake, **E** get off |
| **H** | help |

On phones there's a joystick and an Act button.

## How it works

```
browser (Three.js)                                   Pages Functions (api/)             Cloudflare D1 (SQLite)
┌──────────────────────────────┐  actions (batched)  ┌──────────────────────────┐     ┌──────────────────┐
│ render · walking · UI        │ ──────────────────▶ │ re-check every action    │ ──▶ │ kv: saves (json, │
│ applies moves instantly      │ ◀────────────────── │ with the SAME rules code │     │ versioned, CAS)  │
│ (optimistic), rolls back if  │   the true save     │ on the server's clock    │     │ leaderboard      │
│ the server says no           │                     └──────────────────────────┘     └──────────────────┘
└──────────────────────────────┘          ▲ src/shared/ — the rules, used by both sides
```

### `src/shared/`: the game rules

These are pure TypeScript, used by both the browser and the server.

- `rules.ts`: every action and its checks, including rides (`ride`/`arrive`), kaam, parcels (`pickup`/`deliver`), sights (`visit`), hometown and home site.
- `errands.ts`: the daily parcels and the 12 sights. Money, land, crops and missions change only through `apply()`, so a tampered client gains nothing.
- `time.ts`: the game clock, which runs from real timestamps. Crops keep growing while you're away, up to a week.
- `economy.ts`: Gopal's seasonal rates (pineapple is cheap in the monsoon glut), and net worth.
- `missions.ts`: the nine-mission story.
- `save.ts`: the save format and how old or hand-edited saves get normalised.
- `farm.ts`: the farm layout.
- `stands.ts`: the tomtom stands.
- `spots.ts`: generated from OSM.

### The 3D asset kit

`scripts/build-assets.mjs` generates `public/models/kit.glb`: 18 Agartala-style building models and a tomtom, all sharing one texture atlas plus a night-window glow atlas. The buildings are:

- tin-roof huts (one with bamboo walls)
- Assam-type houses with verandahs
- 1–4 storey RCC houses with balconies, chhajjas, parapets and the black rooftop water tank
- shop-houses with rolling shutters and Bengali-style signboards
- school/office blocks
- godowns

Each model is built at a nominal size, facing +Z. The map bake works out each OSM footprint's smallest bounding rectangle and which side faces the nearest road. The game then picks a model from the footprint's size, its street (main-road frontage gets shops) and the neighbourhood, fits it, and draws it with instancing.

Wall faces carry a `_TINT` vertex attribute, so every building gets its own paint colour. Detailed models draw within about 700 m of you, and plain blocks of the right height draw beyond that.

To use your own models, export a GLB from Blender with the same node names (`rcc2`, `shop2_a`, `tomtom`, …) and drop it in as `kit.glb`.

### Your home anywhere in Agartala

The title screen asks where home is. You can type a neighbourhood, chowmuhani, bazar or sight (the list comes from the map), or pick a spot on the map.

The game then finds an open plot beside a lane near that spot (`findHomeSite` in `src/client/map/places.ts`) and moves your stilt house, Grandpa, your bed and the **Home** tomtom stand there. The arrival story, Grandpa's lines and the mission text all follow it.

The family fields stay by the Haora with their own stand, so farming becomes a commute by tomtom like it would be. You can move home later from the Farm panel (L).

### More to do

- **Kaam:** five neighbours ask for goods each day.
- **Parcels:** three a day to carry across town. You pick one up from one neighbour and deliver it to another, carrying one at a time. Pay depends on the distance.
- **Real places and sights:** the area's real buildings and places from OpenStreetMap and Wikipedia (`src/shared/places.ts`): MBB College in its yellow and brown with its gate, MBB Stadium with galleries, Tripura Government Law College, Mahatma Gandhi Memorial School, the Modern Club Shiv Mandir, Modern Club Park, College Tilla Lake and College Lake, and more, each named on its own building. Eleven are sights, each with a little history. Your first visit to each pays ₹25.
- **Tracking:** the Farm panel lists everything for the day. The minimap marks kaam in blue, parcels in orange, unseen sights in purple and your house with a house icon.

### Life in the paras

- **A bazar that moves:** Gopal's rates follow the season, one item is in demand each day (+30%), and selling a lot at once pushes the rate down for a few days. Fruit, fish and pitha go off overnight unless you build a cold store.
- **More to grow and make:** tea on the third tilla (plant once, pluck every morning), agar trees (a month to grow, worth a fortune), rohu and katla in the pukur, cane baskets from bamboo, pitha from paddy in the kitchen.
- **Vehicles you drive:** Grandpa's old cycle-rickshaw from day one, and a bicycle, scooter, motorbike, tomtom and car from Gopal. They park by the house; walk up and press E. Each handles differently (the car is quick but wide, the rickshaw slow and heavy), and they bump off walls and stop at water. Stop a rickshaw or tomtom at any tomtom stand to pick up a passenger, follow the gold marker, and get paid a fare (up to 12 a day).
- **Rent a ride:** every tomtom stand has a rental point (green on the map) with a few vehicles: bicycles everywhere, scooters, motorbikes, rickshaws, a tomtom at the stadium and cars at Math Chowmuhani and Joynagar. Pay the first game hour up front, then the meter runs (₹3 an hour for a bicycle up to ₹30 for a car) until you return it at any rental point. A forgotten rental is charged for a day at most. Code in `src/client/vehicles.ts` and `src/shared/vehicles.ts`.
- **Kit:** diesel pump set (waters every plot at once), cold store, and a farm hand who waters and harvests at dawn for a week.
- **Energy and food:** work tires you; rest, sleep, or eat at the food stalls by every tomtom stand (momo, mui borok, chakhwi, wahan mosdeng…).
- **Seasons:** monsoon floods in Asharh and Srabon (paddy grows faster, the lunga can't be tilled, rides are slow on muddy roads).
- **Festivals every year:** Kharchi Puja fair, Ker Puja (no tomtoms till 18:00), Durga Puja at Modern Club, Diwali lamps on the lakes, Pous Sankranti pitha.
- **Bus trips:** Neermahal, the Tripura Sundari temple (a four-day blessing on your crops), the Akhaura border retreat at sunset, and the weekly Kamalasagar border haat.
- **People:** friendship with each neighbour (friends pay more and invite you over in the evening), a Kokborok and Bangla phrasebook you learn by talking, and ten chapters of Grandpa's stories.
- **Other players:** signed-in or not, other farmers walk the same streets with name tags. Visit a friend's farm by their visit code, water their crops, or send them a gift. Weekly boards by category, and para against para.
- **Polish:** street lamps and a crowd that follows the hour, stadium floodlights at night, ambient sound (rain, crickets, birds, temple bells, the dhak), photo mode with postcards, and an installable app that opens offline.

### Running

Movement has some inertia: you build up to a run and ease to a stop. Walls are slid along rather than stopping you dead, and fast movement is split into small steps so you can't clip through corners.

When you run, the stride, arm swing, forward lean and bob all grow with speed, the camera pulls back and widens a little, and footsteps sound on each foot-fall. Running is Shift (hold) or R (toggle), and on touch screens you push the joystick all the way.

### A fuller city

OpenStreetMap is missing many of Agartala's houses, especially in the newer paras. During the map bake, `scripts/bake-map.mjs` marks everything that must stay open on a 2 m grid: roads, water, parks, fields, landmarks and existing buildings. It then fills the gaps with modest houses facing the lanes, a front row plus houses in the backs of blocks, only where the neighbourhood is already built-up.

That adds about 2,000 houses to OSM's 6,800. The infill is seeded, so it's identical on every build, and these houses are marked from index `bs` in the map file.

### Crowds and traffic

About 700 people walk the lanes. They're drawn with a handful of instanced meshes, so they're cheap even on a laptop. Each has their own clothes, skin and walking pace; most keep to the edge of the road, some cross, and some stand and chat.

The crowd and the 70 tomtoms follow you around the city: anyone who falls far behind reappears on a road ahead of you, and after a jump or a ride the new area fills straight away. Stop anyone with E for a chat.

### Tomtom rides

- **Routing:** `src/client/route.ts` builds a road graph from the OSM streets and finds routes with A*, preferring main roads the way drivers do.
- **The ride:** you sit in the back with the driver up front and the camera follows. A golden line on the road shows where you're going, and E or Space skips ahead.
- **Timing:** the server sets the ride length, so the tomtom's speed is set to cover the real route in exactly that time. While you ride, game time passes at the ride's pace, not the usual rate, and the server books the rest of the time if you skip.
- **Fares:** your first ride is free. After that it's ₹20.
- **Staying on the road:** the tomtom keeps left but squeezes toward the middle of narrow lanes, so it never clips a wall. The map bake also drops the few OSM footprints that sit right across a street (gates, overhangs, mapping slips).

### People

- **Neighbours:** ten named neighbours live round the paras: a tea stall by the Modern Club Shiv Mandir, a tailor off Math Chowmuhani, the stadium groundsman, a boatman at the Haora bridge, and so on. Every day five of them ask for something.
- **Passers-by:** people walking the lanes stop, turn to face you, and chat when you press E near them.
- **The Farm panel (L):** lists today's kaam, and the minimap marks who needs help with blue dots.

### `src/client/`: the game in the browser

- `map/data.ts`: loads `public/agartala-map.json` and answers spatial questions (inside a building? in water? which road?).
- `scene/`:
  - `world.ts`: ground, parks, ponds, roads, extruded buildings, rooftop water tanks, trees and sky.
  - `landmarks.ts`: the stadium floodlights, the Modern Club pandal, the bazar stall, tomtom stands, the bus and NPCs.
  - `farm.ts`: the farm models.
  - `people.ts`: people and traffic.
- `game.ts` and `net.ts`: optimistic moves, batched sync, rollback, and the offline fallback.
- `interact.ts`: what E does, the dialogue, and where the mission marker points.
- `player.ts`, `sky.ts`, `audio.ts` (all sound is synthesized), `auth.ts` (sign-in buttons), and `ui/`.

### `api/`: the server

Each one is a Web `Request → Response` handler, so the same files run on Cloudflare Pages (through `functions/api/[[path]].ts`), on Vercel, and inside `npm run dev`.

- `session.ts`: create a guest, return a farm for its token, or restore one by farm code. A new farm's hometown and distance come from Cloudflare's `request.cf` (or Vercel's `x-vercel-ip-*` headers).
- `state.ts`: load a save.
- `act.ts`: apply a batch of moves. Saves are compare-and-set on `rev`, so two devices playing at once never lose moves.
- `leaderboard.ts`: the public board of named farms, ranked by net worth.
- `auth-config.ts`, `auth-start.ts`, `auth-google-callback.ts`, `auth-email-callback.ts`: sign-in with no third-party auth service (see below).
- `health.ts`, and `dev.ts` (a dev-only time skip that returns 404 when deployed).
- `_lib/store.ts`: the storage backends: Cloudflare D1, Supabase over REST, memory, and files for local dev (`_lib/file-store.ts`). The same contract tests run on all four; D1 is tested against real SQLite.

### Sign-in

Players start as guests with no sign-up. Signing in makes a farm follow them to any device:

- **Google:** the standard OAuth code flow. `auth-start` returns Google's URL, with a signed `state` naming the farm and a nonce cookie that pins the round-trip to this browser. The callback swaps the code for Google's ID token, checks it, and links `user:google:<id>` to the farm.
- **Email:** a signed link that works once and expires in 15 minutes, sent through [Resend](https://resend.com). It is limited to 5 emails per farm per hour.
- If the account already has a farm, the device switches to it; otherwise the current farm becomes the account's. The new session comes back in the URL fragment (`/#auth=…`), so it never reaches a server log.

Secrets (`AUTH_SECRET`, Google client secret, Resend key) live only on the server. Each method shows up in the game only when its keys are set.

## The map

- **Area:** the paras round MBB Stadium: fetched with bbox `23.810,91.282 → 23.840,91.314` and played inside a 1.9 × 1.9 km box (`src/shared/area.ts`), at 1 game unit = 1 metre. Map data © OpenStreetMap contributors, ODbL.
- **Rebuild it from fresh OSM data:**

  ```bash
  npm run map          # = map:fetch (Overpass → data/raw/agartala-osm.json) + map:bake (→ public/agartala-map.json, src/shared/spots.ts)
  ```

  To cover a different area, pass `node scripts/fetch-osm.mjs --bbox S,W,N,E`.
- **Building heights:** OSM rarely records storeys in Agartala, so heights are estimated from footprint size.
- **Hand-placed on real spots:** OSM doesn't name Ramnagar, Joynagar or Math Chowmuhani, so their centres are set by hand in `src/shared/area.ts` (`PARAS`); adjust them there if they're off. The farm sits on open land between the stadium and the Haora (`FARM_ZONE` in `src/shared/farm.ts`, kept free of houses by the bake). Its three small tillas are invented. Kharchi Puja happens by bus, because the Chaturdasha Devata Mandir is about 8 km east, off the map.

## Deploy on Cloudflare (agartala.biratdatta.tech)

Everything runs on Cloudflare: the static game on Pages, the API as Pages Functions, saves in D1. The free plan is enough.

1. **Sign in to Cloudflare from this folder:**

   ```bash
   npm install
   npx wrangler login
   ```

2. **Create the database** and paste the printed `database_id` into `wrangler.toml`:

   ```bash
   npx wrangler d1 create agartala
   npm run cf:db            # creates the tables (cloudflare/schema.sql)
   ```

3. **Create the Pages project and deploy:**

   ```bash
   npx wrangler pages project create agartala --production-branch main
   npm run cf:deploy
   ```

   You get a `https://agartala.pages.dev` URL, and the D1 binding comes from `wrangler.toml`.

4. **Subdomain:** in the Cloudflare dashboard, go to Workers & Pages → agartala → Custom domains → Set up a custom domain, and enter `agartala.biratdatta.tech`. Because `biratdatta.tech` is already on Cloudflare, it adds the DNS record and certificate for you.

5. **Secret for sign-in:**

   ```bash
   openssl rand -base64 48 | npx wrangler pages secret put AUTH_SECRET
   ```

6. **Google sign-in:**
   - In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), go to Create credentials → OAuth client ID → Web application.
   - Authorized redirect URI: `https://agartala.biratdatta.tech/api/auth-google-callback`. Add `https://agartala.pages.dev/api/auth-google-callback` too if you want sign-in on that URL.
   - On the OAuth consent screen, set the app name and your email, and publish it so anyone can sign in.
   - Then set the two secrets:

     ```bash
     npx wrangler pages secret put GOOGLE_CLIENT_ID
     npx wrangler pages secret put GOOGLE_CLIENT_SECRET
     ```

7. **Email links (optional):**
   - Create a [Resend](https://resend.com) account and verify `biratdatta.tech` there. Resend shows DNS records you can add in Cloudflare DNS.
   - Then:

     ```bash
     npx wrangler pages secret put RESEND_API_KEY
     npx wrangler pages secret put EMAIL_FROM     # e.g. Haora Bari <login@biratdatta.tech>
     ```

8. **Redeploy** (`npm run cf:deploy`) so the secrets take effect, then open `https://agartala.biratdatta.tech/api/health`. It should say `"store":"D1Store"`. `/api/auth-config` shows which sign-in methods are on.

**Auto-deploy from GitHub instead:** connect the repo under Workers & Pages → Create → Pages → Connect to Git, with build command `npm run build` and output `dist`. Then add the D1 binding (`DB` → `agartala`) and the secrets under the project's Settings.

**Test the Cloudflare build locally:** copy `.env.example` to `.dev.vars`, fill in `AUTH_SECRET`, run `npm run cf:db:local` once, then `npm run cf:dev` (→ http://localhost:8788). For Google sign-in locally, add `http://localhost:8788/api/auth-google-callback` as a redirect URI.

### Or on Vercel

The same `api/` files run as Vercel functions:

- Storage is Supabase: run [`supabase/schema.sql`](supabase/schema.sql), then set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- Set the sign-in variables from `.env.example`.

Deployed without a database, the API refuses to run instead of silently losing saves.

## Folders

```
api/            the server: one file per endpoint + _lib (store, sessions, auth, http)
functions/      Cloudflare Pages entry that routes /api/* to api/
src/shared/     game rules shared by client and server
src/client/     the browser game
public/         agartala-map.json (baked OSM data)
scripts/        fetch-osm.mjs, bake-map.mjs, build-assets.mjs
public/models/  kit.glb (the 3D asset kit)
docs/           atlas-preview.png
cloudflare/     schema.sql for D1 (wrangler.toml at the root)
supabase/       schema.sql (if you host on Vercel)
tests/          vitest suites
data/raw/       the raw OSM extract
```

## Ideas

- Add window detail and real storey counts where mappers have tagged them.
- Add more landmarks: Gedu Mia Mosque, Lakshminarayan Bari, M.B.B. College, Neer Mahal (as a day trip).
- Add a Kokborok and Bengali UI toggle, checked by native speakers.
- Add fishing in Dim Sagar, and a Kharchi Puja fair you can walk around.

## Licence

The code is MIT. Map data © OpenStreetMap contributors (ODbL).
