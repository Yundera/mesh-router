import { exec } from 'child_process';
import { promisify } from 'util';
import {registerRecvDTO, registerSendDTO} from "../common/dto.js";

const execPromise = promisify(exec);

export interface ProviderTools {
  provider: string;
  defaultService?: string;
}

/**
 * Executes a curl command and returns the parsed JSON response
 */
async function executeCurl(command: string): Promise<any> {
  try {
    const { stdout, stderr } = await execPromise(command);
    if (stderr && !stderr.includes('  % Total')) {
      console.warn('Curl stderr:', stderr);
    }
    return JSON.parse(stdout);
  } catch (error) {
    console.error('Curl execution error:', error);
    throw error;
  }
}

/**
 * Registers a provider using curl instead of axios
 */
export async function registerProvider(providerURL: string, dta: registerSendDTO): Promise<registerRecvDTO> {
  try {
    // Format the data as JSON
    const jsonData = JSON.stringify(dta).replace(/"/g, '\\"');

    // Build the curl command
    const curlCommand = `curl -s -k -X POST -H "Content-Type: application/json" -d "${jsonData}" ${providerURL}/api/register`;

    // Execute curl and parse the response
    return await executeCurl(curlCommand);
  } catch (error) {
    console.error(`Error registering provider at ${providerURL}:`, error);
    throw error;
  }
}

/**
 * Checks provider availability using curl instead of axios
 */
export async function checkProviderAvailability(providerURL: string): Promise<boolean> {
  try {
    // Build the curl command with a timeout
    const curlCommand = `curl -s -k --max-time 30 ${providerURL}/api/ping`;

    // Execute curl
    const { stdout } = await execPromise(curlCommand);
    return stdout.trim() === 'ok';
  } catch (error) {
    return false;
  }
}

/**
 * Waits for a provider to become available by repeatedly checking
 */
export async function waitForProvider(providerURL: string, retryIntervalSeconds: number, maxRetries: number = -1): Promise<void> {
  let retries = 0;

  while (maxRetries < 0 || retries < maxRetries) {
    console.log(`Checking provider availability (attempt ${retries + 1}${maxRetries > 0 ? '/' + maxRetries : ''})...`);

    if (await checkProviderAvailability(providerURL)) {
      console.log('Provider is available!');
      return;
    }

    retries++;
    console.log(`Provider not available, retrying in ${retryIntervalSeconds} seconds...`);
    await new Promise(resolve => setTimeout(resolve, retryIntervalSeconds * 1000));
  }

  throw new Error(`Provider ${providerURL} not available after ${maxRetries} attempts`);
}