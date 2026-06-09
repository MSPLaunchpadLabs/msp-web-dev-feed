'use strict';

module.exports = (req, res) => {
  res.setHeader('Set-Cookie', 'token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
  res.redirect('/login');
};
