import {VPNManager, VPNManagerConfig} from './VPNManager.js';
import {ApiServer, ApiServerConfig} from './APIServer.js';

export interface ProviderConfig extends VPNManagerConfig,ApiServerConfig{}

export async function startProvider(config:ProviderConfig) {
    console.log('Using config',config);
    const vpnManager = new VPNManager();
    await vpnManager.setup(config);
    const apiServer = new ApiServer(vpnManager,config);
    await apiServer.startProvider();
}