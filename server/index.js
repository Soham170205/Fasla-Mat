import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import gameRoutes from './routes/game.js';
import leaderboardRoutes from './routes/leaderboard.js';
import authRoutes from './routes/auth.js';
import { initUsers } from './services/userStore.js';
import { initLeaderboard } from './services/leaderboardStore.js';
import { aiEnabled } from './services/shopkeeperAI.js';

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors(process.env.CLIENT_ORIGIN ? { origin: process.env.CLIENT_ORIGIN } : {}));
app.use(express.json({ limit: '10kb' }));

// Every message costs LLM tokens: cap messages per IP
const hits = new Map();
function rateLimit(req, res, next) {
  const now = Date.now();
  const key = req.ip;
  const recent = (hits.get(key) || []).filter(t => now - t < 60_000);
  if (recent.length >= 40) return res.status(429).json({ error: 'Too many offers too fast. Take a breath and try again in a minute.' });
  recent.push(now);
  hits.set(key, recent);
  next();
}
app.use('/api/game/:id/message', rateLimit);

app.get('/api/health', (req, res) => res.json({ ok: true, aiEnabled: aiEnabled() }));
app.use('/api/game', gameRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/auth', authRoutes);

// Serve the built React app in production
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error. Check the server logs.' });
});

await initLeaderboard();
await initUsers();
app.listen(PORT, () => {
  console.log(`Fasla Mat API on http://localhost:${PORT}`);
  console.log(aiEnabled() ? `Shopkeepers: Gemini (${process.env.GEMINI_MODEL || 'gemini-2.5-flash'})` : 'Shopkeepers: demo mode (no GEMINI_API_KEY)');
});
