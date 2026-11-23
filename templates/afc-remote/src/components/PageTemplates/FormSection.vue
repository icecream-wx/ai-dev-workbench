<template>
  <section class="pt-form-section">
    <h3 v-if="title">{{ title }}</h3>
    <p v-if="description" class="pt-description">{{ description }}</p>
    <div class="pt-field-grid" :data-columns="columns"><slot /></div>
  </section>
</template>

<script>
import './style.css'

export default {
  name: 'FormSection',
  props: {
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    columns: { type: Number, default: 1, validator: v => [1, 2].includes(v) }
  }
}
</script>
<!-- Modified by AI on 2026-11-06 13:54:58 -->
