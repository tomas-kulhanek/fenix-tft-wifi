import {Formats, Logger, Perms, PlatformAccessory, Service} from 'homebridge';
import {FenixTFTWifiPlatform} from './platform';
import ThermostatApi from './Api/ThermostatApi';

export class FenixTFTThermostatPlatformAccessory {

  private service: Service;
  private name: string;
  private logger: Logger;
  private tValueDisplayUnit = this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS;
  private tValueTargetTemperature = 0;
  private tValueCurrentTemperature = 0;
  private tValueTargetHeatingCoolingState = this.platform.Characteristic.TargetHeatingCoolingState.OFF;
  private tValueCurrentHeatingCoolingState = this.platform.Characteristic.CurrentHeatingCoolingState.HEAT;

  constructor(
    private readonly platform: FenixTFTWifiPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly tApi: ThermostatApi,
    private temperatureCheckInterval: number,
  ) {
    this.logger = platform.log;
    this.name = platform.config.name as string;

    this.logger.debug('Initializing Fenix TFT accessory', this.accessory.displayName);
    this.updateValues();
    // Initialize the AccessoryInformation Service
    const informationService = this.accessory.getService(platform.api.hap.Service.AccessoryInformation)
      || this.accessory.addService(platform.api.hap.Service.AccessoryInformation);
    informationService
      .setCharacteristic(platform.api.hap.Characteristic.Manufacturer, 'ThermoSmart B.V.')
      .setCharacteristic(platform.api.hap.Characteristic.Model, 'Fenix TFT');

    this.service = this.accessory.getService(platform.api.hap.Service.Thermostat)
      || this.accessory.addService(platform.api.hap.Service.Thermostat);

    this.service.getCharacteristic(platform.Characteristic.CurrentHeatingCoolingState)
      .onGet(this.handleCurrentHeatingCoolingStateGet.bind(this))
      .onSet(this.handleCurrentHeatingCoolingStateSet.bind(this))
      .setProps({
        maxValue: 1,
        minValue: 0,
        validValues: [platform.Characteristic.TargetHeatingCoolingState.OFF, platform.Characteristic.TargetHeatingCoolingState.HEAT],
        perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE, Perms.NOTIFY],
      });

