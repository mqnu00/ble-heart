using System.Text.Json;
using BleHelper;

// ── BLE helper process — JSON-line protocol over stdin/stdout ──

var scanner = new BleScanner(WriteLine);
var connector = new BleConnector(WriteLine);
CancellationTokenSource? scanTimeoutCts = null;

// Disable stdout buffering
Console.OutputEncoding = System.Text.Encoding.UTF8;
Console.InputEncoding = System.Text.Encoding.UTF8;

WriteLine(JsonSerializer.Serialize(new BleEvent
{
    Evt = "log",
    Message = $"BLE helper started, .NET {Environment.Version}"
}));

// Read stdin line by line
string? line;
while ((line = await Console.In.ReadLineAsync()) != null)
{
    if (string.IsNullOrWhiteSpace(line)) continue;

    try
    {
        var cmd = JsonSerializer.Deserialize<BleCommand>(line);
        if (cmd == null) continue;

        switch (cmd.Cmd)
        {
            case "scan":
                CancelScanTimeout();
                scanner.Start();
                if (cmd.Timeout > 0)
                {
                    scanTimeoutCts = new CancellationTokenSource();
                    var cts = scanTimeoutCts;
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            await Task.Delay(cmd.Timeout, cts.Token);
                            if (!cts.Token.IsCancellationRequested) scanner.Stop();
                        }
                        catch (TaskCanceledException) { }
                    });
                }
                break;

            case "stopScan":
                CancelScanTimeout();
                scanner.Stop();
                break;

            case "connect":
                CancelScanTimeout();
                scanner.Stop();
                await connector.ConnectAsync(BleAddress.FromHex(cmd.Address));
                break;

            case "disconnect":
                connector.Disconnect();
                break;

            case "quit":
                Shutdown();
                break;

            default:
                WriteLine(JsonSerializer.Serialize(new BleEvent
                {
                    Evt = "error", Message = $"Unknown command: {cmd.Cmd}"
                }));
                break;
        }
    }
    catch (JsonException ex)
    {
        WriteLine(JsonSerializer.Serialize(new BleEvent
        {
            Evt = "error", Message = $"Invalid JSON: {ex.Message}"
        }));
    }
    catch (Exception ex)
    {
        WriteLine(JsonSerializer.Serialize(new BleEvent
        {
            Evt = "error", Message = $"Command error: {ex.Message}"
        }));
    }
}

// stdin closed — clean shutdown
Shutdown();

void CancelScanTimeout()
{
    if (scanTimeoutCts != null)
    {
        scanTimeoutCts.Cancel();
        scanTimeoutCts.Dispose();
        scanTimeoutCts = null;
    }
}

void Shutdown()
{
    CancelScanTimeout();
    connector.Dispose();
    scanner.Dispose();
    Environment.Exit(0);
}

/// <summary>Thread-safe write of one JSON line to stdout.</summary>
void WriteLine(string json)
{
    lock (LockHolder._lock)
    {
        Console.WriteLine(json);
    }
}

// Lock object for thread-safe stdout writes
internal static class LockHolder { internal static readonly object _lock = new(); }
