import { VPNManager } from './provider/VPNManager.js';
import { ApiServer } from './provider/APIServer.js';

const vpnManager = new VPNManager();
const apiServer = new ApiServer(vpnManager);

export async function startProvider(announcedDomain: string) {
    await apiServer.startProvider(announcedDomain);
}