//  获取地址栏参数
export function getUrlParam(name, url) {
  let u = arguments[1] || window.location.href,
         reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)"),
        r = u.substr(u.indexOf("?") + 1).match(reg);
    const result = r != null ? decodeURI(r[2]) : "";
    if(result && result.split('#/').length) {
      return result.split('#/')[0]
    } else {
      return result
    }
}