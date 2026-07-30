<template>
  <div class="settings">
    <el-card class="settings-card" shadow="hover">
      <template #header>
        <span>蓝牙设备</span>
      </template>
      <DeviceScan
        :devices="devices"
        :scanning="scanning"
        :connected-device-id="config.targetDeviceId"
        :is-connected="state.deviceStatus === 'connected'"
        :connected-device-name="state.deviceName || config.targetDeviceName"
        @scan="handleScan"
        @connect="handleConnect"
        @disconnect="handleDisconnect"
      />
    </el-card>

    <el-card class="settings-card" shadow="hover">
      <template #header>
        <span>锁屏设置</span>
      </template>
      <TimeoutSlider
        title="心跳超时"
        :model-value="localTimeout"
        :min="5"
        :max="60"
        :step="5"
        unit="秒"
        description="未收到心率数据超过此时长后自动锁屏"
        @update:model-value="localTimeout = $event"
      />
      <TimeoutSlider
        title="解锁确认"
        :model-value="localUnlockDelay"
        :min="1"
        :max="10"
        :step="1"
        unit="秒"
        description="连续收到心率数据超过此时长后自动解锁"
        @update:model-value="localUnlockDelay = $event"
      />
    </el-card>

    <el-card class="settings-card" shadow="hover">
      <template #header>
        <span>安全设置</span>
      </template>
      <div class="security-section">
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">自动解锁</span>
            <span class="setting-desc">心率恢复后自动解锁 Windows</span>
          </div>
          <el-switch
            :model-value="localAutoUnlock"
            @update:model-value="handleAutoUnlockChange"
          />
        </div>

        <div class="setting-row" v-if="localAutoUnlock">
          <div class="setting-info">
            <span class="setting-label">Windows 登录密码</span>
            <span class="setting-desc">
              用于自动解锁，密码使用 DPAPI 加密存储
            </span>
          </div>
          <div class="password-actions">
            <el-button
              v-if="!showPasswordInput"
              :type="config.hasPassword ? 'warning' : 'primary'"
              size="small"
              @click="showPasswordInput = true"
            >
              {{ config.hasPassword ? '修改密码' : '设置密码' }}
            </el-button>
            <el-button
              v-if="config.hasPassword"
              type="danger"
              size="small"
              plain
              @click="handleClearPassword"
            >
              清除密码
            </el-button>
          </div>
        </div>

        <div class="password-input-row" v-if="showPasswordInput && localAutoUnlock">
          <el-input
            v-model="passwordInput"
            type="password"
            placeholder="输入 Windows 登录密码"
            show-password
            size="small"
          />
          <el-button type="primary" size="small" @click="handleSavePassword">
            保存
          </el-button>
          <el-button size="small" @click="showPasswordInput = false">
            取消
          </el-button>
        </div>
      </div>
    </el-card>

    <el-card class="settings-card" shadow="hover">
      <template #header>
        <span>常规设置</span>
      </template>
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">开机自启动</span>
          <span class="setting-desc">系统启动时自动运行</span>
        </div>
        <el-switch
          :model-value="localAutoStart"
          @update:model-value="localAutoStart = $event"
        />
      </div>
    </el-card>

    <el-card class="settings-card" shadow="hover">
      <template #header>
        <span>功能测试</span>
      </template>
      <div class="test-section">
        <div class="test-row">
          <div class="test-info">
            <span class="test-label">测试锁屏</span>
            <span class="test-desc">立即锁定当前 Windows 工作站</span>
          </div>
          <el-button type="warning" plain size="small" @click="handleTestLock" :loading="testLocking">
            锁屏测试
          </el-button>
        </div>
        <div class="test-row">
          <div class="test-info">
            <span class="test-label">测试解锁</span>
            <span class="test-desc">验证自动解锁功能是否正常（需先设置密码）</span>
          </div>
          <el-button type="success" plain size="small" @click="handleTestUnlock" :loading="testUnlocking">
            解锁测试
          </el-button>
        </div>
      </div>
    </el-card>

    <div class="save-row">
      <el-button type="primary" @click="handleSaveSettings" :loading="saving">
        保存设置
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useElectron } from '@/composables/useElectron'
import DeviceScan from '@/components/DeviceScan.vue'
import TimeoutSlider from '@/components/TimeoutSlider.vue'

const {
  state, config, devices, scanning,
  startScan, stopScan, connectDevice, disconnectDevice,
  updateConfig, setPassword, clearPassword
} = useElectron()

