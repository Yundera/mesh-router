import {startRequester} from "./requester/Requester.js";
import {startProvider} from "./provider/Provider.js";
import {config} from "./common/EnvConfig.js";
import {RequesterConfig} from "./requester/RequesterConfig.js";
import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { spawn } from 'child_process';
const execAsync = promisify(exec);


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
      providerAnnonceDomain: config.PROVIDER_ANNONCE_DOMAIN,
      VPNPort: config.VPN_PORT,
      VPNEndPointAnnounce: config.VPN_ENDPOINT_ANNOUNCE,
      ProviderAnnounceDomain: config.PROVIDER_ANNONCE_DOMAIN
    });

  } else {

    const rconfig = RequesterConfig.getInstance();
    rconfig.ensureDefaultConfig({
      provider: config.PROVIDER,
      defaultHost: config.DEFAULT_HOST,
      defaultHostPort: config.DEFAULT_HOST_PORT
    });// will create the file if it doesn't exist based on the env if a config file is already present the env will be ignored
    rconfig.watchConfig();// will watch the file for changes
    rconfig.on('configUpdated', (newConfig) => {
      console.log('Config updated:', newConfig);
      //TODO: update the requester
    });

    if (rconfig.getConfig().provider) {
      //connect to a provider
      await startRequester(
        rconfig.getConfig().provider,
        rconfig.getConfig().defaultHost,
        rconfig.getConfig().defaultHostPort
      )

    } else {
      throw new Error('No mode specified');
    }
  }

})().catch(console.error);