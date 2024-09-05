import {EventEmitter} from 'events';
import * as os from "node:os";
import {execSync} from 'child_process';
import bodyParser from "body-parser";
import cors from "cors";
import express from 'express';
import {registerRecvDTO, registerSendDTO, verifyRecvDTO} from "./dto.js";
import {IpManager} from "./lib/IpManager.js";
import {config} from "./EnvConfig.js";
import axios from "axios";

export interface Data {
  nodeAddress: string[];
}

export class Provider {
  private ipManager = new IpManager("10.16.0.0/16");
  private peerIdIpMap = new Map<string, string>();//peerId -> ip
  private vpnEndpointAnnounce: string;
  private wgServerPublicKey: string;

  constructor() {
    const vpnPort = config.VPN_PORT;
    this.vpnEndpointAnnounce = `${(config.VPN_ENDPOINT_ANNOUNCE || config.PROVIDER_ANNONCE_DOMAIN)}:${vpnPort}`;
    this.wgServerPublicKey = config.SERVER_WG_PUBLIC_KEY;
    if (!this.wgServerPublicKey) {
      throw new Error('SERVER_WG_PUBLIC_KEY not set');
    }
    this.ipManager.leaseIp("10.16.0.1")
    this.ipManager.leaseIp("10.16.0.2")
  }

  async registerPeer(data: registerSendDTO): Promise<registerRecvDTO> {
    // publicKey is the wireguard public key of the client
    // add the peer to wg => wg set wg0 peer "K30I8eIxuBL3OA43Xl34x0Tc60wqyDBx4msVm8VLkAE=" allowed-ips 10.101.1.2/32
    const uniqueIp = this.ipManager.getFreeIp();

    let serverData: verifyRecvDTO;
    if (config.AUTH_API_URL) {
      const verifyRet = await axios.get<verifyRecvDTO>(`${config.AUTH_API_URL}/${data.userId}/${data.authToken}`);
      serverData = verifyRet.data;
    } else {
      serverData = {
        serverDomain: config.PROVIDER_ANNONCE_DOMAIN,
        domainName: 'test',
      }
    }
    if(!serverData.serverDomain || !serverData.domainName) {
      console.log(serverData);
        throw new Error('Invalid Signature');
    }

    // Add the peer to WireGuard
    execSync(`wg set wg0 peer ${data.vpnPublicKey} allowed-ips ${uniqueIp}/32`);

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
            persistentKeepalive: 360,
          }]
      },
      serverDomain: serverData.serverDomain,
      domainName: serverData.domainName,
    }
    this.peerIdIpMap.set(data.userId, uniqueIp);
    this.peerIdIpMap.set(serverData.domainName, uniqueIp);//TODO ENS support
    console.log(`Registered ${serverData.domainName} ${data.userId} with ip ${uniqueIp}`);
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

    // Serve static files
    app.use(express.static('/usr/share/nginx/html-provider/'));

    app.get('/api/ping', async (req, res) => {
      res.send('pong');
    });

    app.get('/api/get_ip/:host', async (req, res) => {
      try {
        let host = req.params.host;
        host = host.replaceAll("-", ".") //all dash are consiered as dots
        if (!host.endsWith(announcedDomain)) {
          res.status(404).send('Invalid domain');
          return;
        }

        //remove the . + announced domain
        const subDomain = host.substring(0, host.length - announcedDomain.length - 1);
        // takes the right most part of the domain eg aa.bb.cc => cc
        const parts = subDomain.split('.');
        const name = parts[parts.length - 1];
        console.log(`found name ${name} ${subDomain}`);

        if (!name) {
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
      } catch (err) {
        console.error(err);
        res.status(500).send('Internal error');
      }
    });

    app.post('/api/register', async (req, res) => {
      try {
        const data: registerSendDTO = req.body;
        const ret = await this.registerPeer(data);
        res.send(ret);
      } catch (err) {
        console.error(err);
        res.status(500).send('Internal error');
      }
    });

    app.listen(port, () => {
      console.log(`Local API Server is running at http://localhost:${port}`);
    });
  }

}
