/**
 * useEntity — 从 entity.js mixin 提取为 composable
 * 依赖 useCommon 提供的 dispatchProxy, Controllers, valueField, getValIsEmpty 等
 */
import { getCurrentInstance } from 'vue'
import { transListToLink, listToTree2 } from '../../utils/treeList'
import { cloneDeep } from 'lodash'

export function useEntity() {
  const instance = getCurrentInstance()
  const ctx = instance.proxy

  function getParentId(ele, parentField, nextItemChildField) {
    if (ele && ele[parentField] && typeof ele[parentField] === 'object') {
      return ele[parentField] && ele[parentField][nextItemChildField] || undefined
    }
    return ele && ele[parentField] || undefined
  }

  function transCustomEntityModel(arr, item, nextItem) {
    const { config, type, isLeaf } = item
    const { basic, menu } = config || {}
    const { menuData = [] } = menu || {}
    const { parentField, childField, displayField } = basic
    const { type: nextItemType, config: nextItemConfig } = nextItem || {}
    const { basic: nextItemBasic } = nextItemConfig || {}
    const { childField: nextItemChildField } = nextItemBasic || {}

    return arr.map(ele => {
      const customId = type + '_' + ele[childField]
      const parentId = getParentId(ele, parentField, nextItemChildField)
      const customParentId = nextItem && parentId ? (nextItemType + '_' + parentId) : undefined
      return {
        ...ele, menuConfig: menuData, type,
        id: ele[childField], value: ele[childField],
        isLeaf, label: ele[displayField],
        customLabel: ele[displayField], customLabelField: displayField,
        customId, customParentId,
      }
    })
  }

  function transSelfEntityModel(arr, item) {
    const { isSelfCorrelation, config, type } = item
    const { basic, menu } = config || {}
    const { menuData = [] } = menu || {}
    const { parentField, childField, displayField } = basic
    return arr.map(ele => {
      const customId = ele[childField]
      const customParentId = parentField && ele[parentField] || undefined
      const isLeaf = isSelfCorrelation ? Array.isArray(ele[type + 's']) && !ele[type + 's'].length : item.isLeaf
      if (Array.isArray(ele[type + 's'])) delete ele[type + 's']
      const { children, ...rest } = ele
      return {
        ...rest, type, menuConfig: menuData,
        isLeaf: !!isLeaf, label: ele[displayField],
        customLabel: ele[displayField], customLabelField: displayField,
        customId, customParentId, value: customId,
      }
    })
  }

  async function queryEntityByCondition(valueArr, item) {
    const { config, entityName, isSelfCorrelation, cascadeDeep, conditions } = item
    const { parentField, childField } = (config && config.basic) || {}
    const items = Array.isArray(valueArr) && valueArr.map(value => ({
      op: '=', propertyName: childField, propertyValue: value,
    }))
    const condition = conditions || (items && { or: { items } }) || {}
    const resp = await ctx.dispatchProxy(ctx.Controllers.LowcodeModelController.queryWithPage, {
      params: { entityName, pageIndex: 0, pageSize: -1, cascadeDeep: cascadeDeep || 0 },
      payload: { condition },
    })
    return resp.data.data.map(item => ({ ...config, ...item }))
  }

  async function getSelfStaticList(valueObject, configEntityList) {
    let leafNodeList = Array.isArray(valueObject) ? valueObject : [valueObject]
    let result = []
    const { config } = configEntityList[0]
    const { basic } = config || {}
    const { parentField, childField } = basic
    let arr = leafNodeList.map(ele => ({ ...ele, isLeaf: true }))

    const getParentNodes = async (models, cfg, index = 0) => {
      const valueArr = models.map(ele => ele.customParentId).filter(item => item)
      if (!valueArr.length || index === 5) return []
      const res = await queryEntityByCondition(valueArr, configEntityList[0])
      if (res.length) {
        const trans = transSelfEntityModel(res, cfg)
        result = result.concat(trans)
        await getParentNodes(trans, cfg, index + 1)
      }
    }

    if (parentField === childField) return arr
    result = transSelfEntityModel(arr, configEntityList[0])
    await getParentNodes(result, configEntityList[0])
    return result
  }

  async function getStaticEntityList(valueObject, configEntityList) {
    let leafNodeList = Array.isArray(valueObject) ? valueObject : [valueObject]
    let arr = leafNodeList.map(ele => ({ ...ele, isLeaf: true }))
    let preCurrentValueArr = []
    let result = []
    const reverseList = cloneDeep(configEntityList).reverse()
    for (let ci = 0; ci < reverseList.length; ci++) {
      const { config } = reverseList[ci]
      const { basic } = config || {}
      const { parentField } = basic
      if (ci !== 0) {
        arr = await queryEntityByCondition(preCurrentValueArr, reverseList[ci])
        preCurrentValueArr = arr.map(ele => ele[parentField])
      } else {
        preCurrentValueArr = arr.map(ele => ele[parentField])
      }
      result = result.concat(transCustomEntityModel(arr, reverseList[ci], reverseList[ci + 1]))
    }
    return result
  }

  async function getSelfAllLink(valueObject, configEntityList) {
    const result = await getSelfStaticList(valueObject, configEntityList)
    return { model: transListToLink(result) }
  }

  async function getCustomEntityLink(valueObject, configEntityList) {
    const result = await getStaticEntityList(valueObject, configEntityList)
    const tree = listToTree2(result, { id: 'customId', parentId: 'customParentId' })
    return { tree, model: transListToLink(result) }
  }

  async function getAllEntityData(configEntityList, settings) {
    if (!Array.isArray(configEntityList) || configEntityList.length === 0) return []
    const newCondition = ctx.getCondition()
    const conditions = newCondition || (settings && settings.condition && {
      and: settings.condition.and || {},
      or: settings.condition.or || {},
      orderPropertyNames: settings.condition.orderPropertyNames || undefined,
    }) || { and: {} }

    if (ctx.isSelfCorrelation) {
      const res = await queryEntityByCondition(null, { ...configEntityList[0], cascadeDeep: 0, conditions })
      const result = transSelfEntityModel(res, configEntityList[0])
      const tree = listToTree2(result, { id: 'customId', parentId: 'customParentId', mode: 'all' })
      return { list: result, tree }
    } else {
      const reverseList = cloneDeep(configEntityList).reverse()
      let result = []
      for (let ci = 0; ci < reverseList.length; ci++) {
        const curCondition = ci === reverseList.length - 1 ? conditions : null
        const res = await queryEntityByCondition(null, { ...reverseList[ci], conditions: curCondition })
        result = result.concat(transCustomEntityModel(res, reverseList[ci], reverseList[ci + 1]))
      }
      const tree = listToTree2(result)
      return { list: result, tree }
    }
  }

  async function getStaticList(valueObject, configEntityList) {
    const { isSelfCorrelation } = configEntityList[0]
    return isSelfCorrelation
      ? await getSelfStaticList(valueObject, configEntityList)
      : await getStaticEntityList(valueObject, configEntityList)
  }

  function transEntityModel(model, configEntityList) {
    const { isSelfCorrelation } = configEntityList[0]
    const arr = Array.isArray(model) ? model : [model]
    const filterArr = arr.filter(item => !ctx.getValIsEmpty(item))
    return isSelfCorrelation
      ? transSelfEntityModel(filterArr, configEntityList[0])
      : transCustomEntityModel(filterArr, cloneDeep(configEntityList).reverse()[0], cloneDeep(configEntityList).reverse()[1])
  }

  async function queryEntityByValue(valueFieldParam, labelFieldParam, value, entityName) {
    const items = [
      { op: '=', propertyName: valueFieldParam, propertyValue: value },
      { op: '=', propertyName: labelFieldParam, propertyValue: value },
    ]
    const condition = items ? { or: { items } } : {}
    const resp = await ctx.dispatchProxy(ctx.Controllers.LowcodeModelController.queryWithPage, {
      params: { entityName, pageIndex: 0, pageSize: 1, cascadeDeep: 0 },
      payload: { condition },
    })
    return resp.data.data.map(item => ({ ...item }))
  }

  return {
    transSelfEntityModel, transCustomEntityModel, queryEntityByCondition,
    getSelfStaticList, getStaticEntityList, getSelfAllLink, getCustomEntityLink,
    getAllEntityData, getStaticList, transEntityModel, queryEntityByValue,
  }
}
