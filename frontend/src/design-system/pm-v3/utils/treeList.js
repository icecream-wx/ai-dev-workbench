export function listToTree(
  list,
  config = {
    parentId: 'parentId',
    id: 'id',
    children: 'children',
  }
) {
  return listToTree2(list, config)
}

export function listToTree2(
  list,
  config = {
    parentId: 'customParentId',
    id: 'customId',
    children: 'children',
    mode: ''
  }
) {
  const { id:idField, parentId: parentIdField, children: childrenField, mode} = config
  let res = []
  const map = list.reduce((res, v) =>(res[v[idField]] = v, res), {})
  const isRootRight = list.find((item)=>{
    if(item.hasOwnProperty('isRoot')) {
      return !!item.isRoot
    }
    return !item[parentIdField] || item[parentIdField] === '0'
  })
  if(!isRootRight) {
    let obj = {}
    for(let index = 0; index < list.length;index++) {
      const key = list[index][idField] + '_'
      const parentKey = list[index][parentIdField] + '_'
      obj[key] = list[index]
      if(obj[parentKey]) {
        delete  obj[key]
      }
    }
    res = Object.values(obj)
  }
  for (const item of list) {
    if (isRootRight && (!item.hasOwnProperty('isRoot') && (!item[parentIdField] || item[parentIdField] === '0') || item['isRoot'])) {
      res.push(item)
      continue
    }
    if (item[parentIdField] in map) {
      const parent = map[item[parentIdField]]
      parent.children = parent.children || []
      parent.children.push(item)
      if(mode === 'all') {
        parent.isLeaf = false
      }
    }
  }
  return res
}

export function treeToList(
  tree,
  res = [],
  config = {
    labelField: 'label',
    valueField: 'value',
    childrenField: 'children',
  },
  parentId = '',
  isRoot = true
) {
  if (!Array.isArray(tree) || !tree.length) {
    return []
  }
  const  { labelField, valueField, childrenField } = config
  tree.forEach(v => {
    if(v.hasOwnProperty(valueField) && v.hasOwnProperty(labelField)) {
      const isLeaf = !(v[config.childrenField] && v[config.childrenField].length)
      res.push({
        ...v,
        children: undefined,
        isLeaf,
        label: v[config.labelField],
        value: v[config.valueField],
        id: v.id ||  v[config.valueField],
        parentId,
        isRoot,
      })
    }
    if (v[config.childrenField] && v[config.childrenField].length) {
      treeToList(v[config.childrenField], res, config, v.id || v[config.valueField], false)
    }
  })
  return res
}

export const getTreeList = (root, allList) => {
  let list = [root]
  function getChildren(findItem, allList) {
    const result = allList.filter(item => item.parentId === findItem.id)
    if (result.length) {
      list = [...list, ...result]
      for (let index = 0; index < result.length; index++) {
        getChildren(result[index], allList)
      }
    }
  }
  getChildren(root, allList)
  return { list }
}

export function transListToLink(list) {
  const leafNodeList = list.filter((item)=>item.isLeaf)
  const getAncestorLink = (currentNode, list, result)=> {
    const { customParentId } = currentNode
    let parentNode = list.find((item)=>item['customId'] && item['customId'] === customParentId)
    if(parentNode) {
      result.push(parentNode)
      return getAncestorLink(parentNode, list, result)
    } else {
      return result.reverse()
    }
  }
  let result = []
  for(let index = 0; index < leafNodeList.length; index++) {
    const leafNode = leafNodeList[index]
    const res = getAncestorLink(leafNode, list, [leafNode])
    result.push(res)
  }
  return result
}
