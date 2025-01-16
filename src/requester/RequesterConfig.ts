// Define the configuration interface
import {ConfigService} from "../lib/ConfigFileWatcher.js";

export interface Config {
  provider: string;
  defaultHost: string;
  defaultHostPort: string;
}

export function configValidator(config: Config): void {
  if (!config.provider || !config.defaultHost || !config.defaultHostPort) {
    throw new Error('Invalid configuration: Missing required settings');
  }
  if(config.defaultHostPort && isNaN(parseInt(config.defaultHostPort))) {
    throw new Error('defaultHostPort must be a number');
  }
  if(config.provider && !config.provider.startsWith('http')) {
    throw new Error('provider must start with http');
  }
}

export class RequesterConfig extends ConfigService<Config>{
  private static instance: RequesterConfig;

  public static getInstance(): RequesterConfig {
    if (!RequesterConfig.instance) {
      RequesterConfig.instance = new ConfigService<Config>('./config.yml',configValidator);
    }
    return RequesterConfig.instance;
  }

}