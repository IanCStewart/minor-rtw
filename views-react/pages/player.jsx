import React from 'react';
import PropTypes from 'prop-types';
import Html from '../components/html';

function Player({ playing }) {
  const style = {
    backgroundImage: `url(${playing.item.album.images[0].url})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    width: '75px',
    height: '75px'
  };

  return (
    <Html>
      <header><h1>Spoofy Party Player</h1></header>
      <main>
        <section>
          <h1>Currently playing</h1>
          <div>
            <div style={style} />
            <span>{playing.item.name} - {playing.item.album.artists[0].name}</span>
          </div>
        </section>
      </main>
    </Html>
  );
}

Player.propTypes = {
  playing: PropTypes.instanceOf(Object).isRequired
};

export default Player;
