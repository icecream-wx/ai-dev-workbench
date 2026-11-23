import { getTreeList, listToTree, treeToList } from '../../utils/treeList'
import { cloneDeep } from 'lodash'
import { getConditionByParams } from './condition'
import { i18n } from '../../i18n/info'
import { useDispatchProxy, useControllers } from '../../composables/useDispatchProxy'

export default {
  computed: {
    dispatchProxy() {
      const { dispatchProxy } = useDispatchProxy(this)
      return dispatchProxy
    },
    Controllers() {
      return useControllers(this)
    },
    jsonMenuConfig() {
      return this.settings.JsonPanel && Array.isArray(this.settings.JsonPanel.menuConfig) && this.settings.JsonPanel.menuConfig || []
    },
    isCheckStrictly() {
      if(!this.isJSON && !this.isSelfCorrelation) {
        return false
      }
      return this.checkStrictly || this.settings.checkStrictlyType === 'checkStrictly'
    },
    isStaticTreeSearch() {
      return this.settings.isStaticTreeSearch === 'true' || !!this.isEntityAllSearch
    },
    customSearchTemplate() {
      return !!this.searchTemplateIsEnable
    },
    isAddTrackPosition() {
      return this.settings.isAddTrackPosition
    },
    isEntityData() {
      return this.settings.cascaderPanelType === 'entity' || this.settings.cascaderPanelType === 'service'
    },
    isService() {
      return this.settings.cascaderPanelType === 'service'
    },
    isDic() {
      return this.settings.cascaderPanelType === 'dic'
    },
    isJSON() {
      return this.settings.cascaderPanelType === 'json'
    },
    isExpand() {
      return !this.settings.fold
    },
    menuDisplay() {
      return this.settings.menuDisplay
    },
    isSearchEntity() {
      const item = this.configEntityList && this.configEntityList[0] || {}
      return item && item['@xsi:type'] === "model:SPEntityNode" && this.configEntityList.length === 1
    },
    isSelfCorrelation() {
      return (
        this.isEntityData &&
        this.configEntityList &&
        this.configEntityList.length === 1 &&
        ((this.configEntityList[0].fk && this.checkNodeType === this.configEntityList[0].type) || this.configEntityList[0].isSelfCorrelation) || this.isSearchEntity
      )
    },
    valueField() {
      if (this.isEntityData || this.isSelfCorrelation) {
        return this.settings?.valueField
      } else if (this.isDic) {
        return 'code'
      } else {
        return this.settings?.JsonPanel?.value
      }
    },
    labelField() {
      if (this.isDic) {
        return 'name'
      } else if (this.isSelfCorrelation || this.isEntityData) {
        return this.settings?.labelField || 'label'
      } else {
        return this.settings?.JsonPanel?.label
      }
    },
    childrenField() {
      if (this.isJSON) {
        return this.settings?.JsonPanel?.children
      }
      return 'children'
    },
    checkNodeType() {
      return this.settings.cascaderPanelNodeType
    },
    configEntityList() {
      const { cascaderPanel, servicePanel } = this.settings
      const { value } = servicePanel || {}
      if (this.isService) {
        const result = (value && JSON.parse(value)) || []
        return result.map((ele, index) => {
          return {
            ...ele,
            fk: ele.config && ele.config.basic && ele.config.basic.parentField || ele.fk,
            type: ele.name,
            isLeaf: index === result.length - 1,
          }
        })
      }
      return cascaderPanel
    },
    isTreeMode() {
      return this.settings.modePanel === 'tree'
    },
    isAllMode() {
      return this.settings.modePanel === 'all' || !!this.settings.isAllMode
    },
    isJsonSelectAll() {
      return this.settings?.JsonPanel?.isSelectAll
    },
    jsonTreeList() {
      const options = this.settings?.JsonPanel?.options || []
      let arr = treeToList(options, [], {
        labelField: this.labelField,
        valueField: this.valueField,
        childrenField: this.childrenField,
      })
      return arr
    },
    jsonTreeData() {
      if (Array.isArray(this.jsonTreeList)) {
        return listToTree(this.jsonTreeList)
      }
      return []
    },
  },
  data() {
    return {
      i18n,
      allDictsEntryList: [],
      allDictList: [],
      allDictsTree: [],
      getDicTreeAndListPromise: null,
      dictCacheMap: new Map()
    }
  },
  methods: {
    getValIsEmpty(val, valueField) {
      if(val) {
        if(Array.isArray(val)) {
          return val.length === 0
        }
        if(typeof val === 'object' && Object.keys(val).length >= 2 && val.hasOwnProperty('id') && val.hasOwnProperty('name') && !val.id && !val.name) {
          return true
        }
        if(typeof val === 'object' && val && valueField && !val[valueField]) {
          return true
        }
        return false
      }
      return true
    },
    getCondition(conditionParams) {
      let result = conditionParams && getConditionByParams(conditionParams) || null
      this.$emit('getCondition', {
        data: conditionParams,
        callback: newCondition => {
          result = newCondition
        },
      })
      return result
    },
    getRoot(list, value) {
      let result = []
      let findItem = list.find(item => value === item[this.valueField])
      if (!findItem || !findItem.isLeaf) {
        return null
      }
      while (findItem) {
        result.push(findItem)
        const { parentId, customParentId, customId } = findItem
        if (customId && customId === customParentId) {
          findItem = null
        } else {
          findItem = list.find(item => {
            if (item) {
              if (item.hasOwnProperty('customId')) {
                return item.customId && item.customId === customParentId
              }
              if (item.hasOwnProperty('id')) {
                return item.id && item.id === parentId
              }
              return false
            }
            return false
          })
        }
      }
      return result.reverse()
    },
    getDciLink(list, value) {
      if (!value || typeof value !== 'string') {
        return []
      }
      const valueArr = (value && value.split(',')) || []
      const result = valueArr.map(ele => {
        return this.getRoot(list, ele)
      })
      return result.filter(item => item)
    },
    getValueArr(arr, list) {
      if (Array.isArray(arr)) {
        const result = arr.map(item => {
          if (Array.isArray(item)) {
            return item.map(ele => {
              const findItem = list.find(cur => cur[this.valueField] === ele)
              return findItem
            })
          } else {
            const findItem = list.find(cur => cur[this.valueField] === item)
            return findItem
          }
        })
        return result
      } else if (arr) {
        return list.filter(item => (arr + '').split(',').includes(item[this.valueField]))
      } else {
        return []
      }
    },
    getIsAllowSelect(node) {
      this.allowSelect = null
      this.$emit('allowSelect', {
        node: node,
        callback: isAllow => {
          this.allowSelect = isAllow
        },
      })
      return this.allowSelect
    },
    async getAllDictList(dicTypeList) {
      if (!dicTypeList.length) return []
      if (dicTypeList.length) {
        const requests = dicTypeList.map(item =>
          this.dispatchProxy(
            this.Controllers.DictTypeController.queryDictTypesByCriteria,
            { code: item.code }
          )
        )
        const results = await Promise.all(requests)
        const list = results.map((res)=>{
          return (res && res.data && res.data.data) || []
        })
        return list.flat()
      }
    },
    async getDicTreeAndList(value) {
      if (!value) {
        return { tree: [], list: [] }
      }
      const cacheKey = value
      if (this.dictCacheMap.has(cacheKey)) {
        return this.dictCacheMap.get(cacheKey)
      }
      if (this.getDicTreeAndListPromise) {
        return this.getDicTreeAndListPromise
      }
      this.getDicTreeAndListPromise = (async () => {
        try {
          const list = JSON.parse(value)
          const allDictList = await this.getAllDictList(list)
          const dictMap = new Map()
          allDictList.forEach(item => {
            dictMap.set(item.code, item)
          })
          const totalLength = list.length
          const allDictsEntryList = []
          for (let index = 0; index < totalLength; index++) {
            const isLeaf = index === totalLength - 1
            const findItem = dictMap.get(list[index].code)
            if (!findItem) continue
            const { config } = list[index]
            const { basic, menu } = config || {}
            const { menuData: menuConfig } = menu || {}
            const { iconClass, fieldIcon } = basic
            const commonConfig = {
              isRoot: index === 0,
              config,
              menuConfig,
              iconClass,
              fieldIcon,
              isLeaf,
            }
            findItem.dictEntrys.forEach(ele => {
              allDictsEntryList.push({
                ...ele,
                ...commonConfig,
                label: ele.name,
              })
            })
          }
          const tree = listToTree(allDictsEntryList)
          const result = { list: allDictsEntryList, tree }
          this.dictCacheMap.set(cacheKey, result)
          this.allDictsEntryList = allDictsEntryList
          this.allDictsTree = tree
          return result
        } finally {
          this.getDicTreeAndListPromise = null
        }
      })()
      return this.getDicTreeAndListPromise
    },
    clearDictCache() {
      this.dictCacheMap.clear()
      this.allDictsEntryList = []
      this.allDictsTree = []
      this.getDicTreeAndListPromise = null
    },
    getIsLeaf(item, cascaderPanel) {
      if (this.isSelfCorrelation) {
        const types = cascaderPanel.type + 's'
        return item && item[types] && item[types].length === 0
      } else {
        return cascaderPanel.isLeaf
      }
    },
    async getData(cascaderPanel_parent, cascaderPanel, index, node) {
      let entityName = cascaderPanel.entityName
      if(!entityName) {
        return
      }
      const conditionParams = { node, index, currentPanel: cascaderPanel, currentParentPanel: cascaderPanel_parent, settings: this.settings }
      let condition = this.getCondition(conditionParams)
      const resp = await this.dispatchProxy(this.Controllers.LowcodeModelController.queryWithPage, {
        params: {
          entityName: entityName,
          pageIndex: 0,
          pageSize: 999999,
          cascadeDeep: this.isSelfCorrelation ? 1 : 0,
        },
        payload: {
          condition: condition,
        },
      })
      if (!resp.error) {
        const type = cascaderPanel.type
        let data = resp.data.data.map(item => {
          const isLeaf = this.getIsLeaf(item, cascaderPanel)
          let result = {}
          Object.keys(item).map(key => {
            if (!(!item[key] && typeof item[key] === 'object')) {
              result[key] = item[key]
            }
          })
          const { basic, menu } = (cascaderPanel && cascaderPanel.config) || {}
          const { menuData:menuConfig } = menu || {}
          const { iconClass, fieldIcon, parentField, childField } = basic
          // 根级加载（level 0）不存在上一级面板，且 el-tree 根节点 data 为默认空数组，需守卫
          let parentId = node && node.data && cascaderPanel_parent ? cascaderPanel_parent.type + '__' + node.data.value : undefined
          let idStr = cascaderPanel.type + '__' + item[childField]
          if(this.isSelfCorrelation) {
            parentId = item[parentField] ? item[parentField] + '' : undefined
            idStr = item[childField] ? item[childField] + '' : undefined
          }
          const customParentId = parentId
          const customId = idStr ? idStr : ''
          const id = customId && customId.split('__').reverse()[0] + ''
          return {
            data: { ...result, id },
            ...item,
            id,
            menuConfig,
            value: item[childField],
            customId,
            customParentId,
            customLabel: basic.displayField,
            label: item[basic.displayField] + '',
            type: type,
            iconClass: iconClass || cascaderPanel.iconClass,
            fieldIcon: fieldIcon || cascaderPanel.fieldIcon,
            leaf: isLeaf,
            isLeaf,
          }
        })
        return data
      }
    },
    async getDataByFilter(filterEntityText) {
      let finalIndex = this.configEntityList.length - 1
      let finalEntity = this.configEntityList[finalIndex]
      const { entityName, type, config } = finalEntity
      const { basic } = config || {}
      const { displayField } = basic
      let condition = {
        and: {
          items: [
            {
              propertyName: displayField,
              op: 'like',
              propertyValue: filterEntityText,
            },
          ],
        },
      }
      const resp = await this.dispatchProxy(this.Controllers.LowcodeModelController.queryWithPage, {
        params: {
          entityName: entityName,
          pageIndex: 0,
          pageSize: 999,
          cascadeDeep: this.isSelfCorrelation ? 1 : 0,
        },
        payload: {
          condition: condition,
        },
      })
      const result = resp.data.data.map(item => {
        const isLeaf = true
        return {
          ...item,
          value: item[finalEntity.pk],
          customLabel: basic.displayField,
          label: item[basic.displayField] + '',
          type: type,
          iconClass: finalEntity.iconClass,
          fieldIcon: finalEntity.fieldIcon,
          leaf: isLeaf,
          isLeaf,
        }
      })
      return result
    },
    getJSON(options) {
      let arr = treeToList(options, [], {
        labelField: this.labelField,
        valueField: this.valueField,
        childrenField: this.childrenField
      }).map((ele)=>{
        const { children, ...rest } = ele
        return { ...ele, data: rest }
      })
      return listToTree(arr)
    }
  },
}
