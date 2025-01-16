import {EventEmitter} from 'events';
import * as os from "node:os";
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import axios from 'axios';
import {VPNManager} from './VPNManager.js';
import {registerRecvDTO, registerSendDTO, verifyRecvDTO} from '../common/dto.js';

export interface ApiServerConfig {
    authApiUrl?: string,
    announcedDomain: string,
}

export class ApiServer {
    private vpnManager: VPNManager;

    constructor(vpnManager: VPNManager,private config:ApiServerConfig) {
        this.vpnManager = vpnManager;
    }

    async registerPeer(data: registerSendDTO): Promise<registerRecvDTO> {

        let serverData: verifyRecvDTO;
        if (this.config.authApiUrl) {
            const verifyRet = await axios.get<verifyRecvDTO>(`${this.config.authApiUrl}/${data.userId}/${data.authToken}`);
            serverData = verifyRet.data;
        } else {
            serverData = {
                serverDomain: this.config.announcedDomain,
                domainName: 'test',
            };
        }
        if (!serverData.serverDomain || !serverData.domainName) {
            if (this.config.authApiUrl) {
                console.error(`Url => ${this.config.authApiUrl}/${data.userId}/${data.authToken}`);
            }
            console.error(serverData);
            throw new Error('Invalid Signature');
        }

        // Add the peer to WireGuard
        const wgconfig = this.vpnManager.registerPeer(data.vpnPublicKey, serverData.domainName);

        return {
            wgConfig: wgconfig,
            serverDomain: serverData.serverDomain,
            domainName: serverData.domainName,
        };
    }

    async startProvider() {
        console.log(`Starting provider for ${this.config.announcedDomain}`);
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
                if (!host.endsWith(this.config.announcedDomain)) {
                    res.status(404).send('Invalid domain');
                    return;
                }

                //remove the . + announced domain
                const subDomain = host.substring(0, host.length - this.config.announcedDomain.length - 1);
                // takes the right most part of the domain eg aa.bb.cc => cc
                const parts = subDomain.split('.');
                const name = parts[parts.length - 1];

                if (!name) {
                    //if no name it means it is the root domain and or the API server (this server)
                    console.log(`name not found for ${host}`);
                    res.send('http://127.0.0.1:3000');
                    return;
                }

                //will be directly used by nginx to proxy the request
                let ip = this.vpnManager.getIpFromName(name);
                if (!ip) {
                    res.status(404).send('IP not found');
                    return;
                }
                console.log(`found ip for ${name} (${subDomain}): ${ip}`)
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
            console.log(`API Server is running at http://localhost:${port}`);
        });
    }

}
