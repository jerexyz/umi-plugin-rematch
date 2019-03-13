import { readFileSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import globby from 'globby';
import uniq from 'lodash.uniq';
import isRoot from 'path-is-root';
import { chunkName, findJS, optsToArray, endWithSlash } from 'umi-utils';

export function getModel(cwd, api) {
  const { config, winPath } = api;

  const modelJSPath = findJS(cwd, 'model');
  if (modelJSPath) {
    return [winPath(modelJSPath)];
  }

  return globby
    .sync(`./${config.singular ? 'model' : 'models'}/**/*.{ts,tsx,js,jsx}`, {
      cwd,
    })
    .filter(
      p =>
        !p.endsWith('.d.ts') &&
        !p.endsWith('.test.js') &&
        !p.endsWith('.test.jsx') &&
        !p.endsWith('.test.ts') &&
        !p.endsWith('.test.tsx')
    )
    .map(p => api.winPath(join(cwd, p)));
}

function getModelsWithRoutes(routes, api) {
  const { paths } = api;
  return routes.reduce((memo, route) => {
    return [
      ...memo,
      ...(route.component && route.component.indexOf('() =>') !== 0
        ? getPageModels(join(paths.cwd, route.component), api)
        : []),
      ...(route.routes ? getModelsWithRoutes(route.routes, api) : []),
    ];
  }, []);
}

function getPageModels(cwd, api) {
  let models = [];
  while (!isSrcPath(cwd, api) && !isRoot(cwd)) {
    models = models.concat(getModel(cwd, api));
    cwd = dirname(cwd);
  }
  return models;
}

function isSrcPath(path, api) {
  const { paths, winPath } = api;
  return endWithSlash(winPath(path)) === endWithSlash(winPath(paths.absSrcPath));
}

export function getGlobalModels(api, shouldImportDynamic) {
  const { paths, routes } = api;
  let models = getModel(paths.absSrcPath, api);
  if (!shouldImportDynamic) {
    // 不做按需加载时，还需要额外载入 page 路由的 models 文件
    models = [...models, ...getModelsWithRoutes(routes, api)];
    // 去重
    models = uniq(models);
  }
  return models;
}

export default function(api, opts = {}) {
  const { paths, cwd, compatDirname, winPath } = api;
  const isDev = process.env.NODE_ENV === 'development';
  const shouldImportDynamic = opts.dynamicImport;

  function getRematchJS() {
    const RematchJS = findJS(paths.absSrcPath, 'rematch');
    if (RematchJS) {
      return winPath(RematchJS);
    }
  }

  function getModelName(model) {
    const modelArr = winPath(model).split('/');
    return modelArr[modelArr.length - 1];
  }

  function exclude(models, excludes) {
    return models.filter(model => {
      for (const exclude of excludes) {
        if (typeof exclude === 'function' && exclude(getModelName(model))) {
          return false;
        }
        if (exclude instanceof RegExp && exclude.test(getModelName(model))) {
          return false;
        }
      }
      return true;
    });
  }

  function getGlobalModelContent() {
    const globalModels = exclude(
      getGlobalModels(api, shouldImportDynamic),
      optsToArray(opts.exclude)
    )
      .map(path =>
        `
    '${basename(path, extname(path))}': require('${path}').default
  `.trim()
      )
      .join(',\r\n');
    return `{${globalModels}}`;
  }

  function getPluginContent() {
    const pluginPaths = globby.sync('plugins/**/*.{js,ts}', {
      cwd: paths.absSrcPath,
    });
    const ret = pluginPaths.map(path =>
      `
        require('../../${path}').default;
  `.trim()
    );
    if (opts.immer) {
      ret.push(
        `
      new require('${winPath(require.resolve('@rematch/immer'))}').default()
      `.trim()
      );
    }
    return `[${ret.join(',')}]`;
  }

  function generateRematchContainer() {
    const tpl = join(__dirname, '../template/RematchContainer.js');
    const tplContent = readFileSync(tpl, 'utf-8');
    api.writeTmpFile('RematchContainer.js', tplContent);
  }

  function generateInitRematch() {
    const tpl = join(__dirname, '../template/initRematch.js');
    let tplContent = readFileSync(tpl, 'utf-8');
    const RematchJS = getRematchJS();
    if (RematchJS) {
      tplContent = tplContent.replace(
        '<%= ExtendRematchConfig %>',
        `
...((require('${RematchJS}').config || (() => ({})))()),
        `.trim()
      );
    }
    tplContent = tplContent
      .replace('<%= ExtendRematchConfig %>', '')
      .replace('<%= EnhanceApp %>', '')
      .replace('<%= RegisterPlugins %>', getPluginContent())
      .replace('<%= RegisterModels %>', getGlobalModelContent());
    api.writeTmpFile('initRematch.js', tplContent);
  }

  api.onGenerateFiles(() => {
    generateRematchContainer();
    generateInitRematch();
  });

  api.modifyRouterRootComponent(`require('react-router-redux').ConnectedRouter`);

  if (shouldImportDynamic) {
    api.addRouterImport({
      source: 'rematch/dynamic',
      specifier: '_rematchDynamic',
    });
  }

  if (shouldImportDynamic) {
    api.modifyRouteComponent((memo, args) => {
      const { importPath, webpackChunkName } = args;
      if (!webpackChunkName) {
        return memo;
      }

      let loadingOpts = '';
      if (opts.dynamicImport.loadingComponent) {
        loadingOpts = `LoadingComponent: require('${winPath(
          join(paths.absSrcPath, opts.dynamicImport.loadingComponent)
        )}').default,`;
      }

      let extendStr = '';
      if (opts.dynamicImport.webpackChunkName) {
        extendStr = `/* webpackChunkName: ^${webpackChunkName}^ */`;
      }
      let ret = `
_rematchDynamic({
  <%= MODELS %>
  component: () => import(${extendStr}'${importPath}'),
  ${loadingOpts}
})
      `.trim();
      const models = getPageModels(join(paths.absTmpDirPath, importPath), api);
      if (models && models.length) {
        ret = ret.replace(
          '<%= MODELS %>',
          `
app: window.g_app,
models: () => [
  ${models
    .map(
      model =>
        `import(${
          opts.dynamicImport.webpackChunkName
            ? `/* webpackChunkName: '${chunkName(paths.cwd, model)}' */`
            : ''
        }'${model}').then(m => { return { namespace: '${basename(
          model,
          extname(model)
        )}',...m.default}})`
    )
    .join(',\r\n')}
],
      `.trim()
        );
      }
      return ret.replace('<%= MODELS %>', '');
    });
  }

  const rematchDir = compatDirname(
    '@rematch/core/package.json',
    cwd,
    dirname(require.resolve('@rematch/core/package.json'))
  );

  api.addVersionInfo([
    `rematch@${require(join(rematchDir, 'package.json')).version} (${rematchDir})`,
    `rematch-loading@${require('@rematch/loading/package').version}`,
    `rematch-immer@${require('@rematch/immer/package').version}`,
    `path-to-regexp@${require('path-to-regexp/package').version}`,
  ]);

  api.modifyAFWebpackOpts(memo => {
    const alias = {
      ...memo.alias,
      rematch: rematchDir,
      'rematch-loading': require.resolve('@rematch/loading'),
      'path-to-regexp': require.resolve('path-to-regexp'),
      'object-assign': require.resolve('object-assign'),
      ...(opts.immer
        ? {
            immer: require.resolve('immer'),
          }
        : {}),
    };
    const extraBabelPlugins = [
      ...(memo.extraBabelPlugins || []),
    ];
    return {
      ...memo,
      alias,
      extraBabelPlugins,
    };
  });

  api.addPageWatcher([
    join(paths.absSrcPath, 'models'),
    join(paths.absSrcPath, 'plugins'),
    join(paths.absSrcPath, 'model.js'),
    join(paths.absSrcPath, 'model.jsx'),
    join(paths.absSrcPath, 'model.ts'),
    join(paths.absSrcPath, 'model.tsx'),
    join(paths.absSrcPath, 'rematch.js'),
    join(paths.absSrcPath, 'rematch.jsx'),
    join(paths.absSrcPath, 'rematch.ts'),
    join(paths.absSrcPath, 'rematch.tsx'),
  ]);

  api.registerGenerator('rematch:model', {
    Generator: require('./model').default(api),
    resolved: join(__dirname, './model'),
  });

  api.addRuntimePlugin(join(__dirname, './runtime'));
  api.addRuntimePluginKey('rematch');

  api.addEntryCodeAhead(
    `
require('@tmp/initRematch');
  `.trim()
  );
}
