import axios, {Axios} from 'axios';
import TokenManager from '../TokenManager';

export default class FenixApi {

  private axiosClient: Axios;

  constructor(
    private readonly tokenManager: TokenManager,
  ) {
    this.axiosClient = axios.create({
      headers: {
        'Content-type': 'application/json',
      },
    });
  }

  private readonly ApiUrl = 'https://vs2-fe-apim-prod.azure-api.net';

  readMyInformation() {
    return this.axiosClient.get(this.ApiUrl + '/businessmodule/v1/installations/admins/' + this.tokenManager.sub, {
      headers: {Authorization: 'Bearer ' + this.tokenManager.accessToken}
    });
  }
}
