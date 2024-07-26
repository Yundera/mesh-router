import {WgConfigObject} from "wireguard-tools/dist/types/WgConfigObject.js";

export interface registerSendDTO {
    name: string,
    peerId: string,
    publicKey: string
}

export interface registerRecvDTO {
  wgConfig: Partial<WgConfigObject> & { filePath?: string; };
  domain: string;
}