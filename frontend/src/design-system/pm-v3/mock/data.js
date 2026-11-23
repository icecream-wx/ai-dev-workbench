/**
 * P7-2 预览用静态数据。
 *
 * 只服务于 frontend/preview.html，不连接真实 AFCenter/EOS 平台。
 * 结构与平台常见返回保持一致，便于后续页面直接替换为真实接口。
 */

export const orgs = [
  { id: 'all', code: 'PRIMETON', name: '普元信息技术', parentId: '', type: 'org' },
  { id: 'platform', code: 'PLATFORM', name: '数字化平台部', parentId: 'all', type: 'org' },
  { id: 'business', code: 'BUSINESS', name: '业务运营部', parentId: 'all', type: 'org' },
  { id: 'data', code: 'DATA', name: '数据管理部', parentId: 'all', type: 'org' },
  { id: 'frontend', code: 'FE', name: '前端研发组', parentId: 'platform', type: 'org' },
  { id: 'backend', code: 'BE', name: '后端研发组', parentId: 'platform', type: 'org' }
]

export const orgTree = [
  {
    id: 'all',
    code: 'PRIMETON',
    name: '普元信息技术',
    label: '普元信息技术',
    type: 'org',
    children: [
      {
        id: 'platform',
        code: 'PLATFORM',
        name: '数字化平台部',
        label: '数字化平台部',
        type: 'org',
        children: [
          { id: 'frontend', code: 'FE', name: '前端研发组', label: '前端研发组', type: 'org' },
          { id: 'backend', code: 'BE', name: '后端研发组', label: '后端研发组', type: 'org' }
        ]
      },
      { id: 'business', code: 'BUSINESS', name: '业务运营部', label: '业务运营部', type: 'org' },
      { id: 'data', code: 'DATA', name: '数据管理部', label: '数据管理部', type: 'org' }
    ]
  }
]

export const employees = [
  { id: 'emp-1', code: 'zhou.ning', name: '周宁', employeeName: '周宁', orgId: 'platform', orgName: '数字化平台部', positionId: 'pos-1', positionName: '产品经理', status: 1 },
  { id: 'emp-2', code: 'lin.chuan', name: '林川', employeeName: '林川', orgId: 'data', orgName: '数据管理部', positionId: 'pos-3', positionName: '数据工程师', status: 1 },
  { id: 'emp-3', code: 'chen.xu', name: '陈序', employeeName: '陈序', orgId: 'platform', orgName: '数字化平台部', positionId: 'pos-2', positionName: '开发工程师', status: 1 },
  { id: 'emp-4', code: 'xu.an', name: '许安', employeeName: '许安', orgId: 'business', orgName: '业务运营部', positionId: 'pos-4', positionName: '运营专员', status: 0 },
  { id: 'emp-5', code: 'li.ming', name: '李明', employeeName: '李明', orgId: 'frontend', orgName: '前端研发组', positionId: 'pos-2', positionName: '开发工程师', status: 1 }
]

export const positions = [
  { id: 'pos-1', code: 'PM', name: '产品经理', type: 'position' },
  { id: 'pos-2', code: 'DEV', name: '开发工程师', type: 'position' },
  { id: 'pos-3', code: 'DATA', name: '数据工程师', type: 'position' },
  { id: 'pos-4', code: 'OP', name: '运营专员', type: 'position' }
]

export const positionTypes = [
  { id: 'pt-1', code: 'MANAGE', name: '管理岗' },
  { id: 'pt-2', code: 'TECH', name: '技术岗' },
  { id: 'pt-3', code: 'OPERATION', name: '运营岗' }
]

export const roles = [
  { id: 'role-1', code: 'APP_ADMIN', name: '应用管理员', type: 'role' },
  { id: 'role-2', code: 'DATA_ADMIN', name: '数据管理员', type: 'role' },
  { id: 'role-3', code: 'PLATFORM_DEV', name: '平台开发者', type: 'role' },
  { id: 'role-4', code: 'USER', name: '普通用户', type: 'role' }
]

export const workGroups = [
  { id: 'wg-1', code: 'CORE', name: '平台核心组', type: 'group' },
  { id: 'wg-2', code: 'DATA', name: '数据治理组', type: 'group' }
]

export const dicts = {
  user_status: [
    { code: '1', name: '启用', sortBy: 1 },
    { code: '0', name: '禁用', sortBy: 2 }
  ],
  employee_status: [
    { code: '1', name: '在职', sortBy: 1 },
    { code: '0', name: '离职', sortBy: 2 }
  ],
  org_type: [
    { code: 'company', name: '公司', sortBy: 1 },
    { code: 'department', name: '部门', sortBy: 2 },
    { code: 'group', name: '小组', sortBy: 3 }
  ],
  gender: [
    { code: 'M', name: '男', sortBy: 1 },
    { code: 'F', name: '女', sortBy: 2 }
  ],
  activity_priority: [
    { code: 'high', name: '高', sortBy: 1 },
    { code: 'middle', name: '中', sortBy: 2 },
    { code: 'low', name: '低', sortBy: 3 }
  ],
  activity_channel: [
    { code: 'site', name: '站内', sortBy: 1 },
    { code: 'sms', name: '短信', sortBy: 2 },
    { code: 'mail', name: '邮件', sortBy: 3 }
  ],
  task_status: [
    { code: 'running', name: '运行中', sortBy: 1 },
    { code: 'success', name: '成功', sortBy: 2 },
    { code: 'failed', name: '失败', sortBy: 3 }
  ],
  incident_level: [
    { code: 'P1', name: '紧急', sortBy: 1 },
    { code: 'P2', name: '重要', sortBy: 2 },
    { code: 'P3', name: '普通', sortBy: 3 }
  ]
}

export const dictTypes = [
  { id: 'dict-1', code: 'user_status', name: '用户状态', type: 'system' },
  { id: 'dict-2', code: 'org_type', name: '机构类型', type: 'system' },
  { id: 'dict-3', code: 'gender', name: '性别', type: 'system' },
  { id: 'dict-4', code: 'task_status', name: '任务状态', type: 'business' },
  { id: 'dict-5', code: 'incident_level', name: '事件级别', type: 'business' }
]

export const marketingPlans = [
  { id: 'plan-01', code: 'PLAN-2026-01', name: '会员权益成长方案', status: '启用' },
  { id: 'plan-02', code: 'PLAN-2026-02', name: '暖冬满减券方案', status: '启用' },
  { id: 'plan-03', code: 'PLAN-2026-03', name: '沉睡会员召回方案', status: '停用' }
]

export const entities = {
  User: employees.map(item => ({
    id: item.id,
    code: item.code,
    userName: item.name,
    name: item.name,
    orgName: item.orgName,
    status: item.status
  })),
  Organization: orgs,
  Position: positions,
  Role: roles,
  marketingPlan: marketingPlans
}
