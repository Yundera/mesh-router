import axios from "axios";
import { generateKeyPair, WgConfig } from "wireguard-tools";
import { registerRecvDTO, registerSendDTO } from "../common/dto.js";
import * as fs from 'fs/promises';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { Config } from "./RequesterConfig.js";

const exec = promisify(execCallback);

// Track currently active providers
let activeProviders = new Set<string>();

// Function to read existing domain configuration
async function readDomainConfig(): Promise<any> {
  try {
    const configPath = '/var/run/meta/config.json';
    const content = await fs.readFile(configPath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    // If file doesn't exist or is invalid, return empty object
    return {};
  }
}

// Function to write domain configuration
async function writeDomainConfig(config: any): Promise<void> {
  const folder = '/var/run/meta';
  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(`${folder}/config.json`, JSON.stringify(config, null, 2), 'utf8');
}

export async function updateRequestersFromConfig(config: Config) {
  const newProviders = new Set(config.providers.map(p => p.provider));

  // Write metadata files
  try {
    const folder = '/var/run/meta';
    await fs.mkdir(folder, { recursive: true });

    // Write the JSON files for services
    for (const serviceName in config.services) {
      await fs.writeFile(`${folder}/${serviceName}.json`, JSON.stringify(config.services[serviceName], null, 2), 'utf8');
    }
  } catch (err) {
    console.error('Error writing metadata files:', err);
  }

  // Stop providers that are not in the new config
  for (const activeProvider of activeProviders) {
    if (!newProviders.has(activeProvider)) {
      await stopRequester(activeProvider);
      activeProviders.delete(activeProvider);
    }
  }

  // Start new providers that aren't already running
  for (const provider of config.providers) {
    if (!activeProviders.has(provider.provider)) {
      await startRequester(provider);
      activeProviders.add(provider.provider);
    }
  }
}

async function stopRequester(providerString: string) {
  try {
    const [providerURL] = providerString.split(',');
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

async function getConfigPath(providerString: string): Promise<string> {
  const providerURL = providerString.split(',')[0];
  let identifier = providerURL
  .replace(/^https?:\/\//, '')
  .replace(/[^a-zA-Z0-9]/g, '')
  .toLowerCase();

  if (!/^[a-z]/i.test(identifier)) {
    identifier = 'wg' + identifier;
  }

  identifier = identifier.slice(0, 13);

  if (/\d$/.test(identifier)) {
    identifier += 'x';
  }

  return `/etc/wireguard/wg_${identifier}.conf`;
}

async function startRequester(provider:{
  provider: string;
  defaultService?: string;
}) {
  try {
    const [providerURL, userId = '', signature = ''] = provider.provider.split(',');
    const wgKeys = await generateKeyPair();

    const dta: registerSendDTO = {
      userId: userId,
      vpnPublicKey: wgKeys.publicKey,
      authToken: signature,
    };

    const result: registerRecvDTO = (await axios.post(`${providerURL}/api/register`, dta)).data;
    console.log("VPN configuration:", result.wgConfig);
    console.log(`Root Domain: ${result.domainName}.${result.serverDomain}`);

    // Update domain configuration
    try {
      // Read existing config
      const domainConfig = await readDomainConfig();

      // Update configuration with new domain
      const fullDomain = `${result.domainName}.${result.serverDomain}`;
      domainConfig[fullDomain] = {
        defaultService: provider.defaultService,
      };

      // Write updated configuration
      await writeDomainConfig(domainConfig);
      console.log(`Domain ${fullDomain} added to configuration successfully`);
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
      const { stdout, stderr } = await exec(`ping -c 4 ${result.serverIp}`);
      if (stderr) {
        console.error(`Ping stderr: ${stderr}`);
      } else {
        console.log(`Ping stdout: ${stdout}`);
      }
    } catch (error) {
      console.error(`Error executing ping: ${error.message}`);
    }
  } catch (err) {
    console.error(err);
    process.exit(51);
  }
}