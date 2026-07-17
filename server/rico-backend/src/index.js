import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import connectDb from './db/connection.js';
import searchRouter from './routes/search.js';
import dealsRouter from './routes/deals.js';
import classifyRouter from './routes/classify.js';
import adminRouter from './routes/admin.js';
import publicRouter from './routes/public.js';
import businessRouter from './routes/business.js';

const app = express();

// Render (and most PaaS) sit behind one reverse-proxy hop — needed so
// req.ip / rate-limiting see the real client IP, not the proxy's.
app.set('trust proxy', 1);

app.use(express.json());

const mongoUri = process.env.MONGODB_URI;
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev_only_insecure_secret_change_me',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: mongoUri, collectionName: 'business_sessions' }),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  }),
);

app.get('/', (req, res) => res.json({ status: 'ok' }));

// React (Vite) build — static assets + the 4 SPA page routes. Registered
// BEFORE the /admin router: `/admin/dashboard` (the page itself) would
// otherwise be swallowed by adminRouter's requireAdmin middleware, since
// that middleware runs for the whole /admin prefix regardless of the
// specific sub-path. The page handles its own auth (a token prompt), not
// this middleware — only the actual /admin/* API calls it makes need that.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(__dirname, '../client/dist');
app.use(express.static(clientDist));

const SPA_PAGES = ['/submit-deal', '/business/login', '/business/dashboard', '/admin/dashboard'];
for (const page of SPA_PAGES) {
  app.get(page, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

// Each public router applies its own `cors()` internally, scoped per-route
// (see routes/*.js) — deliberately NOT applied here at the app level, and
// NEVER applied to /admin or /business/* (session cookies + CORS '*' don't
// mix safely — see the design-review notes in the project plan).
app.use(searchRouter);
app.use(dealsRouter);
app.use(classifyRouter);
app.use(publicRouter);

app.use('/admin', adminRouter);
app.use(businessRouter);

async function start() {
  await connectDb();
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`rico-backend listening on :${port}`));
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
