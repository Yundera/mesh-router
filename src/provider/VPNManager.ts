import {execSync} from 'child_process';
import {IpManager} from '../lib/IpManager.js';
import {exec} from 'child_process';
import * as staticFs from 'fs';
import {promises as fs} from 'fs';
import {promisify} from 'util';
import path from 'path';

const execAsync = promisify(exec);

export interface Meta {
  name: string;
}

export interface Peer {
  meta: Meta;
  publicKey: string;
  ip: string;
}

interface WGInterface {
  peers: { endpoint: string; allowedIps: string[]; persistentKeepalive: number; publicKey: string }[];
  wgInterface: { address: string[] }
}

function generatePeerConfig(meta: Meta, vpnPublicKey: string, uniqueIp: string): string {
  return `[Peer]\n` +
    `#meta=${JSON.stringify(meta)}\n` +
    `PublicKey = ${vpnPublicKey}\n` +
    `AllowedIPs = ${uniqueIp}/32\n`;
}

export interface VPNManagerConfig {
  VPNPort?: string;
  VPNEndPointAnnounce?: string;
  VPNIpRange?: string;
  announcedDomain: string;
}

export class VPNManager {
  private ipManager
  private vpnEndpointAnnounce: string;
  private vpnPort: string;
  private ipRange: string;
  private wgConfPath: string = '/etc/wireguard/wg0.conf';
  private peersMap = new Map<string, Peer>();

  private readonly WG_CONFIG_DIR = '/etc/wireguard';
  private readonly SERVER_PRIVATE_KEY_PATH = path.join(this.WG_CONFIG_DIR, 'server_private.key');
  private readonly SERVER_PUBLIC_KEY_PATH = path.join(this.WG_CONFIG_DIR, 'server_public.key');
  private readonly WG_CONFIG_PATH = path.join(this.WG_CONFIG_DIR, 'wg0.conf');

  private serverPrivateKey: string = '';
  private serverPublicKey: string = '';
  private serverIp: string;

  constructor() {
  }

  async setup(config: VPNManagerConfig): Promise<void> {
    if (!config.announcedDomain) {
      throw new Error('PROVIDER_ANNONCE_DOMAIN not set');
    }

    this.vpnPort = config.VPNPort || '51820';
    this.ipRange = config.VPNIpRange || '1.0.0.0/24';
    this.vpnEndpointAnnounce = `${(config.VPNEndPointAnnounce || config.announcedDomain)}:${this.vpnPort}`;

    // Reserve default IPs
    this.ipManager = new IpManager(this.ipRange);
    this.serverIp = this.ipRange.replace(/\.0\/\d+$/, '.1');
    this.ipManager.leaseIp(this.serverIp); // host
    const zero = this.ipRange.replace(/\.0\/\d+$/, '.0');
    this.ipManager.leaseIp(zero); // reserved

    console.log(`PROVIDER_ANNONCE_DOMAIN is set to '${config.announcedDomain}'`);

    await this.ensureDirectoryExists();
    await this.generateKeysIfNeeded();
    await this.createConfigIfNeeded();
    await this.startWireGuard();

    // Load reserved IPs from wg0.conf
    this.loadStaticData();

    this.cleanUpWgConf();
  }

  private async ensureDirectoryExists(): Promise<void> {
    try {
      await fs.access(this.WG_CONFIG_DIR);
    } catch {
      await fs.mkdir(this.WG_CONFIG_DIR, {recursive: true});
    }
  }

