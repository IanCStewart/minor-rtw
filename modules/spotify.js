const fetch = require('node-fetch');

require('dotenv').config();

const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;

const spotify = {};

spotify.callback = (req, res) => new Promise((resolve, reject) => {
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
    resolve();
  })
  .catch(err => reject(err));
});

spotify.getUser = req => new Promise((resolve, reject) => {
  fetch(`https://api.spotify.com/v1/users/${req.params.userId}`)
    .then(data => data.json())
    .then(body => resolve(body))
    .catch(err => reject(err));
});

module.exports = spotify;
