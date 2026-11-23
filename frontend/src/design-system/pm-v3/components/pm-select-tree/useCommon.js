/**
 * useCommon — 从 common.js mixin 提取为 composable
 * 用于 setup() 中替代 mixins: [common]，与 Options API 混合使用
 */
import { computed, reactive, ref, getCurrentInstance } from 'vue'
import { getTreeList, listToTree, treeToList } from '../../utils/treeList'
import { cloneDeep } from 'lodash'
import { getConditionByParams } from './condition'
import { i18n } from '../../i18n/info'
import { useDispatchProxy, useControllers } from '../../composables/useDispatchProxy'

export function useCommon() {
  const instance = getCurrentInstance()
  const ctx = instance.proxy

  // ====== computed ======
  const dispatchProxy = computed(() => {
    const { dispatchProxy: dp } = useDispatchProxy(ctx)
    return dp
  })
  const Controllers = computed(() => useControllers(ctx))

  const jsonMenuConfig = computed(() =>
    ctx.settings.JsonPanel && Array.isArray(ctx.settings.JsonPanel.menuConfig) && ctx.settings.JsonPanel.menuConfig || []
  )
  const isCheckStrictly = computed(() => {
    if (!ctx.isJSON && !ctx.isSelfCorrelation) return false
    return ctx.checkStrictly || ctx.settings.checkStrictlyType === 'checkStrictly'
  })
  const isStaticTreeSearch = computed(() =>
    ctx.settings.isStaticTreeSearch === 'true' || !!ctx.isEntityAllSearch
  )
  const customSearchTemplate = computed(() => !!ctx.searchTemplateIsEnable)
  const isAddTrackPosition = computed(() => ctx.settings.isAddTrackPosition)
  const isEntityData = computed(() =>
    ctx.settings.cascaderPanelType === 'entity' || ctx.settings.cascaderPanelType === 'service'
  )
  const isService = computed(() => ctx.settings.cascaderPanelType === 'service')
  const isDic = computed(() => ctx.settings.cascaderPanelType === 'dic')
  const isJSON = computed(() => ctx.settings.cascaderPanelType === 'json')
  const isExpand = computed(() => !ctx.settings.fold)
  const menuDisplay = computed(() => ctx.settings.menuDisplay)
  const isSearchEntity = computed(() => {
    const item = ctx.configEntityList && ctx.configEntityList[0] || {}
    return item && item['@xsi:type'] === "model:SPEntityNode" && ctx.configEntityList.length === 1
  })
  const isSelfCorrelation = computed(() => {
    return (
      ctx.isEntityData &&
      ctx.configEntityList &&
      ctx.configEntityList.length === 1 &&
      ((ctx.configEntityList[0].fk && ctx.checkNodeType === ctx.configEntityList[0].type) || ctx.configEntityList[0].isSelfCorrelation) || ctx.isSearchEntity
    )
  })
  const valueField = computed(() => {
    if (ctx.isEntityData || ctx.isSelfCorrelation) return ctx.settings?.valueField
    if (ctx.isDic) return 'code'
    return ctx.settings?.JsonPanel?.value
  })
  const labelField = computed(() => {
    if (ctx.isDic) return 'name'
    if (ctx.isSelfCorrelation || ctx.isEntityData) return ctx.settings?.labelField || 'label'
    return ctx.settings?.JsonPanel?.label
  })
  const childrenField = computed(() => ctx.isJSON ? ctx.settings?.JsonPanel?.children : 'children')
  const checkNodeType = computed(() => ctx.settings.cascaderPanelNodeType)
  const configEntityList = computed(() => {
    const { cascaderPanel, servicePanel } = ctx.settings
    const { value } = servicePanel || {}
    if (ctx.isService) {
      const result = (value && JSON.parse(value)) || []
      return result.map((ele, index) => ({
        ...ele,
        fk: ele.config && ele.config.basic && ele.config.basic.parentField || ele.fk,
        type: ele.name,
        isLeaf: index === result.length - 1,
      }))
    }
    return cascaderPanel
  })
  const isTreeMode = computed(() => ctx.settings.modePanel === 'tree')
  const isAllMode = computed(() => ctx.settings.modePanel === 'all' || !!ctx.settings.isAllMode)
  const isJsonSelectAll = computed(() => ctx.settings?.JsonPanel?.isSelectAll)
  const jsonTreeList = computed(() => {
    const options = ctx.settings?.JsonPanel?.options || []
    return treeToList(options, [], {
      labelField: labelField.value,
      valueField: valueField.value,
      childrenField: childrenField.value,
    })
  })
  const jsonTreeData = computed(() => {
    if (Array.isArray(jsonTreeList.value)) return listToTree(jsonTreeList.value)
    return []
  })

  // ====== data ======
  const allDictsEntryList = ref([])
  const allDictList = ref([])
  const allDictsTree = ref([])
  const getDicTreeAndListPromise = ref(null)
  const dictCacheMap = reactive(new Map())

  // ====== methods ======
  function getValIsEmpty(val, valueFieldParam) {
    if (val) {
      if (Array.isArray(val)) return val.length === 0
      if (typeof val === 'object' && Object.keys(val).length >= 2 && val.hasOwnProperty('id') && val.hasOwnProperty('name') && !val.id && !val.name) return true
      if (typeof val === 'object' && val && valueFieldParam && !val[valueFieldParam]) return true
      return false
    }
    return true
  }

  function getCondition(conditionParams) {
    let result = conditionParams && getConditionByParams(conditionParams) || null
    instance.emit('getCondition', {
      data: conditionParams,
      callback: newCondition => { result = newCondition },
    })
    return result
  }

  function getRoot(list, value) {
    let result = []
    let findItem = list.find(item => value === item[valueField.value])
    if (!findItem || !findItem.isLeaf) return null
    while (findItem) {
      result.push(findItem)
      const { parentId, customParentId, customId } = findItem
      if (customId && customId === customParentId) {
        findItem = null
      } else {
        findItem = list.find(item => {
          if (item) {
            if (item.hasOwnProperty('customId')) return item.customId && item.customId === customParentId
            if (item.hasOwnProperty('id')) return item.id && item.id === parentId
            return false
          }
          return false
        })
      }
    }
    return result.reverse()
  }

  function getDciLink(list, value) {
    if (!value || typeof value !== 'string') return []
    const valueArr = (value && value.split(',')) || []
    const result = valueArr.map(ele => getRoot(list, ele))
    return result.filter(item => item)
  }

  function getValueArr(arr, list) {
    if (Array.isArray(arr)) {
      return arr.map(item => {
        if (Array.isArray(item)) {
          return item.map(ele => {
            const findItem = list.find(cur => cur[valueField.value] === ele)
            return findItem
          })
        } else {
          return list.find(cur => cur[valueField.value] === item)
        }
      })
    } else if (arr) {
      return list.filter(item => (arr + '').split(',').includes(item[valueField.value]))
    }
    return []
  }

  function getIsAllowSelect(node) {
    let allowSelect = null
    instance.emit('allowSelect', {
      node: node,
      callback: isAllow => { allowSelect = isAllow },
    })
    return allowSelect
  }

  async function getAllDictList(dicTypeList) {
    if (!dicTypeList.length) return []
    const requests = dicTypeList.map(item =>
      dispatchProxy.value(
        Controllers.value.DictTypeController.queryDictTypesByCriteria,
        { code: item.code }
      )
    )
    const results = await Promise.all(requests)
    return results.map(res => (res && res.data && res.data.data) || []).flat()
  }

  async function getDicTreeAndList(value) {
    if (!value) return { tree: [], list: [] }
    const cacheKey = value
    if (dictCacheMap.has(cacheKey)) return dictCacheMap.get(cacheKey)
    if (getDicTreeAndListPromise.value) return getDicTreeAndListPromise.value

    getDicTreeAndListPromise.value = (async () => {
      try {
        const list = JSON.parse(value)
        const allDictList = await getAllDictList(list)
        const dictMap = new Map()
        allDictList.forEach(item => dictMap.set(item.code, item))
        const totalLength = list.length
        const entryList = []
        for (let index = 0; index < totalLength; index++) {
          const isLeaf = index === totalLength - 1
          const findItem = dictMap.get(list[index].code)
          if (!findItem) continue
          const { config } = list[index]
          const { basic, menu } = config || {}
          const { menuData: menuConfig } = menu || {}
          const { iconClass, fieldIcon } = basic
          findItem.dictEntrys.forEach(ele => {
            entryList.push({ ...ele, isRoot: index === 0, config, menuConfig, iconClass, fieldIcon, isLeaf, label: ele.name })
          })
        }
        const tree = listToTree(entryList)
        const result = { list: entryList, tree }
        dictCacheMap.set(cacheKey, result)
        allDictsEntryList.value = entryList
        allDictsTree.value = tree
        return result
      } finally {
        getDicTreeAndListPromise.value = null
      }
    })()
    return getDicTreeAndListPromise.value
  }

  function clearDictCache() {
    dictCacheMap.clear()
    allDictsEntryList.value = []
    allDictsTree.value = []
    getDicTreeAndListPromise.value = null
  }

  function getIsLeaf(item, cascaderPanel) {
    if (ctx.isSelfCorrelation) {
      const types = cascaderPanel.type + 's'
      return item && item[types] && item[types].length === 0
    }
    return cascaderPanel.isLeaf
  }

  async function getData(cascaderPanel_parent, cascaderPanel, index, node) {
    let entityName = cascaderPanel.entityName
    if (!entityName) return
    const conditionParams = { node, index, currentPanel: cascaderPanel, currentParentPanel: cascaderPanel_parent, settings: ctx.settings }
    let condition = getCondition(conditionParams)
    const resp = await dispatchProxy.value(Controllers.value.LowcodeModelController.queryWithPage, {
      params: { entityName, pageIndex: 0, pageSize: 999999, cascadeDeep: ctx.isSelfCorrelation ? 1 : 0 },
      payload: { condition },
    })
    if (!resp.error) {
      const type = cascaderPanel.type
      let data = resp.data.data.map(item => {
        const isLeaf = getIsLeaf(item, cascaderPanel)
        let result = {}
        Object.keys(item).map(key => {
          if (!(!item[key] && typeof item[key] === 'object')) result[key] = item[key]
        })
        const { basic, menu } = (cascaderPanel && cascaderPanel.config) || {}
        const { menuData: menuConfig } = menu || {}
        const { iconClass, fieldIcon, parentField, childField } = basic
        let parentId = node && node.data ? cascaderPanel_parent.type + '__' + node.data.value : undefined
        let idStr = cascaderPanel.type + '__' + item[childField]
        if (ctx.isSelfCorrelation) {
          parentId = item[parentField] ? item[parentField] + '' : undefined
          idStr = item[childField] ? item[childField] + '' : undefined
        }
        const customParentId = parentId
        const customId = idStr || ''
        const id = customId && customId.split('__').reverse()[0] + ''
        return {
          data: { ...result, id },
          ...item, id,
          menuConfig, value: item[childField],
          customId, customParentId,
          customLabel: basic.displayField,
          label: item[basic.displayField] + '',
          type, iconClass: iconClass || cascaderPanel.iconClass,
          fieldIcon: fieldIcon || cascaderPanel.fieldIcon,
          leaf: isLeaf, isLeaf,
        }
      })
      return data
    }
  }

  async function getDataByFilter(filterEntityText) {
    let finalIndex = ctx.configEntityList.length - 1
    let finalEntity = ctx.configEntityList[finalIndex]
    const { entityName, type, config } = finalEntity
    const { basic } = config || {}
    const { displayField } = basic
    let condition = {
      and: { items: [{ propertyName: displayField, op: 'like', propertyValue: filterEntityText }] },
    }
    const resp = await dispatchProxy.value(Controllers.value.LowcodeModelController.queryWithPage, {
      params: { entityName, pageIndex: 0, pageSize: 999, cascadeDeep: ctx.isSelfCorrelation ? 1 : 0 },
      payload: { condition },
    })
    return resp.data.data.map(item => ({
      ...item,
      value: item[finalEntity.pk],
      customLabel: basic.displayField,
      label: item[basic.displayField] + '',
      type, iconClass: finalEntity.iconClass,
      fieldIcon: finalEntity.fieldIcon,
      leaf: true, isLeaf: true,
    }))
  }

  function getJSON(options) {
    let arr = treeToList(options, [], {
      labelField: labelField.value,
      valueField: valueField.value,
      childrenField: childrenField.value,
    }).map(ele => {
      const { children, ...rest } = ele
      return { ...ele, data: rest }
    })
    return listToTree(arr)
  }

  return {
    // computed
    dispatchProxy, Controllers, jsonMenuConfig, isCheckStrictly, isStaticTreeSearch,
    customSearchTemplate, isAddTrackPosition, isEntityData, isService,
    isDic, isJSON, isExpand, menuDisplay, isSearchEntity, isSelfCorrelation,
    valueField, labelField, childrenField, checkNodeType, configEntityList,
    isTreeMode, isAllMode, isJsonSelectAll, jsonTreeList, jsonTreeData,
    // data
    allDictsEntryList, allDictList, allDictsTree, getDicTreeAndListPromise, dictCacheMap,
    // methods
    getValIsEmpty, getCondition, getRoot, getDciLink, getValueArr, getIsAllowSelect,
    getAllDictList, getDicTreeAndList, clearDictCache, getIsLeaf, getData, getDataByFilter, getJSON,
  }
}
