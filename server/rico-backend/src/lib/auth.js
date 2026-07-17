import crypto from 'node:crypto';

// 256-bit random tokens, base64url-encoded (no padding/slashes to worry
// about in URLs). Only the SHA-256 hash is ever stored — see
// db/models/MagicLinkToken.js's comment on why.
function generateToken() {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export { generateToken, hashToken };
