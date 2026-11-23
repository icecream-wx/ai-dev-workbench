import { ref } from 'vue'
import { useSelectModel } from './useSelectModel'

export function useSelectionTree(props) {
  const {
    getOrgs, getSonOrgs, getOrgsByIds, getSonEmp, getEmpByRolecode,
    getEmpByIds, getEmpByOrgs, getRolesByIds, getEmpByPositionIds,
    getPositionType, getPosition, queryEmployeesByKeyword, queryOrgsByKeyword,
    getWorkGroupByCriteria, findWorkGroupByIds, getEmpByWorkGroup,
    getPositionByIds, handlerType,
  } = useSelectModel()

  const treeData = ref([])
  const loading = ref(false)
  const searchResults = ref([])
  const searchLoading = ref(false)
  const expandedKeys = ref([])

  const isRoleType = () => props.currentType === 'role'
  const isOrgType = () => props.currentType === 'org'
  const isEmpType = () => props.currentType === 'emp'
  const isPositionType = () => props.currentType === 'position'
  const isGroupType = () => props.currentType === 'group'

  function getRangeConfig() {
    const mode = props.rangeMode?.[props.currentType] || props.rangeMode || 'dimension'
    const data = props.rangeData?.[props.currentType] || props.rangeData || {}
    return { mode, rangeData: data }
  }

  async function loadRootNodes() {
    loading.value = true
    try {
      const { mode, rangeData } = getRangeConfig()
      const tenantId = props.tenantId || ''
      let nodes = []

      if (mode === 'dimension') {
        nodes = await getOrgs({ ...rangeData, tenantId }) || []
      } else if (mode === 'rootOrgs' || mode === 'orgs') {
        nodes = await getOrgsByIds({ ...rangeData, tenantId }) || []
      } else if (mode === 'roles') {
        const options = { ...((rangeData.ids || rangeData.codes) ? rangeData : {}), tenantId, pageIndex: 0, pageSize: -1 }
        const resp = await getRolesByIds(options)
        nodes = resp?.data?.data || []
      } else if (mode === 'emps') {
        nodes = await getEmpByIds({ ...rangeData, tenantId }) || []
      } else if (mode === 'positions') {
        if (rangeData.ids) {
          nodes = await getPositionByIds({ ...rangeData, tenantId }) || []
        } else {
          nodes = await getPositionType({ pageIndex: 0, pageSize: -1 }) || []
        }
      } else if (mode === 'group') {
        if (rangeData.ids) {
          const res = await findWorkGroupByIds(rangeData)
          nodes = res?.data?.data || []
        } else {
          const res = await getWorkGroupByCriteria({ ...rangeData, pageIndex: 0, pageSize: -1, tenantId })
          nodes = res?.data?.data || []
        }
      }

      nodes = formatNodes(nodes, mode)
      treeData.value = nodes
      return nodes
    } finally {
      loading.value = false
    }
  }

  async function loadChildren(nodeData) {
    const { mode } = getRangeConfig()
    const tenantId = props.tenantId || ''
    const rawId = isEmpType() && nodeData.id && typeof nodeData.id === 'string'
      ? nodeData.id.split('org-').reverse()[0]
      : nodeData.id
    let nodes = []

    if (nodeData.type === 'emp' || nodeData.type === 'position' || nodeData.isLeaf) {
      return []
    }

    if (mode === 'dimension' || mode === 'rootOrgs') {
      let nodesOrg = await getSonOrgs(rawId) || []
      let nodesEmps = []
      if (isEmpType() && nodeData.type !== 'emp') nodesEmps = await getSonEmp(rawId) || []
      nodes = nodesOrg.concat(nodesEmps)
    } else if (mode === 'orgs') {
      if (isEmpType()) nodes = await getSonEmp(rawId) || []
    } else if (mode === 'roles') {
      nodes = await getEmpByRolecode({ tenantId, roleIds: rawId }) || []
    } else if (mode === 'positions') {
      const { rangeData } = getRangeConfig()
      if (rangeData?.ids) {
        if (nodeData.isLeaf) return []
        nodes = await getEmpByPositionIds({ positionIds: rawId, pageIndex: 0, pageSize: 200 }) || []
      } else {
        if (nodeData.children?.length) {
          nodes = nodeData.children
        } else {
          nodes = await getPosition({ types: rawId }) || []
        }
      }
    } else if (mode === 'group') {
      nodes = await getEmpByWorkGroup({ id: rawId }) || []
    }

    nodes = formatNodes(nodes, mode)
    return nodes
  }

  function formatNodes(nodes, mode) {
    const rootIsDisabled = (mode === 'positions' || mode === 'group') && (isEmpType() || isPositionType())
    return (nodes || []).map(i => {
      const mappedId = isEmpType() && i.type === 'org' ? `org-${i.id}` : (i.id || `__${Math.random().toString(36).slice(2)}`)
      const isLeaf = i.type === 'emp' || i.type === 'position' || (isOrgType() && mode === 'orgs')
      return {
        ...i,
        type: i.type || 'org',
        id: mappedId,
        isLeaf,
      disabled: rootIsDisabled
        || (i.type !== props.currentType && !i.isLeaf && !props.isMultiple && !isOrgType())
        || (!props.isMultiple && i.type === 'positionType'),
      // 非目标类型的父节点可以展开，但是样式置灰表示不能勾选
      selectDisabled: (i.type !== props.currentType && !i.isLeaf),
      }
    })
  }

  async function search(keyword) {
    if (!keyword) { searchResults.value = []; return }
    searchLoading.value = true
    try {
      const { mode, rangeData } = getRangeConfig()
      const tenantId = props.tenantId || ''
      const query = { keyword }

      if (isRoleType()) {
        const options = { ...((rangeData.ids || rangeData.codes) ? rangeData : {}), ...query, tenantId, pageIndex: 0, pageSize: -1 }
        const resp = await getRolesByIds(options)
        searchResults.value = resp?.data?.data || []
      } else if (isOrgType()) {
        const ids = treeData.value.map(i => i.id)
        let params = { tenantId, ids: ids.join(','), ...query, isFirst: mode === 'orgs' ? '1' : '0', pageIndex: 0, pageSize: 200 }
        searchResults.value = await queryOrgsByKeyword(params) || []
      } else if (isEmpType()) {
        const ids = treeData.value.map(i => i.id)
        if (['dimension', 'rootOrgs', 'orgs'].includes(mode)) {
          const resp = await queryEmployeesByKeyword({ tenantId, orgIds: ids.join(','), ...query, isFirst: mode === 'orgs' ? '1' : '0', pageIndex: 0, pageSize: 50 })
          searchResults.value = resp?.data || []
        } else if (mode === 'roles') {
          searchResults.value = await getEmpByRolecode({ tenantId, roleIds: ids.join(','), ...query }) || []
        } else if (mode === 'emps') {
          searchResults.value = await getEmpByIds({ tenantId, ...rangeData, ...query }) || []
        }
      } else if (isPositionType()) {
        searchResults.value = await getPosition({ pageIndex: 0, pageSize: -1, ...query }) || []
      }
    } finally {
      searchLoading.value = false
    }
  }

  return {
    treeData, loading, searchResults, searchLoading, expandedKeys,
    loadRootNodes, loadChildren, search, formatNodes, handlerType,
  }
}
