<template>
  <div class="optimized-suite application-type-data-governance">
    <div class="template-stage">
      <div class="business-page domain-assets-page">
    <section class="domain-grid-shell">
      <aside class="domain-navigator">
        <pm-search v-model:query="treeQuery" default-prop="keyword" placeholder="搜索数据域 / 目录" />
        <div class="domain-tree-wrap">
          <pm-tree
            :data="filteredDomainTree"
            :props="treeProps"
            :default-expanded-keys="['all', 'customer', 'transaction', 'product', 'management']"
            :editable="false"
            :removable="false"
            :searchable="false"
            default-expand-all
            highlight-current
            v-model="currentDomain"
            @node-click="selectDomain"
          />
        </div>
      </aside>

      <main class="asset-grid-panel">
        <div class="asset-query-bar">
          <div class="query-title">
            <span>ASSET GRID</span>
            <strong>{{ currentDomain.label }}资产矩阵</strong>
            <small>{{ currentDomain.path }}</small>
          </div>
          <pm-search v-model:query="filters" default-prop="keyword" placeholder="输入资产名、编码或负责人">
            <template #body>
              <el-form-item label="资产类型" prop="type">
                <pm-select size="default"
                  v-model="filters.type"
                  :options="typeOptions"
                  clearable
                  placeholder="全部类型"
                />
              </el-form-item>
              <el-form-item label="质量等级" prop="quality">
                <pm-select size="default"
                  v-model="filters.quality"
                  :options="qualityOptions"
                  clearable
                  placeholder="全部等级"
                />
              </el-form-item>
              <el-form-item label="治理状态" prop="status">
                <pm-select size="default"
                  v-model="filters.status"
                  :options="statusOptions"
                  clearable
                  placeholder="全部状态"
                />
              </el-form-item>
            </template>
          </pm-search>
        </div>

        <div class="active-query-row">
          <div>
            <span>查询范围</span>
            <button type="button">{{ currentDomain.label }} ×</button>
            <button
              v-if="filters.type"
              type="button"
              @click="filters.type = ''"
            >{{ filters.type }} ×</button>
            <button
              v-if="filters.quality"
              type="button"
              @click="filters.quality = ''"
            >{{ filters.quality }} ×</button>
          </div>
          <div class="grid-actions">
            <span>{{ filteredAssets.length }} ASSETS</span>
            <el-button @click="scanCatalog">重新扫描</el-button>
            <el-button type="primary" :icon="Plus" @click="registerAsset">登记资产</el-button>
            <el-button type="primary" plain @click="compareAssets">对比资产</el-button>
            <pm-pagination
              v-model:current-page="currentPage"
              background
              layout="prev, pager, next"
              :page-size="pageSize"
              :total="filteredAssets.length"
            />
          </div>
        </div>

        <pm-table
          :table-data="pagedAssets"
          :columns="columns"
          :default-sort="{ prop: 'heat', order: 'descending' }"
          @row-click="openInspector"
        >
          <template #asset="{ row }">
            <div class="asset-identity">
              <i :class="row.type.toLowerCase()">{{ typeShort[row.type] }}</i>
              <div>
                <strong>{{ row.name }}</strong>
                <span>{{ row.code }} · {{ row.tags.join(' / ') }}</span>
              </div>
            </div>
          </template>
          <template #quality="{ row }">
            <div class="quality-score">
              <strong>{{ row.quality }}</strong>
              <span>
                <i :style="{ width: `${row.quality}%` }" />
              </span>
              <small>{{ qualityLabel(row.quality) }}</small>
            </div>
          </template>
          <template #freshness="{ row }">
            <div class="freshness-cell">
              <strong>{{ row.freshness }}</strong>
              <span>{{ row.schedule }}</span>
            </div>
          </template>
          <template #heat="{ row }">
            <div class="heat-cell">
              <span v-for="n in 5" :key="n" :class="{ active: n <= Math.ceil(row.heat / 20) }" />
              <b>{{ row.heat }}</b>
            </div>
          </template>
          <template #status="{ row }">
            <span class="status-chip" :class="statusClass(row.status)">{{ row.status }}</span>
          </template>
          <template #action="{ row }">
            <button class="grid-action" @click.stop="openInspector(row)">检查</button>
            <button class="grid-action" @click.stop="traceLineage(row)">血缘</button>
          </template>
        </pm-table>

        <footer class="asset-grid-footer">
          <div>
            <span>
              <i class="core" />核心资产
            </span>
            <span>
              <i class="warning" />待治理
            </span>
            <span>
              <i class="normal" />普通资产
            </span>
          </div>
          <small>数据来自元数据中心 · 最近扫描 10:28:42</small>
        </footer>
      </main>
    </section>

    <pm-dialog v-model="inspectorVisible" title="资产检查器" width="680px">
      <div v-if="currentAsset" class="asset-inspector">
        <header>
          <div class="inspector-type">{{ typeShort[currentAsset.type] }}</div>
          <div>
            <strong>{{ currentAsset.name }}</strong>
            <span>{{ currentAsset.code }} · {{ currentAsset.domainLabel }}</span>
          </div>
          <span
            class="status-chip"
            :class="statusClass(currentAsset.status)"
          >{{ currentAsset.status }}</span>
        </header>
        <div class="inspector-metrics">
          <div>
            <span>质量评分</span>
            <strong>{{ currentAsset.quality }}</strong>
          </div>
          <div>
            <span>使用热度</span>
            <strong>{{ currentAsset.heat }}</strong>
          </div>
          <div>
            <span>数据规模</span>
            <strong>{{ currentAsset.volume }}</strong>
          </div>
          <div>
            <span>最近更新</span>
            <strong>{{ currentAsset.freshness }}</strong>
          </div>
        </div>
        <section>
          <h3>资产定义</h3>
          <p>{{ currentAsset.description }}</p>
          <dl>
            <div>
              <dt>负责人</dt>
              <dd>{{ currentAsset.owner }}</dd>
            </div>
            <div>
              <dt>来源系统</dt>
              <dd>{{ currentAsset.source }}</dd>
            </div>
            <div>
              <dt>更新计划</dt>
              <dd>{{ currentAsset.schedule }}</dd>
            </div>
            <div>
              <dt>敏感级别</dt>
              <dd>{{ currentAsset.sensitivity }}</dd>
            </div>
          </dl>
        </section>
        <section>
          <h3>血缘快照</h3>
          <div class="mini-lineage">
            <span>{{ currentAsset.source }}</span>
            <i>→</i>
            <span>{{ currentAsset.name }}</span>
            <i>→</i>
            <span>{{ currentAsset.consumer }}</span>
          </div>
        </section>
      </div>
      <template #footer>
        <el-button @click="inspectorVisible = false">关闭</el-button>
        <el-button type="primary" @click="traceLineage(currentAsset)">打开完整血缘</el-button>
      </template>
    </pm-dialog>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { Plus } from "@element-plus/icons-vue";


