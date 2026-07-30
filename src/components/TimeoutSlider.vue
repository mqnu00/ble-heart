<template>
  <div class="timeout-slider">
    <div class="slider-header">
      <span class="slider-label">心率丢失超时时间</span>
      <span class="slider-value">{{ modelValue }} 秒</span>
    </div>
    <el-slider
      :model-value="modelValue"
      :min="5"
      :max="60"
      :step="5"
      :marks="marks"
      show-stops
      @update:model-value="$emit('update:modelValue', $event)"
    />
    <p class="slider-hint">
      当手表心率信号中断超过设定时间后，自动锁定 Windows
    </p>
  </div>
</template>

<script setup lang="ts">
const marks = {
  5: '5s',
  15: '15s',
  30: '30s',
  45: '45s',
  60: '60s'
}

defineProps<{
  modelValue: number
}>()

defineEmits<{
  'update:modelValue': [value: number]
}>()
</script>

<style lang="scss" scoped>
.timeout-slider {
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
