const express = require('express');
const fetch = require('node-fetch');
const debugHttp = require('debug-http');

require('dotenv').config();

const port = process.env.PORT || '3000';
const host = process.env.HOST || '0.0.0.0';
const app = express();
debugHttp();

const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;

if (!clientId || !clientSecret) {
  throw new Error('Missing a `KEY` in .env');
}

app.use(express.static('public', { maxAge: '31d' }))
  .set('views', 'views')
  .set('view engine', 'jsx')
  .engine('jsx', require('express-react-views').createEngine());

app.get('/', (req, res) => {
  if (req.app.accesToken) {
    // User has auth redirect to main screen
    res.redirect('/player');
  } else {
    // No auth yet render index with sing in button
    res.render(
      'pages/index',
      { loginLink: `https://accounts.spotify.com/authorize?response_type=code&client_id=${clientId}&scope=user-read-playback-state&redirect_uri=http://localhost:3000/callback&show_dialog=true` }
    );
  }
});

app.get('/callback', (req, res) => {
  if (req.query.error) {
    // Acces error on spotify's side?
    throw new Error(req.query.error);
  } else if (!req.query.code) {
    // Empty code. Redirect home
    res.redirect('/');
  } else {
    // Everything seems fine. Let's move on.
    fetch(`https://accounts.spotify.com/api/token?grant_type=authorization_code&code=${req.query.code}&redirect_uri=http://localhost:3000/callback`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${new Buffer(`${clientId}:${clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    )
    .then(data => data.json())
    .then((body) => {
      req.app.accesToken = body.acces_token;
      req.app.refreshToken = body.refresh_token;
      res.redirect('/player');
    });
  }
});

app.get('/player', (req, res) => res.send('Welcome to the player'));

app.listen(port, host, () => {
  console.log(`Server running ${host}:${port}`); // eslint-disable-line no-console
});

module.exports = app;
