import {createLibp2p, Libp2p} from "libp2p";
import {ipns} from '@helia/ipns';
import {EventEmitter} from 'events';
import {createHelia} from "helia";
import {unixfs} from "@helia/unixfs";
import {createConfig} from "./createConfig.js";
import * as os from "node:os";
import {peerIdFromString} from '@libp2p/peer-id'
import {execSync} from 'child_process';
import bodyParser from "body-parser";
import cors from "cors";
import express from 'express';
import {registerRecvDTO, registerSendDTO} from "./dto.js";
import {IpManager} from "./lib/IpManager.js";
import * as path from "node:path";

export interface Data {
  nodeAddress: string[];
  libp2p: Libp2p;
}

export class Provider {
  private ipManager = new IpManager("10.16.0.0/16");
  private peerIdIpMap = new Map<string, string>();//peerId -> ip
  private vpnEndpointAnnounce: string;
  private wgServerPublicKey: string;

  constructor() {
    const vpnPort = process.env.VPN_PORT || '51820';
    this.vpnEndpointAnnounce = `${(process.env.VPN_ENDPOINT_ANNOUNCE || process.env.PROVIDER_ANNONCE_DOMAIN)}:${vpnPort}`;
    this.wgServerPublicKey = process.env.SERVER_WG_PUBLIC_KEY;
    if (!this.wgServerPublicKey) {
      throw new Error('SERVER_WG_PUBLIC_KEY not set');
    }
    this.ipManager.leaseIp("10.16.0.1")
    this.ipManager.leaseIp("10.16.0.2")
  }

  registerPeer(data:registerSendDTO): registerRecvDTO {
    let peerIdObj = peerIdFromString(data.peerId);
    if (!peerIdObj) {
      throw new Error('Invalid peerId');
    }
    // publicKey is the wireguard public key of the client
    // add the peer to wg => wg set wg0 peer "K30I8eIxuBL3OA43Xl34x0Tc60wqyDBx4msVm8VLkAE=" allowed-ips 10.101.1.2/32
    const uniqueIp = this.ipManager.getFreeIp();

    // Add the peer to WireGuard
    execSync(`wg set wg0 peer ${data.publicKey} allowed-ips ${uniqueIp}/32`);

    const ret: registerRecvDTO = {
      wgConfig: {
        wgInterface: {
          address: [`${uniqueIp}/32`],
        },
        peers: [
          {
            publicKey: this.wgServerPublicKey,
            allowedIps: ['10.16.0.0/16'],
            endpoint: this.vpnEndpointAnnounce,
            persistentKeepalive: 3600,
          }]
      },
      domain:process.env.PROVIDER_ANNONCE_DOMAIN
    }
    this.peerIdIpMap.set(data.peerId, uniqueIp);
    this.peerIdIpMap.set(data.name, uniqueIp);//TODO ENS support
    console.log(`Registered ${data.name} ${data.peerId} with ip ${uniqueIp}`);
    return ret;
  }

  async startProvider(announcedDomain: string) {
    console.log(`Starting provider for ${announcedDomain}`);
    os.setPriority(os.constants.priority.PRIORITY_LOW);
    EventEmitter.defaultMaxListeners = 2000; // Or any number that suits your application's needs

    const app = express();
    app.use(bodyParser.json());
    app.use(cors());
    const port = 3000;

    let libp2p = await createLibp2p(await createConfig({}));
    let ipfs = await createHelia({libp2p: libp2p});
    let ufs = unixfs(ipfs);
    const name = ipns(ipfs);
    await libp2p.start();

    libp2p.getMultiaddrs().forEach(multiaddr => {
      console.log(`Listening on ${multiaddr.toString()}`);
    });

    // Serve static files
    app.use(express.static('/usr/share/nginx/html-provider/'));

    app.get('/api/ping', async (req, res) => {
      res.send('pong');
    });

    app.get('/api/get_ip/:host', async (req, res) => {
      let host = req.params.host;
      host = host.replaceAll("-", ".") //all dash are consiered as dots
      if(!host.endsWith(announcedDomain)) {
        res.status(404).send('Invalid domain');
        return;
      }

      //remove the . + announced domain
      const subDomain = host.substring(0, host.length - announcedDomain.length -1);
      // takes the right most part of the domain eg aa.bb.cc => cc
      const parts = subDomain.split('.');
      const name = parts[parts.length - 1];
      console.log(`found name ${name} ${subDomain}`);

      if(!name){
        //if no name it means it is the root domain and or the API server (this server)
        res.send('http://127.0.0.1:3000');
        return;
      }

      //will be directly used by nginx to proxy the request
      let ip = this.peerIdIpMap.get(name);
      if (!ip) {
        res.status(404).send('IP not found');
        return;
      }
      console.log(`found ip for ${name}: ${ip}`)
      const ret = `http://${ip}:80`
      res.send(ret);
    });

    app.post('/api/register', async (req, res) => {
      const data: registerSendDTO = req.body;
      const ret = await this.registerPeer(data);
      res.send(ret);
    });

    app.listen(port, () => {
      console.log(`Local API Server is running at http://localhost:${port}`);
    });
  }

}
