const getLinkNodeByItem = (node, staticList) => {
  if(!node) {
    return []
  }
  let list = []
  let findItem = staticList.find((item)=>{
    if(item.hasOwnProperty('customId')) {
      return item && node && item.customId === node.customId
    } else {
      return item && node && item.id === node.id
    }
  })
  findItem = findItem ? findItem : staticList.find((item)=>{
      return item && item.id === node.id
  })
  while(findItem) {
    list.push(findItem)
    const { customParentId, parentId } = findItem
    findItem = staticList.find((item)=>{
      if(item.hasOwnProperty('customId')) {
        return item && item.customId === customParentId && item.customId !== item.customParentId
      } else {
        return item && item.id === parentId
      }
    })
  }
  return list.reverse()
}

const getLinkNodeByList = (nodes, staticList) => {
  const result = nodes.map((node)=>getLinkNodeByItem(node, staticList))
  return result
}

// 获取链路节点
export const getLinkNode = (data, staticList)=> {
  if(!staticList.length) {
    return data;
  }
  if (Array.isArray(data)) {
    return getLinkNodeByList(data, staticList)
  }
  return getLinkNodeByItem(data, staticList)
}

export const transNodes = (data, setting)=> {
  if(!data) {
    return null
  }
  const { labelField, isAllMode, separator, staticList, isEntityData, isKeepName } = setting
  if(!isAllMode) {
    return data
  }
  const nodeList = getLinkNode(data, staticList)
  if(Array.isArray(data)) {
    const result = nodeList.map((nodes)=>{
      if(Array.isArray(nodes)) {
        if(isKeepName) {
          const lastNode = nodes.length && nodes[nodes.length - 1]
          return lastNode && lastNode[lastNode.customLabel] || lastNode.label || ''
        }
        const label = nodes.map((node)=>{
          return node.hasOwnProperty('customLabel') && node[node.customLabel] || node.label
        }).join(separator)
        return label
      }
    })
    return data.map((ele, index)=>{
      if(isAllMode && result.length) {
        return {
          ...ele,
          [labelField]: result[index]
        }
      } else {
        return {
          ...ele,
        }
      }
      
    })
  } else {
    let  label = Array.isArray(nodeList) && nodeList.map((node)=>{
      return node.hasOwnProperty('customLabel') && node[node.customLabel] || node.label
    }).join(separator)
    if(isKeepName) {
      label = nodeList.length && nodeList[nodeList.length - 1].label || ''
    }
    if(isAllMode && Array.isArray(nodeList) && nodeList.length) {
      return {
        ...data,
        [labelField]: label,
      }
    } else {
      return {
        ...data,
      }
    }
  }
}
export const transCasNode = (data, setting) => {
  if(!data) {
    return null
  }
  const { multiple, labelField, valueField, isAllMode, separator, staticList, isEntityData } = setting
  const nodeList = getLinkNode(data, staticList)
  const valueList = nodeList.map((item)=>{
    if(Array.isArray(item)) {
      return item.map((ele)=>ele[valueField])
    } else {
      return item[valueField]
    }
  })
  return multiple ? valueList : valueList[0]
}


