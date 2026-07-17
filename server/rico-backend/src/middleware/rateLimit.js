import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';

// Two independent caps on /business/login: by IP (catches broad abuse) and
// by the target email (catches someone repeatedly emailing one address —
// harassment vector, not just a cost concern). CF-Connecting-IP doesn't
// apply here (that was Workers-specific); Express's req.ip is used instead,
// with `app.set('trust proxy', ...)` configured in index.js so it reads the
// real client IP behind Render's proxy rather than Render's own address.
const loginIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const loginEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    return crypto.createHash('sha256').update(email).digest('hex');
  },
});

export { loginIpLimiter, loginEmailLimiter };
