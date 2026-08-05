<template>
  <div class="status-badge">
    <div class="status-item" :class="deviceClass">
      <span class="status-dot"></span>
      <span class="status-text">{{ deviceText }}</span>
    </div>
    <div class="status-divider"></div>
    <div class="status-item" :class="lockClass">
      <span class="status-dot"></span>
      <span class="status-text">{{ lockText }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  deviceStatus: string
  lockState: string
}>()

const deviceClass = computed(() => `status-${props.deviceStatus}`)
const lockClass = computed(() => `status-${props.lockState}`)

const deviceText = computed(() => {
  switch (props.deviceStatus) {
    case 'connected': return '手表已连接'
    case 'scanning': return '正在搜索手表...'
    default: return '等待连接手表'
  }
})

const lockText = computed(() => {
  switch (props.lockState) {
    case 'locked': return '电脑已锁定'
    case 'pending': return '即将锁定...'
    default: return '电脑已解锁'
  }
})
</script>

<style lang="scss" scoped>
.status-badge {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 20px;
  background: $card-bg;
  border-radius: 24px;
  border: 1px solid var(--app-border);
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: $text-secondary;
  transition: background 0.3s;
}

.status-text {
  font-size: 13px;
  color: $text-secondary;
  transition: color 0.3s;
}

.status-divider {
  width: 1px;
  height: 16px;
  background: var(--app-border);
}

// Device status
.status-connected .status-dot {
  background: $success-color;
  box-shadow: 0 0 6px color-mix(in srgb, $success-color 50%, transparent);
}
.status-connected .status-text {
  color: $success-color;
}

.status-scanning .status-dot {
  background: $warning-color;
  box-shadow: 0 0 6px color-mix(in srgb, $warning-color 50%, transparent);
  animation: blink 1s ease-in-out infinite;
}
.status-scanning .status-text {
  color: $warning-color;
}

// Lock state
.status-locked .status-dot {
  background: $danger-color;
  box-shadow: 0 0 6px color-mix(in srgb, $danger-color 50%, transparent);
}
.status-locked .status-text {
  color: $danger-color;
}

.status-pending .status-dot {
  background: $warning-color;
  animation: blink 0.5s ease-in-out infinite;
}
.status-pending .status-text {
  color: $warning-color;
}

.status-unlocked .status-dot {
  background: $success-color;
}
.status-unlocked .status-text {
  color: $success-color;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
</style>
