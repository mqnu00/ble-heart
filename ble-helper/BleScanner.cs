using System.Text.Json;
using Windows.Devices.Bluetooth;
using Windows.Devices.Bluetooth.Advertisement;
using Windows.Devices.Radios;

namespace BleHelper;

/// <summary>
/// Wraps BluetoothLEAdvertisementWatcher for BLE device discovery.
/// Supports two modes:
///   - Normal scan: reports all devices (scanStarted / deviceDiscovered / scanStopped)
///   - Watch mode:   watches for a specific device address, reports only when found (deviceFound)
/// Uses separate watcher instances so modes don't interfere.
/// </summary>
public sealed class BleScanner : IDisposable
{
    private readonly BluetoothLEAdvertisementWatcher _scanWatcher;
    private readonly BluetoothLEAdvertisementWatcher _watchWatcher;
    private readonly BluetoothLEAdvertisementWatcher _rssiWatcher;
    private readonly Action<string> _writeOutput;
    private int _scannedCount;
    private ulong? _watchAddress;
    private ulong? _rssiAddress;

    public bool IsScanning => _scanWatcher.Status == BluetoothLEAdvertisementWatcherStatus.Started
                           || _scanWatcher.Status == BluetoothLEAdvertisementWatcherStatus.Created;

    public bool IsWatching => _watchAddress.HasValue
                           && _watchWatcher.Status == BluetoothLEAdvertisementWatcherStatus.Started;

    public bool IsRssiMonitoring => _rssiAddress.HasValue
                                 && _rssiWatcher.Status == BluetoothLEAdvertisementWatcherStatus.Started;

    public BleScanner(Action<string> writeOutput)
    {
        _writeOutput = writeOutput;

        // Normal scan watcher
        _scanWatcher = new BluetoothLEAdvertisementWatcher
        {
            ScanningMode = BluetoothLEScanningMode.Active
        };
        _scanWatcher.Received += OnScanReceived;
        _scanWatcher.Stopped += OnScanStopped;

        // Watch watcher (passive mode — lower power, sufficient for device re-discovery)
        _watchWatcher = new BluetoothLEAdvertisementWatcher
        {
            ScanningMode = BluetoothLEScanningMode.Passive
        };
        _watchWatcher.Received += OnWatchReceived;
        _watchWatcher.Stopped += OnWatchStopped;

        // RSSI monitor watcher (passive — continuous signal strength monitoring)
        _rssiWatcher = new BluetoothLEAdvertisementWatcher
        {
            ScanningMode = BluetoothLEScanningMode.Passive
        };
        _rssiWatcher.Received += OnRssiReceived;
        _rssiWatcher.Stopped += OnRssiStopped;
    }

    // ── Normal scan ──

    /// <summary>
    /// 蓝牙关闭时 watcher.Start() 会直接抛异常(而非触发 Stopped 事件),
    /// 此处捕获并上报 bluetoothError 供主进程提示用户。
    /// </summary>
    public async Task StartAsync()
    {
        _scannedCount = 0;
        try
        {
            _scanWatcher.Start();
            WriteEvent(new BleEvent { Evt = "scanStarted" });
        }
        catch (Exception ex)
        {
            await ReportWatcherStartErrorAsync(ex);
        }
    }

    public void Stop()
    {
        _scanWatcher.Stop();
    }

    private void OnScanReceived(BluetoothLEAdvertisementWatcher sender, BluetoothLEAdvertisementReceivedEventArgs args)
    {
        _scannedCount++;

        var evt = new BleEvent
        {
            Evt = "deviceDiscovered",
            Address = BleAddress.ToHex(args.BluetoothAddress),
            Name = args.Advertisement.LocalName ?? "Unknown",
            Rssi = args.RawSignalStrengthInDBm
        };
        WriteEvent(evt);
    }

    private void OnScanStopped(BluetoothLEAdvertisementWatcher sender, BluetoothLEAdvertisementWatcherStoppedEventArgs args)
    {
        ReportBluetoothErrorIfNeeded(args.Error);
        WriteEvent(new BleEvent { Evt = "scanStopped" });
    }

    // ── Watch mode (targeted device re-discovery) ──

    /// <summary>
    /// Start watching for a specific device address.
    /// When the device is seen in advertisements, emits "deviceFound" and stops watching.
    /// </summary>
    public async Task WatchAsync(ulong address)
    {
        StopWatch();
        _watchAddress = address;
        try
        {
            _watchWatcher.Start();
            WriteEvent(new BleEvent { Evt = "watchStarted", Address = BleAddress.ToHex(address) });
        }
        catch (Exception ex)
        {
            _watchAddress = null;
            await ReportWatcherStartErrorAsync(ex);
        }
    }

    /// <summary>
    /// Stop watching for the target device.
    /// </summary>
    public void StopWatch()
    {
        _watchAddress = null;
        _watchWatcher.Stop();
    }

    private void OnWatchReceived(BluetoothLEAdvertisementWatcher sender, BluetoothLEAdvertisementReceivedEventArgs args)
    {
        if (!_watchAddress.HasValue) return;

        if (args.BluetoothAddress == _watchAddress.Value)
        {
            // Target device found! Stop watching and report.
            var addr = _watchAddress.Value;
            StopWatch();

            WriteEvent(new BleEvent
            {
                Evt = "deviceFound",
                Address = BleAddress.ToHex(addr),
                Name = args.Advertisement.LocalName ?? "Unknown",
                Rssi = args.RawSignalStrengthInDBm
            });
        }
    }

