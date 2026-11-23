import { localStore } from './sessionStore'
const findComponentUpward = (context, componentName = ["LowcodeForm",
  "lowcode_form",
  "lowcode_m_view",
  "lowcode_view",
  "LowcodeView",]) => {
  let parent = context.$parent
  let name = parent?.$options?.name
  while (parent && (!name || !componentName.some(cn => name.indexOf(cn) > -1))) {
    parent = parent.$parent
    if (parent) name = parent.$options?.name
  }
  return parent
}
const isJSON = (str) => {
  if (typeof str == 'string') {
    try {
      var obj = JSON.parse(str);
      if (typeof obj == 'object' && obj) {
        return true;
      } else {
        return false;
      }

    } catch (e) {
      return false;
    }
  }
}
const getBackgrouncolor = (color) =>{
  if(color){
    //设置透明度10%
    let  RGBAcolor = color 
    if(!color.startsWith('rgba')){
      if(color.startsWith('#')){
        RGBAcolor = hexToRGBA(color,1)
       }else if(color.startsWith('rgb')){
        RGBAcolor = color.replace('rgb', 'rgba').replace(')', `, 1)`);
       }
    }
    return RGBAcolor.replace('1)','0.15)')
  }else{
    //默认背景色颜色
    return '#f4f4f5'
  }
}

const getFontColor = (color) => {
  if(color){
    const res = calculateGrayscale(color)
    if(res && res > 217){
      return '#000'
    }else{
      return '#fff'
    }
  }else{
    //默认颜色
    return '#909399'
  }
}
const hexToRGBA = (hex, alpha=1) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const calculateGrayscale = (rgbaColor) =>{
// 提取 R、G、B 参数
var match = rgbaColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
if (match) {
  var r = parseInt(match[1], 10);
  var g = parseInt(match[2], 10);
  var b = parseInt(match[3], 10);
  // 计算灰度值
  var grayscale = (r * 0.299 + g * 0.587 + b * 0.114);
  return grayscale;
} else {
  return null;
}
}
const overflows = ['.vxe-table--body-wrapper']
const setParentOverflow = (value = true) => {
  overflows.forEach(tag => {
    const overflows = document.querySelectorAll(tag)
    overflows && overflows.forEach(item => {
       item.style.overflow = value ? 'auto' :'inherit'
      })
  })
}
/**
 * 获取url中的参数
 * @param {String} variable
 * @returns
 */
const getQueryVariable = (variable) => {
  let query = window.location.search
  let hash = window.location.hash
  let queryStr = query && query.includes(variable) ? query.substring(1) : (hash ?hash.split('?')[1] : '')
  if(!queryStr){
    return false
  }
  var vars = queryStr.split('&')
  for (var i = 0; i < vars.length; i++) {
    var pair = vars[i].split('=')
    if (pair[0] == variable) {
      return pair[1]
    }
  }
return false
}
const findAppName = (_this) => {
  if (!_this) return null
  if (['low-code-entry', 'remote-entry','lowcode'].includes(_this.$options?.name)) {
    return _this.appName
  } else if (_this.$parent) {
    return findAppName(_this.$parent)
  } else {
    return null
  }
}
//视图是否折行(折行时添加whiteSpaceNormal 样式)
const getIsLineWrap = (el) => {
  try {
    const vxeBodyColumnElement = el.parentElement?.parentElement?.parentElement
    if(vxeBodyColumnElement && vxeBodyColumnElement.classList?.contains('vxe-body--column')){
      // 元素是否有 'col--ellipsis' 类
      if (vxeBodyColumnElement.classList.contains('col--ellipsis')) {
        return false
      } else {
        return true
      }
    }else{
      return false
    }
  } catch (error) {
    console.error('getIsLineWrap出错',error)
  }
}
const findParentWithClass = (element, parentClass) => {
  let parent = element.parentElement;
  while (parent) {
    if (hasCommonElement(parent.classList,parentClass)) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}
const hasCommonElement = (arr1, arr2) => {
  for (let i = 0; i < arr1.length; i++) {
    if (arr2.includes(arr1[i])) {
      return true;
    }
  }
  return false;
}
function assembleChildrenConfig (data) {
  let result = {};
  if (!data) return {}
  data.forEach(item => {
    if (item.isShowChildrenContent && item.children && item.code !== "components") {
      const childrenConfig = {};
        item.children.forEach(child => {
          childrenConfig[child.code] = child.value;
        });
      result[item.code] = { ...result[item.code], ...childrenConfig };
    }
    if (item.children) {
      const childConfig = assembleChildrenConfig(item.children, item.code);
      result = { ...result, ...childConfig };
    }
  });
  return result;
}
function getLowCodePreferenceObject (that) {
  const appName = getQueryVariable('appName') || findAppName(that)
  const preferenceList = localStore.get(`${appName}__preference`)
  return assembleChildrenConfig(preferenceList)
}
function isEmpty(value) {
  // 1. 处理 null 和 undefined
  if (value == null) return true;

  // 2. 处理字符串（包括空白字符）
  if (typeof value === 'string') return value.trim() === '';

  // 3. 处理数组或类数组对象（如 arguments、NodeList）
  if (Array.isArray(value) || (typeof value === 'object' && typeof value.length === 'number')) {
    return value.length === 0;
  }

  // 4. 处理普通对象（不包含原型链上的属性）
  if (typeof value === 'object' && value.constructor === Object) {
    return Object.keys(value).length === 0;
  }

  // 5. 其他类型（数字、布尔值、函数等）视为非空
  return false;
}
function isLogicApp(_this, appName){
  return _this?.$store?.state?.lowcode?.appInfos?.[appName]?.types === 'logic' || localStore.get('appInfo')?.[appName]?.types === 'logic'
}
export {
  isJSON,
  findComponentUpward,
  getFontColor,
  getBackgrouncolor,
  setParentOverflow,
  findAppName,
  getQueryVariable,
  getIsLineWrap,
  findParentWithClass,
  getLowCodePreferenceObject,
  isEmpty,
  isLogicApp
}