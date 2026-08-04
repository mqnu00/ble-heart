<template>
  <div class="device-scan">
    <div class="scan-actions">
      <el-button
        :type="scanning ? 'danger' : 'primary'"
        @click="$emit('scan')"
      >
        <el-icon><Search /></el-icon>
        {{ scanning ? '停止扫描' : '扫描设备' }}
      </el-button>
      <el-button
        v-if="isConnected"
        type="danger"
        plain
        @click="$emit('disconnect')"
      >
        断开 {{ connectedDeviceName }}
      </el-button>
      <!-- 附加操作区(如 RSSI 监听状态),由父组件注入 -->
      <slot name="actions" />
    </div>

    <el-table
      :data="devices"
      style="width: 100%"
      v-if="devices.length > 0"
      size="small"
      max-height="400"
      class="device-table"
    >
      <el-table-column prop="name" label="设备名称" min-width="120" />
      <el-table-column prop="address" label="地址" min-width="140" />
      <el-table-column prop="rssi" label="信号强度" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="rssiTagType(row.rssi)" size="small">
            {{ row.rssi }} dBm
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160" align="center">
        <template #default="{ row }">
          <template v-if="!isConnected || row.id !== connectedDeviceId">
            <el-button
              type="primary"
              size="small"
              link
              @click="$emit('connect', row.id)"
            >
              连接
            </el-button>
            <el-button
              type="warning"
              size="small"
              link
              @click="$emit('monitor', row.id)"
            >
              监听
            </el-button>
          </template>
          <el-tag v-else type="success" size="small">已连接</el-tag>
        </template>
      </el-table-column>
    </el-table>

    <div class="empty-hint" v-else>
      <el-icon><Connection /></el-icon>
      <p>{{ scanning ? '正在搜索蓝牙设备...' : '点击"扫描设备"搜索附近的蓝牙心率设备' }}</p>
    </div>

  </div>
</template>

<script setup lang="ts">
import type { BLEDevice } from '@/types'

defineProps<{
  devices: BLEDevice[]
  scanning: boolean
  connectedDeviceId: string
  isConnected: boolean
  connectedDeviceName: string
}>()

defineEmits<{
  scan: []
  connect: [deviceId: string]
  disconnect: []
  monitor: [deviceId: string]
}>()

function rssiTagType(rssi: number): string {
  if (rssi > -60) return 'success'
  if (rssi > -80) return 'warning'
  return 'danger'
}
</script>

<style lang="scss" scoped>
.device-scan {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.scan-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.device-table {
  :deep(.el-table) {
    background: transparent;
    --el-table-bg-color: transparent;
    --el-table-tr-bg-color: transparent;
    --el-table-header-bg-color: rgba(255, 255, 255, 0.03);
    --el-table-border-color: rgba(255, 255, 255, 0.06);
    --el-table-text-color: #e0e0e0;
    --el-table-header-text-color: #a0a0a0;
    --el-table-row-hover-bg-color: rgba(255, 255, 255, 0.04);
  }
}

.empty-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px;
  color: $text-secondary;
  font-size: 14px;

  .el-icon {
    font-size: 36px;
    opacity: 0.4;
  }
}

</style>
