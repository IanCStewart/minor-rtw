import React from 'react';
import PropTypes from 'prop-types';
import Html from '../components/html';

function Player({ user }) {
  const style = {
    backgroundImage: `url(${user.images[0].url})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    width: '50px',
    height: '50px'
  };

  return (
    <Html>
      <header><h1>Spoofy Party Player</h1></header>
      <main>
        <div style={style} />
        <h1>{user.display_name}</h1>
      </main>
    </Html>
  );
}

Player.propTypes = {
  user: PropTypes.instanceOf(Object).isRequired
};

export default Player;
