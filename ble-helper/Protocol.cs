using System.Text.Json;
using System.Text.Json.Serialization;

namespace BleHelper;

/// <summary>Serializes byte[] as a JSON number array instead of base64.</summary>
public sealed class ByteArrayJsonConverter : JsonConverter<byte[]>
{
    public override byte[]? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.StartArray)
        {
            var list = new List<byte>();
            while (reader.Read() && reader.TokenType != JsonTokenType.EndArray)
            {
                list.Add(reader.GetByte());
            }
            return list.ToArray();
        }
        return null;
    }

    public override void Write(Utf8JsonWriter writer, byte[] value, JsonSerializerOptions options)
    {
        writer.WriteStartArray();
        foreach (var b in value) writer.WriteNumberValue(b);
        writer.WriteEndArray();
    }
}

// ── Commands (stdin: Electron → Helper) ──

public sealed class BleCommand
{
    [JsonPropertyName("cmd")]
    public string Cmd { get; set; } = "";

    [JsonPropertyName("timeout")]
    public int Timeout { get; set; } = 30000;

    [JsonPropertyName("address")]
    public string Address { get; set; } = "";
}

// ── Events (stdout: Helper → Electron) ──

public sealed class BleEvent
{
    [JsonPropertyName("evt")]
    public string Evt { get; set; } = "";

    [JsonPropertyName("address")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Address { get; set; }

    [JsonPropertyName("name")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Name { get; set; }

    [JsonPropertyName("rssi")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public short? Rssi { get; set; }

    [JsonPropertyName("raw")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    [JsonConverter(typeof(ByteArrayJsonConverter))]
    public byte[]? Raw { get; set; }

    [JsonPropertyName("reason")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Reason { get; set; }

    [JsonPropertyName("message")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Message { get; set; }
}

// ── Helpers ──

public static class BleAddress
{
    /// <summary>ulong Bluetooth address → 12-char uppercase hex string</summary>
    public static string ToHex(ulong address) => address.ToString("X12");

    /// <summary>12-char hex string → ulong Bluetooth address</summary>
    public static ulong FromHex(string hex) => ulong.Parse(hex, System.Globalization.NumberStyles.HexNumber);
}
