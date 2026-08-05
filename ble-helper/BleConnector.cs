using System.Text.Json;
using Windows.Devices.Bluetooth;
using Windows.Devices.Bluetooth.GenericAttributeProfile;
using Windows.Storage.Streams;

namespace BleHelper;

/// <summary>
/// Wraps BluetoothLEDevice for GATT connection and HR service subscription.
/// </summary>
public sealed class BleConnector : IDisposable
{
    private static readonly Guid HrServiceUuid = Guid.Parse("0000180d-0000-1000-8000-00805f9b34fb");
    private static readonly Guid HrCharUuid    = Guid.Parse("00002a37-0000-1000-8000-00805f9b34fb");

    private readonly Action<string> _writeOutput;
    private BluetoothLEDevice? _device;
    private GattDeviceService? _service;
    private GattCharacteristic? _characteristic;
    private bool _disposed;

    public bool IsConnected => _device?.ConnectionStatus == BluetoothConnectionStatus.Connected;

    public BleConnector(Action<string> writeOutput)
    {
        _writeOutput = writeOutput;
    }

    public async Task ConnectAsync(ulong address)
    {
        Disconnect(notify: false); // ensure clean state (internal reset, do not broadcast)

        _device = await BluetoothLEDevice.FromBluetoothAddressAsync(address);
        if (_device == null)
        {
            WriteEvent(new BleEvent { Evt = "error", Message = "Failed to create BluetoothLEDevice" });
            return;
        }

        _device.ConnectionStatusChanged += OnConnectionStatusChanged;

        // Discover HR service
        var svcResult = await _device.GetGattServicesForUuidAsync(HrServiceUuid, BluetoothCacheMode.Uncached);
        if (svcResult.Status != GattCommunicationStatus.Success || svcResult.Services.Count == 0)
        {
            WriteEvent(new BleEvent { Evt = "error", Message = "Heart Rate service (180D) not found" });
            Disconnect(notify: false);
            return;
        }
        _service = svcResult.Services[0];

        // Discover HR measurement characteristic
        var charResult = await _service.GetCharacteristicsForUuidAsync(HrCharUuid, BluetoothCacheMode.Uncached);
        if (charResult.Status != GattCommunicationStatus.Success || charResult.Characteristics.Count == 0)
        {
            WriteEvent(new BleEvent { Evt = "error", Message = "Heart Rate Measurement characteristic (2A37) not found" });
            Disconnect(notify: false);
            return;
        }
        _characteristic = charResult.Characteristics[0];

        // Subscribe to notifications (CCCD)
        var cccdStatus = await _characteristic.WriteClientCharacteristicConfigurationDescriptorAsync(
            GattClientCharacteristicConfigurationDescriptorValue.Notify);
        if (cccdStatus != GattCommunicationStatus.Success)
        {
            WriteEvent(new BleEvent { Evt = "error", Message = "Failed to subscribe to HR notifications" });
            Disconnect(notify: false);
            return;
        }

        _characteristic.ValueChanged += OnValueChanged;

        WriteEvent(new BleEvent
        {
            Evt = "connected",
            Address = BleAddress.ToHex(address),
            Name = _device.Name ?? "Unknown"
        });
    }

    /// <summary>
    /// 断开当前连接并清理资源。
    /// notify=true(默认)时广播 disconnected(reason=user),用于用户主动断开;
    /// notify=false 用于内部清理(ConnectAsync 开头重置、连接失败清理),
    /// 此时失败已由 error 事件通知,避免干扰主进程重连状态机。
    /// </summary>
    public void Disconnect(bool notify = true)
    {
        if (_characteristic != null)
        {
            _characteristic.ValueChanged -= OnValueChanged;
            _characteristic = null;
        }

        if (_service != null)
        {
            _service.Dispose();
            _service = null;
        }

        if (_device != null)
        {
            _device.ConnectionStatusChanged -= OnConnectionStatusChanged;
            var addr = BleAddress.ToHex(_device.BluetoothAddress);
            _device.Dispose();
            _device = null;

            if (notify)
            {
                WriteEvent(new BleEvent { Evt = "disconnected", Address = addr, Reason = "user" });
            }
        }
    }

    private void OnConnectionStatusChanged(BluetoothLEDevice sender, object args)
    {
        if (sender.ConnectionStatus == BluetoothConnectionStatus.Disconnected)
        {
            WriteEvent(new BleEvent
            {
                Evt = "disconnected",
                Address = BleAddress.ToHex(sender.BluetoothAddress),
                Reason = "remote"
            });
        }
    }

    private void OnValueChanged(GattCharacteristic sender, GattValueChangedEventArgs args)
    {
        try
        {
            var reader = DataReader.FromBuffer(args.CharacteristicValue);
            var data = new byte[reader.UnconsumedBufferLength];
            reader.ReadBytes(data);

            // Debug: log raw bytes
            WriteEvent(new BleEvent
            {
                Evt = "log",
                Message = $"HR raw bytes[{data.Length}]: {string.Join(",", data)}"
            });

            WriteEvent(new BleEvent
            {
                Evt = "heartRateData",
                Raw = data
            });
        }
        catch (Exception ex)
        {
            WriteEvent(new BleEvent { Evt = "error", Message = $"HR data read error: {ex.Message}" });
        }
    }

    private void WriteEvent(BleEvent evt)
    {
        try
        {
            _writeOutput(JsonSerializer.Serialize(evt));
        }
        catch (Exception ex)
        {
            var err = new BleEvent { Evt = "error", Message = $"Connector JSON error: {ex.Message}" };
            _writeOutput(JsonSerializer.Serialize(err));
        }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        Disconnect();
    }
}
