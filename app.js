const express = require('express');

const port = process.env.PORT || '3000';
const host = process.env.HOST || '0.0.0.0';
const app = express();

app.use(express.static('public', { maxAge: '31d' }))
  .set('views', 'views')
  .set('view engine', 'jsx')
  .engine('jsx', require('express-react-views').createEngine());

app.get('/', (req, res) => res.render('pages/index'));

app.listen(port, host, () => {
  console.log(`Server running ${host}:${port}`); // eslint-disable-line no-console
});

module.exports = app;
