import { init } from '@rematch/core';
import { routerReducer } from 'react-router-redux';
import { routerMiddleware } from 'react-router-redux';
import createLoadingPlugin from '@rematch/loading';
const options = {}
const loading = createLoadingPlugin(options)

const store = init({
  models: <%= RegisterModels %>,
  redux: {
    reducers: {
      router: routerReducer
    },
    middlewares:[routerMiddleware(window.g_history)],
  },
  plugins: [
    ...<%= RegisterPlugins %>,
    loading,
  ],
  // <%= ExtendRematchConfig %>
})

window.g_store = store
