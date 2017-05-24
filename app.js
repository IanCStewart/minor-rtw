const express = require('express');
const http = require('http');
const socket = require('socket.io');
const debugHttp = require('debug-http');
const cookieParser = require('cookie-parser');
const JsonDB = require('node-json-db');
const bodyParser = require('body-parser');
const findIndex = require('lodash/findIndex');
const spotify = require('./modules/spotify');
const cookie = require('cookie');

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

const server = http.Server(app);
const io = socket(server);
const nspPlaylist = io.of('/playlist');
const nspHome = io.of('/home');

nspHome.on('connection', (client) => {
  client.on('disconnect', () => {
    const user = cookie.parse(client.handshake.headers.cookie).spoofyUserId;
    const disconected = db.getData('/disconected');
    const index = findIndex(disconected, disconnect => disconnect.id === user);

    if (index === -1) {
      db.push('/disconected[]', { id: user, missed: 0 }, true);
    }
  });
});

nspPlaylist.on('connection', (client) => {
  client.on('room', (room) => {
    client.join(room);

    client.on('disconnect', () => {
      client.leave(room);
    });
  });
});

app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(express.static('src', { maxAge: '31d' }))
  .set('views', 'views')
  .set('view engine', 'ejs');

app.get('/', (req, res) => {
  if (req.cookies.spoofyAccessToken && req.cookies.spoofyRefreshToken && req.cookies.spoofyUserId) {
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
      .then(token => spotify.getCurrentUser(req, res, token))
      .then(() => res.redirect('/home'))
      .catch(err => res.render('pages/500', { err: err.message }));
  }
});

app.get('/home', (req, res) => {
  if (req.cookies.spoofyAccessToken && req.cookies.spoofyRefreshToken && req.cookies.spoofyUserId) {
    // User has auth render
    const disconected = db.getData('/disconected');
    const index = findIndex(disconected, disconnect => disconnect.id === req.cookies.spoofyUserId);
    let missed = null;
    if (index !== -1) {
      missed = disconected[index].missed;
      db.delete(`/disconected[${index}]`);
    }
    res.render('pages/home', { playlists: db.getData('/playlists'), missed });
  } else {
    // No auth yet render login
    res.redirect('/');
  }
});

app.get('/add-playlist', (req, res) => {
  if (req.cookies.spoofyAccessToken && req.cookies.spoofyRefreshToken && req.cookies.spoofyUserId) {
    // User has auth render
    res.render('pages/add-playlist');
  } else {
    // No auth yet render login
    res.redirect('/');
  }
});

function saveNewPlaylist(data) {
  db.push('/playlists[]', { id: data.id, name: data.name, images: data.images, ownerId: data.owner.id, tracks: data.tracks.items }, true);
  return data;
}

app.post('/add-playlist', (req, res) => {
  spotify.addNewPlaylist(req)
    .then(body => saveNewPlaylist(body))
    .then((body) => {
      nspHome.emit('playlist', body);
      res.redirect('/home');
    })
    .catch(() => spotify.refresh()
      .then(token => spotify.addNewPlaylist(req, token))
      .then(body => saveNewPlaylist(body))
      .then((body) => {
        nspHome.emit('playlist', body);
        res.redirect('/home');
      })
      .catch(err => res.send(err.message))
    );
});

app.get('/playlist/:userId/:playlistId', (req, res) => {
  if (req.cookies.spoofyAccessToken && req.cookies.spoofyRefreshToken && req.cookies.spoofyUserId) {
    // User has auth render
    const allPlaylists = db.getData('/playlists');
    const index = findIndex(allPlaylists, playlist => playlist.id === req.params.playlistId);

    spotify.getUser(req)
    .then(body => res.render('pages/playlist', { playlist: allPlaylists[index], owner: body.display_name || body.id }))
    .catch(err => res.render('pages/500', { err: err.message }));
  } else {
    // No auth yet render login
    res.redirect('/');
  }
});

app.get('/add-song/:userId/:playlistId', (req, res) => {
  if (req.cookies.spoofyAccessToken && req.cookies.spoofyRefreshToken && req.cookies.spoofyUserId) {
    // User has auth render
    const allPlaylists = db.getData('/playlists');
    const index = findIndex(allPlaylists, playlist => playlist.id === req.params.playlistId);

    res.render('pages/add-song', { playlistName: allPlaylists[index].name, playlistId: req.params.playlistId, userId: req.params.userId });
  } else {
    // No auth yet render login
    res.redirect('/');
  }
});

function savePlaylist(req, data) {
  const allPlaylists = db.getData('/playlists');
  const index = findIndex(allPlaylists, playlist => playlist.id === req.params.playlistId);
  allPlaylists[index].tracks = data.tracks.items;
  allPlaylists[index].images = data.images;
  db.push('/playlists', allPlaylists, true);
  return data;
}

function addMissedToDisconected(req) {
  const disconected = db.getData('/disconected');
  disconected.forEach((disconnect) => {
    if (disconnect.id !== req.cookies.spoofyUserId) {
      disconnect.missed += 1; // eslint-disable-line no-param-reassign
    }
  });
  db.push('/disconected', disconected, true);
}

app.post('/add-song/:userId/:playlistId', (req, res) => {
  spotify.addTrackToPlaylist(req)
    .then(() => spotify.getPlaylistData(req))
    .then(body => savePlaylist(req, body))
    .then((body) => {
      nspPlaylist.to(`${req.params.playlistId}`).emit('track', body);
      addMissedToDisconected(req);
      res.redirect(`/playlist/${req.params.userId}/${req.params.playlistId}`);
    })
    .catch(() => spotify.refresh(req, res)
      .then(token => spotify.addTrackToPlaylist(req, token))
      .then(token => spotify.getPlaylistData(req, token))
      .then(body => savePlaylist(req, body))
      .then((body) => {
        nspPlaylist.to(`${req.params.playlistId}`).emit('track', body);
        res.redirect(`/playlist/${req.params.userId}/${req.params.playlistId}`);
      })
      .catch(err => res.render('pages/500', { err: err.message }))
    );
});

server.listen(port, host, () => {
  console.log(`Server running ${host}:${port}`); // eslint-disable-line no-console
});

module.exports = app;
