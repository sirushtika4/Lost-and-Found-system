const crypto = require('crypto');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const { ObjectId } = require('mongodb');

const router = express.Router();
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const publicUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
});

const issueSession = (user) => ({
  token: jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '7d' }),
  user: publicUser(user),
});

const createMailer = () => {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_FROM || Boolean(SMTP_USER) !== Boolean(SMTP_PASS)) return null;

  const config = {
    host: SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
  };
  if (SMTP_USER && SMTP_PASS) config.auth = { user: SMTP_USER, pass: SMTP_PASS };
  return nodemailer.createTransport(config);
};

const requireSession = asyncHandler(async (req, res, next) => {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ message: 'Authentication required.' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = new ObjectId(payload.sub);
    return next();
  } catch {
    return res.status(401).json({ message: 'Your session is invalid or has expired.' });
  }
});

const validEmail = (email) => typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

function createAuthRouter(getUsers) {
  router.post('/register', asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    if (typeof name !== 'string' || !name.trim() || !validEmail(email) || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ message: 'Enter your name, a valid email, and a password of at least 8 characters.' });
    }

    const users = getUsers();
    const normalizedEmail = email.trim().toLowerCase();
    if (await users.findOne({ email: normalizedEmail })) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const user = {
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 12),
      createdAt: new Date(),
    };

    try {
      const result = await users.insertOne(user);
      user._id = result.insertedId;
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({ message: 'An account with this email already exists.' });
      throw error;
    }

    return res.status(201).json(issueSession(user));
  }));

  router.post('/login', asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!validEmail(email) || typeof password !== 'string') {
      return res.status(400).json({ message: 'Enter a valid email and password.' });
    }

    const user = await getUsers().findOne({ email: email.trim().toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: 'Email or password is incorrect.' });
    }

    return res.json(issueSession(user));
  }));

  router.get('/me', requireSession, asyncHandler(async (req, res) => {
    const user = await getUsers().findOne({ _id: req.userId });
    if (!user) return res.status(401).json({ message: 'Account not found.' });
    return res.json({ user: publicUser(user) });
  }));

  router.post('/forgot-password', passwordResetLimiter, asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!validEmail(email)) return res.status(400).json({ message: 'Enter a valid email address.' });

    const mailer = createMailer();
    if (!mailer) {
      return res.status(503).json({ message: 'Password reset email is not configured on this server.' });
    }

    const users = getUsers();
    const user = await users.findOne({ email: email.trim().toLowerCase() });
    if (user) {
      const resetCode = crypto.randomInt(100000, 1000000).toString();
      const resetCodeHash = crypto.createHmac('sha256', process.env.JWT_SECRET).update(resetCode).digest('hex');
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await users.updateOne(
        { _id: user._id },
        { $set: { passwordResetCodeHash: resetCodeHash, passwordResetExpiresAt: expiresAt } },
      );

      try {
        await mailer.sendMail({
          from: process.env.SMTP_FROM,
          to: user.email,
          subject: 'Your Lost and Found password reset code',
          text: `Your password reset code is ${resetCode}. It expires in 10 minutes. If you did not request this, ignore this email.`,
          html: `<p>Your password reset code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px">${resetCode}</p><p>It expires in 10 minutes. If you did not request this, ignore this email.</p>`,
        });
      } catch (error) {
        await users.updateOne({ _id: user._id }, { $unset: { passwordResetCodeHash: '', passwordResetExpiresAt: '' } });
        throw error;
      }
    }

    return res.json({ message: 'If an account exists for that email, password reset instructions have been sent.' });
  }));

  router.post('/reset-password', passwordResetLimiter, asyncHandler(async (req, res) => {
    const { email, code, password } = req.body;
    if (!validEmail(email) || typeof code !== 'string' || !/^\d{6}$/.test(code) || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ message: 'Enter the 6-digit code and a password of at least 8 characters.' });
    }

    const passwordResetCodeHash = crypto.createHmac('sha256', process.env.JWT_SECRET).update(code).digest('hex');
    const users = getUsers();
    const user = await users.findOne({
      email: email.trim().toLowerCase(),
      passwordResetCodeHash,
      passwordResetExpiresAt: { $gt: new Date() },
    });
    if (!user) return res.status(400).json({ message: 'The code is incorrect or has expired.' });

    await users.updateOne(
      { _id: user._id },
      {
        $set: { passwordHash: await bcrypt.hash(password, 12), passwordChangedAt: new Date() },
        $unset: { passwordResetCodeHash: '', passwordResetExpiresAt: '' },
      },
    );

    return res.json({ message: 'Password updated. You can now sign in with your new password.' });
  }));

  return router;
}

module.exports = { createAuthRouter };