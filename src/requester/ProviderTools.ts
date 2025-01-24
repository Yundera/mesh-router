import axios from "axios";
import https from "https";
import {registerRecvDTO, registerSendDTO} from "../common/dto.js";

export interface ProviderTools {
  provider: string;
  defaultService?: string;
}

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

export async function registerProvider(providerURL: string, dta: registerSendDTO): Promise<registerRecvDTO> {
  try {
    const response = await axios.post(`${providerURL}/api/register`, dta, { httpsAgent });
    return response.data;
  } catch (error) {
    console.error(`Error registering provider at ${providerURL}:`, error);
    throw error;
  }
}

export async function checkProviderAvailability(providerURL: string): Promise<boolean> {
  try {
    const response = await axios.get(`${providerURL}/api/ping`, {
      httpsAgent,
      timeout: 5000 // 5 second timeout for ping
    });
    return response.data === 'ok';
  } catch (error) {
    return false;
  }
}

export async function waitForProvider(providerURL: string,retryIntervalSeconds:number,maxRetries:number = -1): Promise<void> {
  let retries = 0;

  while (maxRetries < 0 || retries < maxRetries) {
    console.log(`Checking provider availability (attempt ${retries + 1}/${maxRetries})...`);

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
