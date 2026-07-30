/**
 * BLE 设备自动重连管理器
 *
 * 设备意外离开（超出范围/关机）时启动广播监听：
 *   C# 端使用 BluetoothLEAdvertisementWatcher (Passive 模式) 持续监听
 *   目标设备的 BLE 广播，发现后立即停止监听并触发连接。
 *
 * 用户手动断开时不触发重连。
 */

import { EventEmitter } from 'node:events'

export type ReconnectPhase = 'idle' | 'watching' | 'connecting'

export class ReconnectManager extends EventEmitter {
  private _targetAddress: string | null = null
  private _targetName: string | null = null
  private _phase: ReconnectPhase = 'idle'

  /** 供外部注入：发起连接 */
  onConnect: ((address: string) => void) | null = null
  /** 供外部注入：开始监听目标设备广播 */
  onStartWatch: ((address: string) => void) | null = null
  /** 供外部注入：停止监听 */
  onStopWatch: (() => void) | null = null

  get phase(): ReconnectPhase { return this._phase }
  get targetAddress(): string | null { return this._targetAddress }

  /** 开始重连：启动广播监听 */
  start(address: string, name: string): void {
    if (this._phase !== 'idle') this.stop()

    this._targetAddress = address
    this._targetName = name
    this._phase = 'watching'

    console.log(`[Reconnect] 开始监听设备广播: ${name} (${address})`)
    this.emit('phaseChange', this._phase)

    this.onStartWatch?.(address)
  }

  /** 停止所有重连活动 */
  stop(): void {
    if (this._phase === 'watching') {
      this.onStopWatch?.()
    }
    this._phase = 'idle'
    this._targetAddress = null
    this._targetName = null
  }

  /** 用户手动取消（与 stop 相同） */
  cancel(): void {
    console.log('[Reconnect] 用户取消重连')
    this.stop()
  }

  /**
   * 外部通知：目标设备在广播中被发现
   * 停止监听，发起连接
   */
  onDeviceFound(address: string): void {
    if (this._phase !== 'watching') return
    if (address !== this._targetAddress) return

    console.log(`[Reconnect] 广播发现目标设备: ${address}，开始连接`)
    this.onStopWatch?.()
    this._phase = 'connecting' // 连接中，防止断开事件误清除配置

    this.onConnect?.(address)
  }

  /**
   * 外部通知：连接失败（在 connecting 阶段）
   * 回到广播监听等待设备再次出现
   */
  onConnectFailed(): void {
    if (this._phase !== 'connecting') return
    if (!this._targetAddress || !this._targetName) return

    console.log(`[Reconnect] 连接失败，回到广播监听`)
    this._phase = 'watching'
    this.emit('phaseChange', this._phase)
    this.onStartWatch?.(this._targetAddress)
  }

  /**
   * 外部通知：连接成功
   */
  onConnected(): void {
    console.log('[Reconnect] 重连成功')
    this.stop()
    this.emit('reconnected', { address: this._targetAddress, name: this._targetName })
  }
}

/** 全局单例 */
export const reconnectManager = new ReconnectManager()
