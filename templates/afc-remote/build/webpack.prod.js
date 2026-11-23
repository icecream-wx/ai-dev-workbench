const { merge } = require('webpack-merge');
const webpackBaseConfig = require('./webpack.config.js');

module.exports = merge(webpackBaseConfig, {
  mode: 'production',
  devtool: false,
  optimization: {
    splitChunks: {
      chunks: 'all',
      minChunks: 2,
    },
  },
  output: {
    clean: true,
  },
});
