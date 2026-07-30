export interface BLEDeviceInfo {
  id: string
  address: string
  name: string
  rssi: number
}

export interface HeartRateData {
  heartRate: number
  contactDetected: boolean
  energyExpended: number | null
  rrIntervals: number[]
  timestamp: number
}
