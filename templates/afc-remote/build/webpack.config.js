const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { VueLoaderPlugin } = require('vue-loader');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');
const { ModuleFederationPlugin } = require('webpack').container;
const mfpConfig = require('./mfp.config.js');

const devMode = process.env.NODE_ENV !== 'production';
const config = require('../setting.json');
const appName = config['app.name'];
const resolve = dir => path.resolve(__dirname, '..', dir);

function getEntry() {
  if (devMode) return './src/main.js';
  return ['core-js/stable', 'regenerator-runtime/runtime', './src/main.js'];
}

module.exports = {
  entry: getEntry(),
  output: {
    path: resolve(`dist/${appName}/assets`),
    publicPath: 'auto',
    filename: 'js/[name].[chunkhash:5].js',
    chunkFilename: 'js/[name].[chunkhash:5].js',
  },
  resolve: {
    alias: {
      '@': resolve('src'),
      '@static': resolve('static'),
      vue$: 'vue/dist/vue.esm-bundler.js',
    },
    extensions: ['.js', '.vue', '.json'],
    fallback: {
      path: require.resolve('path-browserify'),
      https: require.resolve('https-browserify'),
      http: require.resolve('stream-http'),
      crypto: require.resolve('crypto-browserify'),
      buffer: require.resolve('buffer'),
      stream: require.resolve('stream-browserify'),
      timers: require.resolve('timers-browserify'),
    },
  },
  module: {
    rules: [
      {
        test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
        use: [{ loader: 'url-loader', options: { limit: 10000, name: 'images/[name].[hash:5].[ext]' } }],
      },
      {
        test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
        use: [{ loader: 'url-loader', options: { limit: 10000, name: 'fonts/[name].[hash:5].[ext]' } }],
      },
      {
        test: /\.vue$/,
        loader: 'vue-loader',
      },
      {
        test: /\.(sa|sc|c)ss$/,
        use: [
          devMode ? 'style-loader' : MiniCssExtractPlugin.loader,
          'css-loader',
          'postcss-loader',
          { loader: 'sass-loader', options: { implementation: require('sass') } },
        ],
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: { cacheDirectory: true },
        },
      },
    ],
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),
    new HtmlWebpackPlugin({
      template: resolve('public/index_app.html'),
      filename: devMode ? 'index.html' : '../index.html',
      inject: true,
      chunksSortMode: 'none',
    }),
    new VueLoaderPlugin(),
    new MiniCssExtractPlugin({
      filename: devMode ? 'css/[name].css' : 'css/[name].[contenthash:5].css',
      chunkFilename: devMode ? 'css/[id].css' : 'css/[id].[contenthash:5].css',
    }),
    new CopyPlugin({
      patterns: [
        {
          from: resolve('static'),
          to: resolve(`dist/${appName}/assets/static`),
          noErrorOnMissing: true,
          globOptions: { dot: true },
        },
      ],
    }),
    new ModuleFederationPlugin(mfpConfig),
  ],
};
