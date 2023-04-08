import { API } from 'homebridge';

import { PLATFORM_NAME } from './settings';
import { FenixTFTWifiPlatform } from './platform';

/**
 * This method registers the platform with Homebridge
 */
export = (api: API) => {
  api.registerPlatform(PLATFORM_NAME, FenixTFTWifiPlatform);
};
