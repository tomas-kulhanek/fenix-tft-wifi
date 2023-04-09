import {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Characteristic,
} from 'homebridge';

import {PLATFORM_NAME, PLUGIN_NAME} from './settings';
import {FenixTFTThermostatPlatformAccessory} from './platformAccessory';
import ThermostatApi from './Api/ThermostatApi';
import FenixApi from './Api/FenixApi';
import TokenManager from './TokenManager';

export class FenixTFTWifiPlatform implements DynamicPlatformPlugin {
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);
    this.api.on('didFinishLaunching', async () => {
      log.debug('Executed didFinishLaunching callback');
      await this.initAccessories();
    });
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    this.accessories.push(accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent 'duplicate UUID' errors.
   */
  async initAccessories() {
    const tokenManager = new TokenManager(
      this.config.accessToken,
      this.config.refreshToken,
      this.log,
      this.api,
    );
    await new Promise(resolve => setTimeout(resolve, 5000));
    const fenixApi = new FenixApi(tokenManager);
    fenixApi.readMyInformation().then((data) => {
      const devices: { uuid: string; name: string }[] = [];
      for (const home of data.data) {
        for (const room of home.rooms) {
          for (const sensor of room.sensors) {
            devices.push({'name': sensor.S2, 'uuid': sensor.S1});
          }
        }
      }

      const activeUUIDs: Array<string> = [];
      const toRegister: Array<PlatformAccessory> = [];

      for (const device of devices) {
        const uuid = this.api.hap.uuid.generate(device.uuid);
        activeUUIDs.push(uuid);

        const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

        const tsApi = new ThermostatApi(device.uuid, tokenManager);
        if (existingAccessory) {
          this.log.info('Restoring existing Fenix TFT thermostat from cache:', existingAccessory.displayName);
          existingAccessory.context.device = device;
          this.api.updatePlatformAccessories([existingAccessory]);
          this.createThermostat(existingAccessory, tsApi);
          continue;
        }

        this.log.info('Adding new Fenix TFT thermostat:', device.name);
        const accessory = new this.api.platformAccessory(device.name, uuid);
        accessory.context.device = device;
        this.createThermostat(accessory, tsApi);
        toRegister.push(accessory);
      }

      const toUnregister: Array<PlatformAccessory> = [];
      for (const accessory of this.accessories) {
        if (!activeUUIDs.includes(accessory.UUID)) {
          this.log.debug('Removing unused Fenix TFT thermostat accessory with UUID', accessory.UUID);
          toUnregister.push(accessory);
        }
      }
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, toRegister);
      try {
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, toUnregister);
      } catch (error) {
        this.log.error(`Error while unregistering accessories: ${error}`);
      }
    }).catch(()=>this.log.error('Cannot to retrieve base data'));
  }

  private getTemperatureCheckInterval(): number {
    return (this.config.temperatureCheckInterval || 30) * 60000;
  }

  private createThermostat(accessory, tsApi: ThermostatApi): FenixTFTThermostatPlatformAccessory {
    return new FenixTFTThermostatPlatformAccessory(
      this,
      accessory,
      tsApi,
      this.getTemperatureCheckInterval(),
    );
  }
}
