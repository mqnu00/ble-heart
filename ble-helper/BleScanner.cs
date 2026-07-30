using System.Text.Json;
using Windows.Devices.Bluetooth.Advertisement;

namespace BleHelper;

/// <summary>
/// Wraps BluetoothLEAdvertisementWatcher for BLE device discovery.
/// Fires Received event on threadpool — no UI message pump needed.
/// </summary>
public sealed class BleScanner : IDisposable
{
    private readonly BluetoothLEAdvertisementWatcher _watcher;
    private readonly Action<string> _writeOutput;
    private int _scannedCount;

    public bool IsScanning => _watcher.Status == BluetoothLEAdvertisementWatcherStatus.Started
                           || _watcher.Status == BluetoothLEAdvertisementWatcherStatus.Created;

    public BleScanner(Action<string> writeOutput)
    {
        _writeOutput = writeOutput;
        _watcher = new BluetoothLEAdvertisementWatcher
        {
            ScanningMode = BluetoothLEScanningMode.Active
        };
        _watcher.Received += OnReceived;
        _watcher.Stopped += OnStopped;
    }

    public void Start()
    {
        _scannedCount = 0;
        _watcher.Start();
        WriteEvent(new BleEvent { Evt = "scanStarted" });
    }

    public void Stop()
    {
        if (IsScanning)
        {
            _watcher.Stop();
        }
    }

    private void OnReceived(BluetoothLEAdvertisementWatcher sender, BluetoothLEAdvertisementReceivedEventArgs args)
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

    private void OnStopped(BluetoothLEAdvertisementWatcher sender, BluetoothLEAdvertisementWatcherStoppedEventArgs args)
    {
        WriteEvent(new BleEvent { Evt = "scanStopped" });
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
        _watcher.Received -= OnReceived;
        _watcher.Stopped -= OnStopped;
        if (IsScanning) _watcher.Stop();
    }
}
