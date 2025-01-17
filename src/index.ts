import {updateRequestersFromConfig} from "./requester/Requester.js";
import {startProvider} from "./provider/Provider.js";
import {config} from "./common/EnvConfig.js";
import {RequesterConfig} from "./requester/RequesterConfig.js";
import { promises as fs } from 'fs';
import path from 'path';


async function setupNginxConfig(): Promise<void> {
  try {
    if (process.env.PROVIDER_ANNONCE_DOMAIN) {
    }

    if (process.env.PROVIDER) {
      await fs.copyFile(
        path.join(this.NGINX_CONF_DIR, 'requester.conf.template'),
        path.join(this.NGINX_CONF_DIR, 'requester.conf')
      );
      console.log('Requester configuration activated');
    }
  } catch (error) {
    console.error('Error setting up nginx configuration:', error);
    throw error;
  }
}

//TODO
// 0 - read the env and update the yml file
// 1 - read the file and apply config
//        - link the yaml config to the current system
//        - call an api function for each relevant function
//  2 - test with multi provider
//       - implement mutli provider system

(async () => {
  if (config.PROVIDER_ANNONCE_DOMAIN) {
    //start a provider
    await startProvider({
      announcedDomain: config.PROVIDER_ANNONCE_DOMAIN,
      authApiUrl: config.AUTH_API_URL,
      VPNPort: config.VPN_PORT,
      VPNEndPointAnnounce: config.VPN_ENDPOINT_ANNOUNCE,
      VPNIpRange:config.VPN_IP_RANGE,
    });

  } else {

    const rconfig = RequesterConfig.getInstance();
    // will create the file if it doesn't exist based on the env if a config file is already present the env will be ignored
    rconfig.ensureDefaultConfig({
      providers: [{
        provider: config.PROVIDER,
        defaultService: config.DEFAULT_HOST,
      }],
      services: {
        [config.DEFAULT_HOST]: {
          defaultPort: config.DEFAULT_HOST_PORT,
        },
      },
    });
    rconfig.watchConfig();// will watch the file for changes
    rconfig.on('configUpdated', async (newConfig) => {
      console.log('Config updated:', newConfig);
      await updateRequestersFromConfig(rconfig.getConfig());
    });
    await updateRequestersFromConfig(rconfig.getConfig());
  }

})().catch(console.error);