/**
 * P7-2 预览 mock：模拟平台 Controllers + dispatchProxy。
 *
 * 挂载方式（与真实 AFCenter 宿主保持一致）：
 *   app.config.globalProperties.Controllers = ...
 *   app.config.globalProperties.dispatchProxy = ...
 *   window.globalConfig.dispatchProxy = () => ...
 *
 * 所有数据来自 ./data.js，不发起任何网络请求。
 */
import {
  dicts,
  dictTypes,
  employees,
  entities,
  orgs,
  orgTree,
  positionTypes,
  positions,
  roles,
  workGroups
} from './data.js'

const MOCK_DELAY = 40

function pageData(list) {
  return { data: list, total: list.length, pageIndex: 0, pageSize: list.length }
}

function keywordOf(params) {
  return String(params?.keyword || params?.searchKey || params?.name || '').trim()
}

function filterByKeyword(list, keyword, fields = ['name', 'employeeName', 'code']) {
  if (!keyword) return list
  return list.filter(item => fields.some(field => String(item?.[field] || '').includes(keyword)))
}

function createResponse(payload) {
  const promise = new Promise(resolve => {
    setTimeout(() => resolve(payload), MOCK_DELAY)
  })
  // 与平台长连接返回兼容：useDictDataSource/useEntityDataSource 会调用 response.end(cb)
  promise.end = (cb) => {
    if (typeof cb === 'function') setTimeout(cb, MOCK_DELAY + 1)
  }
  return promise
}

