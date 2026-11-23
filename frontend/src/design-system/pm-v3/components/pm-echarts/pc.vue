<template>
  <div style="width: 100%">
    <div v-show="!chartCorrect" style="color: #F56C6C;text-align: center;font-weight: bold">
      请设置正确的维度、数值信息，或使用自定义模式
    </div>
    <div ref="myChart" :style="{width: width, height: height}" v-show="chartCorrect" />
  </div>
</template>

<script>
// 预览接入：上游使用 echarts/dist/echarts.common（无扩展名），Vite 下统一改为包入口
import * as echarts from 'echarts'

/**
 * ECharts 图表组件，基于 ECharts 封装的图表展示，支持自适应和动态更新
 */
export default {
  name: 'pm-echarts',
  props: {
    option: {
      type: Object,
      default: () => {}
    },
    width: {
      type: String,
      default: '100%'
    },
    height: {
      type: String,
      default: '100%'
    },
  },
  data() {
    return {
      myChart: null,
      chartCorrect: false
    }
  },
  watch: {
    'option.chartView'(val) {
      this.myChart.setOption(val)
    }
  },
  mounted() {
    this.drawLine()
  },
  beforeUnmount() {
    if (this.myChart) {
      this.myChart.dispose()
      this.myChart = null
    }
  },
  methods: {
    drawLine() {
      if (this.option.chartView && this.option.chartView.series && this.option.chartView.series.length > 0 || this.option.currentType === 'text') {
        this.chartCorrect = true
      }
      this.$nextTick(() => {
        this.myChart = echarts.init(this.$refs.myChart)
        this.myChart.setOption(this.option.chartView || {})
        this.myChart.on('click', (params) => {
          if (this.$parent && this.$parent.openChartDialog) {
            this.$parent.openChartDialog()
          }
          if (this.$parent && this.$parent.onChartClick) {
            this.$parent.onChartClick(params)
          }
          window.parent.postMessage(
            { type: 'chartClick', seriesName: params.seriesName, name: params.name, dataIndex: params.dataIndex },
            '*'
          )
        })
      })
    }
  },
}
</script>