const domainTree = [
  {
    id: "all",
    label: "企业数据资产",
    path: "/ enterprise",
    description: "全域数据资产统一视图",
    children: [
      {
        id: "customer",
        label: "客户数据域",
        path: "/ enterprise / customer",
        description: "客户主数据、标签与行为资产",
        children: [
          {
            id: "customer-master",
            label: "客户主数据",
            path: "/ enterprise / customer / master",
            description: "客户身份与关系主数据"
          },
          {
            id: "customer-behavior",
            label: "客户行为",
            path: "/ enterprise / customer / behavior",
            description: "浏览、互动与转化行为"
          }
        ]
      },
      {
        id: "transaction",
        label: "交易数据域",
        path: "/ enterprise / transaction",
        description: "订单、支付和退款交易资产",
        children: [
          {
            id: "order",
            label: "订单履约",
            path: "/ enterprise / transaction / order",
            description: "订单创建到履约全链路"
          },
          {
            id: "payment",
            label: "支付结算",
            path: "/ enterprise / transaction / payment",
            description: "支付、退款与结算数据"
          }
        ]
      },
      {
        id: "product",
        label: "商品数据域",
        path: "/ enterprise / product",
        description: "商品主数据、价格与库存资产",
        children: [
          {
            id: "product-master",
            label: "商品主数据",
            path: "/ enterprise / product / master",
            description: "商品、品牌和类目标准信息"
          },
          {
            id: "inventory",
            label: "库存供应",
            path: "/ enterprise / product / inventory",
            description: "库存、采购与供应履约"
          }
        ]
      },
      {
        id: "management",
        label: "经营数据域",
        path: "/ enterprise / management",
        description: "经营指标、营销和财务资产",
        children: [
          {
            id: "metric",
            label: "经营指标",
            path: "/ enterprise / management / metric",
            description: "统一经营指标与维度"
          },
          {
            id: "marketing",
            label: "营销分析",
            path: "/ enterprise / management / marketing",
            description: "渠道投放与营销归因"
          }
        ]
      }
    ]
  }
];
const allDomains = (() => {
  const result = [];
  const walk = nodes =>
    nodes.forEach(node => {
      result.push(node);
      if (node.children) walk(node.children);
    });
  walk(domainTree);
  return result;
})();
const currentDomain = ref(domainTree[0]);
const treeProps = { id: "id", label: "label", children: "children", isLeaf: "isLeaf" };
const treeQuery = ref({ keyword: "" });
const filteredDomainTree = computed(() => {
  const keyword = treeQuery.value.keyword.trim();
  return keyword
    ? allDomains
        .filter(item => item.label.includes(keyword))
        .map(item => ({ ...item, children: undefined }))
    : domainTree;
});
const typeShort = {
  宽表: "W",
  事实表: "F",
  主题集: "S",
  指标集: "M",
  事件流: "E"
};
const allAssets = ref([
  {
    id: 1,
    domain: "customer-master",
    domainLabel: "客户主数据",
    code: "DS-1028",
    name: "统一客户主数据",
    type: "主题集",
    owner: "陈序",
    quality: 99,
    heat: 96,
    freshness: "12 分钟前",
    schedule: "每小时",
    status: "已认证",
    volume: "3,628 万行",
    source: "MDM",
    sensitivity: "L3",
    consumer: "客户标签主题集",
    core: true,
    tags: ["客户", "主数据"],
    description:
      "统一客户身份、联系方式、会员关系与账户映射，是客户域权威主数据。"
  },
  {
    id: 2,
    domain: "customer-master",
    domainLabel: "客户主数据",
    code: "DS-1016",
    name: "客户标签主题集",
    type: "主题集",
    owner: "陈序",
    quality: 96,
    heat: 92,
    freshness: "28 分钟前",
    schedule: "每小时",
    status: "已认证",
    volume: "3,628 万行",
    source: "标签平台",
    sensitivity: "L3",
    consumer: "会员复购趋势分析",
    core: true,
    tags: ["标签", "画像"],
    description:
      "覆盖客户基础、行为和偏好标签，为人群圈选与个性化运营提供统一资产。"
  },
  {
    id: 3,
    domain: "customer-behavior",
    domainLabel: "客户行为",
    code: "DS-0786",
    name: "用户行为主题宽表",
    type: "宽表",
    owner: "唐宁",
    quality: 96,
    heat: 98,
    freshness: "8 分钟前",
    schedule: "每 15 分钟",
    status: "已认证",
    volume: "18.7 亿行",
    source: "行为采集平台",
    sensitivity: "L3",
    consumer: "活跃度分层模型",
    core: true,
    tags: ["行为", "会话"],
    description: "整合浏览、搜索、收藏、加购和购买行为，提供统一用户会话视图。"
  },
  {
    id: 4,
    domain: "customer-behavior",
    domainLabel: "客户行为",
    code: "DS-0768",
    name: "用户触点事件流",
    type: "事件流",
    owner: "唐宁",
    quality: 93,
    heat: 81,
    freshness: "刚刚",
    schedule: "实时",
    status: "监控中",
    volume: "日均 2.8 亿",
    source: "Kafka",
    sensitivity: "L3",
    consumer: "实时推荐服务",
    core: false,
    tags: ["触点", "实时"],
    description:
      "实时汇聚用户在各渠道的互动触点，为推荐和风险模型提供流式输入。"
  },
  {
    id: 5,
    domain: "order",
    domainLabel: "订单履约",
    code: "DS-0998",
    name: "订单履约事实表",
    type: "事实表",
    owner: "林默",
    quality: 98,
    heat: 95,
    freshness: "15 分钟前",
    schedule: "每 30 分钟",
    status: "已认证",
    volume: "6.42 亿行",
    source: "订单中心",
    sensitivity: "L2",
    consumer: "区域经营指标集",
    core: true,
    tags: ["订单", "履约"],
    description:
      "记录订单创建、支付、发货、签收与关闭全过程，提供统一履约口径。"
  },
  {
    id: 6,
    domain: "order",
    domainLabel: "订单履约",
    code: "DS-0972",
    name: "订单商品明细宽表",
    type: "宽表",
    owner: "林默",
    quality: 94,
    heat: 87,
    freshness: "35 分钟前",
    schedule: "每小时",
    status: "已认证",
    volume: "12.3 亿行",
    source: "湖仓平台",
    sensitivity: "L2",
    consumer: "商品销售分析",
    core: false,
    tags: ["订单", "商品"],
    description:
      "按商品粒度展开订单交易、优惠与履约信息，支持销售和商品专题分析。"
  },
  {
    id: 7,
    domain: "payment",
    domainLabel: "支付结算",
    code: "DS-0964",
    name: "订单退款事实表",
    type: "事实表",
    owner: "周青",
    quality: 97,
    heat: 88,
    freshness: "2 分钟前",
    schedule: "实时",
    status: "已认证",
    volume: "896 万行",
    source: "退款中心",
    sensitivity: "L3",
    consumer: "异常退款识别",
    core: true,
    tags: ["退款", "风控"],
    description:
      "记录退款申请、审核、渠道返回与到账全链路事件，用于风险识别和财务核对。"
  },
  {
    id: 8,
    domain: "payment",
    domainLabel: "支付结算",
    code: "DS-0829",
    name: "支付链路事件流",
    type: "事件流",
    owner: "周青",
    quality: 91,
    heat: 79,
    freshness: "刚刚",
    schedule: "实时",
    status: "待治理",
    volume: "日均 4,600 万",
    source: "支付网关",
    sensitivity: "L3",
    consumer: "支付失败归因",
    core: false,
    tags: ["支付", "链路"],
    description:
      "实时记录支付请求、渠道路由与响应事件，目前存在部分渠道错误码未标准化。"
  },
  {
    id: 9,
    domain: "product-master",
    domainLabel: "商品主数据",
    code: "DS-0741",
    name: "商品主数据主题集",
    type: "主题集",
    owner: "孟星",
    quality: 99,
    heat: 90,
    freshness: "6 小时前",
    schedule: "每日 02:00",
    status: "已认证",
    volume: "842 万行",
    source: "MDM",
    sensitivity: "L1",
    consumer: "商品分析主题",
    core: true,
    tags: ["商品", "类目"],
    description: "提供标准商品、品牌、类目与规格属性，是商品分析的权威维度。"
  },
  {
    id: 10,
    domain: "product-master",
    domainLabel: "商品主数据",
    code: "DS-0931",
    name: "商品价格变更事件流",
    type: "事件流",
    owner: "孟星",
    quality: 95,
    heat: 83,
    freshness: "刚刚",
    schedule: "实时",
    status: "监控中",
    volume: "日均 420 万",
    source: "价格中心",
    sensitivity: "L1",
    consumer: "价格异常检测",
    core: false,
    tags: ["商品", "价格"],
    description: "实时汇聚商品售价、促销价和渠道价变更事件，保留完整价格版本。"
  },
  {
    id: 11,
    domain: "inventory",
    domainLabel: "库存供应",
    code: "DS-0894",
    name: "门店库存日快照",
    type: "宽表",
    owner: "苏禾",
    quality: 92,
    heat: 76,
    freshness: "4 小时前",
    schedule: "每日 05:30",
    status: "待治理",
    volume: "1.26 亿行",
    source: "ERP",
    sensitivity: "L2",
    consumer: "库存周转监控",
    core: true,
    tags: ["库存", "门店"],
    description:
      "记录门店与中心仓 SKU 库存、在途和可售数量，部分门店存在快照延迟。"
  },
  {
    id: 12,
    domain: "inventory",
    domainLabel: "库存供应",
    code: "DS-0817",
    name: "供应商履约事实表",
    type: "事实表",
    owner: "苏禾",
    quality: 89,
    heat: 65,
    freshness: "6 小时前",
    schedule: "每日 04:00",
    status: "整改中",
    volume: "568 万行",
    source: "SRM",
    sensitivity: "L2",
    consumer: "供应商质量评分",
    core: false,
    tags: ["供应商", "履约"],
    description:
      "归集采购订单、交付、质检和结算信息，当前供应商编码完整率待提升。"
  },
  {
    id: 13,
    domain: "metric",
    domainLabel: "经营指标",
    code: "DS-0987",
    name: "区域经营指标集",
    type: "指标集",
    owner: "林默",
    quality: 94,
    heat: 93,
    freshness: "1 小时前",
    schedule: "每小时",
    status: "已认证",
    volume: "128 万行",
    source: "指标中台",
    sensitivity: "L2",
    consumer: "区域销售日报",
    core: true,
    tags: ["经营", "KPI"],
    description: "按区域、门店与渠道聚合销售目标、达成率和同比环比指标。"
  },
  {
    id: 14,
    domain: "metric",
    domainLabel: "经营指标",
    code: "DS-0873",
    name: "门店经营指标集",
    type: "指标集",
    owner: "许诺",
    quality: 96,
    heat: 89,
    freshness: "42 分钟前",
    schedule: "每小时",
    status: "已认证",
    volume: "86 万行",
    source: "指标中台",
    sensitivity: "L2",
    consumer: "门店经营驾驶舱",
    core: true,
    tags: ["门店", "指标"],
    description: "提供门店销售、客流、转化、库存和服务等标准经营指标。"
  },
  {
    id: 15,
    domain: "marketing",
    domainLabel: "营销分析",
    code: "DS-0852",
    name: "营销归因数据集",
    type: "主题集",
    owner: "许诺",
    quality: 91,
    heat: 84,
    freshness: "3 小时前",
    schedule: "每日 07:00",
    status: "待治理",
    volume: "6,482 万行",
    source: "CDP",
    sensitivity: "L2",
    consumer: "渠道回报分析",
    core: false,
    tags: ["营销", "归因"],
    description:
      "融合广告触点、访问和转化链路，部分渠道回传延迟导致归因完整率下降。"
  }
]);
const filters = ref({ keyword: "", type: "", quality: "", status: "" });
const typeOptions = [
  "宽表",
  "事实表",
  "主题集",
  "指标集",
  "事件流"
].map(value => ({ label: value, value }));
const qualityOptions = ["A级", "B级", "C级"].map(value => ({
  label: value,
  value
}));
const statusOptions = ["已认证", "监控中", "待治理", "整改中"].map(value => ({
  label: value,
  value
}));
const descendants = node => [
  node.id,
  ...(node.children || []).flatMap(descendants)
];
const domainIds = computed(() => descendants(currentDomain.value));
const domainAssets = computed(() =>
  allAssets.value.filter(item => domainIds.value.includes(item.domain))
);
const filteredAssets = computed(() =>
  domainAssets.value.filter(row => {
    const keyword = filters.value.keyword.trim().toLowerCase();
    const quality = qualityLabel(row.quality);
    return (
      (!keyword ||
        `${row.name}${row.code}${row.owner}`.toLowerCase().includes(keyword)) &&
      (!filters.value.type || row.type === filters.value.type) &&
      (!filters.value.quality || quality.startsWith(filters.value.quality)) &&
      (!filters.value.status || row.status === filters.value.status)
    );
  })
);
const currentPage = ref(1);
const pageSize = 7;
const pagedAssets = computed(() =>
  filteredAssets.value.slice(
    (currentPage.value - 1) * pageSize,
    currentPage.value * pageSize
  )
);
watch(
  [currentDomain, filters],
  () => {
    currentPage.value = 1;
  },
  { deep: true }
);
const columns = [
  { prop: "name", label: "资产名称 / 编码", minWidth: 220, scope: "asset", sortable: true },
  { prop: "type", label: "类型", width: 76, sortable: true },
  { prop: "quality", label: "质量评分", width: 122, scope: "quality", sortable: true },
  { prop: "owner", label: "负责人", width: 80, sortable: true },
  { prop: "status", label: "治理状态", width: 100, scope: "status", sortable: true },
  { prop: "freshness", label: "时效 / 计划", width: 120, scope: "freshness", sortable: true },
  { prop: "heat", label: "使用热度", width: 120, scope: "heat", sortable: true },
  { prop: "volume", label: "数据规模", width: 105, sortable: true },
  {
    prop: "action",
    label: "快捷操作",
    width: 105,
    scope: "action",
    fixed: "right",
    align: "center"
  }
];
const selectDomain = node => {
  currentDomain.value = node;
};
const qualityLabel = score =>
  score >= 95 ? "A级" : score >= 90 ? "B级" : "C级";
