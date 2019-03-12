import React from 'react';
import { Provider } from 'react-redux';

export default class RematchProvider extends React.Component {
  render() {
    return <Provider store={window.g_store}>{this.props.children}</Provider>;
  }
}
