<template>
  <div class="heart-rate-display" :class="{ 'has-signal': heartRate !== null }">
    <div class="hr-circle">
      <div class="hr-pulse" :class="{ animating: heartRate !== null }"></div>
      <div class="hr-content">
        <span class="hr-value">{{ displayValue }}</span>
        <span class="hr-unit">BPM</span>
      </div>
    </div>
    <div class="hr-device-name" v-if="deviceName">
      <el-icon><Watch /></el-icon>
      {{ deviceName }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  heartRate: number | null
  deviceStatus: string
  lockState: string
  deviceName: string | null
}>()

const displayValue = computed(() => {
  if (props.heartRate !== null) return props.heartRate
  if (props.deviceStatus === 'scanning') return '搜索中'
  if (props.deviceStatus === 'connected') return '等待数据'
  return '--'
})
</script>

<style lang="scss" scoped>
.heart-rate-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px 0 20px;
}

.hr-circle {
  position: relative;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: $card-bg;
  border: 3px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.5s;
}

.has-signal .hr-circle {
  border-color: rgba($danger-color, 0.6);
  box-shadow: 0 0 40px rgba($danger-color, 0.15);
}

.hr-pulse {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2px solid transparent;
  transition: all 0.3s;

  &.animating {
    border-color: rgba($danger-color, 0.3);
    animation: pulse 1.5s ease-in-out infinite;
  }
}

@keyframes pulse {
  0% {
    transform: scale(0.95);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.5;
  }
  100% {
    transform: scale(0.95);
    opacity: 1;
  }
}

.hr-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 1;
}

.hr-value {
  font-size: 64px;
  font-weight: 700;
  color: $text-color;
  line-height: 1;
  transition: color 0.3s;
}

.has-signal .hr-value {
  color: $danger-color;
}

.hr-unit {
  font-size: 14px;
  color: $text-secondary;
  margin-top: 4px;
  letter-spacing: 2px;
}

.hr-device-name {
  display: flex;
  align-items: center;
  gap: 6px;
  color: $text-secondary;
  font-size: 13px;
  padding: 6px 16px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 20px;
}
</style>
