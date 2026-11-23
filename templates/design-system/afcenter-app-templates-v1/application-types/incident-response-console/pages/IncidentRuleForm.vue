<template>
  <div class="optimized-suite application-type-incident-response">
    <div class="template-stage">
      <div class="business-page tool-page rule-canvas-page">
    <header class="page-heading">
      <div>
        <h1>新建异常规则</h1>
        <p>配置检测对象、触发逻辑与自动响应动作</p>
      </div>
      <span class="status-chip status-warning">草稿</span>
    </header>
    <section class="rule-expression">
      <span>LIVE RULE EXPRESSION</span>
      <div><b>WHEN</b><strong>{{form.target}}</strong><b>{{form.operator}}</b><strong>{{form.threshold}}{{form.unit}}</strong><i>THEN</i><em>CREATE INCIDENT</em></div>
    </section>
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      class="panel form-panel tool-form"
    >
      <section class="form-section">
        <h2 class="form-section-title">
          <b>01</b>基础信息
        </h2>
        <div class="form-grid">
          <el-form-item label="规则名称" prop="name">
            <pm-input size="default" v-model="form.name" placeholder="例：订单金额异常波动检测" />
          </el-form-item>
          <el-form-item label="规则代码" prop="code">
            <pm-input size="default" v-model="form.code" placeholder="ORDER-AMOUNT-001" />
          </el-form-item>
          <el-form-item label="严重级别" prop="level">
            <pm-select size="default" v-model="form.level" :options="levelOptions" />
          </el-form-item>
          <el-form-item label="负责人">
            <pm-select size="default" v-model="form.owner" :options="ownerOptions" />
          </el-form-item>
        </div>
        <el-form-item label="规则说明">
          <pm-textarea size="default" v-model="form.description" :rows="3" />
        </el-form-item>
      </section>
      <section class="form-section">
        <h2 class="form-section-title">
          <b>02</b>检测逻辑
        </h2>
        <div class="form-grid">
          <el-form-item label="监控对象" prop="target">
            <pm-select size="default" v-model="form.target" :options="targetOptions" />
          </el-form-item>
          <el-form-item label="检测周期">
            <pm-select size="default" v-model="form.interval" :options="intervalOptions" />
          </el-form-item>
          <el-form-item label="判断条件">
            <pm-select size="default" v-model="form.operator" :options="operatorOptions" />
          </el-form-item>
          <el-form-item label="触发阈值" prop="threshold">
            <pm-input size="default" v-model="form.threshold">
              <template #append>{{form.unit}}</template>
            </pm-input>
          </el-form-item>
        </div>
      </section>
      <section class="form-section">
        <h2 class="form-section-title">
          <b>03</b>响应动作
        </h2>
        <div class="form-grid">
          <el-form-item label="规则状态">
            <pm-switch
              size="default"
              :model-value="String(form.enabled)"
              active-text="启用"
              inactive-text="停用"
              @update:model-value="form.enabled = $event === 'true'"
            />
          </el-form-item>
          <el-form-item label="Webhook 地址">
            <pm-input size="default" v-model="form.webhook" placeholder="https://hooks.example.com/alert" />
          </el-form-item>
        </div>
      </section>
      <footer class="form-actions">
        <el-button @click="saveDraft">保存草稿</el-button>
        <el-button type="primary" @click="submit">启用规则</el-button>
      </footer>
    </el-form>
      </div>
    </div>
  </div>
</template>
<script setup>
import { reactive, ref } from "vue";
import { ElMessage } from "element-plus";

const emit = defineEmits(["open-list"]);
const options = values => values.map(value => ({ label: value, value }));
const formRef = ref(),
  form = reactive({
    name: "",
    code: "",
    level: "警告",
    owner: "ops-01",
    description: "",
    target: "订单金额",
    interval: "每 5 分钟",
    operator: "波动超过",
    threshold: "20",
    unit: "%",
    enabled: true,
    webhook: ""
  });
const levelOptions = options(["严重", "警告", "提示"]),
  ownerOptions = options(["ops-01", "dev-zhou", "dev-lin"]),
  targetOptions = options(["订单金额", "登录请求", "接口响应"]),
  intervalOptions = options(["每 1 分钟", "每 5 分钟", "每 30 分钟"]),
  operatorOptions = options(["大于阈值", "小于阈值", "波动超过"]);
const rules = {
  name: [{ required: true, message: "请输入规则名称" }],
  code: [{ required: true, message: "请输入规则代码" }],
  level: [{ required: true, message: "请选择严重级别" }],
  target: [{ required: true, message: "请选择监控对象" }],
  threshold: [{ required: true, message: "请输入触发阈值" }]
};
const saveDraft = () => ElMessage.success("规则草稿已保存");
const submit = async () => {
  try {
    await formRef.value.validate();
    ElMessage.success("异常规则已启用");
    emit("open-list");
  } catch (_) {
    ElMessage.warning("请补全规则配置");
  }
};
</script>
<style scoped>
.tool-kicker {
  margin: 0 0 4px !important;
  color: var(--template-primary-dark) !important;
  font-weight: 800;
  letter-spacing: 0.08em;
}
.tool-form {
  border-color: var(--template-border);
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  background: transparent;
  box-shadow: none;
  padding: 0;
  border: 0;
}
.tool-form .form-section{padding:22px;border:1px solid var(--template-border);background:var(--template-surface)}.tool-form .form-section:first-child{grid-column:1/-1}.tool-form .form-section+.form-section{padding-top:22px;border-top:1px solid var(--template-border)}.tool-form .form-actions{grid-column:1/-1;padding:16px;border:1px solid var(--template-border);background:var(--template-surface-soft)}
.tool-form .form-section-title b {
  color:var(--template-heading);
  background: var(--template-primary);
  border: 1px solid var(--template-border);
}
.rule-expression{margin:14px 0;padding:15px 18px;color:var(--template-primary-contrast);border:1px solid var(--template-border);background:var(--template-heading)}.rule-expression>span{display:block;margin-bottom:10px;color:var(--template-primary);font-size:9px;font-weight:800;letter-spacing:.13em}.rule-expression>div{display:flex;align-items:center;flex-wrap:wrap;gap:8px}.rule-expression b,.rule-expression i{font-size:10px;font-style:normal;letter-spacing:.08em}.rule-expression strong,.rule-expression em{padding:6px 9px;color:var(--template-heading);border:1px solid var(--template-primary);background:var(--template-primary);font-size:12px;font-style:normal}.rule-expression i{margin-left:auto}.rule-expression em{background:var(--template-surface)}
@media(max-width:760px){.tool-form{grid-template-columns:1fr}.tool-form .form-section:first-child,.tool-form .form-actions{grid-column:auto}.rule-expression i{margin-left:0}}
</style>
