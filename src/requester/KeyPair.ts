import fs from "fs/promises";
import {generateKeyPair} from "wireguard-tools";
import path from "path";

interface KeyPair {
  publicKey: string;
  privateKey: string;
}

const KEYS_DIRECTORY = '.wg-keys';

async function getKeyFilePath(providerURL: string): Promise<string> {
  // Create a unique filename based on the provider URL
  const safeFileName = encodeURIComponent(providerURL) + '.json';
  return path.join(KEYS_DIRECTORY, safeFileName);
}

async function ensureKeysDirectory(): Promise<void> {
  try {
    await fs.mkdir(KEYS_DIRECTORY, {recursive: true});
  } catch (err) {
    console.error('Error creating keys directory:', err);
    throw err;
  }
}

async function writeKeyPair(providerURL: string, keyPair: KeyPair): Promise<void> {
  await ensureKeysDirectory();
  const keyFilePath = await getKeyFilePath(providerURL);

  try {
    await fs.writeFile(keyFilePath, JSON.stringify(keyPair, null, 2));
  } catch (err) {
    console.error('Error writing key pair to file:', err);
    throw err;
  }
}

async function keyPair(providerURL: string): Promise<KeyPair | null> {
  const keyFilePath = await getKeyFilePath(providerURL);

  try {
    const fileContent = await fs.readFile(keyFilePath, 'utf-8');
    return JSON.parse(fileContent) as KeyPair;
  } catch (err) {
    if (err.code === 'ENOENT') {
      return null; // File doesn't exist
    }
    console.error('Error reading key pair from file:', err);
    throw err;
  }
}

export async function getOrGenerateKeyPair(providerURL: string): Promise<KeyPair> {
  // Try to read existing key pair
  const existingKeyPair = await keyPair(providerURL);
  if (existingKeyPair) {
    console.log(`Using existing WireGuard key pair for ${providerURL}`);
    return existingKeyPair;
  }

  // Generate new key pair if none exists
  console.log(`Generating new WireGuard key pair for ${providerURL}`);
  const newKeyPair = await generateKeyPair();
  await writeKeyPair(providerURL, newKeyPair);
  return newKeyPair;
}