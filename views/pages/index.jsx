import React from 'react';
import Html from '../components/html';

function Index() {
  return (
    <Html>
      <header><h1>Spoofy Party Player</h1></header>
      <main>
        <h2>Please login to spotify</h2>
        <a href="/login">Login</a>
      </main>
    </Html>
  );
}

export default Index;
