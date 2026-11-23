<template>
  <div class="optimized-suite afcenter-template">
    <div class="af-page">
    <header class="af-page-header">
      <div>
        <h1>注册应用</h1>
        <p>创建应用身份并配置运行环境与授权范围</p>
      </div>
      <el-button @click="$emit('navigate','applications')">返回应用中心</el-button>
    </header>
    <section class="af-panel af-form">
      <pm-steps v-model="activeStep" :options="steps" is-align-center />
    </section>
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      class="af-panel af-form"
    >
      <section v-if="activeStep===1" class="af-form-section">
        <h2 class="af-panel-title">应用基本信息</h2>
        <div class="af-form-grid">
          <el-form-item label="应用名称" prop="name">
            <pm-input size="default" v-model="form.name" maxlength="30" show-word-limit placeholder="请输入应用名称" />
          </el-form-item>
          <el-form-item label="应用编码" prop="code">
            <pm-input size="default" v-model="form.code" placeholder="全局唯一，如 order-center" />
          </el-form-item>
          <el-form-item label="应用类型" prop="type">
            <pm-select size="default" v-model="form.type" :options="typeOptions" />
          </el-form-item>
          <el-form-item label="所属部门" prop="department">
            <pm-select size="default" v-model="form.department" :options="departmentOptions" />
          </el-form-item>
        </div>
        <el-form-item label="应用说明">
          <pm-textarea size="default" v-model="form.description" :rows="4" />
        </el-form-item>
      </section>
      <section v-else-if="activeStep===2" class="af-form-section">
        <h2 class="af-panel-title">技术与环境配置</h2>
        <div class="af-form-grid">
          <el-form-item label="访问协议">
            <pm-select size="default" v-model="form.protocol" :options="protocolOptions" />
          </el-form-item>
          <el-form-item label="运行环境">
            <pm-select size="default" v-model="form.environment" :options="environmentOptions" />
          </el-form-item>
          <el-form-item label="应用地址" prop="url">
            <pm-input size="default" v-model="form.url" placeholder="https://" />
          </el-form-item>
          <el-form-item label="回调地址">
            <pm-input size="default" v-model="form.callback" placeholder="https://" />
          </el-form-item>
        </div>
      </section>
      <section v-else class="af-form-section">
        <h2 class="af-panel-title">权限与提交确认</h2>
        <div class="af-form-grid">
          <el-form-item label="负责人" prop="owner">
            <pm-select size="default" v-model="form.owner" :options="ownerOptions" />
          </el-form-item>
          <el-form-item label="令牌有效期">
            <pm-select size="default" v-model="form.tokenTtl" :options="ttlOptions" />
          </el-form-item>
          <el-form-item label="授权数据源">
            <pm-select size="default" v-model="form.sources" :options="sourceOptions" multiple />
          </el-form-item>
          <el-form-item label="创建后立即启用">
            <pm-switch
              :model-value="String(form.enabled)"
              active-text="启用"
              @update:model-value="form.enabled = $event === 'true'"
            />
          </el-form-item>
        </div>
        <div class="af-panel" style="box-shadow:none;background:var(--af-surface-soft)">
          <div class="af-form-grid">
            <div>
              <span style="color:var(--af-text-secondary);font-size:11px">应用标识</span>
              <strong style="display:block;margin-top:5px">{{form.code||'未填写'}}</strong>
            </div>
            <div>
              <span style="color:var(--af-text-secondary);font-size:11px">运行环境</span>
              <strong style="display:block;margin-top:5px">{{form.environment}}</strong>
            </div>
          </div>
        </div>
      </section>
      <footer class="af-form-actions">
        <el-button v-if="activeStep>1" @click="activeStep--">上一步</el-button>
        <el-button v-if="activeStep<3" type="primary" @click="next">下一步</el-button>
        <el-button v-else type="primary" @click="submit">提交注册</el-button>
      </footer>
    </el-form>
    </div>
  </div>
</template>
<script setup>
import { reactive, ref } from "vue";
import { ElMessage } from "element-plus";
const emit = defineEmits(["navigate"]);
const activeStep = ref(1),
  steps = [
    { label: "基本信息", description: "应用身份与归属", value: 1 },
    { label: "技术配置", description: "协议与环境参数", value: 2 },
    { label: "权限确认", description: "授权范围与提交", value: 3 }
  ];
const options = values => values.map(value => ({ label: value, value }));
const typeOptions = options([
    "低代码应用",
    "高代码应用",
    "数据应用",
    "门户应用"
  ]),
  departmentOptions = options(["数字化平台部", "业务运营部", "数据管理部"]),
  protocolOptions = options(["HTTPS", "HTTP", "内部路由"]),
  environmentOptions = options(["生产环境", "预发布环境", "测试环境"]),
  ownerOptions = options(["周宁", "林川", "陈序", "许安"]),
  ttlOptions = options(["30 天", "90 天", "180 天", "永久"]),
  sourceOptions = options([
    "用户中心",
    "组织权限库",
    "订单数据源",
    "客户数据平台"
  ]);
const formRef = ref(),
  form = reactive({
    name: "",
    code: "",
    type: "低代码应用",
    department: "数字化平台部",
    description: "",
    protocol: "HTTPS",
    environment: "生产环境",
    url: "",
    callback: "",
    owner: "",
    tokenTtl: "90 天",
    sources: [],
    enabled: true
  });
const rules = {
  name: [{ required: true, message: "请输入应用名称" }],
  code: [{ required: true, message: "请输入应用编码" }],
  type: [{ required: true, message: "请选择应用类型" }],
  department: [{ required: true, message: "请选择所属部门" }],
  url: [{ required: true, message: "请输入应用地址" }],
  owner: [{ required: true, message: "请选择负责人" }]
};
const next = async () => {
  try {
    if (activeStep.value === 1)
      await formRef.value.validateField(["name", "code", "type", "department"]);
    if (activeStep.value === 2) await formRef.value.validateField(["url"]);
    activeStep.value++;
  } catch (_) {
    ElMessage.warning("请补全当前步骤信息");
  }
};
const submit = async () => {
  try {
    await formRef.value.validate();
    ElMessage.success("应用已注册");
    emit("navigate", "applications");
  } catch (_) {
    ElMessage.warning("请检查应用配置");
  }
};
</script>
