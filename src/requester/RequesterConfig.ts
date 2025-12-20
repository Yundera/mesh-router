import { ConfigService } from "../lib/ConfigFileWatcher.js";

export interface Config {
  providers: {
    provider: string;
  }[];
}

export function configValidator(config: Config): void {
  // Check if config and providers exist
  if (!config || !Array.isArray(config.providers) || config.providers.length === 0) {
    throw new Error('Invalid configuration: providers array is required and must not be empty');
  }

  // Validate each provider in the array
  config.providers.forEach((providerConfig, index) => {
    // Check required provider field
    if (!providerConfig.provider) {
      throw new Error(`Invalid configuration: Missing provider string in providers[${index}]`);
    }

    // Validate provider URL format
    if (!providerConfig.provider.startsWith('http')) {
      throw new Error(`Invalid configuration: provider must start with http in providers[${index}]`);
    }
  });
}

export class RequesterConfig extends ConfigService<Config> {
  private static instance: RequesterConfig;

  private constructor() {
    super('../config/config.yml', configValidator);
  }

  public static getInstance(): RequesterConfig {
    if (!RequesterConfig.instance) {
      RequesterConfig.instance = new RequesterConfig();
    }
    return RequesterConfig.instance;
  }
}