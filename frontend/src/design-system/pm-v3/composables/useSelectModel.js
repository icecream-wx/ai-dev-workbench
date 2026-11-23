import { useDispatchProxy, useControllers } from './useDispatchProxy'
import { optionsSerialize, getValIsEmpty } from '../components/pm-selected-left/src/utils/index.js'

export { getValIsEmpty }

export function useSelectModel() {
  const { dispatchProxy } = useDispatchProxy()
  const Controllers = useControllers()

  function handlerType(data, type) {
    return (data || []).map(i => ({ ...i, type }))
  }

  function getDisplayName(item, showCode) {
    if (item && showCode && item.code) {
      return `${item.name || item.employeeName}(${item.code})`
    }
    return item?.name || item?.employeeName || ''
  }

  async function getOrgIdsByType(obj) {
    const payload = {}
    let resp = {}
    const { command } = obj
    if (command === 'fistLevelDepartment') {
      resp = await dispatchProxy(Controllers.EmployeeController?.getFirstOrgForCurrentEmp, payload)
    } else if (command === 'higherDepartment') {
      resp = await dispatchProxy(Controllers.EmployeeController?.getUpperOrgForCurrentEmp, payload)
    }
    const { data } = resp || {}
    return data?.id || 'custom_zero'
  }

  async function getOrgs(options = {}) {
    const resp = await dispatchProxy(Controllers.SelectionComponentController?.queryOrg, options)
    if (!resp.error) return resp.data
  }

  async function getOrgFullPath(options) {
    const resp = await dispatchProxy(Controllers.SelectionComponentController?.queryOrgFullPath, options)
    if (resp?.data?.indexOf('/') === 0) return resp.data.slice(1)
    return resp?.data
  }

  async function getSonOrgs(parentId) {
    const resp = await dispatchProxy(Controllers.SelectionComponentController?.queryChildByParentId, { parentId })
    if (!resp.error) return resp.data
  }

  async function getorgsByCondition(options = {}) {
    const resp = await dispatchProxy(Controllers.OrgController?.queryOrgsByCriteria, options)
    if (!resp.error) return resp.data
  }

  async function getOrgsByIds(options) {
    options = optionsSerialize(options)
    const resp = await dispatchProxy(Controllers.OrgController?.queryComplexOrgByIds, { isFirst: '1', ...options })
    if (!resp.error) return resp.data
  }

  async function queryOrgsByKeyword(options) {
    options = optionsSerialize(options)
    const resp = await dispatchProxy(Controllers.OrgController?.queryOrgsByKeyword, { isFirst: '1', ...options })
    if (!resp.error) return resp.data?.data || []
  }

  async function getEmpByName(options) {
    const resp = await dispatchProxy(Controllers.EmployeeController?.queryEmployeesByTenantId, options)
    if (!resp.error) return resp?.data
  }

  async function getSonEmp(orgId, headerAppName) {
    const resp = await dispatchProxy(Controllers.SelectionComponentController?.queryEmployeeByOrg, { orgId, employeeStatus: 1, headerAppName })
    if (!resp.error) {
      return (resp.data || []).map(i => ({
        ...i.employee,
        orgId,
        org: i.org,
        position: i.position,
        type: 'emp'
      }))
    }
    return []
  }

  async function getEmpByRolecode(options) {
    const resp = await dispatchProxy(Controllers.EmployeeController?.queryEmployeesByRoleCode, options)
    if (!resp.error) return handlerType(resp.data, 'emp')
  }

  async function getEmpByIds(options) {
    options = optionsSerialize(options)
    const resp = await dispatchProxy(Controllers.EmployeeController?.queryEmployeesByIds, options)
    if (!resp.error) return handlerType(resp.data, 'emp')
  }

  async function getEmpsByIds(data) {
    const resp = await dispatchProxy(Controllers.EmployeeController?.queryEmployeesByIdsForMobile, data)
    if (!resp.error) return resp.data
  }

  async function getEmpsArrByIds(options) {
    options = optionsSerialize(options)
    const resp = await dispatchProxy(Controllers.EmployeeController?.queryEmployeesByIds, options)
    if (!resp.error) return handlerType(resp.data, 'emp')
  }

  async function getEmpByOrgs(options) {
    const resp = await dispatchProxy(Controllers.OrgController?.queryComplexEmployeesInOrgs, { isFirst: '1', ...options })
    if (!resp.error) {
      resp.data.data = handlerType(resp.data.data, 'emp')
      return resp.data
    }
  }

  async function getEmployeesByOrg(options) {
    const resp = await dispatchProxy(Controllers.OrgController?.queryEmployeesInOrg, { pageIndex: 0, pageSize: 50, ...options })
    if (!resp.error) {
      resp.data.data = handlerType(resp.data.data, 'emp')
      return resp.data
    }
  }

  async function getRolesByIds(options) {
    if (options.ids && options.type) delete options.type
    if (!Object.prototype.hasOwnProperty.call(options, 'type')) options.type = 'platform'
    options = optionsSerialize(options)
    const resp = await dispatchProxy(Controllers.RoleController?.queryRoleByIds, options)
    if (!resp.error) {
      let { data } = resp.data
      resp.data.data = handlerType(data, 'role')
      return resp
    }
  }

  async function getEmpAppRole(options) {
    const resp = await dispatchProxy(Controllers.RoleController?.queryAppRolesWithPage, options)
    if (!resp.error) {
      resp.data.data = handlerType(resp.data.data, 'role')
      return resp
    }
  }

  async function getEmpFullPath(data) {
    const resp = await dispatchProxy(Controllers.EmployeeController?.getOrgFullPathByEmployeeCode, data)
    if (resp?.data?.indexOf('/') === 0) return resp.data.slice(1)
    return resp?.data
  }

  async function queryEmployeesByKeyword(options) {
    const resp = await dispatchProxy(Controllers.OrgController?.queryEmployeesByKeyword, { isFirst: '1', ...options })
    if (!resp.error) {
      resp.data.data = handlerType(resp.data.data, 'emp')
      return resp.data
    }
  }

  async function getPositionType(data) {
    const resp = await dispatchProxy(Controllers.PositionController?.queryPositionTypes, data)
    if (!resp.error) return handlerType(resp.data, 'positionType')
  }

  async function getPosition(data) {
    const resp = await dispatchProxy(Controllers.OrgController?.queryPositionsToTree, { pageIndex: 0, pageSize: -1, ...data })
    if (!resp.error) return handlerType(resp.data?.data, 'position')
  }

  async function getPositionsByIds(data) {
    data = optionsSerialize(data)
    const resp = await dispatchProxy(Controllers.PositionController?.queryPositionByIds, data)
    return handlerType(resp?.data, 'position')
  }

  async function getEmpByPositionIds(options) {
    const resp = await dispatchProxy(Controllers.PositionController?.queryEmployeesInPosition, options)
    if (!resp.error) return handlerType(resp.data?.data, 'emp')
  }

  async function getPositionByOrg(data) {
    const resp = await dispatchProxy(Controllers.OrgController?.queryPositionsByCriteria, data)
    if (!resp.error) {
      const { data: listData, extendProperties, total } = resp.data
      return { data: handlerType(listData, 'position'), extendProperties, total }
    }
  }

  async function getPositionByIds(data) {
    data = optionsSerialize(data)
    const resp = await dispatchProxy(Controllers.PositionController?.queryPositionByIds, { pageIndex: 0, pageSize: -1, ...data })
    if (!resp.error) return handlerType(resp.data, 'positionType')
  }

  async function getWorkGroupByCriteria(options) {
    if (!options) options = { pageIndex: 0, pageSize: -1 }
    const resp = await dispatchProxy(Controllers.WorkGroupController?.queryWorkGroupsByCriteria, options)
    if (!resp.error) {
      let { data } = resp.data
      resp.data.data = handlerType(data, 'group')
      return resp
    }
  }

  async function findWorkGroupByIds(options) {
    if (!options) options = { pageIndex: 0, pageSize: -1 }
    options = optionsSerialize(options)
    const resp = await dispatchProxy(Controllers.WorkGroupController?.findWorkGroupByIds, options)
    if (!resp.error) {
      let { data } = resp
      resp.data.data = handlerType(data, 'group')
      return resp
    }
  }

  async function getEmpByWorkGroup(options) {
    const resp = await dispatchProxy(Controllers.WorkGroupController?.queryEmployeesInWorkGroup, { pageSize: -1, pageIndex: 0, ...options })
    if (!resp.error) {
      const employees = (resp.data?.data || []).map(item => ({ ...item.employee }))
      return handlerType(employees, 'emp')
    }
  }

  return {
    dispatchProxy,
    Controllers,
    handlerType,
    getDisplayName,
    getOrgIdsByType,
    getOrgs,
    getOrgFullPath,
    getSonOrgs,
    getorgsByCondition,
    getOrgsByIds,
    queryOrgsByKeyword,
    getEmpByName,
    getSonEmp,
    getEmpByRolecode,
    getEmpByIds,
    getEmpsByIds,
    getEmpsArrByIds,
    getEmpByOrgs,
    getEmployeesByOrg,
    getRolesByIds,
    getEmpAppRole,
    getEmpFullPath,
    queryEmployeesByKeyword,
    getPositionType,
    getPosition,
    getPositionsByIds,
    getEmpByPositionIds,
    getPositionByOrg,
    getPositionByIds,
    getWorkGroupByCriteria,
    findWorkGroupByIds,
    getEmpByWorkGroup,
  }
}
