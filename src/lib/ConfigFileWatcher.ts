import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { EventEmitter } from 'events';

export class ConfigService<T> extends EventEmitter {
  private configPath: string;
  private config: T;
  private watcher: fs.FSWatcher | null = null;
  private isInternalUpdate: boolean = false;

  public constructor(
    configPath: string,
    private validator: (data: T) => void,
  ) {
    super();
    this.configPath = configPath;
    /*this.config = this.loadConfig();
    this.watchConfig();*/
  }

  public ensureDefaultConfig(defaultConfig:T): void {
    if (!fs.existsSync(this.configPath)) {
      try {
        // Create directory if it doesn't exist
        const dir = path.dirname(this.configPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        // Write default config
        const yamlStr = yaml.dump(defaultConfig);
        fs.writeFileSync(this.configPath, yamlStr, 'utf8');
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Failed to create default config: ${error.message}`);
        }
        throw error;
      }
    }
  }

  private loadConfig(): T {
    try {
      const fileContents = fs.readFileSync(this.configPath, 'utf8');
      const config = yaml.load(fileContents) as T;
      this.validator(config);
      return config;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to load config: ${error.message}`);
      }
      throw error;
    }
  }

  public watchConfig(): void {
    this.config = this.loadConfig();//initial config load
    this.watcher = fs.watch(this.configPath, (eventType) => {
      if (eventType === 'change' && !this.isInternalUpdate) {
        try {
          const newConfig = this.loadConfig();
          this.config = newConfig;
          this.emit('configUpdated', newConfig);
        } catch (error) {
          this.emit('configError', error);
        }
      }
    });
  }

  public getConfig(): T {
    return { ...this.config };
  }

  public async updateConfig(updates: Partial<T>): Promise<void> {
    try {
      const newConfig = { ...this.config, ...updates };
      this.validator(newConfig);

      // Set flag to ignore the file watch event
      this.isInternalUpdate = true;

      // Write the updated config to file
      const yamlStr = yaml.dump(newConfig);
      await fs.promises.writeFile(this.configPath, yamlStr, 'utf8');

      // Update internal state
      this.config = newConfig;
      this.emit('configUpdated', newConfig);

      // Reset the flag after a short delay to ensure the file write event has been processed
      setTimeout(() => {
        this.isInternalUpdate = false;
      }, 100);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to update config: ${error.message}`);
      }
      throw error;
    }
  }

  public destroy(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}