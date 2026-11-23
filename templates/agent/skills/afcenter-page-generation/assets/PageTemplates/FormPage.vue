<template>
  <section class="pt-page pt-form-page" :data-density="density" :data-sticky="stickyFooter">
    <header v-if="title || $slots.header" class="pt-header">
      <slot name="header"><h2>{{ title }}</h2></slot>
    </header>
    <div v-if="$slots.feedback" class="pt-region" role="status"><slot name="feedback" /></div>
    <div class="pt-form-content">
      <slot :columns="columns" />
    </div>
    <footer v-if="$slots.actions" class="pt-form-footer" :data-align="actionsAlign">
      <slot name="actions" />
    </footer>
  </section>
</template>

<script>
import './style.css'

export default {
  name: 'StandardFormPage',
  props: {
    title: { type: String, default: '' },
    density: { type: String, default: 'comfortable', validator: v => ['comfortable', 'compact'].includes(v) },
    actionsAlign: { type: String, default: 'start', validator: v => ['start', 'end'].includes(v) },
    columns: { type: Number, default: 1, validator: v => [1, 2].includes(v) },
    stickyFooter: { type: Boolean, default: true }
  }
}
</script>
<!-- Modified by AI on 2026-11-06 13:54:58 -->
