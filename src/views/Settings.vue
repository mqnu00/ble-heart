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
        :bluetooth-error="!!bluetoothError"
        @scan="handleScan"
        @connect="handleConnect"
        @disconnect="handleDisconnect"
        @monitor="handleMonitor"
      >
        <template #actions>
          <!-- RSSI 监听状态,显示在心率设备断开按钮右侧 -->
          <div class="rssi-monitor" v-if="config.targetDeviceId">
            <span class="rssi-monitor-name">{{ config.targetDeviceName }}</span>
            <el-tag :type="rssiTagType(state.rssi ?? -100)" size="small" effect="plain">
              {{ state.rssi !== null ? state.rssi + ' dBm' : '等待...' }}
            </el-tag>
            <el-button type="danger" size="small" plain @click="handleStopRssi">
              停止监听
            </el-button>
          </div>
        </template>
      </DeviceScan>
    </el-card>

    <el-card class="settings-card" shadow="hover">
      <template #header>
        <span>锁屏设置</span>
      </template>
      <div class="timeout-slider">
        <div class="slider-header">
          <span class="slider-label">锁屏阈值</span>
          <span class="slider-value">{{ localRssiLockThreshold }} dBm</span>
        </div>
        <el-slider
          :model-value="localRssiLockThreshold"
          :min="-100"
          :max="-40"
          :step="5"
          show-stops
          @update:model-value="localRssiLockThreshold = $event"
        />
        <p class="slider-hint">信号低于此阈值持续超时后自动锁屏</p>
      </div>

      <div class="timeout-slider">
        <div class="slider-header">
          <span class="slider-label">恢复阈值</span>
          <span class="slider-value">{{ localRssiUnlockThreshold }} dBm</span>
        </div>
        <el-slider
          :model-value="localRssiUnlockThreshold"
          :min="-100"
          :max="-40"
          :step="5"
          show-stops
          @update:model-value="localRssiUnlockThreshold = $event"
        />
        <p class="slider-hint">信号高于此阈值持续后自动解锁（应大于锁屏阈值以避抖动）</p>
      </div>

      <TimeoutSlider
        title="心跳超时"
        :model-value="localTimeout"
        :min="5"
        :max="60"
        :step="5"
        unit="秒"
        description="未收到心率数据或 RSSI 信号弱持续此时长后自动锁屏"
        @update:model-value="localTimeout = $event"
      />
      <TimeoutSlider
        title="解锁确认"
        :model-value="localUnlockDelay"
        :min="1"
        :max="10"
        :step="1"
        unit="秒"
        description="连续收到心率数据或 RSSI 信号恢复持续此时长后自动解锁"
        :disabled="!hodorInstalled"
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
            <span class="setting-label">解锁组件</span>
            <span class="setting-desc">UnlockProvider.dll 凭据提供程序，用于锁屏界面自动解锁</span>
          </div>
          <div class="hodor-actions">
            <el-tag :type="hodorInstalled ? 'success' : 'warning'" size="small" effect="plain">
              {{ hodorInstalled ? '已安装' : '未安装' }}
            </el-tag>
            <el-button
              v-if="!hodorInstalled"
              type="primary"
              size="small"
              :loading="hodorBusy"
              @click="handleInstallHodor"
            >
              安装
            </el-button>
            <el-button
              v-else
              type="danger"
              size="small"
              plain
              :loading="hodorBusy"
              @click="handleUninstallHodor"
            >
              卸载
            </el-button>
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">自动解锁</span>
            <span class="setting-desc">心率恢复后自动解锁 Windows</span>
          </div>
          <el-switch
            :model-value="localAutoUnlock"
            :disabled="!hodorInstalled"
            @update:model-value="handleAutoUnlockChange"
          />
        </div>

        <div class="setting-row" v-if="localAutoUnlock">
          <div class="setting-info">
            <span class="setting-label">Windows 登录密码</span>
            <span class="setting-desc">
              用于自动解锁，密码使用 DPAPI 加密存储。
              账户名无需填写，解锁时自动使用当前 Windows 登录账户
            </span>
          </div>
          <div class="password-actions">
            <el-button
              v-if="!showPasswordInput"
              :type="config.hasPassword ? 'warning' : 'primary'"
              size="small"
              :disabled="!hodorInstalled"
              @click="showPasswordInput = true"
            >
              {{ config.hasPassword ? '修改密码' : '设置密码' }}
            </el-button>
            <el-button
              v-if="config.hasPassword"
              type="danger"
              size="small"
              plain
              :disabled="!hodorInstalled"
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
          <el-button
            type="success"
            plain
            size="small"
            :disabled="!hodorInstalled"
            :loading="testUnlocking"
            @click="handleTestUnlock"
          >
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
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useElectron } from '@/composables/useElectron'
import DeviceScan from '@/components/DeviceScan.vue'
import TimeoutSlider from '@/components/TimeoutSlider.vue'

const {
  state, config, devices, scanning, bluetoothError,
  startScan, stopScan, connectDevice, disconnectDevice,
  updateConfig, setPassword, clearPassword
} = useElectron()

const showPasswordInput = ref(false)
const passwordInput = ref('')
const saving = ref(false)
const testLocking = ref(false)
const testUnlocking = ref(false)

