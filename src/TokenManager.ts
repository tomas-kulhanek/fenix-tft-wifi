import {decode} from 'jwt-check-expiry';
import {API, Logger} from 'homebridge';
import axios, {Axios} from 'axios';
import fsExtra from 'fs-extra';
import {PLATFORM_NAME} from './settings';

export default class TokenManager {
  private readonly ttl = 60 * 60; // one hour
  private parsedJwt: {
    header: {
      alg: string;
      kid: string;
      typ: string;
      x5t: string;
    };
    payload: {
      client_id: string;
      nbf: number;
      exp: number;
      iss: string;
      aud: string;
      nonce: string;
      iat: number;
      at_hash: string;
      s_hash: string;
      sid: string;
      sub: string;
      auth_time: number;
      idp: string;
      name: string;
      given_name: string;
      family_name: string;
      country: string;
      lang: string;
      fdow: string;
      tf: string;
      dh: string;
      email: string;
      amr: string[];
    };
  };

  private axiosClient: Axios;

  constructor(
    private token: string,
    private refreshToken: string,
    private readonly logger: Logger,
    private readonly hbApi: API,
  ) {
    this.axiosClient = axios.create();
    this.parsedJwt = decode(this.token);
    this.refreshTokens();
    setInterval(() => {
      if (this.isJwtTokenNearToExpireExpired()) {
        this.refreshTokens();
      }
    }, 15 * 60000);
  }

  isJwtTokenNearToExpireExpired() {
    const currentDate = new Date();
    currentDate.setTime(currentDate.getTime() + (this.ttl * 1000));
    const currentTime = currentDate.getTime() / 1000;
    return currentTime > this.parsedJwt.payload.exp;
  }

  isJwtTokenExpired() {
    const currentTime = new Date().getTime() / 1000;
    return currentTime > this.parsedJwt.payload.exp;
  }

  get sub(): string {
    return this.parsedJwt.payload.sub;
  }

  private refreshTokens() {
    if (!this.isJwtTokenNearToExpireExpired()) {
      return;
    }

    const searchParams = new URLSearchParams();
    searchParams.append('grant_type', 'refresh_token');
    searchParams.append('client_id', this.parsedJwt.payload.client_id);
    searchParams.append('refresh_token', this.refreshToken);

    this.axiosClient.post(
      'https://vs2-fe-identity-prod.azurewebsites.net/connect/token',
      searchParams,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: 'Basic ' + this.token,
        },
      }).then(async (response) => {
      this.logger.info('Tokens are refreshed');
      this.token = response.data.access_token;
      this.refreshToken = response.data.refresh_token;
      this.parsedJwt = decode(this.token);

      const config = await fsExtra.readJson(this.hbApi.user.configPath());
      config.platforms.forEach((platform) => {
        if (platform.platform === PLATFORM_NAME) {
          platform.accessToken = this.token;
          platform.refreshToken = this.refreshToken;
        }
      });
      await fsExtra.writeJsonSync(this.hbApi.user.configPath(), config);
    }).catch(() => this.logger.error('Token is not possible to refresh'));
  }

  public get accessToken(): string {
    return this.token;
  }
}