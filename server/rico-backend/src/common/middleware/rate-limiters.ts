import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import { Request } from 'express';

// Two independent caps on /business/login: by IP (catches broad abuse) and
// by the target email (catches someone repeatedly emailing one address —
// harassment vector, not just a cost concern). `app.set('trust proxy', 1)`
// in main.ts makes req.ip reflect the real client IP behind Render's proxy.
export const loginIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

export const loginEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    return crypto.createHash('sha256').update(email).digest('hex');
  },
});

// Public write endpoint with no auth — cap abuse without adding real
// friction for a legitimate one-off submission.
export const submitDealLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20 });

// Fires once per chat response (batched, up to 20 businessIds per call), so
// a normal browsing session legitimately makes many more calls than a
// one-off form submission — capped generously, just enough to blunt abuse.
export const impressionLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
