import axios from "axios";
import {loadOrCreatePeerId} from "./lib/LoadOrCreatePeerId.js";
import {generateKeyPair, WgConfig} from "wireguard-tools";
import {registerRecvDTO, registerSendDTO} from "./dto.js";
import * as fs from 'fs/promises';

export async function startRequester(providerURL: string, peerIdConf?: string) {
  try {
    const peerId = await loadOrCreatePeerId(peerIdConf);
    const {publicKey, privateKey} = await generateKeyPair()
    console.log(`PeerId: ${peerId.toString()}`);
    const dta: registerSendDTO = {
      name: process.env.NAME,//wanted name - should be unique - leave empty to get the entire domain
      peerId: peerId.toString(),
      publicKey: publicKey
    }
    const result: registerRecvDTO = (await axios.post(`${providerURL}/api/register`, dta)).data;
    console.log(result.wgConfig);

    // write the result.domain in file /var/run/meta/domain
    try {
      // Ensure the directory exists
      await fs.mkdir('/var/run/meta', { recursive: true });
      await fs.writeFile('/var/run/meta/domain', result.domain);
      await fs.writeFile('/var/run/meta/default_host', process.env.DEFAULT_HOST || "default");
      await fs.writeFile('/var/run/meta/default_host_port', process.env.DEFAULT_HOST_PORT || "80");
      console.log(`Domain ${result.domain} written to file successfully`);
    } catch (err) {
      console.error('Error writing domain to file:', err);
    }


    //fill specific local fields
    result.wgConfig.wgInterface.privateKey = privateKey;
    result.wgConfig.filePath = `/etc/wireguard/wg0.conf`;
    const config1 = new WgConfig(result.wgConfig)
    await config1.writeToFile()
    // bring down
    await config1.down()
    // bring up
    await config1.up()
  } catch (err){
    //exit with error if init fails
    console.error(err);
    process.exit(51);
  }
}