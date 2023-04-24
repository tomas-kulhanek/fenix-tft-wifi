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
import {BLUE, GREY, RED, RESET, GREEN, LIGHT_GREY} from './colors';

export class FenixTFTWifiPlatform implements DynamicPlatformPlugin {
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform');
    this.api.on('didFinishLaunching', () => {
      log.debug(`${GREY}Executed didFinishLaunching callback${RESET}`);
      this.initAccessories()
        .then(() => this.log.info(`${GREEN}Initialized${RESET}`))
        .catch((error) => this.log.error(`Initialize of plugin was failed ${error}`));
    });
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    this.accessories.push(accessory);
  }

  async initAccessories() {
    const tokenManager = new TokenManager(
      this.config.accessToken,
      this.config.refreshToken,
      this.log,
      this.api,
    );
    await tokenManager.loadInitialTokens();
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
      const toUpdate: Array<PlatformAccessory> = [];
      const toUnregister: Array<PlatformAccessory> = [];

      for (const device of devices) {
        const uuid = this.api.hap.uuid.generate(device.uuid);
        activeUUIDs.push(uuid);

        const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

        const tsApi = new ThermostatApi(device.uuid, tokenManager);
        if (existingAccessory) {
          this.log.info(
            this.colorizedThermostatIdentifications(device) + 'Restoring existing Fenix TFT thermostat from cache',
          );
          existingAccessory.context.device = device;
          existingAccessory.displayName = device.name;
          this.createThermostat(existingAccessory, tsApi);
          toUpdate.push(existingAccessory);
          continue;
        }

        this.log.info(
          this.colorizedThermostatIdentifications(device) + 'Adding new Fenix TFT thermostat',
        );
        const accessory = new this.api.platformAccessory(device.name, uuid);
        accessory.context.device = device;
        this.createThermostat(accessory, tsApi);
        toRegister.push(accessory);
      }

      for (const accessory of this.accessories) {
        if (!activeUUIDs.includes(accessory.UUID)) {
          this.log.debug(
            this.colorizedThermostatIdentifications(accessory.context.device)
            + `${RED}Removing unused Fenix TFT thermostat accessory ${RESET}`,
          );
          toUnregister.push(accessory);
        }
      }
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, toRegister);
      try {
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, toUnregister);
      } catch (error) {
        this.log.error(`Error while unregistering accessories: ${error}`);
      }
      try {
        this.api.updatePlatformAccessories(toUpdate);
      } catch (error) {
        this.log.error(`Error while updating accessories: ${error}`);
      }
    }).catch((error) => this.log.error(`Cannot to retrieve base data. Do you have valid token? ${error}`));
  }

  private getTemperatureCheckInterval(): number {
    this.log.debug(`${GREY}Thermostat check interval is ${this.config.temperatureCheckInterval || 30} minutes${RESET}`);
    return (this.config.temperatureCheckInterval || 30) * 60000;
  }

  private get temperatureUnit(): number {
    if (this.config.temperatureUnit === 1) {
      return this.Characteristic.TemperatureDisplayUnits.FAHRENHEIT;
    }
    return this.Characteristic.TemperatureDisplayUnits.CELSIUS;
  }

  private createThermostat(accessory, tsApi: ThermostatApi): FenixTFTThermostatPlatformAccessory {
    const thermostat = new FenixTFTThermostatPlatformAccessory(
      this,
      accessory,
      tsApi,
      this.temperatureUnit,
      this.getTemperatureCheckInterval(),
    );
    thermostat.initialize();
    return thermostat;
  }

  private colorizedThermostatIdentifications(device: { uuid: string; name: string }): string {
    return `${LIGHT_GREY}[${device.uuid}]${RESET} ${BLUE}[${device.name}]${RESET}: `;
  }
}
