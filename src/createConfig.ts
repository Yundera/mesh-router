import {noise} from "@chainsafe/libp2p-noise";
import {yamux} from "@chainsafe/libp2p-yamux";
import {mplex} from "@libp2p/mplex";
import {circuitRelayTransport} from "@libp2p/circuit-relay-v2";
import {tcp} from "@libp2p/tcp";
import {bootstrap} from "@libp2p/bootstrap";
import {identify} from "@libp2p/identify";
import * as libp2pInfo from "libp2p/version";
import {keychain} from "@libp2p/keychain";
import {ping} from "@libp2p/ping";
import {kadDHT, removePrivateAddressesMapper} from "@libp2p/kad-dht";
import {ipnsValidator} from "ipns/validator";
import {ipnsSelector} from "ipns/selector";
import {webSockets} from "@libp2p/websockets";
import {config} from "./EnvConfig.js";

export async function createConfig<T>(
    additionalServices: any
): Promise<T> {
    //this node is intended to be read-only
    let bootstrapAddrList = config.BOOTSTRAP?.split(',') || [];

    //add public network for IPNS support
    bootstrapAddrList.push("/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN");
    bootstrapAddrList.push("/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa");
    bootstrapAddrList.push("/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb");
    bootstrapAddrList.push("/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt");
    bootstrapAddrList.push("/ip4/51.159.100.53/tcp/4001/p2p/QmdvgyvitE7TKTrK31iD86eksXJKtHJjWhxAFBhmHoLJGy");

    const libp2pOptions: any = {
        connectionEncryption: [
            noise()
        ],
        streamMuxers: [
            yamux(),
            mplex()
        ],

        addresses: {
            listen: [],
        },
        transports: [
            circuitRelayTransport({}),
            tcp(),
            webSockets(),
        ],
        peerDiscovery: [
            bootstrap({
                list: bootstrapAddrList,
                timeout: 0,
            }),
        ],
        services: {
            identify: identify({
                agentVersion: `${libp2pInfo.name}/${libp2pInfo.version} UserAgent=meta-getaway`
            }),
            keychain: keychain(),
            ping: ping(),
            aminoDHT: kadDHT({
                protocol: '/ipfs/kad/1.0.0',
                peerInfoMapper: removePrivateAddressesMapper,
                clientMode: true,
                validators: {
                    ipns: ipnsValidator
                },
                selectors: {
                    ipns: ipnsSelector
                }
            }),
            ...additionalServices
        }
    }
    return libp2pOptions;
}