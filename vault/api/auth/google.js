'use strict';
const { OAuth2Client } = require('google-auth-library');

module.exports = (req, res) => {
  const base = process.env.BASE_URL || `https://${req.headers.host}`;
  const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${base}/api/auth/callback`
  );
  const url = client.generateAuthUrl({
    access_type: 'online',
    scope: ['email', 'profile'],
    hd: 'msplaunchpad.com',
    prompt: 'select_account',
  });
  res.redirect(url);
};
