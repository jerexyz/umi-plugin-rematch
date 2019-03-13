// ref: https://umijs.org/config/
export default {
  treeShaking: true,
  plugins: [
    // ref: https://umijs.org/plugin/umi-plugin-react.html
    [
      'umi-plugin-react',
      {
        antd: false,
        dva: false,
        dynamicImport: { webpackChunkName: true },
        title: 'demo',
        dll: true,
        locale: {
          enable: true,
          default: 'en-US',
        },
        routes: {
          exclude: [/components\//,/models?\/?/,],
        },
      },
    ],
    ['@jerexyz/umi-plugin-rematch', { immer: true }],
  ],
};
