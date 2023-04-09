import axios, {Axios} from 'axios';
import TokenManager from '../TokenManager';
import {ThermostatMode} from '../Enum/ThermostatMode';
import ThermostatData from "../DTO/ThermostatData";

export default class ThermostatApi {

  private axiosClient: Axios;

  constructor(
    private readonly uuid: string,
    private readonly tokenManager: TokenManager,
  ) {
    this.axiosClient = axios.create({
      headers: {
        'Content-type': 'application/json',
      },
    });
  }

  private readonly ThermostatApiUrl = 'https://vs2-fe-apim-prod.azure-api.net';

  getInformation():Promise<ThermostatData> {
    return new Promise((resolve, reject) => {
      this.axiosClient.get(
        this.ThermostatApiUrl + '/iotmanagement/v1/configuration/' + this.uuid + '/' + this.uuid + '/v1.0/content',
        {
          headers: {Authorization: 'Bearer ' + this.tokenManager.accessToken}
        },
      ).then((response) => resolve(new ThermostatData(response.data))).catch((reject));
    });
  }

  async changeMode(mode: ThermostatMode) {
    return await this.axiosClient.put(this.ThermostatApiUrl + '/iotmanagement/v1/devices/twin/properties/config/replace', {
      'Id_deviceId': this.uuid,
      'S1': this.uuid,
      'configurationVersion': 'v1.0',
      'data': [
        {
          'timestamp': null,
          'wattsType': 'Dm',
          'wattsTypeValue': mode.toString(),
        }
      ],
    }, {
      headers: {Authorization: 'Bearer ' + this.tokenManager.accessToken},
    });
  }

  async setTemperature(thermostat: ThermostatData) {
    return await this.axiosClient.put(this.ThermostatApiUrl + '/iotmanagement/v1/devices/twin/properties/config/replace', {
      'Id_deviceId': this.uuid,
      'S1': this.uuid,
      'configurationVersion': 'v1.0',
      'data': [
        {
          'timestamp': null,
          'wattsType': 'Dm',
          'wattsTypeValue': thermostat.mode,
        },
        {
          'timestamp': null,
          'wattsType': 'Ma',
          'wattsTypeValue': thermostat.realRequiredTemperature,
        },
      ],
    }, {
      headers: {Authorization: 'Bearer ' + this.tokenManager.accessToken},
    });
  }
}
