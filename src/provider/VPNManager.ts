import {execSync} from 'child_process';
import * as fs from 'fs';
import {IpManager} from '../lib/IpManager.js';
import {config} from '../common/EnvConfig.js';

export interface Meta {
  name: string;
}

export interface Peer {
  meta: Meta;
  publicKey: string;
  ip: string;
}

function generatePeerConfig(meta: Meta, vpnPublicKey: string, uniqueIp: string): string {
  return `[Peer]\n` +
    `#meta=${JSON.stringify(meta)}\n` +
    `PublicKey = ${vpnPublicKey}\n` +
    `AllowedIPs = ${uniqueIp}/32\n`;
}

export class VPNManager {
  private ipManager = new IpManager("10.16.0.0/16");
  private vpnEndpointAnnounce: string;
  private wgServerPublicKey: string;
  private wgConfPath: string = '/etc/wireguard/wg0.conf';
  private peersMap = new Map<string, Peer>();

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

    this.cleanUpWgConf();
  }

  // Method to load and reserve IPs from wg0.conf
  private loadStaticData() {
    try {
      const confContent = fs.readFileSync(this.wgConfPath, 'utf8');
      const peerSections = confContent.match(/\[Peer\][^\[]+/g); // Get all [Peer] sections

      if (peerSections) {
        for (const section of peerSections) {
          try {
            const allowedIpsMatch = section.match(/AllowedIPs\s*=\s*([\d.]+\/\d+)/); // Extract IP
            const nameMatch = section.match(/meta\s*=\s*([^\n]+)/);
            const publicKeyMatch = section.match(/PublicKey\s*=\s*([^\n]+)/);
            if (allowedIpsMatch && allowedIpsMatch[1] && nameMatch && nameMatch[1]) {
              const uniqueIp = allowedIpsMatch[1].split('/')[0]; // Extract the actual IP
              const vpnPublicKey = publicKeyMatch[1];
              const meta: Meta = JSON.parse(nameMatch[1]);
              this.setWgPeer(vpnPublicKey, meta, uniqueIp);
              console.log(`Reserved IP from wg0.conf: ${uniqueIp}`);
            }
          } catch (err) {
            console.error(`Failed to parse [Peer] section: ${err.message}`);
          }
        }
      } else {
        console.log('No peers found in wg0.conf');
      }
    } catch (err) {
      console.error(`Failed to load reserved IPs from wg0.conf: ${err.message}`);
    }
  }

  private setWgPeer(vpnPublicKey: string, meta: Meta, uniqueIp: string = undefined): string {
    if (!uniqueIp) {
      uniqueIp = this.ipManager.getFreeIp();
    } else {
      this.ipManager.leaseIp(uniqueIp);
    }
    // add the peer to wg => wg set wg0 peer "K30I8eIxuBL3OA43Xl34x0Tc60wqyDBx4msVm8VLkAE=" allowed-ips 10.101.1.2/32
    execSync(`wg set wg0 peer ${vpnPublicKey} allowed-ips ${uniqueIp}/32`);
    this.removeWgPeer(meta.name);
    this.peersMap.set(meta.name, {meta, publicKey: vpnPublicKey, ip: uniqueIp});
    return uniqueIp;
  }

  // Function to remove a peer from the WireGuard interface
  private removeWgPeer(name: string) {
    try {
      if(!this.peersMap.has(name)) {
        return;
      }
      const {publicKey,ip} = this.peersMap.get(name);
      this.peersMap.delete(name);
      // wg command to remove peer from the active WireGuard configuration
      execSync(`wg set wg0 peer ${publicKey} remove`);
      this.ipManager.releaseIp(ip);
      console.log(`Removed peer with publicKey: ${publicKey}`);
    } catch (err) {
      console.error(`Failed to remove peer with publicKey ${name}: ${err.message}`);
    }
  }

  public cleanUpWgConf(): void {
    try {
      // Start with the default configuration (without peer sections)
      let wgConfContent = fs.readFileSync(this.wgConfPath, 'utf8');

      // Remove all existing [Peer] sections
      wgConfContent = wgConfContent.replace(/\[Peer\][^\[]+/g, '');

      // Iterate over peersMap and append each peer's configuration
      for (const [, peer] of this.peersMap.entries()) {
        const peerConfig = generatePeerConfig(peer.meta, peer.publicKey, peer.ip);
        wgConfContent += `\n${peerConfig}`;
      }

      // Deduplicate multiple consecutive line returns into a single line return
      wgConfContent = wgConfContent.replace(/\n\s*\n+/g, '\n');

      // Write the updated configuration back to wg0.conf
      fs.writeFileSync(this.wgConfPath, wgConfContent, 'utf8');
      console.log('wg0.conf successfully updated with peersMap');
    } catch (err) {
      console.error(`Failed to apply peersMap to wg0.conf: ${err.message}`);
      throw new Error('Failed to update wg0.conf');
    }
  }

  // Register a peer
  public registerPeer(vpnPublicKey: string, name: string): {
    peers: { endpoint: string; allowedIps: string[]; persistentKeepalive: number; publicKey: string }[];
    wgInterface: { address: string[] }
  } {
    // publicKey is the wireguard public key of the client

    const meta: Meta = {
      name: name,
    }
    const uniqueIp = this.setWgPeer(vpnPublicKey, meta);

    const peerConfig = generatePeerConfig(meta, vpnPublicKey, uniqueIp);

    try {
      fs.appendFileSync(this.wgConfPath, peerConfig);
    } catch (err) {
      console.error(`Failed to append to wg0.conf: ${err}`);
      throw new Error('Failed to update wg0.conf');
    }

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
          persistentKeepalive: 25,
        }]
    };
  }

  getIpFromName(name: string): string {
    try {
      return this.peersMap.get(name).ip;
    } catch (err){
      return null;
    }
  }
}
