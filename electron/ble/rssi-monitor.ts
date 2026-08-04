/**
 * RSSI 信号监听策略层
 *
 * 不连接设备,通过持续监听蓝牙广播 RSSI 实现自动锁屏/解锁:
 *   - 信号弱(低于锁屏阈值持续 heartbeatTimeout 秒) → 锁屏
 *   - 信号强(高于恢复阈值持续 unlockDelay 秒) → 解锁
 *   - 信号丢失(无广播超时) → 视为弱信号,锁屏
 *
 * 锁屏/解锁通过回调注入,由 main.ts 接入现有 handleLock()/handleUnlock()。
 */

import { EventEmitter } from 'node:events'

export interface RssiMonitorConfig {
  rssiLockThreshold: number
  rssiUnlockThreshold: number
  weakTimeoutMs: number       // 弱信号持续多久锁屏(复用 heartbeatTimeout)
  unlockConfirmMs: number     // 信号恢复持续多久解锁(复用 unlockDelay)
}

export interface RssiMonitorState {
  rssi: number | null
  monitorStatus: 'idle' | 'monitoring'
  deviceName: string
}

export class RssiMonitor extends EventEmitter {
  private _address = ''
  private _name = ''
  private _lockThreshold = -80
  private _unlockThreshold = -70
  private _weakTimeoutMs = 15000
  private _unlockConfirmMs = 3000

  // 运行状态
  private _rssi: number | null = null
  private _lastUpdateTime = 0
  private _weakStartTime = 0
  private _strongStartTime = 0
  private _lockTriggered = false
  private _lossCheckTimer: ReturnType<typeof setInterval> | null = null
  private _connected = false

  // 回调(由 main.ts 注入)
  onTriggerLock: (() => void) | null = null
  onTriggerUnlock: (() => void) | null = null

  get address(): string { return this._address }
  get name(): string { return this._name }
  get isMonitoring(): boolean { return !!this._address }

  /**
   * 设置设备连接状态
   *
   * 已连接时,设备在场由 GATT 连接证明,广播可能因连接而停止,
   * 此时"信号丢失"不算弱信号,不触发锁屏;弱信号(仍收到广播)仍有效。
   */
  setConnected(connected: boolean): void {
    this._connected = connected
  }

  // ── Lifecycle ──

  start(address: string, name: string, config: Partial<RssiMonitorConfig>): void {
    // 已在监听同一设备 → 仅更新阈值配置,避免重复 Stop/Start 导致监听中断
    if (this._address === address && this.isMonitoring) {
      this.applyConfig(config)
      return
    }
    this.stop()
    this._address = address
    this._name = name
    this.applyConfig(config)
    this._rssi = null
    this._lastUpdateTime = Date.now()
    this._weakStartTime = 0
    this._strongStartTime = 0
    this._lockTriggered = false

    // 信号丢失检测:每 3 秒检查一次
    this._lossCheckTimer = setInterval(() => this.checkLoss(), 3000)
  }

  stop(): void {
    this._address = ''
    this._name = ''
    this._rssi = null
    this._lastUpdateTime = 0
    this._weakStartTime = 0
    this._strongStartTime = 0
    this._lockTriggered = false
    this._connected = false
    if (this._lossCheckTimer) {
      clearInterval(this._lossCheckTimer)
      this._lossCheckTimer = null
    }
  }

  // ── Config ──

  applyConfig(config: Partial<RssiMonitorConfig>): void {
    if (config.rssiLockThreshold !== undefined) this._lockThreshold = config.rssiLockThreshold
    if (config.rssiUnlockThreshold !== undefined) this._unlockThreshold = config.rssiUnlockThreshold
    if (config.weakTimeoutMs !== undefined) this._weakTimeoutMs = config.weakTimeoutMs
    if (config.unlockConfirmMs !== undefined) this._unlockConfirmMs = config.unlockConfirmMs
  }

  // ── Signal handling ──

  /**
   * 收到新的 RSSI 采样
   *
   * @param rssi 信号强度(dBm),通常范围 -40(极近) ~ -100(极远)
   */
  onRssiUpdate(rssi: number): void {
    this._rssi = rssi
    this._lastUpdateTime = Date.now()
    const now = this._lastUpdateTime

    if (rssi < this._lockThreshold) {
      // 弱信号:开始/累加计时
      if (!this._weakStartTime) {
        this._weakStartTime = now
      }
      // 强信号计时清零(低于锁屏阈值必定也低于恢复阈值)
      this._strongStartTime = 0

      // 弱信号持续时间达到阈值 → 锁屏
      if (!this._lockTriggered && (now - this._weakStartTime) >= this._weakTimeoutMs) {
        this._lockTriggered = true
        console.log('[RSSI] 信号弱持续超时,触发锁屏')
        this.onTriggerLock?.()
      }
    } else if (rssi >= this._unlockThreshold) {
      // 强信号:清零弱信号计时,累加强信号计时
      this._weakStartTime = 0

      if (!this._strongStartTime) {
        this._strongStartTime = now
      }

      // 强信号持续时间达到阈值 → 解锁
      if (now - this._strongStartTime >= this._unlockConfirmMs) {
        console.log('[RSSI] 信号恢复持续超时,触发解锁')
        // 重置锁屏标记,以便下次弱信号时重新锁屏
        this._lockTriggered = false
        this._strongStartTime = 0
        this.onTriggerUnlock?.()
      }
    } else {
      // 中间地带(lockThreshold ≤ rssi < unlockThreshold):维持现状,重置计时
      this._weakStartTime = 0
      this._strongStartTime = 0
    }
  }

  // ── Loss detection ──

  /**
   * 信号丢失检测:若超过 weakTimeout + 2 秒无广播,视为信号丢失,触发锁屏
   */
  private checkLoss(): void {
    if (!this._address) return
    // 已连接时设备在场由连接证明,广播停止不代表信号弱,不锁屏
    if (this._connected) return
    const now = Date.now()

    if (
      this._lastUpdateTime > 0 &&
      (now - this._lastUpdateTime) > this._weakTimeoutMs + 2000
    ) {
      if (!this._lockTriggered) {
        console.log('[RSSI] 信号丢失,触发锁屏')
        this._lockTriggered = true
        this._weakStartTime = 0
        this._strongStartTime = 0
        this.onTriggerLock?.()
      }
    }
  }

  // ── State ──

  getState(): RssiMonitorState {
    return {
      rssi: this._rssi,
      monitorStatus: this._address ? 'monitoring' : 'idle',
      deviceName: this._name
    }
  }
}

/** 全局单例 */
export const rssiMonitor = new RssiMonitor()
