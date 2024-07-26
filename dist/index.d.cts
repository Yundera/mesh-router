import { Libp2p } from 'libp2p';

interface Data {
    nodeAddress: string[];
    libp2p: Libp2p;
}
declare function createConfig<T>(additionalServices: any, bootstrapAddrList?: string[]): Promise<T>;

export { type Data, createConfig };
