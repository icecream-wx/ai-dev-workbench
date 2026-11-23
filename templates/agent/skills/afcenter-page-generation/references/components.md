# 组件知识入口与选型

详细组件资料统一来自相邻 [pm-components-usage](../../pm-components-usage/SKILL.md)，两个技能同级分发，无需本机组件库仓库。

## 按需检索

| 需求 | 优先组件 | 原手册相对路径（从 pm-components-usage 起） |
| --- | --- | --- |
| 文本、多行、数字、开关、上传、富文本 | pm-input、pm-textarea、pm-number、pm-switch、pm-upload、pm-richtext | references/form-inputs.md |
| 静态选项、字典、人员、组织、岗位、实体、日期 | pm-select、pm-select-dict、pm-select-user、pm-select-org、pm-select-position、pm-select-entity、pm-lookup、pm-datepicker | references/selectors.md |
| 树、展示表格、图片、图表、空态 | pm-tree、pm-table、pm-image、pm-echarts、pm-empty | references/data-display.md |
| 弹窗、折叠、下拉操作 | pm-form-dialog、pm-dialog、pm-fold、pm-drop-menu | references/feedback.md |
| 工具栏、分栏、绑定、下载 | pm-toolbar、pm-toolbar-item、pm-split、pm-bind、pm-download | references/business-layout.md |

先从 `../../pm-components-usage/references/` 定位候选组件段落；有目标版本源码时再核实对应 `pc.vue` 与 `demo.vue`，源码不是使用技能的前置依赖。部分组件通过 mixin 或子组件实现，跟进其实际绑定链。注册表在 `src/components/register_pc.js`；以目标项目真正的安装方式和依赖版本为准，不新增重复注册。

参考资料的 API 表由静态扫描生成，可能有截断联合类型、遗漏继承 props、把 computed 当方法的问题。不要调用仅在表格中出现但实际未暴露的方法。也不要把“所有 $attrs 均透传”当通则；检查具体模板的绑定目标与过滤逻辑。

## 必须核实的值契约

| 组件 | 关键点 |
| --- | --- |
| pm-input / pm-textarea | v-model 值类型、maxlength 与 showWordLimit、readonly/disabled；按源码检查支持的 mode |
| pm-switch | 默认 activeValue/inactiveValue 可能是字符串 'true'/'false'；接口需要 boolean 时显式核实并绑定，不混用 |
| pm-select | 无 type 时静态 options；设置 type 后代理专用组件。不要继续臆造 settings.type 数据加载方式 |
| pm-select-dict | dictTypeCode 必填；值通常为 code，显示 name；级联 parentCode、disableWhenParentEmpty；字典码来自业务资料 |
| pm-select-entity | entity 必填；labelField/valueField 与后端字段一致；核实 queryCondition 格式及服务依赖 |
| pm-select-user / org / position | 单多选的实际值形态、ID/编码、selected 回显、tenantId/权限环境；不假设 multiple 一定返回数组 |
| pm-lookup | bindType=value/entity、valueField、labelField、selected 回显；不要把实体对象直接发给只接收 ID 的接口 |
| pm-datepicker / datepick-range | valueFormat、空值、单值或双值；范围组件可能使用 modelValue + value2，不统一套数组 |
| pm-upload | 文件 ID 与回显元数据、multiple、listType、大小单位、上传/下载地址、鉴权；不是原生 File 数组的通用替代 |
| pm-field | 根据 model/prop 动态绑定 component；核实是否包裹表单项，防止与 FormSection 的 el-form-item 重复嵌套 |

mode=view 与 readonly 的含义不同：前者通常纯文本展示，后者保留控件。按组件实现使用，不能把模式契约推广到所有组件。

## 模板优先的例外

- 标准列表默认使用 `el-table v-auto-height` 和平台 `Pagination`，不因库里存在 pm-table/pm-pagination 而替换。
- 业务确需配置列的 pm-table 时，先核实 tableData/columns、scope 插槽、checked、事件 **changrows** 及 ref 方法；它与 el-table 的 data/selection-change 契约不同。另行验证自动高度和偏好适配。
- PmSearch/PmToolbar 可能同时存在平台实现和组件库实现。读取目标工程注册来源与现有业务页，沿用模板使用的实现，不能仅按组件标签确定 API。
- 不在新页面使用源技能标为废弃的 PmFlip、PmMultiUrl、PmSelectRich、PmMain、PmHamburger，除非目标版本有明确相反依据或用户要求兼容旧页。
- PC 页面使用 PC 组件；移动端需要独立注册和布局验证，不能把本列表模板直接当移动模板交付。

## 最小组合示意

以下假设组件已按目标项目正确注册，statusDictCode 为真实业务字典码：

```vue
<el-form ref="formRef" v-bind="bindings.form" :model="form" :rules="rules">
  <FormSection :columns="bindings.formPage.columns">
    <el-form-item label="名称" prop="name">
      <pm-input v-bind="bindings.text" v-model="form.name" size="default" maxlength="64" />
    </el-form-item>
    <el-form-item label="状态" prop="status">
      <pm-select-dict v-model="form.status" :dict-type-code="statusDictCode" size="default" clearable />
    </el-form-item>
    <el-form-item label="描述" prop="description" class="pt-field-full">
      <pm-textarea v-bind="bindings.textarea" v-model="form.description" size="default" maxlength="200" />
    </el-form-item>
  </FormSection>
</el-form>
```

组件选择不能代替模型设计。生成前明确每字段初始值、提交值、回显值及转换位置；枚举、日期、人员、上传尤其需要端到端一致。
<!-- Modified by AI on 2026-11-12 11:20:40 -->
