import {WgConfigObject} from "wireguard-tools/dist/types/WgConfigObject.js";

export interface registerSendDTO {
    userId: string,
    vpnPublicKey: string,
    authToken: string, // userId signed by the private key
}

export interface registerRecvDTO {
  wgConfig: Partial<WgConfigObject> & { filePath?: string; };
  serverDomain: string;
  domainName: string;
}

export interface verifyRecvDTO {
  serverDomain:string;
  domainName:string;
}