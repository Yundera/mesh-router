import type {PeerId} from "@libp2p/interface";
// Example of checking if a file exists asynchronously
// Note: `existsSync` does not have a direct async equivalent, so we use `access` instead.
import fs, {access, constants} from "fs/promises";
import {peerIdFromKeys} from "@libp2p/peer-id";
import * as crypto from "@libp2p/crypto";

export async function existsAsync(filePath: string): Promise<boolean> {
    try {
        await access(filePath, constants.F_OK);
        return true; // File exists
    } catch {
        return false; // File does not exist
    }
}

//ipfs key import metatest2 ./peer.key
export async function loadOrCreatePeerId(filePath: string = ""): Promise<PeerId> {
    try {
        if (filePath && await existsAsync(filePath)) {
            const buffer = await fs.readFile(filePath);
            let privateKey = await crypto.keys.unmarshalPrivateKey(new Uint8Array(buffer));
            return await peerIdFromKeys(privateKey.public.bytes, privateKey.bytes) as PeerId;
        } else {
            const privateKey = await crypto.keys.generateKeyPair('Ed25519', 256);
            const peerId = await peerIdFromKeys(privateKey.public.bytes, privateKey.bytes);
            if (filePath) {
                await fs.writeFile(filePath, privateKey.bytes);
                console.log(`Generated and saved a new PeerId to ${filePath}`);
            }
            return peerId as PeerId;
        }
    } catch (error) {
        console.error('Error in loadOrCreatePeerId:', error);
        throw error;
    }
}