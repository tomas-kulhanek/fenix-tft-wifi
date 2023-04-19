import {Logger, PlatformAccessory, Service} from 'homebridge';
import {FenixTFTWifiPlatform} from './platform';
import ThermostatApi from './Api/ThermostatApi';
import ThermostatData from './DTO/ThermostatData';
import {ThermostatMode} from './Enum/ThermostatMode';

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

  async initialize() {
    this.logger.debug('Initializing Fenix TFT accessory', this.accessory.displayName);

    this.accessory.getService(this.platform.api.hap.Service.AccessoryInformation);
    await this.updateValues();

    this.service.getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState)
      .onGet(this.handleCurrentHeatingCoolingStateGet.bind(this))
      .onSet(this.handleCurrentHeatingCoolingStateSet.bind(this))
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
      (this.temperatureUnit === this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS ? 'Celsius' : 'Fahrenheit'),
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

    setInterval(() => this.updateValues(), this.temperatureCheckInterval);
  }

  cToF(celsius: number): number {
    this.debug('Converting ' + celsius + ' to Fahrenheit');
    return celsius * 9 / 5 + 32;
  }

  fToC(fahrenheit: number): number {
    this.debug('Converting ' + fahrenheit + ' to Celsius');
    return (fahrenheit - 32) * 5 / 9;
  }

  handleCurrentHeatingCoolingStateGet() {
    this.logger.debug('Triggered GET CurrentHeatingCoolingState');
    return this.thermostatData?.currentHeatingCoolingState ?? this.platform.Characteristic.CurrentHeatingCoolingState.OFF;
  }

  handleCurrentHeatingCoolingStateSet(value) {
    this.logger.debug('Triggered SET CurrentHeatingCoolingState:' + value);
  }

  handleTargetHeatingCoolingStateGet() {
    this.logger.debug('Triggered GET TargetHeatingCoolingState');
    const temp = this.thermostatData?.targetHeatingCoolingState ?? this.platform.Characteristic.TargetHeatingCoolingState.OFF;
    this.debug('Temperature ' + temp);
    return temp;
  }

  handleTargetHeatingCoolingStateSet(value) {
    this.logger.info('Triggered SET TargetHeatingCoolingState:' + value);
    if (!this.thermostatData) {
      this.warning('Thermostat data was not found');
      return;
    }
    if (value === this.platform.Characteristic.TargetHeatingCoolingState.COOL) {
      this.thermostatData.mode = ThermostatMode.ANTIFREEZE;
      this.debug('Setting Antifreeze mode');
      this.tApi.changeMode(ThermostatMode.ANTIFREEZE)
        .then(() => this.info('Antifreeze mode was set'))
        .catch(() => this.logger.error('Cannot to set mode for thermostat ' + this.accessory.displayName));
      return;
    }
    if (value === this.platform.Characteristic.TargetHeatingCoolingState.AUTO) {
      this.thermostatData.mode = ThermostatMode.AUTO;
      this.debug('Setting Auto mode');
      this.tApi.changeMode(ThermostatMode.AUTO)
        .then(() => this.info('Auto mode was set'))
        .catch(() => this.logger.error('Cannot to set mode for thermostat ' + this.accessory.displayName));
      return;
    }
    if (value === this.platform.Characteristic.TargetHeatingCoolingState.OFF) {
      this.thermostatData.mode = ThermostatMode.OFF;
      this.debug('Setting Off mode');
      this.tApi.changeMode(ThermostatMode.OFF)
        .then(() => this.info('Off mode was set'))
        .catch(() => this.logger.error('Cannot to set mode for thermostat ' + this.accessory.displayName));
      return;
    }
    if (value === this.platform.Characteristic.TargetHeatingCoolingState.HEAT) {
      this.thermostatData.mode = ThermostatMode.MANUAL;
      this.debug('Setting Manual mode');
      this.tApi.setTemperature(this.thermostatData)
        .then(() => this.info('Manual mode was set'))
        .catch(() => this.logger.error('Cannot to set mode for thermostat ' + this.accessory.displayName));
      return;
    }
  }

  handleCurrentTemperatureGet() {
    this.logger.debug('Triggered GET CurrentTemperature');

    if (this.temperatureUnit === this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS) {
      if (!this.thermostatData?.actualTemperature) {
        return 0;
      }
      const temp = this.fToC(this.thermostatData?.actualTemperature);
      this.info('Current temperature ' + temp);
      return temp;
    }

    const temp = this.thermostatData?.actualTemperature ?? 0;
    this.info('Current temperature ' + temp);
    return temp;
  }

  handleTargetTemperatureGet() {
    this.logger.debug('Triggered GET TargetTemperature');
    if (this.temperatureUnit === this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS) {
      if (!this.thermostatData?.requiredTemperature) {
        return 0;
      }

      const temp = this.fToC(this.thermostatData?.requiredTemperature);
      this.info('Target temperature ' + temp);
      return temp;
    }

    const temp = this.thermostatData?.requiredTemperature ?? 0;
    this.info('Target temperature ' + temp);
    return temp;
  }

  handleTargetTemperatureSet(value) {
    this.logger.debug('Triggered SET TargetTemperature:' + value);

    if (this.temperatureUnit === this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS) {
      value = this.cToF(value);
    }
    if (this.thermostatData === undefined) {
      this.error('Thermostat data was not found');
      return;
    }

    if (value === this.thermostatData.requiredTemperature) {
      this.info('Temperature is same as actually required');
      return;
    }
    this.thermostatData.requiredTemperature = value;

    this.tApi.setTemperature(this.thermostatData)
      .then(() => this.info('Temperature was set'))
      .catch(() => this.logger.error('Cannot to set temperature for thermostat ' + this.accessory.displayName));
  }

  handleTemperatureDisplayUnitsGet() {
    this.logger.debug('Triggered GET TemperatureDisplayUnits');
    return this.temperatureUnit;
  }

  async updateValues() {
    this.logger.debug('Update Fenix TFT accessory', this.accessory.displayName);
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
    this.logger.debug(this.accessory.displayName + ': ' + message);
  }

  info(message: string) {
    this.logger.info(this.accessory.displayName + ': ' + message);
  }

  warning(message: string) {
    this.logger.warn(this.accessory.displayName + ': ' + message);
  }

  error(message: string) {
    this.logger.error(this.accessory.displayName + ': ' + message);
  }
}
