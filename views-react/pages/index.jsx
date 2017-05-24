import React from 'react';
import PropTypes from 'prop-types';
import Html from '../components/html';

function Index({ loginLink }) {
  return (
    <Html>
      <header><h1>Spoofy Party Player</h1></header>
      <main>
        <h2>Please login to spotify</h2>
        <a href={loginLink}>Login</a>
      </main>
    </Html>
  );
}

Index.propTypes = {
  loginLink: PropTypes.string.isRequired
};

export default Index;
