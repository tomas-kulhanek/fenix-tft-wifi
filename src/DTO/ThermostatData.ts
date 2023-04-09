import {ThermostatMode} from '../Enum/ThermostatMode';
import ThermostatResponse from './ThermostatResponse';

export default class ThermostatData {

  constructor(
    private data: ThermostatResponse,
  ) {
  }

  get targetHeatingCoolingState() {
    if (this.mode === ThermostatMode.OFF) {
      return 0;
    }
    return 1;
  }

  get currentHeatingCoolingState(): number {
    if (this.mode === ThermostatMode.OFF || this.actualTemperature >= this.requiredTemperature) {
      return 0;
    }
    return 1;
  }

  get mode(): ThermostatMode {
    if (this.data.Dm.value === ThermostatMode.OFF) {
      return ThermostatMode.OFF;
    }
    if (this.data.Dm.value === ThermostatMode.AUTO) {
      return ThermostatMode.AUTO;
    }
    if (this.data.Dm.value === ThermostatMode.ANTIFREEZE) {
      return ThermostatMode.ANTIFREEZE;
    }
    return ThermostatMode.MANUAL;
  }

  set mode(mode: ThermostatMode) {
    this.data.Dm.value = mode;
  }

  get actualTemperature(): number {
    return this.data.At.value / this.data.At.divFactor;
  }

  get requiredTemperature(): number {
    return this.data.Ma.value / this.data.Ma.divFactor;
  }

  set requiredTemperature(temperature: number) {
    this.data.Ma.value = temperature * this.data.Ma.divFactor;
  }

  get realRequiredTemperature(): number {
    return this.data.Ma.value;
  }

  get model(): string {
    return this.data.Ty.value;
  }

  get softwareVersion(): string {
    return this.data.Sv.value;
  }
}