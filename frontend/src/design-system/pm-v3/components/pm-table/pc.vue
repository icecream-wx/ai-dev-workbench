<template>
  <div :key="comKey" class="layer">
    <el-table
      ref="myTable"
      :data="tableData"
      v-bind="$attrs"
      stripe
      @selection-change="_handleSelectionChange"
      @row-click="handleRowClick"
    >
      <el-table-column v-if="showIndex" type="index" width="50" />
      <el-table-column v-if="checked && tableData.length" type="selection" :selectable="_selectDisabled" width="42" />
      <el-table-column
        v-for="(v, k) in tableColumns.filter(item => !item.hidden)"
        :key="k"
        :prop="v.prop"
        :label="v.label"
        v-bind="v"
        :width="v.width || 'auto'"
        show-overflow-tooltip
      >
        <template #header>
          <slot :name="`${v.scope}-header`" :row="v">
            <span>{{ v.label }}</span>
          </slot>
        </template>
        <template #default="scope">
          <slot :name="v.scope" :row="scope.row" :$index="scope.$index">
            <span v-show="getType(_showColData(scope.row, scope.$index, v)) !== 'object'">{{ _showColData(scope.row, scope.$index, v) }}</span>
            <el-button
              v-show="isShowDetailText(_showColData(scope.row, scope.$index, v))"
              @click.stop="showDetail(_showColData(scope.row, scope.$index, v))"
            >详细信息</el-button>
          </slot>
        </template>
      </el-table-column>
    </el-table>
    <el-dialog
      title="详细信息"
      v-model="dialogVisible"
      append-to-body
      width="900px"
    >
      <el-row>
        <el-col v-for="(item, index) in detail" :key="index">
          <span style="font-weight:bold">{{ index }}：</span>
          <span>{{ typeof item === 'object' ? JSON.stringify(item) : item }}</span>
        </el-col>
      </el-row>
      <template #footer>
        <el-button @click="dialogVisible = false">关 闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { defineComponent } from 'vue'

/**
 * 表格组件，基于 el-table 封装的数据表格，支持列配置、多选、行点击和操作栏
 */
export default defineComponent({
  name: 'PmTable',
  emits: ['changrows'],
  props: {
    tableData: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
    checked: { type: Boolean, default: false },
    showIndex: { type: Boolean, default: false },
    detailKeyWidth: { type: Number, default: 100 },
    editColumns: { type: Boolean, default: false },
    autoSelectRow: { type: Boolean, default: true },
  },
  data() {
    return {
      selectedRows: [],
      dialogVisible: false,
      detail: {},
      tableColumns: this.columns,
      comKey: Date.now(),
    }
  },
  watch: {
    tableData() {
      this.$nextTick(() => {
        this.$refs.myTable?.doLayout()
      })
    },
  },
  methods: {
    handleRowClick(row) {
      if (this.checked && this.autoSelectRow) {
        this.$refs.myTable.toggleRowSelection(row)
      }
    },
    getSelectRows() {
      return this.selectedRows
    },
    rerender() {
      this.comKey = Date.now()
    },
    getType(val) {
      return typeof val
    },
    changeColumns(columns) {
      this.tableColumns = columns
      this.rerender()
    },
    _handleSelectionChange(val) {
      this.selectedRows = val
      this.$emit('changrows', val)
    },
    _showColData(row, index, col) {
      if (col.prop) {
        let collValue = row[col.prop]
        const propArr = col.prop.split('.')
        if (propArr && propArr.length) {
          let eachRow = row
          propArr.forEach(prop => {
            collValue = eachRow[prop]
            eachRow = collValue
          })
        }
        if (col.formatter && typeof col.formatter === 'function') {
          return col.formatter(row, col, collValue, index)
        }
        if (typeof collValue === 'boolean') return collValue ? '是' : '否'
        return collValue
      }
      return ''
    },
    _selectDisabled(row) {
      return row.disabled !== true
    },
    toggleSelection(rows) {
      if (Array.isArray(rows)) {
        rows.forEach(row => this.$refs.myTable.toggleRowSelection(row))
      } else {
        this.$refs.myTable.clearSelection()
      }
    },
    showDetail(row) {
      this.detail = row
      this.dialogVisible = true
    },
    isShowDetailText(obj) {
      return typeof obj === 'object' && obj !== null && Object.keys(obj).length
    },
  },
})
</script>

<style lang="scss" scoped>
.layer { position: relative; }
</style>