const showPasswordInput = ref(false)
const passwordInput = ref('')
const saving = ref(false)
const testLocking = ref(false)
const testUnlocking = ref(false)

// Local editing state (not saved until user clicks "保存设置")
const localTimeout = ref(15)
const localUnlockDelay = ref(3)
const localAutoUnlock = ref(false)
const localAutoStart = ref(false)

// Sync local state from loaded config
watch(() => config.value, (c) => {
  localTimeout.value = c.heartbeatTimeout
  localUnlockDelay.value = c.unlockDelay
  localAutoUnlock.value = c.autoUnlock
  localAutoStart.value = c.autoStart
}, { immediate: true, deep: true })

async function handleScan() {
  if (scanning.value) {
    await stopScan()
  } else {
    try {
      await startScan()
    } catch (err: any) {
      console.error('Scan failed:', err)
      ElMessage.error(err.message || 'Scan failed. Check if Bluetooth is enabled.')
    }
  }
}

async function handleConnect(deviceId: string) {
  try {
    await connectDevice(deviceId)
    ElMessage.success('设备连接成功')
  } catch (err: any) {
    ElMessage.error(err.message || '设备连接失败')
  }
}

async function handleDisconnect() {
  await disconnectDevice()
  ElMessage.info('设备已断开')
}

async function handleAutoUnlockChange(value: boolean) {
  if (!value && config.value.hasPassword) {
    await ElMessageBox.confirm(
      '关闭自动解锁将不会删除已保存的密码，确定关闭？',
      '确认',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
  }
  localAutoUnlock.value = value
  if (!value) {
    showPasswordInput.value = false
  }
}

async function handleSavePassword() {
  if (!passwordInput.value) {
    ElMessage.warning('请输入密码')
    return
  }
  await setPassword(passwordInput.value)
  passwordInput.value = ''
  showPasswordInput.value = false
  ElMessage.success('密码已安全保存')
}

async function handleClearPassword() {
  await ElMessageBox.confirm(
    '确定要清除已保存的密码吗？自动解锁功能将无法使用。',
    '确认清除',
    { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
  )
  await clearPassword()
  ElMessage.success('密码已清除')
}

async function handleSaveSettings() {
  saving.value = true
  try {
    await updateConfig({
      heartbeatTimeout: localTimeout.value,
      unlockDelay: localUnlockDelay.value,
      autoUnlock: localAutoUnlock.value,
      autoStart: localAutoStart.value
    })
    ElMessage.success('设置已保存')
  } catch (err: any) {
    ElMessage.error(err.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleTestLock() {
  if (!window.electronAPI) return
  testLocking.value = true
  try {
    const result = await window.electronAPI.testLock()
    if (result.success) {
      ElMessage.success('锁屏命令已执行')
    } else {
      ElMessage.error(result.message || '锁屏失败')
    }
  } catch (err: any) {
    ElMessage.error(err.message || '锁屏失败')
  } finally {
    testLocking.value = false
  }
}

async function handleTestUnlock() {
  if (!window.electronAPI) return
  testUnlocking.value = true
  try {
    const result = await window.electronAPI.testUnlock()
    if (result.success) {
      ElMessage.success('解锁命令已执行')
    } else {
      ElMessage.error(result.message || '解锁失败')
    }
  } catch (err: any) {
    ElMessage.error(err.message || '解锁失败')
  } finally {
    testUnlocking.value = false
  }
}
</script>

<style lang="scss" scoped>
.settings {
  max-width: 640px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-card {
  background: $card-bg;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: $border-radius;

  :deep(.el-card__header) {
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    color: $text-color;
    font-size: 15px;
    font-weight: 600;
    padding: 14px 20px;
  }

  :deep(.el-card__body) {
    padding: 20px;
  }
}

.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;

  &:not(:last-child) {
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .setting-label {
    color: $text-color;
    font-size: 14px;
  }

  .setting-desc {
    color: $text-secondary;
    font-size: 12px;
  }
}

.security-section {
  display: flex;
  flex-direction: column;
}

.password-actions {
  display: flex;
  gap: 8px;
}

.password-input-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 12px;
  padding: 12px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.04);

  .el-input {
    flex: 1;
  }
}

.save-row {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}

.test-section {
  display: flex;
  flex-direction: column;
}

.test-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;

  &:not(:last-child) {
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }
}

.test-info {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .test-label {
    color: $text-color;
    font-size: 14px;
  }

  .test-desc {
    color: $text-secondary;
    font-size: 12px;
  }
}
</style>
