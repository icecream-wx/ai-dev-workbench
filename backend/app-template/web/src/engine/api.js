const base = 'api'

async function request(path, options = {}) {
  const res = await fetch(`${base}/${path.replace(/^\//, '')}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  })
  let data = null
  try {
    data = await res.json()
  } catch {
    // 非 JSON 响应
  }
  if (!res.ok) throw new Error(data?.error || `请求失败（HTTP ${res.status}）`)
  return data
}

export const api = {
  manifest: () => request('manifest'),
  list: (entity, params = {}) => request(`res/${entity}?${new URLSearchParams(params)}`),
  get: (entity, id) => request(`res/${entity}/${encodeURIComponent(id)}`),
  create: (entity, data) => request(`res/${entity}`, { method: 'POST', body: JSON.stringify(data) }),
  update: (entity, id, data) => request(`res/${entity}/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (entity, id) => request(`res/${entity}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  batchDelete: (entity, ids) => request(`res/${entity}/batch-delete`, { method: 'POST', body: JSON.stringify({ ids }) }),
  stats: (entity, params) => request(`res/${entity}/stats?${new URLSearchParams(params)}`)
}