    private void OnWatchStopped(BluetoothLEAdvertisementWatcher sender, BluetoothLEAdvertisementWatcherStoppedEventArgs args)
    {
        ReportBluetoothErrorIfNeeded(args.Error);
        WriteEvent(new BleEvent { Evt = "watchStopped" });
    }

    // ── RSSI monitor (continuous signal strength monitoring) ──

    /// <summary>
    /// Start continuously monitoring RSSI for a specific device address.
    /// Unlike Watch, this does NOT stop when the device is found — it keeps
    /// reporting rssiUpdate events for every received advertisement.
    /// </summary>
    public async Task StartRssiMonitorAsync(ulong address)
    {
        // 已在监听同一设备 → 不重启 watcher,避免监听中断
        if (_rssiAddress == address && IsRssiMonitoring)
        {
            return;
        }
        StopRssiMonitor();
        _rssiAddress = address;
        try
        {
            _rssiWatcher.Start();
            WriteEvent(new BleEvent
            {
                Evt = "rssiMonitorStarted",
                Address = BleAddress.ToHex(address)
            });
        }
        catch (Exception ex)
        {
            _rssiAddress = null;
            await ReportWatcherStartErrorAsync(ex);
        }
    }

    /// <summary>
    /// Stop RSSI monitoring.
    /// </summary>
    public void StopRssiMonitor()
    {
        _rssiAddress = null;
        _rssiWatcher.Stop();
    }

    private void OnRssiReceived(BluetoothLEAdvertisementWatcher sender, BluetoothLEAdvertisementReceivedEventArgs args)
    {
        if (!_rssiAddress.HasValue) return;

        if (args.BluetoothAddress == _rssiAddress.Value)
        {
            WriteEvent(new BleEvent
            {
                Evt = "rssiUpdate",
                Address = BleAddress.ToHex(args.BluetoothAddress),
                Name = args.Advertisement.LocalName ?? "Unknown",
                Rssi = args.RawSignalStrengthInDBm
            });
        }
    }

    private void OnRssiStopped(BluetoothLEAdvertisementWatcher sender, BluetoothLEAdvertisementWatcherStoppedEventArgs args)
    {
        ReportBluetoothErrorIfNeeded(args.Error);
        WriteEvent(new BleEvent { Evt = "rssiMonitorStopped" });
    }

    // ── Helpers ──

    /// <summary>
    /// 蓝牙关闭/禁用时 watcher 停止并携带错误码(RadioNotAvailable 等),
    /// 此时发 bluetoothError 事件供主进程提示用户。正常停止(Error == Success)不发。
    /// </summary>
    private void ReportBluetoothErrorIfNeeded(BluetoothError error)
    {
        if (error == BluetoothError.Success) return;
        WriteEvent(new BleEvent
        {
            Evt = "bluetoothError",
            Code = error.ToString(),
            Message = $"Bluetooth radio unavailable: {error}"
        });
    }

    /// <summary>
    /// watcher.Start() 抛异常时(常见于蓝牙关闭):查询 radio 状态确认,
    /// 蓝牙不可用 → bluetoothError,其他原因 → 普通 error。
    /// </summary>
    private async Task ReportWatcherStartErrorAsync(Exception ex)
    {
        if (await GetRadioErrorAsync() != BluetoothError.Success)
        {
            WriteEvent(new BleEvent
            {
                Evt = "bluetoothError",
                Code = BluetoothError.RadioNotAvailable.ToString(),
                Message = $"Bluetooth radio unavailable: {ex.GetType().Name}"
            });
        }
        else
        {
            WriteEvent(new BleEvent { Evt = "error", Message = $"Watcher start failed: {ex.Message}" });
        }
    }

    /// <summary>查询蓝牙 radio 状态:关闭/不可用返回 RadioNotAvailable,正常返回 Success。</summary>
    private static async Task<BluetoothError> GetRadioErrorAsync()
    {
        try
        {
            var radios = await Radio.GetRadiosAsync();
            var btRadio = radios.FirstOrDefault(r => r.Kind == RadioKind.Bluetooth);
            if (btRadio == null || btRadio.State != RadioState.On)
            {
                return BluetoothError.RadioNotAvailable;
            }
            return BluetoothError.Success;
        }
        catch
        {
            return BluetoothError.RadioNotAvailable;
        }
    }

    private void WriteEvent(BleEvent evt)
    {
        try
        {
            var json = JsonSerializer.Serialize(evt);
            _writeOutput(json);
        }
        catch (Exception ex)
        {
            var err = new BleEvent { Evt = "error", Message = $"Scanner JSON error: {ex.Message}" };
            _writeOutput(JsonSerializer.Serialize(err));
        }
    }

    public void Dispose()
    {
        _scanWatcher.Received -= OnScanReceived;
        _scanWatcher.Stopped -= OnScanStopped;
        if (IsScanning) _scanWatcher.Stop();

        _watchWatcher.Received -= OnWatchReceived;
        _watchWatcher.Stopped -= OnWatchStopped;
        StopWatch();

        _rssiWatcher.Received -= OnRssiReceived;
        _rssiWatcher.Stopped -= OnRssiStopped;
        _rssiWatcher.Stop();
    }
}
