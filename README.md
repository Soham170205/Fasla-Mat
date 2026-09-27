# Fasla Mat

An AI haggling game set in a Mumbai market. Walk around a pixel-art bazaar, talk to three shopkeepers
and bargain them down. The backend owns the game: floor prices, LLM calls and scoring never reach the browser.

## Run it

Needs Node 18+.

```bash
npm run setup                  # installs server + client
cp server/.env.example server/.env
# add ANTHROPIC_API_KEY to server/.env (leave it empty for demo mode)
npm start                      # serves the prebuilt game + API on http://localhost:3000
```

For development with hot reload, use two terminals:

```bash
npm run dev:server             # API on :3000
npm run dev:client             # Vite on :5173, proxies /api to :3000
```

After changing client code, run `npm run build` so `npm start` serves the new version.

**Demo mode:** with no API key each shopkeeper answers from about 120 written lines in
`server/data/demo_dialogue.json`, picked by what the player said (offer, lowball, reason, compliment, rudeness,
off-topic, prompt-injection attempts and more). Lines never repeat within one bargain until a category runs out.
Opening lines, walk-away callbacks and endings come from the same file in AI mode too.

## Controls

WASD / arrow keys, or tap/click where you want to walk. Stand in front of a shopkeeper and press E (or Space,
Enter, or tap them / the "Talk to" button). Esc closes the shop panel. A bargain in progress is kept if you step away.

## What's new in v2

- **120+ demo lines per shopkeeper** in 22 situations (`server/data/demo_dialogue.json`), with intent detection
  in `services/shopkeeperAI.js` and no-repeat picking in `services/dialogue.js`.
- **Five walking locals you can talk to**: Shanta Aaji, Kamat Uncle, Bunty, Rukhsana Aapa and Pintu Chaiwala.
  They follow routes, pause at stalls, stop and face you when you talk, and speak in an RPG-style text box.
  Their lines live in `client/src/data/npc_dialogue.json` (about 45 scenes and 80 small-talk lines). Scenes unlock
  from what you've done: first meeting, what you bought, who threw you out, the vendor of the day, time of day,
  how often you've visited. Each scene plays once; after that, small talk comes from shuffle bags. What each
  player has heard is remembered in the browser, per account.
- **Sign up / log in.** Passwords are hashed with scrypt, logins use signed tokens (7 days). Logged-in deals save
  automatically. Guests can play, and can sign up on the result screen to save the deal they just made.
- **Leaderboard with two views**: Top players (best score at each stall, added up, so replaying one stall can't farm
  points) and Best deals.

## Architecture

```
client/ (React + Phaser)                    server/ (Express)
  src/pages/Home.jsx     name, leaderboard     index.js               app, CORS, rate limit, serves client/dist
  src/pages/Market.jsx   Phaser world + HUD    routes/game.js         vendors / start / message / accept / walkaway
  src/pages/Shop.jsx     haggling panel        routes/leaderboard.js  top scores; submit by sessionId only
  src/pages/Result.jsx   score, share, board   services/sessionStore  in-memory sessions (1h TTL)
  src/components/        Shopkeeper, ChatBox,  services/shopkeeperAI  prompt + LLM + JSON parse + retry + demo mode
                         PriceTag, Patience-   services/rules.js      clamps every LLM number (floor, no price rises,
                         Meter, ActionBar,                             patience, deal checks)
                         Leaderboard           services/scoring.js    score + rating
  src/api/game.js        every fetch call      services/leaderboardStore  MongoDB if MONGO_URI, else JSON file
  src/state/useGame.js   session state hook    data/items.js          vendors, items, prices, personas (secret)
  src/game/              Phaser scene + bus    models/Score.js        Mongo schema
```

Phaser and React talk through `src/game/bus.js`. The scene emits `near` and `talk`; React emits `resume`,
`requestTalk`, `sold`, `mood` and `cooldown`.

### API

| Method | Route | Does |
|---|---|---|
| GET | `/api/game/vendors` | public vendor list, vendor of the day, whether AI is on |
| POST | `/api/game/start` | `{vendorId}` → new session, opening line and price |
| POST | `/api/game/:id/message` | `{text}` → one shopkeeper turn |
| POST | `/api/game/:id/accept` | deal at the current price, returns score |
| POST | `/api/game/:id/walkaway` | 65% chance (once, if patience ≥ 30) the shopkeeper calls you back cheaper |
| POST | `/api/auth/signup` | `{username, password, displayName}` → token + user |
| POST | `/api/auth/login` | `{username, password}` → token + user |
| GET | `/api/auth/me` | current user (Bearer token) |
| GET | `/api/leaderboard` | `{players, deals}` top 10 of each |
| GET | `/api/leaderboard/me` | your rank, total and best deals (login) |
| POST | `/api/leaderboard` | `{sessionId}`: save a finished guest deal to your account (login) |

Score = 0-100 for how close you got to the secret floor, plus up to 30 for doing it in fewer turns.

## Changing the game

- **Vendors, items, prices, personalities:** `server/data/items.js`. `floorPrice` and `persona` stay server-side.
- **Map, stall positions, props, crowd:** `tools/map_layout.json`, then `npm run assets` (needs Python 3 + Pillow).
- **Switching LLM provider:** only `callLLM()` in `server/services/shopkeeperAI.js` changes.
- **Shopkeeper demo lines:** `server/data/demo_dialogue.json`. Placeholders: `{price}`, `{offer}`, `{item}`.
- **Walking NPCs:** dialogue in `client/src/data/npc_dialogue.json`; routes and speeds under `walkers` in
  `tools/map_layout.json`. Condition keys are listed in the file's `_readme`.
- **Collision boxes:** set `arcade: { debug: true }` in `client/src/game/createGame.js`.

## Asset pipeline

`tools/build_assets.py` turns the raw sheets in `assets-src/` into game files in `client/public/assets/`:

- One stall per vendor with its own awning colour: saffron (Ramesh), rani pink (Pinky), tarp blue (Salim).
- 28 props trimmed to their pixels and packed into one atlas with names (`crate_tomato`, `sacks_big`, `dock`…).
- The whole ground baked into one image: grass, cobbled plaza, dirt entrance path, dock water with a shoreline
  edge, and a soft vignette.
- Two new shopper characters palette-swapped from the NPC pack, so the crowd doesn't look like the player.
- In game: shadows under every character and prop, y-sorted depth, vendor-of-the-day glow.

## Deploying

Render/Railway: build command `npm run setup && npm run build`, start command `npm start`, set the env vars from
`server/.env.example`, including a long random `AUTH_SECRET`. Sessions are in memory, so run a single instance.
On hosts with a temporary disk, set `MONGO_URI` so users and scores survive restarts.

## Licences

See CREDITS.md. The NPC pack licence does not allow public repositories, so keep the repo private.
