import { createLibp2p } from "libp2p";
import { ipns } from '@helia/ipns';
import { EventEmitter } from 'events';
import { createHelia } from "helia";
import { unixfs } from "@helia/unixfs";
import { createConfig } from "./createConfig.js";
import cron from 'node-cron';
import { update } from "./update.js";
import * as os from "node:os";
import { peerIdFromString } from '@libp2p/peer-id';
os.setPriority(os.constants.priority.PRIORITY_LOW);
EventEmitter.defaultMaxListeners = 2000; // Or any number that suits your application's needs
import express from 'express';
const app = express();
const port = 3000;
async function startGateway() {
    console.log('Starting gateway');
    let libp2p = await createLibp2p(await createConfig({}));
    let ipfs = await createHelia({ libp2p: libp2p });
    let ufs = unixfs(ipfs);
    const name = ipns(ipfs);
    await libp2p.start();
    libp2p.getMultiaddrs().forEach(multiaddr => {
        console.log(`Listening on ${multiaddr.toString()}`);
    });
    app.get('/get_ip/:hash', async (req, res) => {
        const hash = req.params.hash;
        let peerId = peerIdFromString(hash);
        let peer = await libp2p.peerStore.get(peerId);
        if (peer) {
            if (peer.addresses.length > 1) {
                console.warn('Peer has multiple addresses, returning the first one');
                console.warn(peer.addresses);
            }
            res.send(peer.addresses[0].toString());
        }
        else {
            res.send('127.0.0.1');
        }
    });
    app.listen(port, () => {
        console.log(`Local API Server is running at http://localhost:${port}`);
    });
    // Run the update function every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
        console.log('Running update');
        await update(name, ufs);
    });
    await update(name, ufs);
}
startGateway().catch(console.error);
//# sourceMappingURL=index.js.map