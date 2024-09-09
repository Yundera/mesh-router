import {execSync} from 'child_process';
import * as fs from 'fs';
import {IpManager} from '../lib/IpManager.js';
import {config} from '../EnvConfig.js';

export class VPNManager {
    private ipManager = new IpManager("10.16.0.0/16");
    private peerIdIpMap = new Map<string, string>();//peerId -> ip
    private vpnEndpointAnnounce: string;
    private wgServerPublicKey: string;
    private wgConfPath: string = '/etc/wireguard/wg0.conf';

    constructor() {
        const vpnPort = config.VPN_PORT;
        this.vpnEndpointAnnounce = `${(config.VPN_ENDPOINT_ANNOUNCE || config.PROVIDER_ANNONCE_DOMAIN)}:${vpnPort}`;
        this.wgServerPublicKey = config.SERVER_WG_PUBLIC_KEY;
        if (!this.wgServerPublicKey) {
            throw new Error('SERVER_WG_PUBLIC_KEY not set');
        }

        // Reserve default IPs
        this.ipManager.leaseIp("10.16.0.1");//host

        // Load reserved IPs from wg0.conf
        this.loadStaticData();
    }

    // Method to load and reserve IPs from wg0.conf
    private loadStaticData() {
        try {
            const confContent = fs.readFileSync(this.wgConfPath, 'utf8');
            const peerSections = confContent.match(/\[Peer\][^\[]+/g); // Get all [Peer] sections

            if (peerSections) {
                peerSections.forEach(section => {
                    const allowedIpsMatch = section.match(/AllowedIPs\s*=\s*([\d.]+\/\d+)/); // Extract IP
                    if (allowedIpsMatch && allowedIpsMatch[1]) {
                        const ip = allowedIpsMatch[1].split('/')[0]; // Extract the actual IP
                        this.ipManager.leaseIp(ip); // Lease the IP
                        console.log(`Reserved IP from wg0.conf: ${ip}`);
                    }
                    //also match the name
                    const nameMatch = section.match(/name\s*=\s*([^\n]+)/);
                    if (nameMatch && nameMatch[1]) {
                        const name = nameMatch[1];
                        const ip = allowedIpsMatch[1].split('/')[0]; // Extract the actual IP
                        this.setIPName(name, ip);
                    }
                });
            } else {
                console.log('No peers found in wg0.conf');
            }
        } catch (err) {
            console.error(`Failed to load reserved IPs from wg0.conf: ${err.message}`);
        }
    }

    // Register a peer
    public registerPeer(vpnPublicKey: string, name: string):  {
            peers: { endpoint: string; allowedIps: string[]; persistentKeepalive: number; publicKey: string }[];
            wgInterface: { address: string[] }
        } {
        // publicKey is the wireguard public key of the client
        // add the peer to wg => wg set wg0 peer "K30I8eIxuBL3OA43Xl34x0Tc60wqyDBx4msVm8VLkAE=" allowed-ips 10.101.1.2/32
        const uniqueIp = this.ipManager.getFreeIp();
        execSync(`wg set wg0 peer ${vpnPublicKey} allowed-ips ${uniqueIp}/32`);

        const peerConfig = `[Peer]\n#name=${name}\nPublicKey = ${vpnPublicKey}\nAllowedIPs = ${uniqueIp}/32\n`;

        try {
            fs.appendFileSync(this.wgConfPath, peerConfig);
        } catch (err) {
            console.error(`Failed to append to wg0.conf: ${err}`);
            throw new Error('Failed to update wg0.conf');
        }

        this.setIPName(name, uniqueIp);
        console.log(`Registered peer ${name} with IP ${uniqueIp}`);

        return {
                wgInterface: {
                    address: [`${uniqueIp}/32`],
                },
                peers: [
                    {
                        publicKey: this.wgServerPublicKey,
                        allowedIps: ['10.16.0.0/16'],
                        endpoint: this.vpnEndpointAnnounce,
                        persistentKeepalive: 360,
                    }]
            };
    }

    setIPName(name: string, ip: string) {
        this.peerIdIpMap.set(name, ip);
    }

    getIpFromName(name: string): string {
        return this.peerIdIpMap.get(name);
    }
}
