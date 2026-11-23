import { transListToLink, listToTree2 } from '../../utils/treeList'
import { cloneDeep } from 'lodash'
import common from './common'
export default {
  mixins: [common],
  methods: {
    // 获取自关联实体全路径数组
    async getSelfAllLink(valueObject, configEntityList) {
      const result = await this.getSelfStaticList(valueObject, configEntityList)
      const model = transListToLink(result)
      return {
        model,
      }
    },
    // 获取自关联实体集合
    async getSelfStaticList(valueObject, configEntityList) {
      let leafNodeList = Array.isArray(valueObject) ? valueObject : [valueObject]
      let result = []
      const { config } = configEntityList[0]
      const { basic } = config || {}
      const { parentField, childField } = basic
      let arr = leafNodeList.map(ele => {
        return {
          ...ele,
          isLeaf: true,
        }
      })
      const getParentNodes = async (models, config, index = 0) => {
        const valueArr = models.map(ele => ele.customParentId).filter(item => item)
        // 避免层层嵌套，当嵌套层级超过5时终止循坏
        if (!valueArr.length || index === 5) {
          return []
        }
        const res = await this.queryEntityByCondition(valueArr, configEntityList[0])
        if (res.length) {
          const trans = this.transSelfEntityModel(res, config)
          result = result.concat(trans)
          await getParentNodes(trans, config, index + 1)
        } else {
          return res
        }
      }
      if (parentField === childField) {
        return arr
      }
      result = this.transSelfEntityModel(arr, configEntityList[0])
      await getParentNodes(result, configEntityList[0])
      return result
    },
    // 获取非自关联实体的实体集合
    async getStaticEntityList(valueObject, configEntityList) {
      let leafNodeList = Array.isArray(valueObject) ? valueObject : [valueObject]
      let arr = leafNodeList.map(ele => {
        return {
          // ...configEntityList[configEntityList.length - 1],
          ...ele,
          isLeaf: true,
        }
      })
      let preCurrentValueArr = []
      let result = []
      const reverseList = cloneDeep(configEntityList).reverse()
      for (let configIndex = 0; configIndex < reverseList.length; configIndex++) {
        const { config } = reverseList[configIndex]
        const { basic } = config || {}
        const { parentField } = basic
        if (configIndex !== 0) {
          arr = await this.queryEntityByCondition(preCurrentValueArr, reverseList[configIndex])
          preCurrentValueArr = arr.map(ele => {
            return ele[parentField]
          })
        } else {
          preCurrentValueArr = arr.map(ele => {
            return ele[parentField]
          })
        }
        result = result.concat(this.transCustomEntityModel(arr, reverseList[configIndex], reverseList[configIndex + 1]))
      }
      return result
    },
    // 获取非自关联实体的全路径数组
    async getCustomEntityLink(valueObject, configEntityList) {
      const result = await this.getStaticEntityList(valueObject, configEntityList)
      const tree = listToTree2(result, { id: 'customId', parentId: 'customParentId' })
      const model = transListToLink(result)
      return {
        tree,
        model,
      }
    },
    transSelfEntityModel(arr, item) {
      const { isSelfCorrelation, config, type } = item
      const { basic, menu } = config || {}
      const { menuData = [] } = menu || {}
      const { parentField, childField, displayField } = basic
      return arr.map(ele => {
        const customId = ele[childField]
        const customParentId = parentField && ele[parentField] || undefined
        const isLeaf = isSelfCorrelation ? Array.isArray(ele[type + 's']) && !ele[type + 's'].length : item.isLeaf
        if(Array.isArray(ele[type + 's'])) {
          delete ele[type + 's']
        }
        const { children,...rest} = ele
       
        return {
          ...rest,
          type,
          menuConfig: menuData,
          isLeaf: !!isLeaf,
          label: ele[displayField],
          customLabel: ele[displayField],
          customLabelField: displayField,
          customId,
          customParentId,
          value: customId,
        }
      })
    },
    getParentId(ele, parentField, nextItemChildField) {
      if(ele && ele[parentField] && typeof  ele[parentField] === 'object' ) {
        return ele && ele[parentField] && ele[parentField][nextItemChildField] || undefined
      } else {
        return ele && ele[parentField] || undefined
      }
    },
    transCustomEntityModel(arr, item, nextItem) {
      const { config, type, isLeaf } = item
      const { basic, menu } = config || {}
      const { menuData = [] } = menu || {}
      const { parentField, childField, displayField } = basic
      
      const { type: nextItemType, config:nextItemConfig } = nextItem || {}
      const { basic:nextItemBasic } = nextItemConfig || {}
      const { childField:nextItemChildField } = nextItemBasic || {}
      
      return arr.map(ele => {
        const customId = type + '_' + ele[childField]
        const parentId = this.getParentId(ele, parentField, nextItemChildField)
        const customParentId = nextItem && parentId ? (nextItemType + '_' + parentId) : undefined
        return {
          ...ele,
          menuConfig: menuData,
          type,
          id: ele[childField],
          value: ele[childField],
          isLeaf: isLeaf,
          label: ele[displayField],
          customLabel: ele[displayField],
          customLabelField: displayField,
          customId,
          customParentId,
        }
      })
    },
    // 根据实体查询
    async queryEntityByCondition(valueArr, item) {
      const { config, entityName, isSelfCorrelation, cascadeDeep, conditions } = item
      const { parentField, childField } = (config && config.basic) || {}
      const items = Array.isArray(valueArr) && valueArr.map(value => {
        return {
          op: '=',
          propertyName: childField,
          propertyValue: value,
        }
      })
      const condition = conditions || items && {
        or: { items },
      } || {}
      const resp = await this.dispatchProxy(Vue.prototype.Controllers.LowcodeModelController.queryWithPage, {
        params: {
          entityName: entityName,
          pageIndex: 0,
          pageSize: -1,
          cascadeDeep: cascadeDeep || 0,
        },
        payload: {
          condition,
        },
      })
      const result = resp.data.data.map(item => {
        return {
          ...config,
          ...item,
        }
      })
      return result
    },
    // 获取所有的实体数据
    async getAllEntityData(configEntityList, settings) {
      if(!Array.isArray(configEntityList) || configEntityList.length === 0) {
        return []
      }
      const newCondition = this.getCondition()
      const conditions = newCondition || settings && settings.condition && {
          and: settings.condition.and || {},
          or: settings.condition.or || {},
          orderPropertyNames: settings.condition.orderPropertyNames || undefined,
        } || {
        and: {},
      }
      if (this.isSelfCorrelation) {
        const res = await this.queryEntityByCondition(null, {...configEntityList[0], cascadeDeep: 0, conditions})
        const result = this.transSelfEntityModel(res, configEntityList[0])
        const tree = listToTree2(result, {
          id: 'customId',
          parentId: 'customParentId',
          mode: 'all'
        })
        console.log('tree:', tree)
        return {list: result, tree}
      } else {
        const reverseList = cloneDeep(configEntityList).reverse()
        let result = []
        for(let configIndex = 0;configIndex < reverseList.length;configIndex++) {
          const curCondition = configIndex === reverseList.length - 1 ? conditions : null
          const res = await this.queryEntityByCondition(null, {...reverseList[configIndex], conditions: curCondition})
          result = result.concat(this.transCustomEntityModel(res, reverseList[configIndex], reverseList[configIndex + 1]))
        }
        
        const tree = listToTree2(result)
        return {list: result, tree}
      }
    },
    async getStaticList(valueObject, configEntityList) {
      const { isSelfCorrelation } = configEntityList[0]
      if(isSelfCorrelation) {
        return await this.getSelfStaticList(valueObject, configEntityList)
      } else {
        return await this.getStaticEntityList(valueObject, configEntityList)
      }
    },
    transEntityModel(model, configEntityList) {
      const { isSelfCorrelation } = configEntityList[0]
      const arr = Array.isArray(model) ? model : [model]
      const filterArr = arr.filter((item)=>!this.getValIsEmpty(item))
      if(isSelfCorrelation) {
        return this.transSelfEntityModel(filterArr, configEntityList[0])
      } else {
        const reverseList = cloneDeep(configEntityList).reverse()
        return this.transCustomEntityModel(filterArr, reverseList[0], reverseList[1])
      }
    },
    // 根据默认值查询
    async queryEntityByValue(valueField, labelField, value,  entityName) {
        const items = [
          {
            op: '=',
            propertyName: valueField,
            propertyValue: value,
          }, {
            op: '=',
            propertyName: labelField,
            propertyValue: value,
          }
        ]
        const condition = items && {
          or: { items },
        } || {}
        const resp = await this.dispatchProxy(Vue.prototype.Controllers.LowcodeModelController.queryWithPage, {
          params: {
            entityName: entityName,
            pageIndex: 0,
            pageSize: 1,
            cascadeDeep: 0,
          },
          payload: {
            condition,
          },
        })
        const result = resp.data.data.map(item => {
          return {
            ...item,
          }
        })
        return result
      },
  },
}
