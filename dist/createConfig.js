import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { mplex } from "@libp2p/mplex";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";
import { tcp } from "@libp2p/tcp";
import { bootstrap } from "@libp2p/bootstrap";
import { autoNAT } from "@libp2p/autonat";
import { dcutr } from "@libp2p/dcutr";
import { identify } from "@libp2p/identify";
import * as libp2pInfo from "libp2p/version";
import { keychain } from "@libp2p/keychain";
import { ping } from "@libp2p/ping";
import { kadDHT, removePrivateAddressesMapper } from "@libp2p/kad-dht";
import { ipnsValidator } from "ipns/validator";
import { ipnsSelector } from "ipns/selector";
import { uPnPNAT } from "@libp2p/upnp-nat";
import { webSockets } from "@libp2p/websockets";
import { config } from "./EnvConfig.js";
export async function createConfig(additionalServices) {
    let port = config.IPFS_PORT || "4001";
    let bootstrapAddrList = config.BOOTSTRAP?.split(',') || [];
    let host = config.HOST; //optional
    let domain = config.IPFS_ANNOUNCE_DOMAIN_NAME;
    //add public network for IPNS support
    bootstrapAddrList.push("/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN");
    bootstrapAddrList.push("/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa");
    bootstrapAddrList.push("/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb");
    bootstrapAddrList.push("/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt");
    bootstrapAddrList.push("/ip4/51.159.100.53/tcp/4001/p2p/QmdvgyvitE7TKTrK31iD86eksXJKtHJjWhxAFBhmHoLJGy");
    //TODO compute announce list
    let announceList = [];
    if (host) {
        announceList.push(`/ip4/${host}/tcp/${+port}`);
    }
    if (domain) {
        announceList.push(`/dns4/${domain}/tcp/${+port}`);
        announceList.push(`/dns4/${domain}/tcp/433/wss`);
        //`/ip4/${host}/tcp/${+port}`,
        //`/ip4/${host}/tcp/${+port + 1000}/ws`,
        //`/ip4/${host}/udp/${+port+2000}/quic`,
        //"/dns4/ipfs.le-space.de/tcp/1235",
        //"/dns4/ipfs.le-space.de/tcp/443/wss",
    }
    const libp2pOptions = {
        connectionEncryption: [
            noise()
        ],
        streamMuxers: [
            yamux(),
            mplex()
        ],
        addresses: {
            listen: [
                `/ip4/0.0.0.0/tcp/${+port}`,
            ],
            announce: announceList,
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
            autoNAT: autoNAT(),
            dcutr: dcutr(),
            identify: identify({
                agentVersion: `${libp2pInfo.name}/${libp2pInfo.version} UserAgent=meta-getaway`
            }),
            keychain: keychain(),
            ping: ping(),
            aminoDHT: kadDHT({
                protocol: '/ipfs/kad/1.0.0',
                peerInfoMapper: removePrivateAddressesMapper,
                clientMode: false,
                validators: {
                    ipns: ipnsValidator
                },
                selectors: {
                    ipns: ipnsSelector
                }
            }),
            upnp: uPnPNAT(),
            ...additionalServices
        }
    };
    return libp2pOptions;
}
//# sourceMappingURL=createConfig.js.map