// ── hodor 解锁组件状态 ──
const hodorStatus = ref<{ registered: boolean; dllInstalled: boolean; admin: boolean } | null>(null)
const hodorInstalled = computed(
  () => !!hodorStatus.value && hodorStatus.value.registered && hodorStatus.value.dllInstalled
)
const hodorBusy = ref(false)

// Local editing state (not saved until user clicks "保存设置")
const localTimeout = ref(15)
const localUnlockDelay = ref(3)
const localAutoUnlock = ref(false)
const localAutoStart = ref(false)
const localRssiLockThreshold = ref(-80)
const localRssiUnlockThreshold = ref(-70)

// Sync local state from loaded config
watch(() => config.value, (c) => {
  localTimeout.value = c.heartbeatTimeout
  localUnlockDelay.value = c.unlockDelay
  localAutoUnlock.value = c.autoUnlock
  localAutoStart.value = c.autoStart
  localRssiLockThreshold.value = c.rssiLockThreshold
  localRssiUnlockThreshold.value = c.rssiUnlockThreshold
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

async function handleMonitor(deviceId: string) {
  const device = devices.value.find(d => d.id === deviceId || d.address === deviceId)
  if (!device) {
    ElMessage.warning('设备信息丢失，请重新扫描')
    return
  }
  await updateConfig({
    targetDeviceId: deviceId,
    targetDeviceName: device.name
  })
  ElMessage.success(`开始监听信号: ${device.name}`)
}

async function handleStopRssi() {
  await updateConfig({
    targetDeviceId: '',
    targetDeviceName: ''
  })
  ElMessage.info('已停止 RSSI 监听')
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

// ── hodor 解锁组件安装/卸载 ──

async function loadHodorStatus() {
  if (!window.electronAPI) return
  hodorStatus.value = await window.electronAPI.getHodorStatus()
}

async function handleInstallHodor() {
  try {
    await ElMessageBox.confirm(
      'UnlockProvider.dll 是 Windows 凭据提供程序（Credential Provider）。\n\n' +
        '安装后，本应用可在锁屏界面通过命名管道向它发送解锁命令，实现自动解锁。\n\n' +
        '安装需要将 DLL 复制到 C:\\Windows\\System32 并写入 HKLM 注册表，将请求管理员权限。',
      '安装解锁组件',
      { confirmButtonText: '继续安装', cancelButtonText: '取消', type: 'info' }
    )
  } catch {
    return // 用户取消
  }

  hodorBusy.value = true
  try {
    const result = await window.electronAPI.installHodor()
    if (result.success) {
      ElMessage.success(result.message)
    } else {
      ElMessage.warning(result.message)
    }
  } catch (err: any) {
    ElMessage.error(err.message || '安装失败')
  } finally {
    hodorBusy.value = false
    await loadHodorStatus()
  }
}

async function handleUninstallHodor() {
  try {
    await ElMessageBox.confirm(
      '卸载后将无法使用自动解锁、测试解锁等功能，确定卸载？',
      '卸载解锁组件',
      { confirmButtonText: '确定卸载', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return // 用户取消
  }

  hodorBusy.value = true
  try {
    const result = await window.electronAPI.uninstallHodor()
    if (result.success) {
      ElMessage.success(result.message)
      // 卸载后自动解锁配置已失效，关闭该开关并收起密码输入
      await updateConfig({ autoUnlock: false })
      showPasswordInput.value = false
    } else {
      ElMessage.warning(result.message)
    }
  } catch (err: any) {
    ElMessage.error(err.message || '卸载失败')
  } finally {
    hodorBusy.value = false
    await loadHodorStatus()
  }
}

onMounted(loadHodorStatus)

function rssiTagType(rssi: number): string {
  if (rssi > -60) return 'success'
  if (rssi > -80) return 'warning'
  return 'danger'
}

async function handleSaveSettings() {
  saving.value = true
  try {
    await updateConfig({
      heartbeatTimeout: localTimeout.value,
      unlockDelay: localUnlockDelay.value,
      autoUnlock: localAutoUnlock.value,
      autoStart: localAutoStart.value,
      rssiLockThreshold: localRssiLockThreshold.value,
      rssiUnlockThreshold: localRssiUnlockThreshold.value
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
  border: 1px solid var(--app-border);
  border-radius: $border-radius;

  :deep(.el-card__header) {
    border-bottom: 1px solid var(--app-border);
    color: $text-color;
    font-size: 15px;
    font-weight: 600;
    padding: 14px 20px;
  }

  :deep(.el-card__body) {
    padding: 20px;
  }
}

// RSSI 阈值滑块样式（锁屏设置卡片内联使用）
.timeout-slider {
  &:not(:first-child) {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid var(--app-border);
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
    --el-slider-runway-bg-color: var(--app-slider-track);
    --el-slider-stop-bg-color: var(--app-slider-stop);
  }
}

.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;

  &:not(:last-child) {
    border-bottom: 1px solid var(--app-border);
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

.hodor-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.rssi-monitor {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 8px;
  padding-left: 12px;
  border-left: 1px solid var(--app-border);

  .rssi-monitor-name {
    color: $text-secondary;
    font-size: 12px;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.password-input-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 12px;
  padding: 12px 0;
  border-top: 1px solid var(--app-border);

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
    border-bottom: 1px solid var(--app-border);
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
