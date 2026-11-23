<template>
  <section class="pt-form-section-card">
    <header v-if="title || description || $slots.icon || $slots.extra" class="pt-form-section-card__header">
      <div class="pt-form-section-card__heading">
        <span v-if="title" class="pt-form-section-card__marker" aria-hidden="true" />
        <span v-if="$slots.icon" class="pt-form-section-card__icon"><slot name="icon" /></span>
        <h3 v-if="title" class="pt-form-section-card__title">{{ title }}</h3>
        <span v-if="description" class="pt-form-section-card__description">{{ description }}</span>
      </div>
      <div v-if="$slots.extra" class="pt-form-section-card__extra"><slot name="extra" /></div>
    </header>
    <FormSection :columns="columns"><slot /></FormSection>
  </section>
</template>

<script setup>
import FormSection from './FormSection.vue'

defineProps({
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  columns: { type: Number, default: 1, validator: value => [1, 2].includes(value) }
})
</script>

<style scoped>
.pt-form-section-card {
  min-width: 0;
  margin-bottom: 16px;
  padding: 10px;
  border: 1px solid #ebeff5;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 2px 6px rgba(15, 23, 42, .03);
}
.pt-form-section-card__header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #ebeff5; }
.pt-form-section-card__heading { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; min-width: 0; }
.pt-form-section-card__marker { width: 4px; height: 18px; flex-shrink: 0; border-radius: 2px; background: rgb(0 96 169); }
.pt-form-section-card__icon { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; color: #2563eb; font-size: 20px; }
.pt-form-section-card__title { margin: 0; color: #111827; font-size: 14px; font-weight: 700; line-height: 24px; overflow-wrap: anywhere; }
.pt-form-section-card__description { color: #64748b; font-size: 12px; line-height: 20px; }
.pt-form-section-card__extra { margin-left: auto; }
/* 卡片统一管理段间距，内部区块只负责字段栅格。 */
.pt-form-section-card > .pt-form-section { margin-bottom: 0; }
@media (max-width: 640px) {
  .pt-form-section-card { padding: 10px; }
}
</style>
<!-- Modified by AI on 2026-11-12 16:02:04 -->
