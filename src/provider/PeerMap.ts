// PeerMap.ts
import * as fs from 'fs';
import { execSync } from 'child_process';
import { Meta, Peer } from './VPNManager.js';

export class PeerMap {
  private peersMap: Map<string, Peer>;
  private wgConfPath: string;
  private readonly PEERS_SECTION_MARKER = '# Peers list';

  constructor(wgConfPath: string) {
    this.peersMap = new Map<string, Peer>();
    this.wgConfPath = wgConfPath;
    this.loadPeersFromConfig();
  }

  private loadPeersFromConfig(): void {
    try {
      const confContent = fs.readFileSync(this.wgConfPath, 'utf8');
      const peersSection = confContent.split(this.PEERS_SECTION_MARKER)[1];

      if (!peersSection) {
        console.log('No peers section found in configuration');
        return;
      }

      const peerSections = peersSection.match(/\[Peer\][^\[]+/g);
      if (!peerSections) {
        return;
      }

      for (const section of peerSections) {
        try {
          const allowedIpsMatch = section.match(/AllowedIPs\s*=\s*([\d.]+)\/\d+/);
          const metaMatch = section.match(/meta\s*=\s*([^\n]+)/);
          const publicKeyMatch = section.match(/PublicKey\s*=\s*([^\n]+)/);

          if (allowedIpsMatch && metaMatch && publicKeyMatch) {
            const ip = allowedIpsMatch[1];
            const meta: Meta = JSON.parse(metaMatch[1]);
            const publicKey = publicKeyMatch[1].trim();

            this.peersMap.set(meta.name, {
              meta,
              publicKey,
              ip
            });
          }
        } catch (err) {
          console.error(`Failed to parse peer section: ${err.message}`);
        }
      }
    } catch (err) {
      console.error(`Failed to load peers from config: ${err.message}`);
      throw err;
    }
  }

  private updateConfigFile(): void {
    try {
      let confContent = fs.readFileSync(this.wgConfPath, 'utf8');
      const [baseConfig] = confContent.split(this.PEERS_SECTION_MARKER);
      let newContent = baseConfig + this.PEERS_SECTION_MARKER + '\n';

      for (const [, peer] of this.peersMap.entries()) {
        const peerConfig = this.generatePeerConfig(peer);
        newContent += `\n${peerConfig}`;
      }

      newContent = newContent.replace(/\n\s*\n+/g, '\n\n');
      fs.writeFileSync(this.wgConfPath, newContent, 'utf8');
    } catch (err) {
      console.error(`Failed to update config file: ${err.message}`);
      throw err;
    }
  }

  private generatePeerConfig(peer: Peer): string {
    return `[Peer]\n` +
      `#meta=${JSON.stringify(peer.meta)}\n` +
      `PublicKey = ${peer.publicKey}\n` +
      `AllowedIPs = ${peer.ip}/32\n`;
  }

  private updateWireGuardInterface(action: 'add' | 'remove', peer: Peer): void {
    try {
      if (action === 'add') {
        execSync(`wg set wg0 peer ${peer.publicKey} allowed-ips ${peer.ip}/32`);
      } else {
        execSync(`wg set wg0 peer ${peer.publicKey} remove`);
      }
    } catch (err) {
      console.error(`Failed to update WireGuard interface: ${err.message}`);
      throw err;
    }
  }

  public has(name: string): boolean {
    return this.peersMap.has(name);
  }

  public get(name: string): Peer | undefined {
    return this.peersMap.get(name);
  }

  public add(name: string, peer: Peer): void {
    this.peersMap.set(name, peer);
    this.updateWireGuardInterface('add', peer);
    this.updateConfigFile();
  }

  public delete(name: string): boolean {
    const peer = this.peersMap.get(name);
    if (peer) {
      this.updateWireGuardInterface('remove', peer);
      this.peersMap.delete(name);
      this.updateConfigFile();
      return true;
    }
    return false;
  }

  public getAll(): Map<string, Peer> {
    return new Map(this.peersMap);
  }

  public size(): number {
    return this.peersMap.size;
  }

  public clear(): void {
    for (const [name] of this.peersMap) {
      this.delete(name);
    }
  }
}
