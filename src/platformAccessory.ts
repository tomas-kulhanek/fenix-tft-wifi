import {Logger, PlatformAccessory, Service} from 'homebridge';
import {FenixTFTWifiPlatform} from './platform';
import ThermostatApi from './Api/ThermostatApi';
import ThermostatData from './DTO/ThermostatData';
import {ThermostatMode} from './Enum/ThermostatMode';
import {BLUE, CYAN, GREEN, GREY, LIGHT_GREY, RESET} from './colors';

export class FenixTFTThermostatPlatformAccessory {

  private service: Service;
  private name: string;
  private logger: Logger;
  private thermostatData: ThermostatData | undefined;

  constructor(
    private readonly platform: FenixTFTWifiPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly tApi: ThermostatApi,
    private readonly temperatureUnit,
    private temperatureCheckInterval: number,
  ) {
    this.logger = platform.log;
    this.name = platform.config.name as string;

    this.service = this.accessory.getService(this.platform.api.hap.Service.Thermostat)
      || this.accessory.addService(this.platform.api.hap.Service.Thermostat);
  }

  initialize() {
    this.debug('Initializing Fenix TFT accessory');

    this.updateValues()
      .then(() => {
        this.service.getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState)
          .onGet(this.handleCurrentHeatingCoolingStateGet.bind(this))
          .setProps({
            validValues: [
              this.platform.Characteristic.CurrentHeatingCoolingState.OFF,
              this.platform.Characteristic.CurrentHeatingCoolingState.HEAT,
            ],
          });

        this.service.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
          .onGet(this.handleTargetHeatingCoolingStateGet.bind(this))
          .onSet(this.handleTargetHeatingCoolingStateSet.bind(this))
          .setProps({
            validValues: [
              this.platform.Characteristic.TargetHeatingCoolingState.OFF,
              this.platform.Characteristic.TargetHeatingCoolingState.HEAT,
              this.platform.Characteristic.TargetHeatingCoolingState.COOL,
              this.platform.Characteristic.TargetHeatingCoolingState.AUTO,
            ],
          });

        this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
          .onGet(this.handleCurrentTemperatureGet.bind(this));

        this.debug(
          'Setting unit ' +
          this.cyanize(this.stringifyUnit),
        );
        this.service.getCharacteristic(this.platform.Characteristic.TargetTemperature)
          .onGet(this.handleTargetTemperatureGet.bind(this))
          .onSet(this.handleTargetTemperatureSet.bind(this))
          .setProps({
            minValue: this.temperatureUnit === this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS ? 5 : 0,
            maxValue: this.temperatureUnit === this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS ? 35 : 1000,
            minStep: this.temperatureUnit === this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS ? 0.5 : 5,
          });

        this.service.getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
          .onGet(this.handleTemperatureDisplayUnitsGet.bind(this));

        setInterval(() => {
          this.updateValues()
            .then(() => this.debug('Value updates was successfully'))
            .catch((error) => this.error(`Is not possible to update values ${error}`));
        }, this.temperatureCheckInterval);
      }).catch((error) => this.error(`Is not possible to update values ${error}`));
  }

  cToF(celsius: number): number {
    const converted = celsius * 9 / 5 + 32;
    this.debug('Converting ' + this.cyanize(celsius + '°C') + `${GREY} to ${RESET}${this.cyanize(converted + '°F')}`);
    return converted;
  }

  fToC(fahrenheit: number): number {
    const converted = Math.round((((fahrenheit - 32) * 5 / 9) + Number.EPSILON) * 100) / 100;
    this.debug('Converting ' + this.cyanize(fahrenheit + '°F') + `${GREY} to ${RESET}${this.cyanize(converted + '°C')}`);
    return converted;
  }

  handleCurrentHeatingCoolingStateGet() {
    this.debug('Triggered GET CurrentHeatingCoolingState');
    return this.thermostatData?.currentHeatingCoolingState ?? this.platform.Characteristic.CurrentHeatingCoolingState.OFF;
  }

  handleTargetHeatingCoolingStateGet() {
    const temp = this.thermostatData?.targetHeatingCoolingState ?? this.platform.Characteristic.TargetHeatingCoolingState.OFF;
    this.info('Target temperature  was set on ' + this.cyanize(temp + this.stringifyUnit));
    return temp;
  }

  handleTargetHeatingCoolingStateSet(value) {
    this.info(`Changing thermostat mode from ${this.cyanize(this.thermostatData?.mode)} to ${this.cyanize(value)}`);
    if (!this.thermostatData) {
      this.warning('Thermostat data was not found');
      return;
    }
    switch (value) {
      case this.platform.Characteristic.TargetHeatingCoolingState.COOL:
        this.thermostatData.mode = ThermostatMode.ANTIFREEZE;
        this.debug('Setting ' + this.cyanize('Antifreeze mode'));
        break;
      case this.platform.Characteristic.TargetHeatingCoolingState.AUTO:
        this.thermostatData.mode = ThermostatMode.AUTO;
        this.debug('Setting ' + this.cyanize('Auto mode'));
        break;
      case this.platform.Characteristic.TargetHeatingCoolingState.OFF:
        this.thermostatData.mode = ThermostatMode.OFF;
        this.debug('Setting ' + this.cyanize('Off mode'));
        break;
      default:
        this.thermostatData.mode = ThermostatMode.MANUAL;
        this.debug('Setting ' + this.cyanize('Manual mode'));
        this.tApi.setTemperature(this.thermostatData)
          .then(() => this.info(`${GREEN}Manual mode was set${RESET}`))
          .catch(() => this.error('Cannot to set mode for thermostat ' + this.accessory.displayName));
        return;
    }

    this.tApi.changeMode(this.thermostatData.mode)
      .then(() => this.info(`${GREEN}Mode was set${RESET}`))
      .catch(() => this.error('Cannot to set mode for thermostat ' + this.accessory.displayName));
  }

  handleCurrentTemperatureGet() {
    if (this.temperatureUnit === this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS) {
      if (!this.thermostatData?.actualTemperature) {
        this.info('Current temperature ' + this.cyanize('0' + this.stringifyUnit));
        return 0;
      }
      const temp = this.fToC(this.thermostatData?.actualTemperature);
      this.info('Current temperature ' + this.cyanize(temp + this.stringifyUnit));
      return temp;
    }

    const temp = this.thermostatData?.actualTemperature ?? 0;
    this.info('Current temperature ' + this.cyanize(temp + this.stringifyUnit));
    return temp;
  }

  handleTargetTemperatureGet() {
    this.debug('Triggered GET TargetTemperature');
    if (this.temperatureUnit === this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS) {
      if (!this.thermostatData?.requiredTemperature) {
        this.info('Target temperature is ' + this.cyanize('0' + this.stringifyUnit));
        return 0;
      }

      const temp = this.fToC(this.thermostatData?.requiredTemperature);
      this.info('Target temperature is ' + this.cyanize(temp + this.stringifyUnit));
      return temp;
    }

    const temp = this.thermostatData?.requiredTemperature ?? 0;
    this.info('Target temperature is ' + this.cyanize(temp + this.stringifyUnit));
    return temp;
  }

  private get stringifyUnit(): string {
    return this.temperatureUnit === this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS ? '°C' : '°F';
  }

  handleTargetTemperatureSet(value) {
    this.info('Triggered SET TargetTemperature:' + this.cyanize(value + this.stringifyUnit));

    const targetTemperature = value;
    if (this.temperatureUnit === this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS) {
      value = this.cToF(value);
    }
    if (this.thermostatData === undefined) {
      this.error('Thermostat data was not found');
      return;
    }

    if (value === this.thermostatData.requiredTemperature) {
      this.debug('Temperature is same as actually required');
      return;
    }
    this.thermostatData.requiredTemperature = value;

    this.tApi.setTemperature(this.thermostatData)
      .then(() => this.info(`${GREEN}Temperature was set on ${targetTemperature}${this.stringifyUnit}${RESET}`))
      .catch(() => this.error('Cannot to set temperature for thermostat ' + this.accessory.displayName));
  }

  handleTemperatureDisplayUnitsGet() {
    return this.temperatureUnit;
  }

  async updateValues() {
    this.debug('Update Fenix TFT accessory');
    this.thermostatData = await this.tApi.getInformation();

    const informationService = this.accessory.getService(this.platform.api.hap.Service.AccessoryInformation);
    if (informationService) {
      informationService
        .setCharacteristic(this.platform.api.hap.Characteristic.Manufacturer, 'Fenix Trading s.r.o.')
        .setCharacteristic(this.platform.api.hap.Characteristic.Model, 'Fenix TFT Wifi ' + this.thermostatData.model)
        .setCharacteristic(this.platform.api.hap.Characteristic.SerialNumber, this.thermostatData.softwareVersion);
    }
  }

  debug(message: string) {
    this.logger.debug(this.baseLogMessage + `${GREY}${message}${RESET}`);
  }

  info(message: string) {
    this.logger.info(this.baseLogMessage + message);
  }

  warning(message: string) {
    this.logger.warn(this.baseLogMessage + message);
  }

  error(message: string) {
    this.logger.error(this.baseLogMessage + message);
  }

  private get baseLogMessage(): string {
    return `${LIGHT_GREY}[${this.accessory.context.device.uuid}]${RESET} ${BLUE}[${this.accessory.displayName}]: ${RESET}`;
  }

  private cyanize(value: string | number | undefined): string {
    if (value === undefined) {
      return '';
    }
    return `${CYAN}${value}${RESET}`;
  }
}
