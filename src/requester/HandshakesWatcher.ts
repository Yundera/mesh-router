import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';

const exec = promisify(execCallback);

// Note: WireGuard persistent keepalive is set to 60 seconds, so threshold should be at least 2x that value
const HANDSHAKE_INTERVAL_SECONDS = 5 * 60; // 5 minutes
const HANDSHAKE_THRESHOLD_SECONDS = 5 * 60; // 5 minutes

interface HandshakeData {
  interface: string;
  lastHandshake: number;
}

interface ProviderConfig {
  filePath: string;
}

type RestartCallback = (provider: string ) => Promise<void>;

export class HandshakesWatcher extends EventEmitter {
  private static instance: HandshakesWatcher;
  private watchIntervalId: NodeJS.Timeout | null = null;
  private providers: Map<string, ProviderConfig> = new Map();
  private onRestart: RestartCallback | null = null;

  private constructor() {
    super();
  }

  static getInstance(): HandshakesWatcher {
    if (!HandshakesWatcher.instance) {
      HandshakesWatcher.instance = new HandshakesWatcher();
    }
    return HandshakesWatcher.instance;
  }

  setRestartCallback(callback: RestartCallback): void {
    this.onRestart = callback;
  }

  async checkHandshakes(): Promise<HandshakeData[]> {
    const results: HandshakeData[] = [];

    for (const [providerUrl, config] of this.providers.entries()) {
      try {
        const interfaceName = config.filePath.split('/').pop()?.replace('.conf', '');

        if (!interfaceName) continue;

        const { stdout } = await exec(`wg show ${interfaceName} latest-handshakes`);
        const handshakeTime = parseInt(stdout.trim().split('\t')[1]);

        results.push({
          interface: interfaceName,
          lastHandshake: handshakeTime
        });

        // Check if handshake is older than the configured threshold
        const thresholdTime = Math.floor(Date.now() / 1000) - HANDSHAKE_THRESHOLD_SECONDS;
        if (handshakeTime < thresholdTime) {
          console.log(`Stale handshake detected for ${interfaceName}, restarting connection...`);
          await this.restartConnection(providerUrl);
        }
      } catch (error) {
        console.error(`Error checking handshakes for ${providerUrl}:`, error);
        this.emit('error', { provider: providerUrl, error });
      }
    }

    this.emit('checkComplete', results);
    return results;
  }

  private async restartConnection(providerUrl: string): Promise<void> {
    if (!this.onRestart) {
      console.error('Restart callback not set');
      return;
    }

    try {
      await this.onRestart(providerUrl);
      this.emit('connectionRestarted', providerUrl);
    } catch (error) {
      console.error(`Error restarting connection for ${providerUrl}:`, error);
      this.emit('error', { provider: providerUrl, error });
    }
  }

  addProvider(providerUrl: string, config: ProviderConfig): void {
    this.providers.set(providerUrl, config);
    this.emit('providerAdded', providerUrl);
  }

  removeProvider(providerUrl: string): void {
    this.providers.delete(providerUrl);
    this.emit('providerRemoved', providerUrl);
  }

  startWatching(): void {
    if (!this.watchIntervalId) {
      this.watchIntervalId = setInterval(() => {
        this.checkHandshakes().catch(error => {
          console.error('Error in handshake check interval:', error);
          this.emit('error', { error });
        });
      }, HANDSHAKE_INTERVAL_SECONDS * 1000);

      console.log('HandshakesWatcher started');
      this.emit('watchingStarted');
    }
  }

  stopWatching(): void {
    if (this.watchIntervalId) {
      clearInterval(this.watchIntervalId);
      this.watchIntervalId = null;
      console.log('HandshakesWatcher stopped');
      this.emit('watchingStopped');
    }
  }
}