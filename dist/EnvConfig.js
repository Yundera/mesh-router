import dotenv from 'dotenv';
dotenv.config();
export const config = {
    TARGET_FOLDER: process.env.TARGET_FOLDER,
    IPNS: process.env.IPNS,
    BOOTSTRAP: process.env.BOOTSTRAP,
    IPFS_PORT: process.env.IPFS_PORT || "4001",
    HOST: process.env.HOST,
    DOMAIN_NAME: process.env.DOMAIN_NAME,
    EMAIL: process.env.EMAIL,
    SUBDOMAINS: process.env.SUBDOMAINS,
    IPFS_ANNOUNCE_DOMAIN_NAME: process.env.IPFS_ANNOUNCE_DOMAIN_NAME
};
//# sourceMappingURL=EnvConfig.js.map