    this.service.getCharacteristic(platform.Characteristic.TargetHeatingCoolingState)
      .onGet(this.handleTargetHeatingCoolingStateGet.bind(this))
      .onSet(this.handleTargetHeatingCoolingStateSet.bind(this))
      .setProps({
        format: Formats.UINT8,
        maxValue: 1,
        minValue: 0,
        validValues: [platform.Characteristic.TargetHeatingCoolingState.OFF, platform.Characteristic.TargetHeatingCoolingState.HEAT],
        perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE, Perms.NOTIFY],
      });

    this.service.getCharacteristic(platform.Characteristic.CurrentTemperature)
      .onGet(this.handleCurrentTemperatureGet.bind(this));

    if (this.tValueDisplayUnit === this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS) {
      this.service.getCharacteristic(platform.Characteristic.TargetTemperature)
        .onGet(this.handleTargetTemperatureGet.bind(this))
        .onSet(this.handleTargetTemperatureSet.bind(this))
        .setProps({
          minValue: 0,
          maxValue: 27,
          minStep: 0.5,
        }).setValue(this.tValueTargetTemperature);
    } else {
      this.service.getCharacteristic(platform.Characteristic.TargetTemperature)
        .onGet(this.handleTargetTemperatureGet.bind(this))
        .onSet(this.handleTargetTemperatureSet.bind(this))
        .setProps({
          minValue: 0,
          maxValue: 100,
          minStep: 1,
        }).setValue(this.tValueTargetTemperature);
    }

    this.service.getCharacteristic(platform.Characteristic.TemperatureDisplayUnits)
      .onGet(this.handleTemperatureDisplayUnitsGet.bind(this))
      .onSet(this.handleTemperatureDisplayUnitsSet.bind(this));

    setInterval(() => this.updateValues(), this.temperatureCheckInterval);
  }

  cToF(celsius: number): number {
    return celsius * 9 / 5 + 32;
  }

  fToC(fahrenheit: number): number {
    return (fahrenheit - 32) * 5 / 9;
  }

  handleCurrentHeatingCoolingStateGet() {
    //this.logger.debug('Triggered GET CurrentHeatingCoolingState');
    return this.tValueCurrentHeatingCoolingState;
  }

  handleCurrentHeatingCoolingStateSet(value) {
    this.logger.debug('Triggered SET CurrentHeatingCoolingState:' + value);
  }

  handleTargetHeatingCoolingStateGet() {
    //this.logger.debug('Triggered GET TargetHeatingCoolingState');
    return this.tValueTargetHeatingCoolingState;
  }

  handleTargetHeatingCoolingStateSet(value) {
    this.logger.debug('Triggered SET TargetHeatingCoolingState:' + value);
  }

  handleCurrentTemperatureGet() {
    //this.logger.debug('Triggered GET CurrentTemperature');

    return this.tValueCurrentTemperature;
  }

  handleTargetTemperatureGet() {
    //this.logger.debug('Triggered GET TargetTemperature');

    return this.tValueTargetTemperature;
  }

  handleTargetTemperatureSet(value) {
    this.logger.debug('Triggered SET TargetTemperature:' + value);

    if (value === this.tValueTargetTemperature) {
      return;
    }
    this.tValueTargetTemperature = value;
    if (this.tValueDisplayUnit === this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS) {

      if (value < 7) {
        return;
      }
      value = this.cToF(value);
    }

    this.tApi.setTemperature(value)
      .then(async () => {
        this.updateRealStates();
        await new Promise(resolve => setTimeout(resolve, 5000));
        this.updateValues();
      }).catch(() => this.logger.error('Cannot to set temperature for thermostat ' + this.accessory.displayName));
  }

  handleTemperatureDisplayUnitsGet() {
    //this.logger.debug('Triggered GET TemperatureDisplayUnits');

    // set this to a valid value for TemperatureDisplayUnits
    return this.tValueDisplayUnit;
  }

  handleTemperatureDisplayUnitsSet(value) {
    this.logger.debug('Triggered SET TemperatureDisplayUnits:' + value);
  }

  updateValues() {
    this.logger.debug('Update Fenix TFT accessory', this.accessory.displayName);
    this.tApi.getInformation().then((res) => {

      const informationService = this.accessory.getService(this.platform.api.hap.Service.AccessoryInformation);
      if (informationService) {
        informationService
          .setCharacteristic(this.platform.api.hap.Characteristic.Manufacturer, 'Fenix Trading s.r.o.')
          .setCharacteristic(this.platform.api.hap.Characteristic.Model, 'Fenix TFT Wifi ' + res.data.Ty.value)
          .setCharacteristic(this.platform.api.hap.Characteristic.SerialNumber, res.data.Sv.value);
      }
      let targetTemperature = res.data.Sp.value / res.data.Sp.divFactor;
      let currentTemperature = res.data.At.value / res.data.At.divFactor;

      if (this.tValueDisplayUnit === this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS) {
        targetTemperature = this.fToC(res.data.Sp.value / res.data.Sp.divFactor);
        currentTemperature = this.fToC(res.data.At.value / res.data.At.divFactor);
      }
      if (res.data.Dm.value === 0) {
        this.tValueCurrentHeatingCoolingState = this.platform.Characteristic.CurrentHeatingCoolingState.OFF;
        this.tValueTargetHeatingCoolingState = this.platform.Characteristic.TargetHeatingCoolingState.OFF;
      }
      this.tValueCurrentTemperature = currentTemperature;
      if (targetTemperature >= 7) {
        this.tValueTargetTemperature = targetTemperature;
        this.tValueTargetHeatingCoolingState = this.platform.Characteristic.TargetHeatingCoolingState.HEAT;
      } else {
        this.tValueTargetTemperature = 0;
        this.tValueTargetHeatingCoolingState = this.platform.Characteristic.TargetHeatingCoolingState.OFF;
      }
      if (targetTemperature > currentTemperature) {
        this.tValueCurrentHeatingCoolingState = this.platform.Characteristic.CurrentHeatingCoolingState.HEAT;
      } else {
        this.tValueCurrentHeatingCoolingState = this.platform.Characteristic.CurrentHeatingCoolingState.OFF;
      }
    }).catch(() => this.logger.error('Cannot to retrieve data for thermostat ' + this.accessory.displayName));
  }

  updateRealStates() {
    if (this.tValueTargetTemperature >= 7) {
      this.tValueTargetHeatingCoolingState = this.platform.Characteristic.TargetHeatingCoolingState.HEAT;
    } else {
      this.tValueTargetHeatingCoolingState = this.platform.Characteristic.TargetHeatingCoolingState.OFF;
    }
    if (this.tValueTargetTemperature > this.tValueCurrentTemperature) {
      this.tValueCurrentHeatingCoolingState = this.platform.Characteristic.CurrentHeatingCoolingState.HEAT;
    } else {
      this.tValueCurrentHeatingCoolingState = this.platform.Characteristic.CurrentHeatingCoolingState.OFF;
    }
  }
}
