import { VPNManager } from './VPNManager.js';
import { ApiServer } from './APIServer.js';

export async function startProvider(announcedDomain: string) {
    const vpnManager = new VPNManager();
    const apiServer = new ApiServer(vpnManager);
    await apiServer.startProvider(announcedDomain);
}