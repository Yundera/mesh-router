import {generateKeyPair, WgConfig} from "wireguard-tools";
import {registerRecvDTO} from "../common/dto.js";
import * as fs from 'fs/promises';
import {exec as execCallback} from 'child_process';
import {promisify} from 'util';
import {Config} from "./RequesterConfig.js";
import {HandshakesWatcher} from './HandshakesWatcher.js';
import {readDomainConfig, writeDomainConfig, writeMetadataFiles} from "./WriteMeta.js";
import {getConfigPath} from "./WireGuard.js";
import {ProviderTools, registerProvider, waitForProvider} from "./ProviderTools.js";

const exec = promisify(execCallback);


// Configuration for retry mechanism
const RETRY_INTERVAL_SECONDS = 10 * 60 * 60; // 10 minutes

// Track currently active providers
let activeProviders = new Set<string>();
let currentConfig: Config = { providers: [] };

// Initialize the HandshakesWatcher with callbacks
const watcher = HandshakesWatcher.getInstance();
watcher.setRestartCallback(async (provider:string) => {
  for (const providerElement of currentConfig.providers) {
    if(providerElement.provider === provider){
      await stopRequester(providerElement.provider);
      await startRequester(providerElement);
    }
  }
});

// Add these event listeners if you want to log important events
watcher.on('error', ({ provider, error }) => {
  console.error(`HandshakesWatcher error${provider ? ` for ${provider}` : ''}:`, error);
});

watcher.on('connectionRestarted', (provider) => {
  console.error(`ERROR CONNECTION RESTARTED for ${provider}`);
});

export async function updateRequestersFromConfig(config: Config) {
  currentConfig = config;
  const newProviders = new Set(config.providers.map(p => p.provider));

  // Write metadata files
  await writeMetadataFiles(config);

  // Stop providers that are not in the new config
  for (const activeProvider of activeProviders) {
    if (!newProviders.has(activeProvider)) {
      await stopRequester(activeProvider);
      activeProviders.delete(activeProvider);
      watcher.removeProvider(activeProvider);
    }
  }

  // Start new providers that aren't already running
  for (const provider of config.providers) {
    if (!activeProviders.has(provider.provider)) {
      await startRequester(provider);
      activeProviders.add(provider.provider);

      const [providerURL] = provider.provider.split(',');
      watcher.addProvider(provider.provider, {
        filePath: await getConfigPath(providerURL)
      });
    }
  }

  // Start watching if there are any active providers
  if (activeProviders.size > 0) {
    watcher.startWatching();
  } else {
    watcher.stopWatching();
  }
}

async function stopRequester(providerString: string) {
  try {
    const [providerURL] = providerString.split(',');
    console.log(`Stopping requester for ${providerURL}`);
    const configPath = await getConfigPath(providerURL);

    // Bring down the interface if it exists
    try {
      const config = new WgConfig({ filePath: configPath });
      await config.down();
    } catch (err) {
      console.warn(`Error bringing down interface for ${providerURL}:`, err);
    }

    // Remove configuration file
    try {
      await fs.unlink(configPath);
    } catch (err) {
      console.warn(`Error removing config file for ${providerURL}:`, err);
    }

    console.log(`Stopped requester for ${providerURL}`);
  } catch (err) {
    console.error(`Failed to stop requester for ${providerString}:`, err);
  }
}

async function startRequester(provider:ProviderTools) {

  try {
    const [providerURL, userId = '', signature = ''] = provider.provider.split(',');
    console.log(`Starting requester for ${providerURL}`);
    // Wait for provider to become available
    await waitForProvider(providerURL, RETRY_INTERVAL_SECONDS);

    const wgKeys = await generateKeyPair();
    console.log(`Generated WireGuard key pair for ${providerURL}`);
    const result: registerRecvDTO = await registerProvider(providerURL, {
      userId: userId,
      vpnPublicKey: wgKeys.publicKey,
      authToken: signature,
    });

    console.log("Received configuration:", JSON.stringify(result));

    // Update domain configuration
    try {
      // Read existing config
      const domainConfig = await readDomainConfig();

      // Update configuration with new domain
      domainConfig.domain = domainConfig.domain || [];
      domainConfig.domain.push(result.domain);
      domainConfig.domain = Array.from(new Set(domainConfig.domain));
      //sort domain by longest string first
      domainConfig.domain.sort((a, b) => b.length - a.length);
      domainConfig.config = domainConfig.config || {};
      domainConfig.config[result.domain] = {
        defaultService: provider.defaultService,
      };

      // Write updated configuration
      await writeDomainConfig(domainConfig);
      console.log(`Domain ${result.domain} added to configuration successfully`);
    } catch (err) {
      console.error('Error updating domain configuration:', err);
    }

    // Generate config with domain-specific path
    const configPath = await getConfigPath(providerURL);
    result.wgConfig.wgInterface.privateKey = wgKeys.privateKey;
    result.wgConfig.filePath = configPath;

    const config = new WgConfig(result.wgConfig);
    await config.writeToFile();
    await config.down(); // Ensure interface is down before bringing it up
    await config.up();

    // Test connection
    try {
      const { stdout, stderr } = await exec(`ping -c 1 ${result.serverIp}`);
      if (stderr) {
        console.error(`Ping stderr: ${stderr}`);
      } else {
        console.log(`Ping stdout: ${stdout}`);
      }
    } catch (error) {
      console.error(result);
      console.error(`Error executing ping: ${error.message}`);
    }
  } catch (err) {
    console.error(err);
    process.exit(51);
  }
}