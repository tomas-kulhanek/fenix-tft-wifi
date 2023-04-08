import axios, {Axios} from 'axios';
import TokenManager from '../TokenManager';

export default class ThermostatApi {

  private axiosClient: Axios;

  constructor(
    private readonly uuid: string,
    private readonly tokenManager: TokenManager
  ) {
    this.axiosClient = axios.create({
      headers: {
        'Content-type': 'application/json'
      },
    });
  }

  private readonly ThermostatApiUrl = 'https://vs2-fe-apim-prod.azure-api.net';

  getInformation() {
    return (this.axiosClient.get(this.ThermostatApiUrl + '/iotmanagement/v1/configuration/' + this.uuid + '/' + this.uuid + '/v1.0/content', {
      headers: {Authorization: 'Bearer ' + this.tokenManager.accessToken}
    }));
  }

  async setTemperature(farenheit: number) {
    return await this.axiosClient.put(this.ThermostatApiUrl + '/iotmanagement/v1/devices/twin/properties/config/replace', {
      'Id_deviceId': this.uuid,
      'S1': this.uuid,
      'configurationVersion': 'v1.0',
      'data': [
        {
          'timestamp': null,
          'wattsType': 'Dm',
          'wattsTypeValue': 6,
        },
        {
          'timestamp': null,
          'wattsType': 'Ma',
          'wattsTypeValue': farenheit * 10,
        },
      ],
    },{
      headers: {Authorization: 'Bearer ' + this.tokenManager.accessToken},
    });
  }
}
