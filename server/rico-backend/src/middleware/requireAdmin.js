function requireAdmin(req, res, next) {
  const expected = process.env.ADMIN_TOKEN;
  const auth = req.headers.authorization || '';
  if (!expected || auth !== `Bearer ${expected}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

export default requireAdmin;
