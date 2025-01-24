// Function to read existing domain configuration
import fs from "fs/promises";
import {Config} from "./RequesterConfig.js";

export async function readDomainConfig(): Promise<any> {
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
export async function writeDomainConfig(config: {
  [domain: string]: {
    defaultService?: string;
  }
}): Promise<void> {
  const folder = '/var/run/meta';
  await fs.mkdir(folder, {recursive: true});
  await fs.writeFile(`${folder}/config.json`, JSON.stringify(config, null, 2), 'utf8');
}

export async function writeMetadataFiles(config: Config): Promise<void> {
  try {
    const folder = '/var/run/meta';
    await fs.mkdir(folder, {recursive: true});

    // Write the JSON files for services
    for (const serviceName in config.services) {
      await fs.writeFile(`${folder}/${serviceName}.json`, JSON.stringify(config.services[serviceName], null, 2), 'utf8');
    }
  } catch (err) {
    console.error('Error writing metadata files:', err);
  }
}