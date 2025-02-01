import dotenv from 'dotenv';
dotenv.config();

interface EnvConfig {

    /** [provider] IP range for VPN */
    VPN_IP_RANGE: string;
    /** [provider] API used to verify if the user have righs to register on this server */
    AUTH_API_URL: string;
    /** [provider] Port for VPN */
    VPN_PORT: string;
    /** [provider] VPN endpoint announcement */
    VPN_ENDPOINT_ANNOUNCE: string;
    /** [provider] Provider announcement domain */
    PROVIDER_ANNONCE_DOMAIN: string;

    /** **/

    /** [requester] Default routing host (request will be routed to this host by default) */
    DEFAULT_HOST: string;
    /** [requester] Default routing host port (request will be routed to this host by default)*/
    DEFAULT_HOST_PORT: string;
    /** [requester]  provider connexion string <url>,<userid>,<secret> */
    PROVIDER: string;
}

/**
 * Load environment variables into the config object
 */
export const config: EnvConfig = {
    VPN_IP_RANGE: process.env.VPN_IP_RANGE!,
    AUTH_API_URL: process.env.AUTH_API_URL!,
    VPN_PORT: process.env.VPN_PORT,
    VPN_ENDPOINT_ANNOUNCE: process.env.VPN_ENDPOINT_ANNOUNCE!,
    PROVIDER_ANNONCE_DOMAIN: process.env.PROVIDER_ANNONCE_DOMAIN!,
    DEFAULT_HOST: process.env.DEFAULT_HOST || "casaos",
    DEFAULT_HOST_PORT: process.env.DEFAULT_HOST_PORT || "8080",
    PROVIDER: process.env.PROVIDER!,
};
