/**
 * Windows 锁屏控制
 */

import { exec } from 'node:child_process'
import { lockDetector, isWorkstationLocked } from './lock-detect'

/**
 * 锁定 Windows 工作站
 *
 * 使用 user32.dll 的 LockWorkStation API。
 */
export function lockWorkstation(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isWorkstationLocked()) {
      resolve()
      return
    }

    const command = 'rundll32.exe user32.dll,LockWorkStation'

    exec(command, (error) => {
      if (error) {
        reject(new Error(`锁屏失败: ${error.message}`))
      } else {
        resolve()
      }
    })
  })
}

/**
 * 获取当前锁屏状态（真实 Windows 状态）
 */
export function getLockState(): boolean {
  return isWorkstationLocked()
}

/**
 * 重置锁屏状态
 *
 * 此时锁屏已由 Windows 会话事件检测到，
 * 此函数保留仅为兼容旧代码。
 */
export function resetLockState(): void {
  // 锁屏状态由 lockDetector 轮询自动检测，无需手动重置
}

// 导出 lockDetector 供 main.ts 监听事件
export { lockDetector }
