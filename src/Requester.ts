import axios from "axios";
import {generateKeyPair, WgConfig} from "wireguard-tools";
import {registerRecvDTO, registerSendDTO} from "./dto.js";
import * as fs from 'fs/promises';
import {config} from "./EnvConfig.js";
import {sign} from "./lib/KeyLib.js";

export async function startRequester(providerString: string) {
  try {
// providerString := "http://provider:port,<userid (optional)>,<signature (optional)>"
    const [providerURL, userId = '', signature = ''] = providerString.split(',');
    const wgKeys = await generateKeyPair();
    const dta: registerSendDTO = {
      userId: userId,
      vpnPublicKey: wgKeys.publicKey,
      authToken: signature,
    }
    const result: registerRecvDTO = (await axios.post(`${providerURL}/api/register`, dta)).data;
    console.log("VPN configuration :", result.wgConfig);
    console.log(`Root Domain: ${result.domainName}.${result.serverDomain}`);

    // write the result.domain in file /var/run/meta/domain
    try {
      // Ensure the directory exists
      await fs.mkdir('/var/run/meta', { recursive: true });
      await fs.writeFile('/var/run/meta/domain', result.serverDomain);
      await fs.writeFile('/var/run/meta/default_host', config.DEFAULT_HOST);
      await fs.writeFile('/var/run/meta/default_host_port', config.DEFAULT_HOST_PORT);
      console.log(`Domain ${result.domainName}.${result.serverDomain} config saved successfully`);
    } catch (err) {
      console.error('Error writing domain to file:', err);
    }


    //fill specific local fields
    result.wgConfig.wgInterface.privateKey = wgKeys.privateKey;
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