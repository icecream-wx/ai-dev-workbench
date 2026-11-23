// 查找树
export const searchTree = (value, arr, labelField) => {
  let newArr = [];
  arr.forEach(element => {
    if (element[labelField] && element[labelField].indexOf(value) > -1 || !value) { // 判断条件
      newArr.push({...element,expands: true});
    } else {
      if (element.children && element.children.length > 0) {
        let reData = searchTree(value, element.children, labelField);
        if (reData && reData.length > 0) {
          let obj = {
            ...element,
            expands: true,
            children: reData
          };
          newArr.push(obj);
        }
      }
    }
  })
  return newArr;
};
// 获取全路径
export const getAllPathByIdUtil = (curKey, treeData) => {
  var result = []
  let traverse = (curKey, path, data) => {
    // 树为空时，不执行函数
    if (data.length === 0) {
      return;
    }
    // 遍历存放树的数组
    for (let item of data) {
      // 遍历的数组元素存入path参数数组中
      path.push(item);
      // 如果目的节点的id值等于当前遍历元素的节点id值
      if (item.value === curKey || item.label === curKey) {
        // 把获取到的节点路径数组path赋值到result数组
        result = JSON.parse(JSON.stringify(path));
        return;
      }
      // 当前元素的children是数组
      const children = Array.isArray(item.children) ? item.children : [];
      // 递归遍历子数组内容
      traverse(curKey, path, children);
      // 利用回溯思想，当没有在当前叶树找到目的节点，依次删除存入到的path数组路径
      path.pop();
    }
  };
  if (curKey) {
    traverse(curKey, [], treeData);
  }
  return result
}
// 获取兄弟节点
export const getBrothersByIdUtil = (id, treeData) => {
  function getChildren(id2, data) {
    var hasFound = false, // 表示是否有找到id值
      result = null,
      before, after;
    var fn = function (id2, data) {
      if (Array.isArray(data) && !hasFound) { // 判断是否是数组并且没有的情况下，
        data.forEach((item, index) => {
          if (item.value === id2 || item.label === id2) { // 数据循环每个子项，并且判断子项下边是否有id值
            before = data[index - 1];
            result = item; // 返回的结果等于每一项
            after = data[index + 1];
            hasFound = true; // 并且找到id值
          }
          else if (item.children) {
            fn(id2, item.children); // 递归调用下边的子项
          }
        })
      }
    }
    fn(id2, data); // 调用一下
    return {
      before,
      after,
      current: result
    };
  }
  const res = getChildren(id, treeData)
  return res;
}