import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'

import { BLEManager } from './ble/manager'
import { reconnectManager } from './ble/reconnect'
import { stateManager } from './state'
import { lockWorkstation, lockDetector } from './system/lock'
import { triggerUnlock, ensureHodorReady } from './system/unlock'
import { getConfig, setConfig } from './config'
import { hasPassword } from './system/safe-storage'
import { registerIpcHandlers, setBleManagerRef } from './ipc-handlers'
import { createTray, destroyTray } from './tray'
import type { HeartRateData } from './ble/types'
import type { BLEDeviceInfo } from './ble/types'

let mainWindow: BrowserWindow | null = null
let bleManager: BLEManager | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 620,
    minWidth: 600,
    minHeight: 500,
    frame: true,
    resizable: true,
    show: true,
    autoHideMenuBar: true,
    title: 'BLE 心率监测',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('close', (event) => {
    if (!(app as any).isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function initBLE(): void {
  bleManager = new BLEManager()
  setBleManagerRef(bleManager)

  // Start the C# BLE helper process
  bleManager.start()

  const config = getConfig()
  bleManager.setHeartbeatTimeout(config.heartbeatTimeout * 1000)
  stateManager.setUnlockDelay(config.unlockDelay)

  setupBLEEvents()
  setupReconnect()
  setupBLEIpc()
}

/**
 * 设置重连管理器的回调
 *
 * 将 reconnectManager 的抽象操作（连接/监听广播/停止监听）
 * 绑定到 bleManager 的实际方法。
 */
function setupReconnect(): void {
  if (!bleManager) return

  // 回调：发起连接
  reconnectManager.onConnect = (address: string) => {
    bleManager?.connect(address)
  }

  // 回调：开始监听目标设备广播
  reconnectManager.onStartWatch = (address: string) => {
    bleManager?.watchForDevice(address)
  }

  // 回调：停止监听
  reconnectManager.onStopWatch = () => {
    bleManager?.stopWatch()
  }

  // C# 端广播发现目标设备 → 通知重连管理器
  bleManager.on('deviceFound', (device: BLEDeviceInfo) => {
    reconnectManager.onDeviceFound(device.address)
  })

  // 连接错误（在 connecting 阶段） → 回到广播监听
  bleManager.on('error', () => {
    reconnectManager.onConnectFailed()
  })

  // 重连状态变化 → 同步到渲染进程
  reconnectManager.on('phaseChange', (phase: string) => {
    mainWindow?.webContents.send('reconnect-phase-change', phase)
  })
  reconnectManager.on('reconnected', (info: { address: string; name: string }) => {
    mainWindow?.webContents.send('reconnected', info)
  })
}

function setupBLEEvents(): void {
  if (!bleManager || !mainWindow) return

  // Scan events → forward to renderer
  bleManager.on('scanStarted', () => {
    mainWindow?.webContents.send('ble-scan-started')
  })

  bleManager.on('scanStopped', () => {
    mainWindow?.webContents.send('ble-scan-stopped')
  })

  bleManager.on('deviceDiscovered', (device: BLEDeviceInfo) => {
    mainWindow?.webContents.send('ble-device-discovered', device)
  })

  // Heart rate data → update state machine
  bleManager.on('heartRateData', (data: HeartRateData) => {
    stateManager.setHeartRate(data.heartRate)
    if (stateManager.shouldTriggerUnlock()) {
      handleUnlock()
    }
  })

  // Heartbeat timeout → lock
  bleManager.on('heartbeatTimeout', () => {
    if (stateManager.onHeartbeatTimeout()) {
      setTimeout(() => handleLock(), 2000)
    }
  })

  // Device disconnected — 区分远程断开 vs 用户主动断开
  bleManager.on('deviceDisconnected', (reason: string) => {
    stateManager.setDeviceStatus('disconnected')
    stateManager.setDeviceName(null)

    const phase = reconnectManager.phase

    // 重连进行中时，所有断开（包括 reason=user，C# 连接失败内部调用 Disconnect 所致）
    // 都视为重连流程的一部分，由重连管理器处理。
    if (phase !== 'idle') {
      if (phase === 'connecting') {
        // 连接失败 → 回到广播监听
        reconnectManager.onConnectFailed()
      }
      // watching 阶段收到断开（连接已不存在）→ 忽略，继续监听广播
      return
    }

    if (reason === 'user') {
      // idle 状态下用户主动断开 → 清除配置，不重连，不锁屏
      reconnectManager.cancel()
      setConfig({ targetDeviceId: '', targetDeviceName: '' })
      console.log('[BLE] 用户主动断开，清除设备配置')
    } else {
      // idle 状态下远程断开 → 保留配置，启动广播监听 + 触发锁屏
      const config = getConfig()
      if (config.targetDeviceId) {
        reconnectManager.start(config.targetDeviceId, config.targetDeviceName)
      }
      // 设备离开 → 2 秒后锁屏
      if (stateManager.onHeartbeatTimeout()) {
        setTimeout(() => handleLock(), 2000)
      }
    }
  })

  // Device connected
  bleManager.on('deviceConnected', (device: { id: string; name: string }) => {
    stateManager.setDeviceStatus('connected')
    stateManager.setDeviceName(device.name)
    // 重连成功 → 停止重连
    reconnectManager.onConnected()
  })

  // Helper errors
  bleManager.on('error', (err: Error) => {
    console.error('[BLE] error:', err.message)
  })
}

/**
 * IPC from renderer: BLE control commands
 */
function setupBLEIpc(): void {
  if (!bleManager) return

  ipcMain.on('ble-start-scan', (_event, timeout?: number) => {
    bleManager?.startScan(timeout || 30000)
  })

  ipcMain.on('ble-stop-scan', () => {
    bleManager?.stopScan()
  })

  ipcMain.on('ble-connect', (_event, address: string) => {
    // 用户主动连接新设备 → 取消重连
    reconnectManager.cancel()
    bleManager?.connect(address)
  })

  ipcMain.on('ble-disconnect', () => {
    bleManager?.disconnect()
  })

  // Test lock / unlock
  ipcMain.handle('test-lock', async () => {
    try {
      await lockWorkstation()
      stateManager.confirmLock()
      return { success: true }
    } catch (err: any) {
      return { success: false, message: err.message }
    }
  })

  ipcMain.handle('test-unlock', async () => {
    if (!hasPassword()) {
      return { success: false, message: '未设置解锁密码，请在安全设置中先设置密码' }
    }
    try {
      // 先锁屏（已锁屏则跳过），等待 Credential Provider 加载后自动解锁
      await lockWorkstation()
      stateManager.confirmLock()

      // 短暂等待让 LogonUI 加载 hodor DLL
      await new Promise((r) => setTimeout(r, 2000))

      await triggerUnlock()
      stateManager.confirmUnlock()
      return { success: true }
    } catch (err: any) {
      return { success: false, message: err.message }
    }
  })
}

async function handleLock(): Promise<void> {
  try {
    await lockWorkstation()
    stateManager.confirmLock()
  } catch (err: any) {
    console.error('Lock failed:', err.message)
  }
}

async function handleUnlock(): Promise<void> {
  const config = getConfig()
  if (!config.autoUnlock || !hasPassword()) {
    console.log('Auto-unlock not enabled or password not set')
    return
  }
  try {
    await triggerUnlock()
    stateManager.confirmUnlock()
  } catch (err: any) {
    console.error('Unlock failed:', err.message)
  }
}

/**
 * 初始化锁屏状态监听
 *
 * 监听 Windows 实际锁屏/解锁事件，同步状态机。
 * 用户在外部手动解锁时，状态机会自动同步。
 */
function initLockDetection(): void {
  lockDetector.on('locked', () => {
    stateManager.confirmLock()
  })

  lockDetector.on('unlocked', () => {
    if (stateManager.getState().lockState === 'locked') {
      stateManager.confirmUnlock()
    }
  })

  lockDetector.startMonitoring()
}

function initIPC(): void {
  if (!mainWindow) return
  registerIpcHandlers(mainWindow)
}

app.whenReady().then(() => {
  createWindow()
  initBLE()
  initIPC()
  initLockDetection()

  if (mainWindow) {
    createTray(mainWindow)
  }

  // 确保 hodor DLL 已注册（需要管理员权限）
  ensureHodorReady().then((ready) => {
    if (ready) {
      console.log('[hodor] 解锁组件已就绪')
    } else {
      console.warn('[hodor] 解锁组件未注册，无法自动解锁。请以管理员权限重启应用。')
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else if (mainWindow) {
      mainWindow.show()
    }
  })
})

app.on('window-all-closed', () => {
  // Don't quit; stay in tray
})

app.on('before-quit', () => {
  (app as any).isQuitting = true
  reconnectManager.stop()
  lockDetector.stopMonitoring()
  destroyTray()
  bleManager?.stop()
  if (bleManager) {
    bleManager.removeAllListeners()
  }
})

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
}
