import type { HeartRateData } from './types'

/**
 * 解析 BLE 心率测量特征数据
 * 
 * 数据格式 (Heart Rate Measurement, UUID: 0x2A37):
 * Byte 0: Flags
 *   bit 0: Heart Rate Value Format (0 = UINT8, 1 = UINT16)
 *   bit 1: Sensor Contact Status (0-1 = not supported, 2 = supported but not detected, 3 = supported and detected)
 *   bit 2: Sensor Contact Supported
 *   bit 3: Energy Expended Status (是否包含能量消耗字段)
 *   bit 4: RR-Interval (是否包含 RR 间期字段)
 * Byte 1-2: Heart Rate Value (UINT8 or UINT16, depends on flag bit 0)
 * 后续字节: Energy Expended (2 bytes, optional)
 * 后续字节: RR-Intervals (每 2 bytes 一个, optional)
 */
export function parseHeartRateMeasurement(data: Buffer): HeartRateData {
  const flags = data[0]
  let offset = 1

  // 解析心率值
  const isUint16 = (flags & 0x01) !== 0
  let heartRate: number

  if (isUint16) {
    heartRate = data.readUInt16LE(offset)
    offset += 2
  } else {
    heartRate = data.readUInt8(offset)
    offset += 1
  }

  // 接触状态
  const contactSupported = (flags & 0x04) !== 0
  const contactDetected = contactSupported && (flags & 0x02) !== 0

  // 能量消耗 (optional)
  let energyExpended: number | null = null
  if ((flags & 0x08) !== 0) {
    energyExpended = data.readUInt16LE(offset)
    offset += 2
  }

  // RR 间期 (optional)
  const rrIntervals: number[] = []
  if ((flags & 0x10) !== 0) {
    while (offset < data.length - 1) {
      // RR 间期分辨率 1/1024 秒，转换为毫秒
      const rrValue = data.readUInt16LE(offset)
      rrIntervals.push(Math.round((rrValue / 1024) * 1000))
      offset += 2
    }
  }

  return {
    heartRate,
    contactDetected,
    energyExpended,
    rrIntervals,
    timestamp: Date.now()
  }
}
