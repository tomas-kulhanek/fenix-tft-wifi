import {Logger, PlatformAccessory, Service} from 'homebridge';
import {FenixTFTWifiPlatform} from './platform';
import ThermostatApi from './Api/ThermostatApi';
import ThermostatData from './DTO/ThermostatData';
import {ThermostatMode} from "./Enum/ThermostatMode";

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
    return celsius * 9 / 5 + 32;
  }

  fToC(fahrenheit: number): number {
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
    return this.thermostatData?.targetHeatingCoolingState ?? this.platform.Characteristic.TargetHeatingCoolingState.OFF;
  }

  handleTargetHeatingCoolingStateSet(value) {
    this.logger.info('Triggered SET TargetHeatingCoolingState:' + value);
    if (!this.thermostatData) {
      return;
    }
    if (value === this.platform.Characteristic.TargetHeatingCoolingState.COOL) {
      this.thermostatData.mode = ThermostatMode.ANTIFREEZE;
      this.tApi.changeMode(ThermostatMode.ANTIFREEZE)
        .catch(() => this.logger.error('Cannot to set mode for thermostat ' + this.accessory.displayName));
      return;
    }
    if (value === this.platform.Characteristic.TargetHeatingCoolingState.AUTO) {
      this.thermostatData.mode = ThermostatMode.AUTO;
      this.tApi.changeMode(ThermostatMode.AUTO)
        .catch(() => this.logger.error('Cannot to set mode for thermostat ' + this.accessory.displayName));
      return;
    }
    if (value === this.platform.Characteristic.TargetHeatingCoolingState.OFF) {
      this.thermostatData.mode = ThermostatMode.OFF;
      this.logger.error('Nastavuji vypnuto');
      this.tApi.changeMode(ThermostatMode.OFF)
        .catch(() => this.logger.error('Cannot to set mode for thermostat ' + this.accessory.displayName));
      return;
    }
    if (value === this.platform.Characteristic.TargetHeatingCoolingState.HEAT) {
      this.thermostatData.mode = ThermostatMode.MANUAL;
      this.logger.error('Nastavuji manual');
      this.tApi.setTemperature(this.thermostatData)
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
      return this.fToC(this.thermostatData?.actualTemperature);
    }

    return this.thermostatData?.actualTemperature ?? 0;
  }

  handleTargetTemperatureGet() {
    this.logger.debug('Triggered GET TargetTemperature');
    if (this.temperatureUnit === this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS) {
      if (!this.thermostatData?.requiredTemperature) {
        return 0;
      }
      return this.fToC(this.thermostatData?.requiredTemperature);
    }

    return this.thermostatData?.requiredTemperature ?? 0;
  }

  handleTargetTemperatureSet(value) {
    this.logger.debug('Triggered SET TargetTemperature:' + value);

    if (this.temperatureUnit === this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS) {
      value = this.cToF(value);
    }
    if (this.thermostatData === undefined) {
      return;
    }

    if (value === this.thermostatData.requiredTemperature) {
      return;
    }
    this.thermostatData.requiredTemperature = value;

    this.tApi.setTemperature(this.thermostatData)
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
}
