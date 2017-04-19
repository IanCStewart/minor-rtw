const express = require('express');

const port = process.env.PORT || '3000';
const host = process.env.HOST || '0.0.0.0';
const app = express();

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
    res.render('pages/index');
  }
});

app.get('/player', (req, res) => res.send('Welcome to the player'));

app.listen(port, host, () => {
  console.log(`Server running ${host}:${port}`); // eslint-disable-line no-console
});

module.exports = app;
