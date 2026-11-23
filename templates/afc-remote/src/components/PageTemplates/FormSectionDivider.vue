<template>
  <div class="pt-form-section-divider" :class="`pt-form-section-divider--${tone}`">
    <div class="pt-form-section-divider__heading">
      <span class="pt-form-section-divider__dot" aria-hidden="true" />
      <h3><span v-if="number !== ''">{{ number }} / </span>{{ title }}</h3>
    </div>
    <div v-if="$slots.extra || description" class="pt-form-section-divider__extra">
      <slot name="extra">{{ description }}</slot>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  number: { type: [String, Number], default: '' },
  description: { type: String, default: '' },
  tone: { type: String, default: 'primary', validator: value => ['primary', 'secondary'].includes(value) }
})
</script>

<style scoped>
.pt-form-section-divider {
  margin-bottom: 20px;
  --pt-section-dot: #1d4ed8;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding-bottom: 4px;
  border-bottom: 1px solid #e5eeff;
}
.pt-form-section-divider--secondary { --pt-section-dot: #6bd8cb; }
.pt-form-section-divider__heading { display: flex; align-items: center; gap: 4px; min-width: 0; }
.pt-form-section-divider__dot { width: 10px; height: 10px; flex-shrink: 0; border-radius: 50%; background: var(--pt-section-dot); }
.pt-form-section-divider__heading h3 { margin: 0; color: #0b1c30; font-size: 15px; font-weight: 600; line-height: 20px; overflow-wrap: anywhere; }
.pt-form-section-divider__extra { margin-left: auto; color: #747686; font-size: 11px; font-weight: 600; line-height: 14px; }
</style>
<!-- Modified by AI on 2026-11-13 09:26:37 -->
