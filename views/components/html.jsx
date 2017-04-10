import React from 'react';
import PropTypes from 'prop-types';

function Html({ children }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="/styles.css" rel="stylesheet" />
        <title>Minor || RTW</title>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}

Html.propTypes = {
  children: PropTypes.node.isRequired
};

export default Html;
