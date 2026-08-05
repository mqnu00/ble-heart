<template>
  <div class="dashboard">
    <div class="heart-rate-section">
      <HeartRateDisplay
        :heart-rate="state.heartRate"
        :device-status="state.deviceStatus"
        :lock-state="state.lockState"
        :device-name="state.deviceName"
      />
    </div>

    <div class="status-section">
      <StatusBadge
        :device-status="state.deviceStatus"
        :lock-state="state.lockState"
      />
    </div>

    <div class="info-cards">
      <el-card class="info-card" shadow="hover">
        <template #header>
          <span>设备信息</span>
        </template>
        <div class="info-row">
          <span class="label">设备名称</span>
          <span class="value">{{ state.deviceName || '未连接' }}</span>
        </div>
        <div class="info-row">
          <span class="label">MAC 地址</span>
          <span class="value">{{ config.targetDeviceId || '—' }}</span>
        </div>
        <div class="info-row">
          <span class="label">连接状态</span>
          <el-tag
            :type="statusTagType"
            size="small"
          >{{ statusText }}</el-tag>
        </div>
        <div class="info-row">
          <span class="label">锁屏状态</span>
          <el-tag
            :type="lockTagType"
            size="small"
          >{{ lockText }}</el-tag>
        </div>
        <div class="info-row" v-if="config.targetDeviceId">
          <span class="label">RSSI 监听</span>
          <span class="value">
            {{ config.targetDeviceName }}
            <el-tag
              v-if="bluetoothError"
              type="danger"
              size="small"
              effect="plain"
            >蓝牙未开启</el-tag>
            <el-tag
              v-else
              :type="rssiTagType(state.rssi ?? -100)"
              size="small"
              effect="plain"
            >{{ state.rssi !== null ? state.rssi + ' dBm' : '等待...' }}</el-tag>
          </span>
        </div>
      </el-card>

      <el-card class="info-card" shadow="hover">
        <template #header>
          <span>配置摘要</span>
        </template>
        <div class="info-row">
          <span class="label">超时锁屏</span>
          <span class="value">{{ config.heartbeatTimeout }} 秒</span>
        </div>
        <div class="info-row">
          <span class="label">自动解锁</span>
          <span class="value">{{ config.autoUnlock ? '已启用' : '未启用' }}</span>
        </div>
        <div class="info-row">
          <span class="label">密码配置</span>
          <span class="value">{{ config.hasPassword ? '已设置' : '未设置' }}</span>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useElectron } from '@/composables/useElectron'
import HeartRateDisplay from '@/components/HeartRateDisplay.vue'
import StatusBadge from '@/components/StatusBadge.vue'

const { state, config, bluetoothError } = useElectron()

const statusTagType = computed(() => {
  switch (state.value.deviceStatus) {
    case 'connected': return 'success'
    case 'scanning': return 'warning'
    default: return 'info'
  }
})

const statusText = computed(() => {
  switch (state.value.deviceStatus) {
    case 'connected': return '已连接'
    case 'scanning': return '扫描中'
    default: return '未连接'
  }
})

const lockTagType = computed(() => {
  switch (state.value.lockState) {
    case 'locked': return 'danger'
    case 'pending': return 'warning'
    default: return 'success'
  }
})

const lockText = computed(() => {
  switch (state.value.lockState) {
    case 'locked': return '已锁定'
    case 'pending': return '即将锁定...'
    default: return '已解锁'
  }
})

function rssiTagType(rssi: number): string {
  if (rssi > -60) return 'success'
  if (rssi > -80) return 'warning'
  return 'danger'
}
</script>

<style lang="scss" scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 20px 0;
}

.heart-rate-section {
  width: 100%;
  display: flex;
  justify-content: center;
}

.status-section {
  width: 100%;
  display: flex;
  justify-content: center;
}

.info-cards {
  display: flex;
  gap: 16px;
  width: 100%;
  max-width: 600px;
}

.info-card {
  flex: 1;
  background: $card-bg;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: $border-radius;

  :deep(.el-card__header) {
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    color: $text-secondary;
    font-size: 13px;
    padding: 12px 16px;
  }

  :deep(.el-card__body) {
    padding: 16px;
  }
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;

  &:not(:last-child) {
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .label {
    color: $text-secondary;
    font-size: 13px;
  }

  .value {
    color: $text-color;
    font-size: 13px;
  }
}
</style>
