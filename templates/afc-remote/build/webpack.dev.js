const { merge } = require('webpack-merge');
const path = require('path');
const webpack = require('webpack');
const webpackBaseConfig = require('./webpack.config.js');
const { getLocalIP } = require('./utils.js');
const config = require('../setting.json');

const appName = config['app.name'];
const port = process.env.PORT || config['webpack.dev.port'] || 4002;
const devHostname = config['webpack.dev.hostname'] || getLocalIP();

const HMR_NOOP = '{createRecord:function(){},rerender:function(){},reload:function(){}}';

module.exports = merge(webpackBaseConfig, {
  mode: 'development',
  devtool: 'source-map',
  devServer: {
    host: '0.0.0.0',
    port,
    hot: 'only',
    historyApiFallback: {
      index: `/${appName}/index.html`,
      rewrites: [{ from: /^\/$/, to: `/${appName}/index.html` }],
    },
    static: {
      directory: path.resolve(__dirname, '..', 'public'),
      publicPath: `/${appName}/`,
    },
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
    client: {
      logging: 'warn',
      overlay: false,
      webSocketURL: {
        hostname: devHostname,
        port: port + '',
      },
    },
  },
  output: {
    publicPath: `http://${devHostname}:${port}/${appName}/`,
  },
  plugins: [
    new webpack.DefinePlugin({
      __VUE_HMR_RUNTIME__: `(window.__VUE_HMR_RUNTIME__ || ${HMR_NOOP})`,
    }),
  ],
});
