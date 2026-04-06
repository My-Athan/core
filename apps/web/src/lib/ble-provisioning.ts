// ─────────────────────────────────────────────────────────────
// BLE WiFi Provisioning — Web Bluetooth API
// Matches firmware BLE GATT service UUIDs
// ─────────────────────────────────────────────────────────────

const WIFI_SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const SSID_CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
const PASSWORD_CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a9';
const STATUS_CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26aa';

export class BleProvisioner {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;

  async scan(): Promise<BluetoothDevice> {
    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'MyAthan-' }],
      optionalServices: [WIFI_SERVICE_UUID],
    });
    return this.device;
  }

  async connect(): Promise<void> {
    if (!this.device) throw new Error('No device selected');
    this.server = await this.device.gatt!.connect();
  }

  async sendCredentials(ssid: string, password: string): Promise<void> {
    if (!this.server) throw new Error('Not connected');

    const service = await this.server.getPrimaryService(WIFI_SERVICE_UUID);

    const ssidChar = await service.getCharacteristic(SSID_CHAR_UUID);
    await ssidChar.writeValue(new TextEncoder().encode(ssid));

    const passChar = await service.getCharacteristic(PASSWORD_CHAR_UUID);
    await passChar.writeValue(new TextEncoder().encode(password));
  }

  async getStatus(): Promise<string> {
    if (!this.server) throw new Error('Not connected');
    const service = await this.server.getPrimaryService(WIFI_SERVICE_UUID);
    const statusChar = await service.getCharacteristic(STATUS_CHAR_UUID);
    const value = await statusChar.readValue();
    return new TextDecoder().decode(value);
  }

  disconnect(): void {
    if (this.server?.connected) {
      this.server.disconnect();
    }
    this.device = null;
    this.server = null;
  }
}

export const bleProvisioner = new BleProvisioner();
