using System.Text.Json;
using Windows.Devices.Bluetooth.Advertisement;

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
    private readonly Action<string> _writeOutput;
    private int _scannedCount;
    private ulong? _watchAddress;

    public bool IsScanning => _scanWatcher.Status == BluetoothLEAdvertisementWatcherStatus.Started
                           || _scanWatcher.Status == BluetoothLEAdvertisementWatcherStatus.Created;

    public bool IsWatching => _watchAddress.HasValue
                           && _watchWatcher.Status == BluetoothLEAdvertisementWatcherStatus.Started;

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
    }

    // ── Normal scan ──

    public void Start()
    {
        _scannedCount = 0;
        _scanWatcher.Start();
        WriteEvent(new BleEvent { Evt = "scanStarted" });
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
        WriteEvent(new BleEvent { Evt = "scanStopped" });
    }

    // ── Watch mode (targeted device re-discovery) ──

    /// <summary>
    /// Start watching for a specific device address.
    /// When the device is seen in advertisements, emits "deviceFound" and stops watching.
    /// </summary>
    public void Watch(ulong address)
    {
        StopWatch();
        _watchAddress = address;
        _watchWatcher.Start();
        WriteEvent(new BleEvent { Evt = "watchStarted", Address = BleAddress.ToHex(address) });
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
        WriteEvent(new BleEvent { Evt = "watchStopped" });
    }

    // ── Helpers ──

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
    }
}