function createControllers() {
  const handlers = new Map()

  function method(key, handler) {
    const fn = function pmMockControllerMethod() {}
    fn.__pmMockKey = key
    handlers.set(key, handler)
    return fn
  }

  const Controllers = {
    DictEntryController: {
      queryDictEntrysByCriteria: method('DictEntryController.queryDictEntrysByCriteria', params => {
        const rows = dicts[params?.dictTypeCode] || []
        return { data: pageData(rows) }
      })
    },
    DictTypeController: {
      queryDictTypesByCriteria: method('DictTypeController.queryDictTypesByCriteria', params => {
        const keyword = keywordOf(params)
        const rows = keyword
          ? dictTypes.filter(item => item.code.includes(keyword) || item.name.includes(keyword))
          : dictTypes
        return { data: { data: rows, total: rows.length } }
      })
    },
    LowcodeModelController: {
      queryWithPage: method('LowcodeModelController.queryWithPage', params => {
        const entityName = params?.params?.entityName
        const rows = entities[entityName] || []
        return { data: pageData(rows) }
      }),
      generateNumber: method('LowcodeModelController.generateNumber', () => ({
        data: 'ACT-202611-0086'
      })),
      getAttachments: method('LowcodeModelController.getAttachments', () => ({ data: [] })),
      getAttachmentToken: method('LowcodeModelController.getAttachmentToken', () => ({
        data: { token: 'mock-token', fileId: 'mock-file' }
      })),
      getWopiCoolUrl: method('LowcodeModelController.getWopiCoolUrl', () => ({
        data: { url: '' }
      })),
      uploadAttachments: method('LowcodeModelController.uploadAttachments', () => ({
        data: [{ fileId: 'mock-file', fileName: 'preview-placeholder.csv' }]
      })),
      removeAttachment: method('LowcodeModelController.removeAttachment', () => ({ data: true }))
    },
    LowcodeOCRGeneralController: {
      generalOCR: method('LowcodeOCRGeneralController.generalOCR', () => ({
        data: {
          ocrObject: {
            invoiceNo: 'INV-20261111-0836',
            company: '上海星禾商贸有限公司',
            amount: '12,680.00'
          }
        }
      }))
    },
    SelectionComponentController: {
      queryOrg: method('SelectionComponentController.queryOrg', () => ({ data: orgTree })),
      queryOrgFullPath: method('SelectionComponentController.queryOrgFullPath', () => ({ data: '/普元信息技术/数字化平台部' })),
      queryChildByParentId: method('SelectionComponentController.queryChildByParentId', params => ({
        data: orgs.filter(org => org.parentId === params?.parentId)
      })),
      queryEmployeeByOrg: method('SelectionComponentController.queryEmployeeByOrg', params => ({
        data: employees
          .filter(emp => !params?.orgId || emp.orgId === params.orgId)
          .map(emp => ({
            employee: emp,
            org: orgs.find(org => org.id === emp.orgId) || null,
            position: positions.find(pos => pos.id === emp.positionId) || null
          }))
      }))
    },
    EmployeeController: {
      getFirstOrgForCurrentEmp: method('EmployeeController.getFirstOrgForCurrentEmp', () => ({ data: { id: 'platform', name: '数字化平台部' } })),
      getUpperOrgForCurrentEmp: method('EmployeeController.getUpperOrgForCurrentEmp', () => ({ data: { id: 'all', name: '普元信息技术' } })),
      queryEmployeesByTenantId: method('EmployeeController.queryEmployeesByTenantId', () => ({ data: pageData(employees) })),
      queryEmployeesByRoleCode: method('EmployeeController.queryEmployeesByRoleCode', () => ({ data: employees })),
      queryEmployeesByIds: method('EmployeeController.queryEmployeesByIds', () => ({ data: employees })),
      queryEmployeesByIdsForMobile: method('EmployeeController.queryEmployeesByIdsForMobile', () => ({ data: employees })),
      getOrgFullPathByEmployeeCode: method('EmployeeController.getOrgFullPathByEmployeeCode', () => ({
        data: '/普元信息技术/数字化平台部'
      }))
    },
    OrgController: {
      queryOrgsByCriteria: method('OrgController.queryOrgsByCriteria', () => ({
        data: { data: orgs, total: orgs.length, extendProperties: [] }
      })),
      queryComplexOrgByIds: method('OrgController.queryComplexOrgByIds', () => ({ data: orgs })),
      queryOrgsByKeyword: method('OrgController.queryOrgsByKeyword', params => ({
        data: { data: filterByKeyword(orgs, keywordOf(params)) }
      })),
      queryComplexEmployeesInOrgs: method('OrgController.queryComplexEmployeesInOrgs', () => ({
        data: pageData(employees)
      })),
      queryEmployeesInOrg: method('OrgController.queryEmployeesInOrg', params => ({
        data: pageData(employees.filter(emp => !params?.orgId || emp.orgId === params.orgId))
      })),
      queryEmployeesByKeyword: method('OrgController.queryEmployeesByKeyword', params => ({
        data: { data: filterByKeyword(employees, keywordOf(params)) }
      })),
      queryPositionsToTree: method('OrgController.queryPositionsToTree', () => ({
        data: pageData(positions)
      })),
      queryPositionsByCriteria: method('OrgController.queryPositionsByCriteria', () => ({
        data: { data: positions, total: positions.length, extendProperties: [] }
      }))
    },
    PositionController: {
      queryPositionTypes: method('PositionController.queryPositionTypes', () => ({ data: positionTypes })),
      queryPositionByIds: method('PositionController.queryPositionByIds', () => ({ data: positions })),
      queryEmployeesInPosition: method('PositionController.queryEmployeesInPosition', params => ({
        data: pageData(employees.filter(emp => !params?.positionId || emp.positionId === params.positionId))
      }))
    },
    RoleController: {
      queryRoleByIds: method('RoleController.queryRoleByIds', () => ({ data: { data: roles, total: roles.length } })),
      queryAppRolesWithPage: method('RoleController.queryAppRolesWithPage', () => ({
        data: pageData(roles)
      }))
    },
    WorkGroupController: {
      queryWorkGroupsByCriteria: method('WorkGroupController.queryWorkGroupsByCriteria', () => ({
        data: { data: workGroups, total: workGroups.length }
      })),
      findWorkGroupByIds: method('WorkGroupController.findWorkGroupByIds', () => ({
        data: { data: workGroups, total: workGroups.length }
      })),
      queryEmployeesInWorkGroup: method('WorkGroupController.queryEmployeesInWorkGroup', () => ({
        data: pageData(employees.slice(0, 3).map(employee => ({ employee })))
      }))
    }
  }

  return { Controllers, handlers }
}

export function installPmMock(app) {
  const { Controllers, handlers } = createControllers()
  const calls = (window.__pmMockCalls = [])

  function dispatchProxy(controllerMethod, params) {
    const key = controllerMethod?.__pmMockKey
    const handler = key ? handlers.get(key) : null
    if (!handler) {
      console.warn('[pm-mock] 未覆盖的 Controller 方法：', controllerMethod)
      return createResponse({ error: true, message: 'mock-not-found' })
    }
    calls.push({ key, params })
    if (new URLSearchParams(window.location.search).get('mockLog') === '1') {
      console.info('[pm-mock]', key, params)
    }
    return createResponse(handler(params))
  }

  app.config.globalProperties.Controllers = Controllers
  app.config.globalProperties.dispatchProxy = dispatchProxy

  const globalConfig = (window.globalConfig = window.globalConfig || {})
  globalConfig.Controllers = Controllers
  globalConfig.dispatchProxy = () => dispatchProxy

  return { Controllers, dispatchProxy, calls }
}
