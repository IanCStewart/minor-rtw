const express = require('express');
const fetch = require('node-fetch');
const debugHttp = require('debug-http');
const cookieParser = require('cookie-parser');

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

app.use(cookieParser());

app.use(express.static('public', { maxAge: '31d' }))
  .set('views', 'views')
  .set('view engine', 'jsx')
  .engine('jsx', require('express-react-views').createEngine());

app.get('/', (req, res) => {
  if (req.cookies.spoofyAccessToken) {
    // User has auth redirect to main screen
    res.redirect('/player');
  } else {
    // No auth yet render index with sing in button
    res.render(
      'pages/index',
      { loginLink: `https://accounts.spotify.com/authorize?response_type=code&client_id=${clientId}&scope=user-read-playback-state user-read-private user-read-email&redirect_uri=http://localhost:3000/callback&show_dialog=true` }
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
      res.cookie('spoofyAccessToken', body.access_token);
      res.cookie('spoofyRefreshToken', body.refresh_token);
      res.redirect('/player');
    });
  }
});

app.get('/player', (req, res) => {
  fetch(
    'https://api.spotify.com/v1/me',
    {
      headers: {
        Authorization: `Bearer ${req.cookies.spoofyAccessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })
    .then(data => data.json())
    .then((body) => {
      if (body.error && body.error.message === 'The access token expired') {
        res.redirect(`/refresh?redirect=${req.url}`);
      }

      res.render('pages/player', { user: body });
    })
    .catch(err => new Error(err));
});

app.get('/refresh', (req, res) => {
  fetch(
    `https://accounts.spotify.com/api/token?grant_type=refresh_token&refresh_token=${req.cookies.spoofyRefreshToken}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${new Buffer(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  ).then(data => data.json())
  .then((token) => {
    res.cookie('spoofyAccessToken', token.access_token);
    res.redirect(req.query.redirect);
  })
  .catch(err => res.send(err));
});

app.listen(port, host, () => {
  console.log(`Server running ${host}:${port}`); // eslint-disable-line no-console
});

module.exports = app;
