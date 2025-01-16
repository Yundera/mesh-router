import { Address4, Address6 } from 'ip-address';

type IpVersion = 4 | 6;

interface IpAddress {
    address: Address4 | Address6;
    version: IpVersion;
}

export class IpManager {
    private subnet: Address4 | Address6;
    private assignedIps: Set<string>;
    private version: IpVersion;

    constructor(subnet: string) {
        // Try parsing as IPv4 first
        try {
            this.subnet = new Address4(subnet);
            this.version = 4;
        } catch {
            try {
                this.subnet = new Address6(subnet);
                this.version = 6;
            } catch {
                throw new Error('Invalid subnet format');
            }
        }
        this.assignedIps = new Set();
    }

    private parseIp(ip: string): IpAddress {
        try {
            const addr4 = new Address4(ip);
            return { address: addr4, version: 4 };
        } catch {
            try {
                const addr6 = new Address6(ip);
                return { address: addr6, version: 6 };
            } catch {
                throw new Error('Invalid IP address format');
            }
        }
    }

    private isIpInSubnet(ip: IpAddress): boolean {
        if (ip.version !== this.version) {
            return false;
        }

        if (this.version === 4) {
            return (ip.address as Address4).isInSubnet(this.subnet as Address4);
        } else {
            return (ip.address as Address6).isInSubnet(this.subnet as Address6);
        }
    }

    private incrementIp(ip: IpAddress): IpAddress | null {
        try {
            if (ip.version === 4) {
                const parts = (ip.address as Address4).toArray();
                let i = 3;
                while (i >= 0) {
                    parts[i]++;
                    if (parts[i] <= 255) break;
                    parts[i] = 0;
                    i--;
                }
                if (i < 0) return null;
                const newIp = parts.join('.');
                return this.parseIp(newIp);
            } else {
                // For IPv6, we'll use the built-in methods of Address6
                const bigInt = ip.address.bigInt();
                const next = bigInt + BigInt(1);
                const hex = next.toString(16).padStart(32, '0');
                const newIp = hex.match(/.{1,4}/g)?.join(':') || '';
                return this.parseIp(newIp);
            }
        } catch {
            return null;
        }
    }

    getFreeIp(): string | null {
        let currentIp: IpAddress;

        // Start with the first usable IP in the subnet
        if (this.version === 4) {
            const subnet4 = this.subnet as Address4;
            currentIp = this.parseIp(subnet4.startAddress().address);
        } else {
            const subnet6 = this.subnet as Address6;
            currentIp = this.parseIp(subnet6.startAddress().address);
        }

        while (currentIp) {
            const ipString = currentIp.address.address;

            if (!this.assignedIps.has(ipString) && this.isIpInSubnet(currentIp)) {
                this.assignedIps.add(ipString);
                return ipString;
            }

            currentIp = this.incrementIp(currentIp);
            if (!currentIp || !this.isIpInSubnet(currentIp)) {
                break;
            }
        }

        return null;
    }

    leaseIp(ip: string): void {
        const parsedIp = this.parseIp(ip);

        if (parsedIp.version !== this.version) {
            throw new Error(`IP version mismatch. Subnet is IPv${this.version}`);
        }

        if (!this.isIpInSubnet(parsedIp)) {
            throw new Error('IP is not in subnet');
        }

        this.assignedIps.add(ip);
    }

    releaseIp(ip: string): void {
        const parsedIp = this.parseIp(ip);

        if (parsedIp.version !== this.version) {
            throw new Error(`IP version mismatch. Subnet is IPv${this.version}`);
        }

        if (this.assignedIps.has(ip)) {
            this.assignedIps.delete(ip);
        }
    }

    getVersion(): IpVersion {
        return this.version;
    }
}