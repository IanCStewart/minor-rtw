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
  spotify.addNewPlaylist(req)
    .then((body) => {
      db.push('/playlists[]', { id: body.id, name: body.name, images: body.images, ownerId: body.owner.id, tracks: body.tracks.items }, true);
      res.redirect('/home');
    })
    .catch(() => spotify.refresh()
      .then(() => spotify.addNewPlaylist(req))
      .then((body) => {
        db.push('/playlists[]', { id: body.id, name: body.name, images: body.images, ownerId: body.owner.id, tracks: body.tracks.items }, true);
        res.redirect('/home');
      })
      .catch(err => res.render('pages/500', { err: err.message }))
    );
});

app.get('/playlist/:userId/:playlistId', (req, res) => {
  const allPlaylists = db.getData('/playlists');
  const index = findIndex(allPlaylists, playlist => playlist.id === req.params.playlistId);

  spotify.getUser(req)
    .then(body => res.render('pages/playlist', { playlist: allPlaylists[index], owner: body.display_name || body.id }))
    .catch(err => res.render('pages/500', { err: err.message }));
});

app.get('/add-song/:userId/:playlistId', (req, res) => {
  const allPlaylists = db.getData('/playlists');
  const index = findIndex(allPlaylists, playlist => playlist.id === req.params.playlistId);

  res.render('pages/add-song', { playlistName: allPlaylists[index].name, playlistId: req.params.playlistId, userId: req.params.userId });
});

function savePlaylist(req, data) {
  const allPlaylists = db.getData('/playlists');
  const index = findIndex(allPlaylists, playlist => playlist.id === req.params.playlistId);
  allPlaylists[index].tracks = data.tracks.items;
  allPlaylists[index].images = data.images;
  db.push('/playlists', allPlaylists, true);
  return data;
}

app.post('/add-song/:userId/:playlistId', (req, res) => {
  spotify.addTrackToPlaylist(req)
    .then(() => spotify.getPlaylistData(req))
    .then(body => savePlaylist(req, body))
    .then((body) => {
      nsp.to(`${req.params.playlistId}`).emit('track', body);
      res.redirect(`/playlist/${req.params.userId}/${req.params.playlistId}`);
    })
    .catch(() => spotify.refresh(req, res)
      .then(token => spotify.addTrackToPlaylist(req, token))
      .then(() => spotify.getPlaylistData(req))
      .then(body => savePlaylist(req, body))
      .then((body) => {
        nsp.to(`${req.params.playlistId}`).emit('track', body);
        res.redirect(`/playlist/${req.params.userId}/${req.params.playlistId}`);
      })
      .catch(err => res.render('pages/500', { err: err.message }))
    );
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
