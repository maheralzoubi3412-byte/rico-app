function requireBusinessSession(req, res, next) {
  if (!req.session?.businessId) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

export default requireBusinessSession;
