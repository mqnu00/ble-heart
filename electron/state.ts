import { EventEmitter } from 'node:events'
import { isWorkstationLocked } from './system/lock-detect'

export type DeviceStatus = 'scanning' | 'connected' | 'disconnected'
export type LockState = 'unlocked' | 'pending' | 'locked'

export interface AppState {
  heartRate: number | null
  deviceStatus: DeviceStatus
  lockState: LockState
  lastBeatTime: number
  deviceName: string | null
}

class StateManager extends EventEmitter {
  private state: AppState = {
    heartRate: null,
    deviceStatus: 'disconnected',
    lockState: 'unlocked',
    lastBeatTime: 0,
    deviceName: null
  }

  // 冷却期：解锁后短时间内不重新锁屏
  private cooldownUntil = 0
  private unlockConfirmCount = 0
  private readonly UNLOCK_CONFIRM_REQUIRED = 3

  getState(): AppState {
    return { ...this.state }
  }

  setHeartRate(rate: number) {
    this.state.heartRate = rate
    this.state.lastBeatTime = Date.now()
    this.emit('change', this.getState())
  }

  setDeviceStatus(status: DeviceStatus) {
    this.state.deviceStatus = status
    this.emit('change', this.getState())
  }

  setDeviceName(name: string | null) {
    this.state.deviceName = name
    this.emit('change', this.getState())
  }

  /**
   * 心跳超时处理
   * 检查是否应该进入锁屏状态
   */
  onHeartbeatTimeout(): boolean {
    if (this.state.lockState === 'locked') return false
    if (Date.now() < this.cooldownUntil) {
      // 在冷却期内，忽略超时
      return false
    }
    this.state.lockState = 'pending'
    this.state.heartRate = null
    this.emit('change', this.getState())
    return true
  }

  /**
   * 确认锁屏
   */
  confirmLock(): void {
    this.state.lockState = 'locked'
    this.unlockConfirmCount = 0
    this.emit('change', this.getState())
  }

  /**
   * 心率恢复时的解锁确认
   *
   * 需连续收到多次心跳才触发解锁，防止误触发。
   * 同时通过 OpenInputDesktop 验证确已锁屏。
   */
  shouldTriggerUnlock(): boolean {
    if (this.state.lockState !== 'locked') return false
    if (Date.now() < this.cooldownUntil) return false

    // 通过 Win32 API 确认真实锁屏状态
    if (!isWorkstationLocked()) {
      // 实际未锁屏（可能是手动解锁了），同步状态
      this.state.lockState = 'unlocked'
      this.unlockConfirmCount = 0
      this.emit('change', this.getState())
      return false
    }

    this.unlockConfirmCount++
    return this.unlockConfirmCount >= this.UNLOCK_CONFIRM_REQUIRED
  }

  /**
   * 确认解锁
   */
  confirmUnlock(): void {
    this.state.lockState = 'unlocked'
    this.unlockConfirmCount = 0
    // 设置冷却期：解锁后 10 秒内不重新锁屏
    this.cooldownUntil = Date.now() + 10000
    this.emit('change', this.getState())
  }

  /**
   * 检查是否在冷却期
   */
  isInCooldown(): boolean {
    return Date.now() < this.cooldownUntil
  }

  resetUnlockConfirm(): void {
    this.unlockConfirmCount = 0
  }
}

export const stateManager = new StateManager()
