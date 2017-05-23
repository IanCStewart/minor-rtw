const express = require('express');
const http = require('http');
const socket = require('socket.io');
const fetch = require('node-fetch');
const debugHttp = require('debug-http');
const cookieParser = require('cookie-parser');
const JsonDB = require('node-json-db');
const bodyParser = require('body-parser');
const findIndex = require('lodash/findIndex');
const spotify = require('./modules/spotify');

require('dotenv').config();

const port = process.env.PORT || '3000';
const host = process.env.HOST || '0.0.0.0';
const app = express();

const server = http.Server(app);
const io = socket(server);
const nsp = io.of('/playlist');

nsp.on('connection', (client) => {
  client.on('room', (room) => {
    client.join(room);
    console.log('client joined room', room);

    client.on('disconnect', () => {
      client.leave(room);
      console.log('client leaved room', room);
    });
  });
});

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
      { loginLink: `https://accounts.spotify.com/authorize?response_type=code&client_id=${clientId}&scope=playlist-modify-private playlist-modify-public&redirect_uri=http://localhost:3000/callback&show_dialog=true` }
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
    spotify.callback(req, res)
      .then(() => res.redirect('/home'))
      .catch(err => res.render('pages/500', { err: err.message }));
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
  fetch(
    'https://api.spotify.com/v1/users/1172537089/playlists',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${req.cookies.spoofyAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: `${req.body.playlist || req.query.name}`,
        public: false,
        collaborative: true
      })
    })
    .then(data => data.json())
    .then((body) => {
      if (body.error && body.error.message === 'The access token expired') {
        res.redirect(`/refresh?redirect=${req.url}`);
      } else {
        db.push('/playlists[]', { id: body.id, name: body.name, images: body.images, ownerId: body.owner.id, tracks: body.tracks.items }, true);
      }

      res.redirect('/home');
    })
    .catch(err => res.send(err));
});

app.get('/playlist/:userId/:playlistId', (req, res) => {
  const allPlaylists = db.getData('/playlists');
  const index = findIndex(allPlaylists, playlist => playlist.id === req.params.playlistId);

  fetch(`https://api.spotify.com/v1/users/${req.params.userId}`)
    .then(data => data.json())
    .then(body => res.render('pages/playlist', { playlist: allPlaylists[index], owner: body.display_name || body.id }))
    .catch(err => res.send(err));
});

app.get('/add-song/:userId/:playlistId', (req, res) => {
  const allPlaylists = db.getData('/playlists');
  const index = findIndex(allPlaylists, playlist => playlist.id === req.params.playlistId);

  res.render('pages/add-song', { playlistName: allPlaylists[index].name, playlistId: req.params.playlistId, userId: req.params.userId });
});

app.post('/add-song/:userId/:playlistId', (req, res) => {
  const allPlaylists = db.getData('/playlists');
  const index = findIndex(allPlaylists, playlist => playlist.id === req.params.playlistId);

  fetch(
    `https://api.spotify.com/v1/users/${req.params.userId}/playlists/${req.params.playlistId}/tracks`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${req.cookies.spoofyAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        uris: [req.body.uri]
      })
    })
    .then(data => data.json())
    .then((body) => {
      if (body.error && body.error.message === 'The access token expired') {
        res.redirect(`/refresh?redirect=${req.url}`);
      }

      fetch(
        `https://api.spotify.com/v1/users/${req.params.userId}/playlists/${req.params.playlistId}?fields=tracks.items(added_at,track(name,artists)),images`,
        {
          headers: {
            Authorization: `Bearer ${req.cookies.spoofyAccessToken}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }).then(response => response.json())
        .then((tracks) => {
          if (tracks.error && tracks.error.message === 'The access token expired') {
            res.redirect(`/refresh?redirect=${req.url}`);
          } else {
            allPlaylists[index].tracks = tracks.tracks.items;
            allPlaylists[index].images = tracks.images;
            db.push('/playlists', allPlaylists, true);
            nsp.to(`${req.params.playlistId}`).emit('track', tracks);
          }

          res.redirect(`/playlist/${req.params.userId}/${req.params.playlistId}`);
        })
        .catch(err => res.send(err));
    })
    .catch(err => res.send(err));
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
    res.redirect(307, req.query.redirect);
  })
  .catch(err => res.send(err));
});

server.listen(port, host, () => {
  console.log(`Server running ${host}:${port}`); // eslint-disable-line no-console
});

module.exports = app;
