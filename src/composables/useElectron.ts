import { ref, watch, onMounted, onUnmounted } from 'vue'
import type { AppState, AppConfig, BLEDevice } from '@/types'

export function useElectron() {
  const state = ref<AppState>({
    heartRate: null,
    deviceStatus: 'disconnected',
    lockState: 'unlocked',
    lastBeatTime: 0,
    deviceName: null
  })
  const config = ref<AppConfig>({
    targetDeviceId: '',
    targetDeviceName: '',
    heartbeatTimeout: 15,
    autoUnlock: false,
    autoStart: false,
    hasPassword: false
  })
  const devices = ref<BLEDevice[]>([])
  const scanning = ref(false)
  let unsubscribe: (() => void) | null = null
  let flushTimer: ReturnType<typeof setInterval> | null = null

  async function refreshState() {
    if (window.electronAPI) state.value = await window.electronAPI.getState()
  }
  async function loadConfig() {
    if (window.electronAPI) config.value = await window.electronAPI.getConfig()
  }

  // ── BLE Device Scanning ──

  async function startScan() {
    if (!window.electronAPI) return
    devices.value = []

    // Track discovered devices (deduplicate by address)
    const deviceMap = new Map<string, BLEDevice>()

    window.electronAPI.onBleDeviceDiscovered((d: BLEDevice) => {
      deviceMap.set(d.address, d)
    })

    // Flush accumulated devices every 3 seconds
    flushTimer = setInterval(() => {
      if (deviceMap.size > 0) {
        devices.value = [...deviceMap.values()].sort((a, b) => b.rssi - a.rssi)
      }
    }, 3000)

    window.electronAPI.onBleScanStarted(() => {
      scanning.value = true
    })

    window.electronAPI.onBleScanStopped(() => {
      scanning.value = false
      state.value.deviceStatus = 'disconnected'
      if (flushTimer) { clearInterval(flushTimer); flushTimer = null }
    })

    // Tell main process to start scanning
    window.electronAPI.bleStartScan(30000)
    state.value.deviceStatus = 'scanning'
    scanning.value = true
  }

  async function stopScan() {
    window.electronAPI?.bleStopScan()
    window.electronAPI?.removeBleListeners()
    if (flushTimer) { clearInterval(flushTimer); flushTimer = null }
    scanning.value = false
    state.value.deviceStatus = 'disconnected'
  }

  // ── BLE Device Connection ──

  async function connectDevice(address: string) {
    if (!window.electronAPI) throw new Error('electronAPI not available')

    try {
      // Stop scanning and connect
      window.electronAPI.bleStopScan()
      window.electronAPI.removeBleListeners()
      if (flushTimer) { clearInterval(flushTimer); flushTimer = null }
      scanning.value = false

      // Send connect command to main process (which proxies to helper)
      window.electronAPI.bleConnect(address)

      // Wait for actual connection result (state changes via onStateChange)
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          stopWatcher()
          reject(new Error('连接超时，请确认设备在范围内且支持心率服务'))
        }, 10000)

        const stopWatcher = watch(
          () => state.value.deviceStatus,
          (status) => {
            if (status === 'connected') {
              clearTimeout(timer)
              stopWatcher()
              resolve()
            }
          }
        )
      })

      // Save device config (use updateConfig to refresh local config ref)
      const device = devices.value.find(d => d.address === address || d.id === address)
      await updateConfig({
        targetDeviceId: address,
        targetDeviceName: device?.name || 'Unknown'
      })
    } catch (err: any) {
      state.value.deviceStatus = 'disconnected'
      throw err
    }
  }

  async function disconnectDevice() {
    try {
      window.electronAPI?.bleStopScan()
      window.electronAPI?.bleDisconnect()
    } catch { /* ignore */ }
    state.value.deviceStatus = 'disconnected'
    state.value.deviceName = null
    // Clear saved device so the list no longer shows "已连接"
    await updateConfig({ targetDeviceId: '', targetDeviceName: '' })
  }

  // ── Config ──

  async function updateConfig(newConfig: Partial<AppConfig>) {
    if (window.electronAPI) { await window.electronAPI.setConfig(newConfig); await loadConfig() }
  }
  async function setPassword(password: string) {
    if (window.electronAPI) await window.electronAPI.setPassword(password)
  }
  async function clearPassword() {
    if (window.electronAPI) await window.electronAPI.clearPassword()
  }

  // ── State listener ──

  function setupStateListener() {
    if (window.electronAPI) {
      window.electronAPI.onStateChange((s: AppState) => {
        state.value = s
        // Reflect connection status
        if (s.deviceStatus === 'connected') {
          scanning.value = false
        }
      })
      unsubscribe = () => window.electronAPI.removeStateListener()
    }
  }

  onMounted(async () => { setupStateListener(); await refreshState(); await loadConfig() })
  onUnmounted(() => {
    unsubscribe?.()
    window.electronAPI?.bleStopScan()
    window.electronAPI?.removeBleListeners()
    if (flushTimer) { clearInterval(flushTimer); flushTimer = null }
  })

  return {
    state, config, devices, scanning,
    refreshState, loadConfig,
    startScan, stopScan, connectDevice, disconnectDevice,
    updateConfig, setPassword, clearPassword
  }
}
