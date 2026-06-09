'use strict';
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect('/login');

  const base = process.env.BASE_URL || `https://${req.headers.host}`;
  const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${base}/api/auth/callback`
  );

  try {
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload.email || '';
    if (!email.endsWith('@msplaunchpad.com')) {
      return res.status(403).send('Access restricted to @msplaunchpad.com accounts.');
    }
    const token = jwt.sign(
      { email, name: payload.name },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.setHeader('Set-Cookie', `token=${token}; HttpOnly; SameSite=Lax; Path=/${process.env.VERCEL ? '; Secure' : ''}`);
    res.setHeader('Content-Type', 'text/html');
    res.end(`<!DOCTYPE html><html><head><script>sessionStorage.setItem('auth','1');window.location.href='/';</script></head></html>`);
  } catch (err) {
    console.error('Auth error:', err);
    res.redirect('/login');
  }
};
