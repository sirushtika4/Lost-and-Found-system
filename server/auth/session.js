const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const { cookieOptions } = require('../config/auth');
function signSession(userId, config) {
  return jwt.sign({}, config.secret, { algorithm: 'HS256', subject: String(userId), issuer: config.issuer, audience: config.audience, expiresIn: config.ttl, jwtid: randomUUID() });
}
function verifySession(token, config) {
  const payload = jwt.verify(token, config.secret, { algorithms: ['HS256'], issuer: config.issuer, audience: config.audience, maxAge: config.ttl });
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload !== 'object' || typeof payload.sub !== 'string' || !/^[a-f\d]{24}$/i.test(payload.sub)
    || !Number.isInteger(payload.exp) || !Number.isInteger(payload.iat) || payload.iat > now + 5
    || payload.exp <= payload.iat || payload.exp - payload.iat > config.ttl) throw new Error('Invalid session claims');
  return payload.sub;
}
function setSession(res, userId, config) {
  res.cookie(config.cookieName, signSession(userId, config), { ...cookieOptions(config), maxAge: config.ttl * 1000 });
}
function clearSession(res, config) { res.clearCookie(config.cookieName, cookieOptions(config)); }
module.exports = { signSession, verifySession, setSession, clearSession };
