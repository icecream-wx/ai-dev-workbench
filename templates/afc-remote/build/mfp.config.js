/**
 * Module Federation（remote）配置
 *
 * - name 来自 setting.json 的 app.name（工作台创建应用时写入应用 ID）；
 * - 只暴露最小入口 ./index（src/views/AppIndex.vue）；开发新增页面后按需追加 exposes；
 * - vue / vue-router / element-plus 走 singleton 共享，避免宿主与子应用各带一份；
 * - pm-*（primeton-form-components-v3）由 AFCenter 宿主全局提供，不在此打包。
 */
const devMode = process.env.NODE_ENV === 'development';
const { getLocalIP } = require('./utils.js');
const setting = require('../setting.json');
const port = setting['afcenter.client.port'] || 3002;
const host = setting['afcenter.client.hostname'] || getLocalIP();
const appName = setting['app.name'];

module.exports = {
  name: appName,
  filename: 'remoteEntry.js',
  exposes: {
    './index': './src/views/AppIndex.vue',
  },
  shared: {
    vue: { singleton: true, requiredVersion: '^3.4.0' },
    'vue-router': { singleton: true, requiredVersion: '^4.3.0' },
    'element-plus': { singleton: true, requiredVersion: '^2.6.0' },
  },
  remotes: {
    // 宿主基座（提供登录态/菜单/pm-* 全局组件）；dev 指向本机 AFCenter 服务
    base: devMode ? `base@http://${host}:${port}/remoteEntry.js` : 'base@../remoteEntry.js',
  },
};
