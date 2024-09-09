import { VPNManager } from './provider/VPNManager.js';
import { ApiServer } from './provider/APIServer.js';

export async function startProvider(announcedDomain: string) {
    const vpnManager = new VPNManager();
    const apiServer = new ApiServer(vpnManager);
    await apiServer.startProvider(announcedDomain);
}