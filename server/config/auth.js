function loadAuthConfig(env = process.env) {
  const secret = env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) throw new Error('JWT_SECRET must contain at least 32 random bytes; configure it privately.');
  const mode = env.AUTH_MODE || (env.NODE_ENV === 'production' ? 'production' : 'local');
  if (!['local', 'production'].includes(mode)) throw new Error('AUTH_MODE must be local or production.');
  let url;
  try { url = new URL(env.CLIENT_URL || 'http://localhost:5173'); }
  catch { throw new Error('CLIENT_URL must be a valid HTTP(S) origin.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('CLIENT_URL must be an HTTP(S) origin without credentials or a path.');
  if (mode === 'production' && url.protocol !== 'https:') throw new Error('Production authentication requires HTTPS CLIENT_URL.');
  if (mode === 'local' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Local HTTP authentication is restricted to loopback frontend origins.');
  const proxyIp = env.TRUSTED_PROXY_IP?.trim() || undefined;
  if (proxyIp && (!require('node:net').isIP(proxyIp) || ['0.0.0.0', '::'].includes(proxyIp))) throw new Error('TRUSTED_PROXY_IP must be the exact IP of a controlled TLS reverse proxy.');
  return Object.freeze({ secret, origin: url.origin, secure: mode === 'production', proxyIp, issuer: 'campus-lost-found-api', audience: 'campus-lost-found-web', ttl: 900, cookieName: 'lf_session' });
}

function cookieOptions(config) {
  return { httpOnly: true, secure: config.secure, sameSite: 'strict', path: '/api' };
}
module.exports = { loadAuthConfig, cookieOptions };
