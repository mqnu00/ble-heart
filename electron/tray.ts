import { Tray, Menu, nativeImage, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { stateManager, type AppState } from './state'

let tray: Tray | null = null
let mainWindow: BrowserWindow | null = null

export function createTray(window: BrowserWindow): Tray {
  mainWindow = window

  // 创建托盘图标 (16x16 像素的简单图标)
  const icon = createTrayIcon()
  tray = new Tray(icon)
  tray.setToolTip('BLE 心率监测 - 等待连接')

  updateTrayMenu()

  // 监听状态变化更新托盘
  stateManager.on('change', (state: AppState) => {
    updateTrayMenu()
  })

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  })

  return tray
}

function createTrayIcon(): Electron.NativeImage {
  // 优先使用应用图标（icon.png），缩放至 Windows 托盘推荐尺寸
  const iconPath = getAppIconPath()
  if (iconPath) {
    const img = nativeImage.createFromPath(iconPath)
    if (!img.isEmpty()) {
      return img.resize({ width: 16, height: 16 })
    }
  }

  // 兜底：创建一个简单的 16x16 绿色圆点
  const size = 16
  const canvas = Buffer.alloc(size * size * 4)

  const cx = size / 2, cy = size / 2, r = 6
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx
      const dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      const idx = (y * size + x) * 4

      if (dist < r) {
        canvas[idx] = 0x40     // R
        canvas[idx + 1] = 0x9E // G
        canvas[idx + 2] = 0xFF // B
        canvas[idx + 3] = 255  // A
      } else {
        canvas[idx + 3] = 0
      }
    }
  }

  return nativeImage.createFromBuffer(canvas, {
    width: size,
    height: size
  })
}

/**
 * 获取应用图标路径
 * - 开发模式:项目根 public/icon.png
 * - 打包后:resources/app/dist/icon.png（public 目录经 Vite 复制到 dist 的副本）
 */
function getAppIconPath(): string {
  const candidates = [
    join(__dirname, '../public/icon.png'),
    join(__dirname, '../dist/icon.png')
  ]
  return candidates.find((p) => existsSync(p)) || ''
}

function updateTrayMenu(): void {
  if (!tray) return

  const state = stateManager.getState()

  // 根据状态更新提示
  const statusText = state.deviceStatus === 'connected'
    ? `已连接: ${state.deviceName || '手表'}`
    : state.deviceStatus === 'scanning'
      ? '正在搜索手表...'
      : '等待连接'

  const lockText = state.lockState === 'locked'
    ? ' [已锁定]'
    : state.lockState === 'pending'
      ? ' [即将锁定]'
      : ''

  tray.setToolTip(`BLE 心率监测 - ${statusText}${lockText}`)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `状态: ${statusText}${lockText}`,
      enabled: false
    },
    {
      label: `心率: ${state.heartRate !== null ? state.heartRate + ' BPM' : '--'}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: '显示窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        // 通过 app 退出
        const { app } = require('electron')
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}
