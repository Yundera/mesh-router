import sodium from "libsodium-wrappers";
import { base36 } from "multiformats/bases/base36";

/** Generate a new key pair base 36 string Ed25519 256 */
export async function generateKeyPair(): Promise<{ pub: string; priv: string }> {
    await sodium.ready; // Ensure Sodium is ready

    const keyPair = sodium.crypto_sign_keypair();
    const pub = base36.encode(keyPair.publicKey);
    const priv = base36.encode(keyPair.privateKey);

    return { pub, priv };
}

export async function verifySignature(
    pubKeyBase36: string,
    signature: string,
    message: string
): Promise<boolean> {
    await sodium.ready; // Ensure Sodium is ready

    // Decode the base36 public key to bytes
    const pubKeyBytes = base36.decode(pubKeyBase36);

    // Decode the signature from base36 to bytes
    const signatureBytes = base36.decode(signature);

    // Convert the message to Uint8Array
    const messageBytes = new TextEncoder().encode(message);

    // Verify the signature using the public key and message
    return sodium.crypto_sign_verify_detached(signatureBytes, messageBytes, pubKeyBytes);
}

export async function sign(privKeyBase36: string, message: string): Promise<string> {
    await sodium.ready; // Ensure Sodium is ready

    // Decode the base36 private key to bytes
    const privKeyBytes = base36.decode(privKeyBase36);

    // Convert the message to Uint8Array
    const messageBytes = new TextEncoder().encode(message);

    // Sign the message using the private key
    const signatureBytes = sodium.crypto_sign_detached(messageBytes, privKeyBytes);

    // Return the signature as a base36 string
    return base36.encode(signatureBytes);
}
