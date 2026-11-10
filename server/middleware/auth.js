const { verifySession, clearSession } = require('../auth/session');
function protect(config, User) {
  return async (req, res, next) => {
    const token = req.cookies[config.cookieName];
    if (!token) return res.status(401).json({ message: 'Authentication required.' });
    let userId;
    try { userId = verifySession(token, config); }
    catch {
      clearSession(res, config);
      return res.status(401).json({ message: 'Session expired or invalid. Please sign in again.' });
    }
    try {
      const user = await User.findById(userId);
      if (!user) {
        clearSession(res, config);
        return res.status(401).json({ message: 'Session expired or invalid. Please sign in again.' });
      }
      req.user = user;
      return next();
    } catch (error) { return next(error); }
  };
}
// Custom-header CSRF defense, layered with exact Origin, JSON and SameSite cookies.
function csrfProtection(config) {
  return (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    if (req.get('origin') !== config.origin || req.get('X-CSRF-Protection') !== '1' || !req.is('application/json')) return res.status(403).json({ message: 'Request origin or CSRF protection is invalid.' });
    return next();
  };
}
module.exports = { protect, csrfProtection };
