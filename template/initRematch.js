import { init } from '@rematch/core';
import createLoadingPlugin from '@rematch/loading';
const options = {}
const loading = createLoadingPlugin(options)

const store = init({
  models: <%= RegisterModels %>,
  // plugins: [
  //   ...<%= RegisterPlugins %>,
  //   loading,
  // ],
  // <%= ExtendRematchConfig %>
})

window.g_store = store
