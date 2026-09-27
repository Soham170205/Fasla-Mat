# 🛒 Fasla Mat

**An AI haggling game set in a Mumbai market.** Walk around a pixel-art bazaar, talk to three AI shopkeepers, and bargain them down as far as you can. Every shopkeeper has a secret floor price and their own personality, and they'll throw you out if you push too hard.

Built for **AGENTHON 2026** (12-hour AI + Games Hackathon, 27 September 2026).

🌐 **Live demo:** [https://fasla-mat.onrender.com](https://fasla-mat.onrender.com)
🎥 **Demo video:** [add link]

> The free Render instance sleeps when idle. The first load can take 30 to 50 seconds.

---

## 🎮 The Game

You arrive at the market with a shopping list. Three vendors, three items, three very different people:

| Shopkeeper | Stall | Item | Opening price | Personality |
|---|---|---|---|---|
| **Ramesh Kaka** | Ramesh Sabzi Bhandar | Sabzi thaila, 5 kg | ₹450 | Grumpy 65-year-old, 40 years at the stall, easily "offended" by lowballs, softens if you're respectful |
| **Pinky Didi** | Pinky Anaaj Bhandar | Basmati chawal, 5 kg | ₹900 | Sweet-talker, heavy on emotional lines ("subah se boni nahi hui"), caves if you threaten to go next door |
| **Salim Bhai** | Salim Machhi Center | Taaza pomfret, 1 kg | ₹1400 | Fast-talking hustler at Sassoon Dock, respects street-smart buyers, impatient with time-wasters |

You type whatever you want. There are no dialogue options. Make offers, give reasons, compliment them, walk away, or try to trick them. They reply in Hinglish, in character, and adjust the price based on how convincing you are.

**Patience meter:** every turn changes the shopkeeper's patience. Lowballs and rudeness drain it. Hit zero and you're thrown out with no deal.

**Walk-away trick:** walk away once with patience at 30 or more, and there's a 65% chance the shopkeeper calls you back with a lower price.

**Scoring:** 0 to 100 for how close you got to the secret floor price, plus up to 30 bonus points for doing it in fewer turns.

| Score | Rating |
|---|---|
| 100+ | Mandi King. Vendor ro raha hai! |
| 70+ | Pakka mol-bhaav expert. |
| 40+ | Theek-thaak. Thoda aur ladna tha. |
| 1+ | Vendor ne aapko loot liya. |

### Controls

- **Move:** WASD / arrow keys, or tap/click where you want to walk
- **Talk:** stand in front of a shopkeeper and press **E** (or Space, Enter, tap them, or the "Talk to" button)
- **Close shop panel:** Esc. A bargain in progress is kept if you step away.

## ✨ Features

- **AI shopkeepers powered by Google Gemini:** each has a persona, backstory, and bargaining style
- **Server-side game rules:** the LLM plays the character, but the backend owns the numbers. Prices can never drop below the secret floor or go back up, and patience changes are clamped. Floor prices and personas never reach the browser.
- **Prompt-injection resistant:** players can't talk the AI into revealing the floor or giving items away, because `services/rules.js` validates every number the model returns.
- **Demo mode:** with no API key, each shopkeeper answers from 120+ handwritten lines across 22 situations (offer, lowball, reason, compliment, rudeness, off-topic, injection attempts, and more), with no repeats within one bargain
- **Five walking locals:** Shanta Aaji, Kamat Uncle, Bunty, Rukhsana Aapa, and Pintu Chaiwala follow routes, pause at stalls, and talk to you in an RPG-style text box. About 45 story scenes unlock based on what you've done (what you bought, who threw you out, the vendor of the day, time of day, how often you visit).
- **Vendor of the day:** one stall glows each day, based on IST
- **Accounts:** sign up and log in with scrypt-hashed passwords and signed tokens (7 days). Guests can play and save their deal by signing up on the result screen.
- **Leaderboard with two views:** Top Players (best score per stall added up, so you can't farm one stall) and Best Deals
- **Rate limiting:** 40 messages per minute per IP to protect LLM costs

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5 |
| Game engine | Phaser 3.80 |
| Backend | Node.js, Express 4 |
| AI | Google Gemini API |
| Database | MongoDB Atlas with Mongoose (falls back to JSON files if `MONGO_URI` isn't set) |
| Auth | scrypt + HMAC-SHA256 tokens (Node `crypto`, no extra dependencies) |
| Asset pipeline | Python 3 + Pillow |
| Hosting | Render (single web service) |

## 🏗️ Architecture

```
client/ (React + Phaser)                    server/ (Express)
  src/pages/Home.jsx     name, leaderboard     index.js               app, CORS, rate limit, serves client/dist
  src/pages/Market.jsx   Phaser world + HUD    routes/game.js         vendors / start / message / accept / walkaway
  src/pages/Shop.jsx     haggling panel        routes/auth.js         signup / login / me
  src/pages/Result.jsx   score, share, board   routes/leaderboard.js  top scores; submit by sessionId only
  src/components/        Shopkeeper, ChatBox,  services/sessionStore  in-memory sessions (1h TTL)
                         PriceTag, Patience-   services/shopkeeperAI  prompt + Gemini call + JSON parse + retry + demo mode
                         Meter, ActionBar,     services/rules.js      clamps every LLM number (floor, no price rises,
                         Leaderboard                                   patience, deal checks)
  src/api/game.js        every fetch call      services/scoring.js    score + rating
  src/state/useGame.js   session state hook    services/auth.js       password hashing + tokens
  src/state/auth.jsx     login state           services/*Store.js     MongoDB if MONGO_URI, else JSON file
  src/game/              Phaser scene + bus    data/items.js          vendors, items, prices, personas (secret)
                                               models/                Mongo schemas (User, Score)
```

**One shopkeeper turn:**
1. The player's message goes to `POST /api/game/:id/message`.
2. `shopkeeperAI.js` builds a prompt from the vendor's secret persona, current price, patience, and conversation history, then calls Gemini.
3. Gemini returns JSON: `{ reply, newPrice, mood, patienceDelta, dealAccepted, playerOffer }`.
4. `rules.js` validates it. The price is clamped to at least the floor and at most the current price, and if the model wrote a different number, the reply text is corrected to match.
5. The browser receives only the reply, price, mood, and patience.

Phaser and React talk through `src/game/bus.js`. The scene emits `near` and `talk`; React emits `resume`, `requestTalk`, `sold`, `mood`, and `cooldown`.

### API

| Method | Route | Does |
|---|---|---|
| GET | `/api/health` | server status and whether AI is on |
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

## 🚀 Run It Locally

Needs **Node 18+**.

```bash
git clone [your-repo-url]
cd fasla-mat
npm run setup                  # installs server + client
```

Create `server/.env`:

```env
# Leave empty to run in demo mode (rule-based shopkeepers, no AI calls)
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.8-flash
PORT=3000
# Optional. Without it, users and the leaderboard are saved to server/data/*.json
MONGO_URI=
# Optional. Only needed if the client is hosted on a different origin
CLIENT_ORIGIN=
# Signs login tokens. Use a long random string in production (openssl rand -hex 32)
AUTH_SECRET=
```

Get a Gemini key from [Google AI Studio](https://aistudio.google.com/).

```bash
npm run build                  # builds the React app into client/dist
npm start                      # serves the game + API on http://localhost:3000
```

**Development with hot reload** (two terminals):

```bash
npm run dev:server             # API on :3000
npm run dev:client             # Vite on :5173, proxies /api to :3000
```

After changing client code, run `npm run build` again so `npm start` serves the new version.

## ☁️ Deploying (Render)

The Express server serves the built React app, so everything runs as **one Web Service**.

| Setting | Value |
|---|---|
| Root Directory | *(blank)* |
| Runtime | Node |
| Build Command | `npm run setup && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |

**Environment variables:** `GEMINI_API_KEY`, `GEMINI_MODEL`, `MONGO_URI`, `AUTH_SECRET`. Don't set `PORT` (Render provides it).

Notes:
- Set `AUTH_SECRET`. Without it, a new secret is generated on each restart, since Render's disk is temporary, and every login token breaks.
- Set `MONGO_URI` so users and scores survive restarts. In MongoDB Atlas → Network Access, allow `0.0.0.0/0`.
- Sessions are held in memory, so run a single instance.

## 🔧 Changing the Game

- **Vendors, items, prices, personalities:** `server/data/items.js`. `floorPrice` and `persona` stay server-side.
- **Shopkeeper demo lines:** `server/data/demo_dialogue.json`. Placeholders: `{price}`, `{offer}`, `{item}`.
- **Walking NPCs:** dialogue in `client/src/data/npc_dialogue.json`; routes and speeds under `walkers` in `tools/map_layout.json`. Condition keys are listed in the file's `_readme`.
- **Map, stall positions, props, crowd:** `tools/map_layout.json`, then `npm run assets` (needs Python 3 + Pillow).
- **Switching LLM provider:** only `callLLM()` in `server/services/shopkeeperAI.js` changes.
- **Collision boxes:** set `arcade: { debug: true }` in `client/src/game/createGame.js`.

## 🎨 Asset Pipeline

`tools/build_assets.py` turns the raw sheets in `assets-src/` into game files in `client/public/assets/`:

- One stall per vendor with its own awning colour: saffron (Ramesh), rani pink (Pinky), tarp blue (Salim)
- 28 props trimmed to their pixels and packed into one named atlas (`crate_tomato`, `sacks_big`, `dock`…)
- The whole ground baked into one image: grass, cobbled plaza, dirt entrance path, dock water with a shoreline edge, and a soft vignette
- Two new shopper characters palette-swapped from the NPC pack, so the crowd doesn't look like the player
- In game: shadows under every character and prop, y-sorted depth, vendor-of-the-day glow

## 🧗 Challenges We Faced

- **Keeping the AI honest about prices:** LLMs drop prices too easily and can be sweet-talked or prompt-injected. We moved all price logic into `rules.js`, so the model only suggests numbers and the server decides.
- **Reliable structured output:** Gemini had to return a reply and game state together. We used strict JSON instructions, a parser, and a retry, with demo lines as a fallback.
- **Making the market feel alive:** walking locals with conditional story scenes turned a chat window into a place.
- [add your own]

## 🔮 Future Improvements

- Voice haggling
- More markets (Crawford Market, Colaba Causeway, Dadar flower market)
- Multiplayer: two shoppers competing for the same item
- Persistent sessions (Redis) for multi-instance hosting

## 👥 Team

| Name | Role |
|---|---|
| Soham [surname] | [role] |
| [Teammate 2] | [role] |
| [Teammate 3] | [role] |
| [Teammate 4] | [role] |

## 📜 Credits

See [CREDITS.md](CREDITS.md). Market tileset by Zabin, Jetrel, Redshrike, Hyptosis, Daneeklu, and Bertram (LPC). Characters: *Market Day Folk* by Obssidian Art. Fonts: Pixelify Sans and Hind (SIL OFL).
