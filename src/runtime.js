import React from 'react';

export function rootContainer(container) {
  const RematchContainer = require('@tmp/RematchContainer').default;
  return React.createElement(RematchContainer, null, container);
}
