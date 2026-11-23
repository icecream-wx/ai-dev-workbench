<template>
  <span v-html="text">
  </span>
</template>
<script>
import { get } from "lodash";
import moment from "dayjs";
export default {
  props: {
    titles: {},
    data: {},
  },
  computed: {
    text() {
      const title = get(this.titles, this.data.code);
      if (!title) {
        return "";
      }
      if (title.innerText) {
        return title.innerText;
      }
      const { type, format, options = {}, settings } = title;
      let values = "";
      if (
        this.data.value &&
        Array.isArray(this.data.value) &&
        type === "date"
      ) {
        values = this.data.value;
        return values
          .map((v) => moment(v).format(format || "YYYY-MM-DD"))
          .join("至");
      }
      if (Array.isArray(this.data.value)) {
        // 数组不是 Object 取值场景，否则 arr['name'] 为 undefined 渲染成空胶囊
        return this.data.value
          .filter((v, index) => index < 5)
          .map((v) => options[v] || v)
          .join(',');
      }
      if (this.data.value && this.data.value instanceof Object) {
        return this.data.value[(settings && settings.labelField) || "name"];
      }
      values = this.data.value && (this.data.value + "").split(",");
      let split = ",";
      return values
        .filter((v,index) => index < 5).map((v) => {
          if (type === "date") {
            split = "至";
          }
          if (v instanceof Date) {
            split = "至";
            return moment(v).format(format || "YYYY-MM-DD");
          }
          return options[v] || v;
        })
        .join(split);
    },
  },
};
</script>
