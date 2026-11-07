const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { rateLimit } = require('express-rate-limit');
const { safeUser } = require('../models/User');
const { protect, csrfProtection } = require('../middleware/auth');
const { setSession, clearSession } = require('../auth/session');
const email = z.string().trim().max(254).email().transform(value => value.toLowerCase());
const registration = z.object({ name: z.string().trim().min(1).max(100), email,
  password: z.string().refine(value => Array.from(value).length >= 15 && Buffer.byteLength(value, 'utf8') <= 72),
  phoneNumber: z.string().max(30).optional() }).strict();
const credentials = z.object({ email, password: z.string().min(1).max(4096) }).strict();
const dummyHash = bcrypt.hash('Dummy credential used only for unknown-account comparisons', 12);
const wrap = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
function createAuthRouter({ config, User, limits = {} }) {
  const router = express.Router();
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(csrfProtection(config));
  const limiter = (limit, skipSuccessfulRequests = false) => rateLimit({ windowMs: 15 * 60 * 1000, limit, skipSuccessfulRequests, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Too many attempts. Please try again later.' } });
  router.post('/register', limiter(limits.register ?? 5), wrap(async (req, res, next) => {
    const input = registration.safeParse(req.body);
    if (!input.success) return res.status(400).json({ message: 'Use a valid name and email, and a password of at least 15 characters and at most 72 UTF-8 bytes. Extra fields are not accepted.' });
    const password = await bcrypt.hash(input.data.password, 12);
    let user;
    try { user = await User.create({ ...input.data, password, role: 'user' }); }
    catch (error) {
      if (error.code === 11000) return res.status(409).json({ message: 'Unable to register with these details.' });
      return next(error);
    }
    setSession(res, user._id, config);
    return res.status(201).json({ success: true, user: safeUser(user) });
  }));
  router.post('/login', limiter(limits.login ?? 10, true), wrap(async (req, res) => {
    const input = credentials.safeParse(req.body);
    if (!input.success) return res.status(400).json({ message: 'Provide a valid email and password.' });
    const user = await User.findOne({ email: input.data.email }).select('+password');
    const matches = await bcrypt.compare(input.data.password, user ? user.password : await dummyHash);
    if (!user || !matches) return res.status(401).json({ message: 'Invalid email or password.' });
    setSession(res, user._id, config);
    return res.json({ success: true, user: safeUser(user) });
  }));
  router.get('/me', protect(config, User), (req, res) => res.json({ success: true, user: safeUser(req.user) }));
  router.post('/logout', (req, res) => { clearSession(res, config); return res.status(204).end(); });
  return router;
}
module.exports = { createAuthRouter };
