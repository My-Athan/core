// ─────────────────────────────────────────────────────────────
// BLE WiFi Provisioning — Web Bluetooth API
// Matches firmware BLE GATT service UUIDs
// ─────────────────────────────────────────────────────────────

const WIFI_SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const SSID_CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
const PASSWORD_CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a9';
const STATUS_CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26aa';

const BLE_TIMEOUT_MS = 30000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      val => { clearTimeout(timer); resolve(val); },
      err => { clearTimeout(timer); reject(err); },
    );
  });
}

export class BleProvisioner {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;

  async scan(): Promise<BluetoothDevice> {
    // requestDevice has its own browser timeout/cancel UI
    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'MyAthan-' }],
      optionalServices: [WIFI_SERVICE_UUID],
    });
    return this.device;
  }

  /** Returns the device ID as stored in the backend (lowercase of BLE name, e.g. "myathan-abcdef"). */
  getDeviceId(): string | null {
    if (!this.device?.name) return null;
    return this.device.name.toLowerCase();
  }

  async connect(): Promise<void> {
    if (!this.device) throw new Error('No device selected');
    this.server = await withTimeout(
      this.device.gatt!.connect(),
      BLE_TIMEOUT_MS,
      'BLE connection timed out',
    );
  }

  async sendCredentials(ssid: string, password: string): Promise<void> {
    if (!this.server) throw new Error('Not connected');
    if (!ssid || ssid.length > 32) throw new Error('SSID must be 1-32 characters');
    if (password.length > 63) throw new Error('Password must be 63 characters or less');

    const service = await withTimeout(
      this.server.getPrimaryService(WIFI_SERVICE_UUID),
      BLE_TIMEOUT_MS,
      'BLE service discovery timed out',
    );

    const ssidChar = await service.getCharacteristic(SSID_CHAR_UUID);
    await withTimeout(
      ssidChar.writeValue(new TextEncoder().encode(ssid)),
      BLE_TIMEOUT_MS,
      'Failed to send SSID',
    );

    const passChar = await service.getCharacteristic(PASSWORD_CHAR_UUID);
    await withTimeout(
      passChar.writeValue(new TextEncoder().encode(password)),
      BLE_TIMEOUT_MS,
      'Failed to send password',
    );
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
