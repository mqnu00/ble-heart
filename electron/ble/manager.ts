import { EventEmitter } from 'events'
import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import type { HeartRateData } from './types'

/**
 * BLEManager — spawns the C# WinRT helper process, communicates via JSON-line
 * protocol over stdin/stdout. Provides the same EventEmitter interface as before.
 */
export class BLEManager extends EventEmitter {
  private helper: ChildProcess | null = null
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimeout: number = 15000
  private buffer = ''
  private restarting = false

  /** Path to the published helper executable */
  private get helperPath(): string {
    // In dev: dotnet run; in prod: published exe
    if (process.env.VITE_DEV_SERVER_URL) {
      return join(__dirname, '../ble-helper')
    }
    return join(process.resourcesPath || '', 'ble-helper', 'ble-helper.exe')
  }

  /** Start the BLE helper process */
  start(): void {
    if (this.helper) return

    const isDev = !!process.env.VITE_DEV_SERVER_URL

    if (isDev) {
      // Dev mode: use dotnet run
      this.helper = spawn('dotnet', ['run', '--project', this.helperPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      })
    } else {
      // Production: run published exe
      this.helper = spawn(this.helperPath, [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      })
    }

    this.helper.stdout?.on('data', (chunk: Buffer) => this.onStdout(chunk))
    this.helper.stderr?.on('data', (chunk: Buffer) => {
      console.error('[BLE helper stderr]', chunk.toString())
    })

    this.helper.on('exit', (code, signal) => {
      console.log(`[BLE] helper exited, code=${code}, signal=${signal}`)
      this.helper = null
      this.buffer = ''
      this.clearHeartbeatTimer()

      if (!this.restarting && code !== 0 && code !== null) {
        // Unexpected exit — notify
        this.emit('deviceDisconnected')
      }
    })

    this.helper.on('error', (err) => {
      console.error('[BLE] helper spawn error:', err.message)
      this.emit('error', err)
    })

    console.log('[BLE] helper process started')
  }

  /** Stop the helper process */
  stop(): void {
    if (!this.helper) return
    this.restarting = true
    this.send({ cmd: 'quit' })
    setTimeout(() => {
      if (this.helper) {
        this.helper.kill()
        this.helper = null
      }
      this.restarting = false
    }, 2000)
  }

  /** Send a command to the helper */
  private send(cmd: Record<string, unknown>): void {
    if (!this.helper?.stdin?.writable) {
      console.warn('[BLE] cannot send command: helper stdin not available')
      return
    }
    const json = JSON.stringify(cmd)
    console.log('[BLE] → helper:', json)
    this.helper.stdin.write(json + '\n')
  }

  /** Parse incoming JSON lines from stdout */
  private onStdout(chunk: Buffer): void {
    this.buffer += chunk.toString()
    const lines = this.buffer.split('\n')
    // Last element may be incomplete — keep it in buffer
    this.buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const evt = JSON.parse(line)
        this.handleEvent(evt)
      } catch {
        console.warn('[BLE] unparseable stdout line:', line)
      }
    }
  }

  /** Handle a parsed event from the helper */
  private handleEvent(evt: { evt: string; address?: string; name?: string; rssi?: number; raw?: number[]; message?: string; reason?: string }): void {
    console.log('[BLE] ← helper:', evt.evt)

    switch (evt.evt) {
      case 'scanStarted':
        this.emit('scanStarted')
        break

      case 'deviceDiscovered':
        this.emit('deviceDiscovered', {
          id: evt.address || '',
          address: evt.address || '',
          name: evt.name || 'Unknown',
          rssi: evt.rssi ?? 0
        })
        break

      case 'scanStopped':
        this.emit('scanStopped')
        break

      case 'connected':
        this.emit('deviceConnected', {
          id: evt.address || '',
          name: evt.name || 'Unknown'
        })
        break

      case 'disconnected':
        this.clearHeartbeatTimer()
        this.emit('deviceDisconnected')
        break

      case 'heartRateData':
        console.log('[BLE] heartRateData raw type:', typeof evt.raw, 'isArray:', Array.isArray(evt.raw), 'length:', evt.raw?.length, 'first bytes:', JSON.stringify(evt.raw?.slice(0, 6)))
        if (evt.raw && evt.raw.length > 0) {
          const hrData = this.handleHeartRateData(evt.raw)
          console.log('[BLE] parsed HR:', hrData)
          if (hrData) {
            this.emit('heartRateData', hrData)
          }
        }
        break

      case 'error':
        console.error('[BLE] helper error:', evt.message)
        this.emit('error', new Error(evt.message))
        break

      case 'log':
        console.log('[BLE helper]', evt.message)
        break

      default:
        console.log('[BLE] unhandled event:', evt.evt)
    }
  }

  // ── Public commands ──

  startScan(timeout = 30000): void {
    this.send({ cmd: 'scan', timeout })
  }

  stopScan(): void {
    this.send({ cmd: 'stopScan' })
  }

  connect(address: string): void {
    this.send({ cmd: 'connect', address: address.replace(/:/g, '') })
  }

  disconnect(): void {
    this.send({ cmd: 'disconnect' })
  }

  // ── Heart rate parsing & heartbeat timer ──

  setHeartbeatTimeout(ms: number): void {
    this.heartbeatTimeout = ms
  }

  handleHeartRateData(data: number[]): HeartRateData | null {
    if (data.length === 0) return null

    const flags = data[0]
    let offset = 1

    const isUint16 = (flags & 0x01) !== 0
    let heartRate: number
    if (isUint16 && data.length >= 3) {
      heartRate = data[offset] | (data[offset + 1] << 8)
      offset += 2
    } else {
      heartRate = data[offset]
      offset += 1
    }

    const contactSupported = (flags & 0x04) !== 0
    const contactDetected = contactSupported && (flags & 0x02) !== 0

    let energyExpended: number | null = null
    if ((flags & 0x08) !== 0 && data.length > offset + 1) {
      energyExpended = data[offset] | (data[offset + 1] << 8)
      offset += 2
    }

    const rrIntervals: number[] = []
    if ((flags & 0x10) !== 0) {
      while (offset < data.length - 1) {
        const rrValue = data[offset] | (data[offset + 1] << 8)
        rrIntervals.push(Math.round((rrValue / 1024) * 1000))
        offset += 2
      }
    }

    this.resetHeartbeatTimer()
    return { heartRate, contactDetected, energyExpended, rrIntervals, timestamp: Date.now() }
  }

  private resetHeartbeatTimer(): void {
    this.clearHeartbeatTimer()
    this.heartbeatTimer = setTimeout(() => {
      this.emit('heartbeatTimeout')
    }, this.heartbeatTimeout)
  }

  private clearHeartbeatTimer(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  isConnected(): boolean {
    return this.helper !== null
  }
}
