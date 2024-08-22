import type {PeerId} from "@libp2p/interface";
import { keys } from "@libp2p/crypto";
import {peerIdFromKeys} from "@libp2p/peer-id";
import {base36} from 'multiformats/bases/base36';

export async function createPeerId(): Promise<PeerId> {
    const privateKey = await keys.generateKeyPair('Ed25519', 256);
    return await peerIdFromKeys(privateKey.public.bytes, privateKey.bytes) as any;
}

/** Generate a new key pair base 36 string Ed25519 256 */
export async function generateKeyPair(): Promise<{pub: string, priv: string}> {
    const peerId = await createPeerId();

    // const pub = peerId.toCID().toString(base36); // k5.. (IPNS)
    // const pub = peerId.toCID().toString(); // bafz...
    // const pub = peerId.toString(); // 12D...

    const pub = base36.encode(peerId.publicKey);
    const priv = base36.encode(peerId.privateKey);
    return {pub, priv};
}

export async function verifySignature(pubKeyBase36: string, signature: string, message: string): Promise<boolean> {
    // Decode the base36 public key to bytes
    const pubKeyBytes = base36.decode(pubKeyBase36);

    // Create a public key object from the decoded bytes
    const publicKey = keys.unmarshalPublicKey(pubKeyBytes);

    // Convert the signature to Uint8Array (base36 decoding)
    const signatureBytes = base36.decode(signature);

    // Convert the message to Uint8Array
    const messageBytes = new TextEncoder().encode(message);

    // Verify the signature using the public key object and the message
    return publicKey.verify(messageBytes, signatureBytes);
}

export async function sign(privKeyBase36: string, message: string): Promise<string> {
    // Decode the base36 private key to bytes
    const privKeyBytes = base36.decode(privKeyBase36);

    // Create a private key object from the decoded bytes
    const privateKey = await keys.unmarshalPrivateKey(privKeyBytes);

    // Convert the message to Uint8Array
    const messageBytes = new TextEncoder().encode(message);

    // Sign the message using the private key object
    const signatureBytes = await privateKey.sign(messageBytes);

    // Return the signature as a base36 string
    return base36.encode(signatureBytes);
}

// usage example
/*(async () => {
    {
        const {pub, priv} = await generateKeyPair();

        const message = 'Hello, world!';
        const signature = await sign(priv, message);

        const isValid = await verifySignature(pub, signature, message);
        console.log('Is valid:', isValid);


        const key2= await generateKeyPair();
        const isValid2 = await verifySignature(key2.pub, signature, message);
        console.log('Is valid:', isValid2);

    }

})();*/
