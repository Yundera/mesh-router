import { Netmask } from 'netmask';

export class IpManager {
    private netBlock: Netmask;
    private assignedIps: Set<string>;/** eg 10.16.0.1 */

    constructor(subnet: string) {
        this.netBlock = new Netmask(subnet);
        this.assignedIps = new Set();
    }

    getFreeIp(): string | null {
        let freeIp: string | null = null;

        // Iterate over all IPs in the netBlock to find an available one
        this.netBlock.forEach((ip) => {
            if (!this.assignedIps.has(ip) && freeIp === null) {
                this.assignedIps.add(ip);
                freeIp = ip;
            }
        });

        return freeIp; // Returns null if no IPs are available
    }

    leaseIp(ip: string): void {
        // verify that the IP format is correct with regex
        if (!ip.match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/)) {
            throw new Error('Invalid IP format');
        }
        // Add the IP to the set of assigned IPs
        this.assignedIps.add(ip);
    }

    releaseIp(ip: string): void {
        // verify that the IP format is correct with regex
        if (!ip.match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/)) {
            throw new Error('Invalid IP format');
        }
        // Remove the IP from the set if it was assigned
        if (this.assignedIps.has(ip)) {
            this.assignedIps.delete(ip);
        }
    }
}
