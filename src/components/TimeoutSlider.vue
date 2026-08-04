<template>
  <div class="timeout-slider">
    <div class="slider-header">
      <span class="slider-label">{{ title }}</span>
      <span class="slider-value">{{ modelValue }} {{ unit }}</span>
    </div>
    <el-slider
      :model-value="modelValue"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      show-stops
      @update:model-value="$emit('update:modelValue', $event)"
    />
    <p class="slider-hint">{{ description }}</p>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  modelValue: number
  title?: string
  min?: number
  max?: number
  step?: number
  unit?: string
  description?: string
  disabled?: boolean
}>(), {
  title: '超时时间',
  min: 5,
  max: 60,
  step: 5,
  unit: '秒',
  description: '',
  disabled: false
})

defineEmits<{
  'update:modelValue': [value: number]
}>()
</script>

<style lang="scss" scoped>
.timeout-slider {
  &:not(:first-child) {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .slider-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;

    .slider-label {
      color: $text-color;
      font-size: 14px;
    }

    .slider-value {
      color: $primary-color;
      font-size: 16px;
      font-weight: 600;
    }
  }

  .slider-hint {
    margin-top: 12px;
    color: $text-secondary;
    font-size: 12px;
  }

  :deep(.el-slider) {
    --el-slider-main-bg-color: #{$primary-color};
    --el-slider-runway-bg-color: rgba(255, 255, 255, 0.1);
    --el-slider-stop-bg-color: rgba(255, 255, 255, 0.3);
    --el-slider-button-wrapper-size: 36px;
    --el-slider-button-size: 14px;
  }

  :deep(.el-slider__marks-text) {
    color: $text-secondary;
    font-size: 11px;
  }
}
</style>
