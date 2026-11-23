const os = require('os');

/** 本机非回环 IPv4 地址；没有时回退 localhost（与宿主调试同网段时使用） */
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal && iface.address) return iface.address;
    }
  }
  return 'localhost';
}

module.exports = { getLocalIP };