const statusClass = status =>
  ({
    已认证: "status-success",
    监控中: "status-warning",
    待治理: "status-danger",
    整改中: "status-warning"
  }[status]);
const inspectorVisible = ref(false);
const currentAsset = ref(null);
const openInspector = row => {
  currentAsset.value = row;
  inspectorVisible.value = true;
};
const traceLineage = row => ElMessage.info(`正在打开 ${row.name} 的完整血缘图`);
const compareAssets = () =>
  ElMessage.success(
    `已将当前 ${Math.min(filteredAssets.value.length, 3)} 个高热资产加入对比区`
  );
const scanCatalog = () =>
  ElMessage.success("元数据扫描已完成，发现 2 项字段变更");
const registerAsset = () => ElMessage.info("已打开数据资产登记流程");
</script>

<style scoped>
.domain-grid-shell {
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}
.domain-navigator {
  position: sticky;
  top: 12px;
  padding: 15px;
  border: 1px solid var(--template-border);
  border-radius: 12px;
  background: var(--template-surface-soft);
  box-shadow: var(--template-shadow);
}
.domain-tree-wrap {
  height: calc(100vh - 190px);
  min-height: 420px;
  margin-top: 12px;
  padding: 6px;
  overflow: auto;
  border: 1px solid var(--template-border);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
}
.domain-tree-wrap :deep(.el-tree-node__content) {
  height: 31px;
  border-radius: 5px;
  font-size: 10px;
}
.domain-tree-wrap :deep(.el-tree-node.is-current > .el-tree-node__content) {
  color: var(--template-secondary-dark);
  background: var(--template-secondary-soft);
  box-shadow: inset 2px 0 0 var(--template-secondary);
}
.asset-grid-panel {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--template-border);
  border-radius: 12px;
  background:var(--template-surface);
  box-shadow: var(--template-shadow);
}
.asset-query-bar {
  padding: 14px;
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
  border-bottom: 1px solid var(--template-border);
  background: var(--template-surface-soft);
}
.query-title span,
.query-title strong,
.query-title small {
  display: block;
}
.query-title span {
  color: var(--template-secondary);
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.12em;
}
.query-title strong {
  margin-top: 4px;
  color: var(--template-heading);
  font-size: 13px;
}
.query-title small {
  margin-top: 3px;
  color: var(--template-text-soft);
  font: 8px Consolas, monospace;
}
.asset-query-bar :deep(.pm-search-body) {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}
.active-query-row {
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid var(--template-border-light);
}
.active-query-row > div:first-child {
  display: flex;
  align-items: center;
  gap: 5px;
}
.active-query-row > div:first-child > span {
  margin-right: 3px;
  color: var(--template-text-soft);
  font-size: 8px;
}
.active-query-row button {
  padding: 4px 7px;
  color: var(--template-secondary);
  border: 1px solid var(--template-border);
  border-radius: 4px;
  background: var(--template-secondary-soft);
  font-size: 8px;
  cursor: pointer;
}
.grid-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.grid-actions > span {
  color: var(--template-primary);
  font-size: 8px;
  font-weight: 800;
}
.asset-grid-panel :deep(.el-table) {
  border-right: 0;
  border-left: 0;
  border-radius: 0;
}
.asset-identity {
  display: flex;
  align-items: center;
  gap: 9px;
}
.asset-identity > i {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  color:var(--template-primary-contrast);
  border-radius: 7px;
  background: linear-gradient(
    135deg,
    var(--template-primary),
    var(--template-secondary)
  );
  font-size: 9px;
  font-style: normal;
  font-weight: 800;
}
.asset-identity strong,
.asset-identity span {
  display: block;
}
.asset-identity strong {
  color: var(--template-heading);
  font-size: 11px;
}
.asset-identity span {
  margin-top: 3px;
  color: var(--template-text-soft);
  font-size: 8px;
}
.quality-score {
  display: grid;
  grid-template-columns: 24px 1fr;
  gap: 3px 7px;
  align-items: center;
}
.quality-score strong {
  grid-row: 1/3;
  color: var(--template-heading);
  font-size: 15px;
}
.quality-score > span {
  height: 4px;
  overflow: hidden;
  border-radius: 99px;
  background: var(--template-border-light);
}
.quality-score > span i {
  height: 100%;
  display: block;
  background: linear-gradient(
    90deg,
    var(--template-primary),
    var(--template-secondary)
  );
}
.quality-score small {
  color: var(--template-text-soft);
  font-size: 7px;
}
.freshness-cell strong,
.freshness-cell span {
  display: block;
}
.freshness-cell strong {
  font-size: 9px;
}
.freshness-cell span {
  margin-top: 3px;
  color: var(--template-text-soft);
  font-size: 8px;
}
.heat-cell {
  display: flex;
  align-items: center;
  gap: 3px;
}
.heat-cell > span {
  width: 5px;
  height: 14px;
  border-radius: 2px;
  background: var(--template-border-light);
}
.heat-cell > span.active {
  background: var(--template-secondary);
}
.heat-cell b {
  margin-left: 4px;
  color: var(--template-text-soft);
  font-size: 8px;
}
.grid-action {
  padding: 3px 5px;
  color: var(--template-primary);
  border: 0;
  border-radius: 4px;
  background: transparent;
  font-size: 9px;
  cursor: pointer;
}
.grid-action:hover {
  background: var(--template-primary-soft);
}
.asset-grid-footer {
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--template-text-soft);
  font-size: 8px;
}
.asset-grid-footer > div {
  display: flex;
  gap: 12px;
}
.asset-grid-footer span {
  display: flex;
  align-items: center;
  gap: 5px;
}
.asset-grid-footer i {
  width: 6px;
  height: 6px;
  border-radius: 2px;
  background: var(--template-neutral);
}
.asset-grid-footer i.core {
  background: var(--template-primary);
}
.asset-grid-footer i.warning {
  background: var(--template-danger);
}
.asset-inspector > header {
  padding-bottom: 15px;
  display: flex;
  align-items: center;
  gap: 11px;
  border-bottom: 1px solid var(--template-border);
}
.inspector-type {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  color:var(--template-primary-contrast);
  border-radius: 9px;
  background: linear-gradient(
    135deg,
    var(--template-primary),
    var(--template-secondary)
  );
  font-weight: 800;
}
.asset-inspector > header > div:nth-child(2) {
  min-width: 0;
  flex: 1;
}
.asset-inspector > header strong,
.asset-inspector > header span {
  display: block;
}
.asset-inspector > header strong {
  font-size: 14px;
}
.asset-inspector > header div span {
  margin-top: 4px;
  color: var(--template-text-soft);
  font-size: 9px;
}
.inspector-metrics {
  margin: 14px 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border: 1px solid var(--template-border);
  border-radius: 9px;
}
.inspector-metrics div {
  padding: 11px;
  border-right: 1px solid var(--template-border);
}
.inspector-metrics div:last-child {
  border-right: 0;
}
.inspector-metrics span,
.inspector-metrics strong {
  display: block;
}
.inspector-metrics span {
  color: var(--template-text-soft);
  font-size: 8px;
}
.inspector-metrics strong {
  margin-top: 4px;
  font-size: 12px;
}
.asset-inspector section {
  padding: 14px 0;
  border-top: 1px solid var(--template-border-light);
}
.asset-inspector section h3 {
  margin: 0 0 8px;
  font-size: 11px;
}
.asset-inspector section p {
  margin: 0;
  color: var(--template-text-soft);
  font-size: 9px;
  line-height: 1.7;
}
.asset-inspector section dl {
  margin: 12px 0 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.asset-inspector section dl div {
  padding: 9px;
  border-radius: 7px;
  background: var(--template-surface-soft);
}
.asset-inspector dt {
  color: var(--template-text-soft);
  font-size: 8px;
}
.asset-inspector dd {
  margin: 3px 0 0;
  font-size: 9px;
  font-weight: 650;
}
.mini-lineage {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto 1fr;
  gap: 7px;
  align-items: center;
}
.mini-lineage span {
  padding: 9px;
  overflow: hidden;
  border-radius: 7px;
  background: var(--template-secondary-soft);
  font-size: 8px;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mini-lineage i {
  color: var(--template-secondary);
  font-style: normal;
}
@media (max-width: 1100px) {
  .domain-grid-shell {
    grid-template-columns: 1fr;
  }
  .domain-navigator {
    position: static;
  }
  .domain-tree-wrap {
    height: 220px;
  }
  .asset-query-bar {
    grid-template-columns: 1fr;
  }
  .query-title {
    display: none;
  }
}
@media (max-width: 760px) {
  .active-query-row {
    align-items: flex-start;
    flex-direction: column;
  }
  .asset-query-bar :deep(.pm-search-body) {
    grid-template-columns: 1fr;
  }
  .inspector-metrics {
    grid-template-columns: 1fr 1fr;
  }
  .inspector-metrics div:nth-child(2) {
    border-right: 0;
  }
}
</style>
<style scoped>
.domain-tree-wrap {
  padding: 8px 6px 8px 3px;
  border-color: var(--template-border-light);
  background: linear-gradient(rgba(20, 95, 186, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(20, 95, 186, 0.035) 1px, transparent 1px),
    rgba(255, 255, 255, 0.84);
  background-size: 18px 18px;
  scrollbar-color: var(--template-border) var(--template-surface-soft);
  scrollbar-width: thin;
}
.domain-tree-wrap::-webkit-scrollbar {
  width: 7px;
}
.domain-tree-wrap::-webkit-scrollbar-track {
  border-radius: 8px;
  background: var(--template-surface-soft);
}
.domain-tree-wrap::-webkit-scrollbar-thumb {
  border: 2px solid var(--template-surface-soft);
  border-radius: 8px;
  background: var(--template-border);
}
.domain-tree-wrap :deep(.el-tree) {
  padding: 2px 0;
  color: var(--template-text);
  background: transparent !important;
  --el-tree-node-hover-bg-color: transparent;
}
.domain-tree-wrap :deep(.el-tree-node) {
  position: relative;
}
.domain-tree-wrap :deep(.el-tree-node__children) {
  position: relative;
}
.domain-tree-wrap :deep(.el-tree-node__children::before) {
  position: absolute;
  top: 1px;
  bottom: 9px;
  left: 12px;
  width: 1px;
  border-left: 1px dashed var(--template-border-light);
  content: "";
}
.domain-tree-wrap :deep(.el-tree-node__content) {
  position: relative;
  height: 34px;
  margin: 2px 0;
  color: var(--template-text);
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent !important;
  box-shadow: none !important;
  transition: color 0.16s, border-color 0.16s, background 0.16s, transform 0.16s;
}
.domain-tree-wrap :deep(.el-tree-node__content:hover) {
  color: var(--template-primary);
  border-color: var(--template-primary-soft);
  background: rgba(232, 247, 246, 0.92) !important;
  transform: translateX(2px);
}
.domain-tree-wrap :deep(.el-tree-node:focus > .el-tree-node__content) {
  color: var(--template-text);
  border-color: transparent;
  background: transparent !important;
}
.domain-tree-wrap :deep(.el-tree-node.is-current > .el-tree-node__content),
.domain-tree-wrap
  :deep(.el-tree-node.is-current:focus > .el-tree-node__content) {
  color: var(--template-primary) !important;
  border-color: var(--template-primary) !important;
  background: linear-gradient(90deg, var(--template-primary-soft), var(--template-primary-soft)) !important;
  box-shadow: inset 3px 0 0 var(--template-secondary),
    0 4px 12px rgba(0,0,0,0.08) !important;
  transform: none;
}
.domain-tree-wrap :deep(.el-tree > .el-tree-node > .el-tree-node__content) {
  margin-bottom: 5px;
  color: var(--template-heading);
  border-color: var(--template-border);
  background: linear-gradient(90deg, var(--template-surface-soft), var(--template-surface-soft)) !important;
  font-weight: 750;
}
.domain-tree-wrap :deep(.el-tree-node__expand-icon) {
  color: var(--template-text-soft);
  font-size: 12px;
}
.domain-tree-wrap :deep(.el-tree-node__expand-icon.is-leaf) {
  color: transparent;
}
.domain-tree-wrap :deep(.el-tree-node__label) {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  line-height: 1;
}
.domain-tree-wrap :deep(.el-tree-node__label::before) {
  width: 7px;
  height: 7px;
  flex: 0 0 7px;
  border: 1px solid var(--template-border);
  border-radius: 2px;
  background: var(--template-surface);
  content: "";
}
.domain-tree-wrap
  :deep(.el-tree
    > .el-tree-node
    > .el-tree-node__content
    .el-tree-node__label::before) {
  width: 10px;
  height: 10px;
  flex-basis: 10px;
  border-color: var(--template-primary);
  border-radius: 3px;
  background: linear-gradient(
      90deg,
      transparent 42%,
      rgba(255, 255, 255, 0.8) 43%,
      rgba(255, 255, 255, 0.8) 56%,
      transparent 57%
    ),
    linear-gradient(
      transparent 42%,
      rgba(255, 255, 255, 0.8) 43%,
      rgba(255, 255, 255, 0.8) 56%,
      transparent 57%
    ),
    var(--template-primary);
}
.domain-tree-wrap
  :deep(.el-tree-node.is-current
    > .el-tree-node__content
    .el-tree-node__label) {
  font-weight: 750;
}
.domain-tree-wrap
  :deep(.el-tree-node.is-current
    > .el-tree-node__content
    .el-tree-node__label::before) {
  border-color: var(--template-secondary);
  background: var(--template-secondary);
  box-shadow: 0 0 0 3px rgba(0,0,0,0.08);
}
.domain-navigator :deep(.pm-search-main) {
  grid-template-columns: minmax(0, 1fr) 40px;
  gap: 4px;
  padding: 4px;
  border-color: var(--template-border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(31, 87, 111, 0.06);
}
.domain-navigator :deep(.pm-search-main .el-input__wrapper) {
  min-height: 34px;
  padding-right: 8px;
}
.domain-navigator :deep(.pm-search-main .el-input__inner) {
  font-size: 10px;
}
.domain-navigator :deep(.pm-search-shortcut) {
  display: none;
}
.domain-navigator :deep(.pm-search-main .el-button) {
  width: 40px;
  min-width: 40px;
  height: 34px;
  min-height: 34px;
  padding: 0;
  color:var(--template-primary-contrast) !important;
  border-color: var(--template-secondary) !important;
  border-radius: 6px;
  background: linear-gradient(
    135deg,
    var(--template-secondary),
    var(--template-primary-dark)
  ) !important;
  box-shadow: 0 4px 9px rgba(0,0,0,0.08) !important;
}
.domain-navigator :deep(.pm-search-main .el-button:hover) {
  border-color: var(--template-secondary-dark) !important;
  background: var(--template-secondary-dark) !important;
}
.domain-navigator :deep(.pm-search-main .el-button > span) {
  display: none;
}
.domain-navigator :deep(.pm-search-main .el-button .el-icon) {
  margin: 0;
  font-size: 15px;
}
.domain-tree-wrap :deep(.el-tree-node.is-current > .el-tree-node__content),
.domain-tree-wrap
  :deep(.el-tree-node.is-current:focus > .el-tree-node__content) {
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08) !important;
}
.domain-tree-wrap
  :deep(.el-tree-node.is-current > .el-tree-node__content::before) {
  position: absolute;
  z-index: 2;
  top: 5px;
  bottom: 5px;
  left: 0;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--template-primary) !important;
  box-shadow: 0 0 0 1px rgba(0,0,0,0.08);
  content: "";
}
</style>
