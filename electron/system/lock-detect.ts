/**
 * Windows 锁屏状态检测
 *
 * 使用 koffi FFI 调用 Win32 API 检测当前桌面是否被锁屏。
 *
 * 原理：
 *   锁屏时 Windows 切换到 Winlogon 安全桌面，用户进程无法
 *   访问该桌面。通过 OpenInputDesktop 尝试打开输入桌面：
 *   - 成功 = 用户桌面 = 未锁屏
 *   - 失败 (NULL) = Winlogon 安全桌面 = 已锁屏
 *
 * 通过轮询实现锁屏/解锁事件监听。
 */

import koffi from 'koffi'
import { EventEmitter } from 'node:events'

// ============================================================
// koffi FFI 声明
// ============================================================

const user32 = koffi.load('user32.dll')

const OpenInputDesktop = user32.func(
  'void* OpenInputDesktop(int dwFlags, int fInherit, int dwDesiredAccess)'
)
const CloseDesktop = user32.func(
  'int CloseDesktop(void* hDesktop)'
)

/** 轮询间隔（毫秒） */
const POLL_INTERVAL = 1000

class LockDetector extends EventEmitter {
  private _isLocked = false
  private _pollTimer: ReturnType<typeof setInterval> | null = null

  /**
   * 同步检测当前是否锁屏
   */
  isLocked(): boolean {
    try {
      // 尝试无权限打开输入桌面
      // 锁屏时 Winlogon 桌面拒绝访问，返回 NULL
      const hDesk = OpenInputDesktop(0, 0, 0)
      if (hDesk) {
        CloseDesktop(hDesk)
        return false // 成功打开 = 用户桌面 = 未锁屏
      }
      return true // 返回 NULL = Winlogon 桌面 = 已锁屏
    } catch {
      // koffi 调用失败，保守假定未锁屏
      return false
    }
  }

  /**
   * 开始监听锁屏状态变化（轮询模式）
   */
  startMonitoring(): void {
    if (this._pollTimer) return

    // 初始化当前状态
    this._isLocked = this.isLocked()

    this._pollTimer = setInterval(() => {
      const locked = this.isLocked()
      if (locked !== this._isLocked) {
        this._isLocked = locked
        this.emit('change', locked)
        if (locked) {
          this.emit('locked')
        } else {
          this.emit('unlocked')
        }
      }
    }, POLL_INTERVAL)
  }

  /**
   * 停止监听
   */
  stopMonitoring(): void {
    if (this._pollTimer) {
      clearInterval(this._pollTimer)
      this._pollTimer = null
    }
  }
}

/** 全局单例 */
export const lockDetector = new LockDetector()

/** 同步查询当前锁屏状态 */
export function isWorkstationLocked(): boolean {
  return lockDetector.isLocked()
}
