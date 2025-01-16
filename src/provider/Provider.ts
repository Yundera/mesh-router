import { VPNManager } from './VPNManager.js';
import { ApiServer } from './APIServer.js';

export async function startProvider(config:{
    announcedDomain: string,
    authApiUrl?: string,
    providerAnnonceDomain?: string,
    VPNPort?: string,
    VPNEndPointAnnounce?: string,
    ProviderAnnounceDomain: string
}) {
    const vpnManager = new VPNManager();
    await vpnManager.setup(config);
    const apiServer = new ApiServer(vpnManager,config);
    await apiServer.startProvider(config);
}