  private async generateKeysIfNeeded(): Promise<void> {
    try {
      await fs.access(this.SERVER_PRIVATE_KEY_PATH);
      // If keys exist, read them
      this.serverPrivateKey = (await fs.readFile(this.SERVER_PRIVATE_KEY_PATH, 'utf-8')).trim();
      this.serverPublicKey = (await fs.readFile(this.SERVER_PUBLIC_KEY_PATH, 'utf-8')).trim();
    } catch {
      // Generate new keys
      const {stdout: privateKey} = await execAsync('wg genkey');
      this.serverPrivateKey = privateKey.trim();
      await fs.writeFile(this.SERVER_PRIVATE_KEY_PATH, this.serverPrivateKey);

      const {stdout: publicKey} = await execAsync(`echo "${this.serverPrivateKey}" | wg pubkey`);
      this.serverPublicKey = publicKey.trim();
      await fs.writeFile(this.SERVER_PUBLIC_KEY_PATH, this.serverPublicKey);
    }

    // Export public key to environment
    process.env.SERVER_WG_PUBLIC_KEY = this.serverPublicKey;
    console.log(`public key: ${this.serverPublicKey}`);
  }

  private async createConfigIfNeeded(): Promise<void> {
    try {
      const stats = await fs.stat(this.WG_CONFIG_PATH);
      if (stats.size > 0) {
        console.log('WireGuard configuration already exists and is not empty.');
        return;
      }
    } catch {
      // Config doesn't exist or is empty, create it
      console.log('Creating WireGuard configuration...');

      const config = `[Interface]
Address = ${this.serverIp}/${this.ipRange.split('/')[1]}
SaveConfig = true
ListenPort = ${this.vpnPort}
PrivateKey = ${this.serverPrivateKey}

PostUp = iptables -t nat -A POSTROUTING -s ${this.ipRange} -o $(ip route | grep default | awk '{print $5}') -j MASQUERADE; iptables -A INPUT -p udp -m udp --dport ${this.vpnPort} -j ACCEPT; iptables -A FORWARD -i wg0 -j ACCEPT; iptables -A FORWARD -o wg0 -j ACCEPT;
PostDown = iptables -t nat -D POSTROUTING -s ${this.ipRange} -o $(ip route | grep default | awk '{print $5}') -j MASQUERADE; iptables -D INPUT -p udp -m udp --dport ${this.vpnPort} -j ACCEPT; iptables -D FORWARD -i wg0 -j ACCEPT; iptables -D FORWARD -o wg0 -j ACCEPT;`;

      await fs.writeFile(this.WG_CONFIG_PATH, config);
    }
  }

  private async startWireGuard(): Promise<void> {
    await execAsync('wg-quick up wg0');
  }

  // Method to load and reserve IPs from wg0.conf
  private loadStaticData() {
    try {
      const confContent = staticFs.readFileSync(this.wgConfPath, 'utf8');
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
      if (!this.peersMap.has(name)) {
        return;
      }
      const {publicKey, ip} = this.peersMap.get(name);
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
      let wgConfContent = staticFs.readFileSync(this.wgConfPath, 'utf8');

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
      staticFs.writeFileSync(this.wgConfPath, wgConfContent, 'utf8');
      console.log('wg0.conf successfully updated with peersMap');
    } catch (err) {
      console.error(`Failed to apply peersMap to wg0.conf: ${err.message}`);
      throw new Error('Failed to update wg0.conf');
    }
  }

  // Register a peer
  public registerPeer(vpnPublicKey: string, name: string): WGInterface {
    // publicKey is the wireguard public key of the client

    const meta: Meta = {
      name: name,
    }
    const uniqueIp = this.setWgPeer(vpnPublicKey, meta);

    const peerConfig = generatePeerConfig(meta, vpnPublicKey, uniqueIp);

    try {
      staticFs.appendFileSync(this.wgConfPath, peerConfig);
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
          publicKey: this.serverPublicKey,
          allowedIps: [this.ipRange],
          endpoint: this.vpnEndpointAnnounce,
          persistentKeepalive: 25,
        }]
    };
  }

  public getIpFromName(name: string): string {
    try {
      return this.peersMap.get(name).ip;
    } catch (err) {
      return null;
    }
  }

  // Get the server IP eg 10.16.0.1
  getServerIp():string {
    return this.serverIp;
  }
}
