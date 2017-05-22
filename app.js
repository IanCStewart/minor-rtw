const express = require('express');
const fetch = require('node-fetch');
const debugHttp = require('debug-http');
const cookieParser = require('cookie-parser');
const JsonDB = require('node-json-db');
const bodyParser = require('body-parser');

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

const db = new JsonDB('spoofyDataBase', true, false);

app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(express.static('src', { maxAge: '31d' }))
  .set('views', 'views')
  .set('view engine', 'ejs');

app.get('/', (req, res) => {
  if (req.cookies.spoofyAccessToken) {
    // User has auth render home
    res.redirect('/home');
  } else {
    // No auth yet render login
    res.render(
      'pages/login',
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
      res.redirect('/home');
    });
  }
});

app.get('/home', (req, res) => {
  if (req.cookies.spoofyAccessToken) {
    // User has auth render
    res.render('pages/home', { playlists: db.getData('/playlists') });
  } else {
    // No auth yet render login
    res.redirect('/');
  }
});

app.get('/add-playlist', (req, res) => {
  if (req.cookies.spoofyAccessToken) {
    // User has auth render
    res.render('pages/add-playlist');
  } else {
    // No auth yet render login
    res.redirect('/');
  }
});

app.post('/add-playlist', (req, res) => {
  console.log(req.body);
  res.send(req.body);
});

app.get('/online', (req, res) => {
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

      res.render('pages/online', { user: body });
    })
    .catch(err => new Error(err));
});

app.get('/refresh', (req, res) => {
  // Refresh the accesToken
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
