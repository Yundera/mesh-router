import { ConfigService } from "../lib/ConfigFileWatcher.js";

export interface Config {
  providers: {
    provider: string;
    defaultService?: string;
  }[];
  services?: {
    [key: string]: {
      defaultPort: string;
    };
  }
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

    // Validate defaultService if provided
    if (providerConfig.defaultService !== undefined && providerConfig.defaultService.trim() === '') {
      throw new Error(`Invalid configuration: defaultService cannot be empty in providers[${index}]`);
    }
  });

  // Validate services if provided
  if (config.services) {
    Object.entries(config.services).forEach(([serviceName, service]) => {
      if (serviceName.trim() === '') {
        throw new Error('Invalid configuration: service name cannot be empty');
      }

      if (service.defaultPort !== undefined) {
        const port = parseInt(service.defaultPort);
        if (isNaN(port) || port < 1 || port > 65535) {
          throw new Error(`Invalid configuration: defaultPort must be a valid port number (1-65535) for service "${serviceName}"`);
        }
      }
    });
  }
}

export class RequesterConfig extends ConfigService<Config> {
  private static instance: RequesterConfig;

  private constructor() {
    super('./config.yml', configValidator);
  }

  public static getInstance(): RequesterConfig {
    if (!RequesterConfig.instance) {
      RequesterConfig.instance = new RequesterConfig();
    }
    return RequesterConfig.instance;
  }
}