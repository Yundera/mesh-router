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

    /** [requester] Routing target host - all traffic will be forwarded to this container */
    ROUTING_TARGET_HOST: string;
    /** [requester] Routing target port */
    ROUTING_TARGET_PORT: string;
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
    ROUTING_TARGET_HOST: process.env.ROUTING_TARGET_HOST || "caddy",
    ROUTING_TARGET_PORT: process.env.ROUTING_TARGET_PORT || "80",
    PROVIDER: process.env.PROVIDER!,
};
