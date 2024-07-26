import path from "path";
import { createWriteStream, promises as fs } from "fs";
import { config } from "./EnvConfig.js";
import { peerIdFromString } from "@libp2p/peer-id";
let lastCid = null;
let wip = false;
async function downloadFile(ufs, cid, localPath) {
    for await (const file of ufs.ls(cid)) {
        const relPath = file.path.replace(cid.toString(), '');
        const filePath = path.join(localPath, relPath);
        if (file.type === 'file' || file.type === 'raw') {
            console.log(`Downloading file ${relPath}`);
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            const content = file.content();
            const writeStream = createWriteStream(filePath);
            for await (const chunk of content) {
                writeStream.write(chunk);
            }
            writeStream.end();
            console.log(`File ${relPath} has been downloaded to ${filePath}`);
        }
        else if (file.type === 'directory') {
            console.log(`Entering directory ${relPath}`);
            await downloadFile(ufs, file.cid, filePath);
        }
        else {
            console.error(`Unsupported file type ${file.type} for ${relPath}`);
        }
    }
}
export async function update(name, ufs) {
    if (wip) {
        console.log('Already in progress');
        return;
    }
    wip = true;
    try {
        // Download a folder from IPFS (IPNS cid) and move it to the local filesystem
        const ipnsPeer = config.IPNS; // Replace with your IPNS CID
        const localPath = config.TARGET_FOLDER; // Replace with your local path
        const tempPath = path.normalize('./tmp');
        // resolve the name
        let peerIdIPNS = peerIdFromString(ipnsPeer);
        let rcid = null;
        while (!rcid) {
            try {
                const result = await name.resolve(peerIdIPNS);
                console.info(`Resolved IPNS name ${ipnsPeer} to CID ${result.cid.toString()}`);
                rcid = result.cid;
            }
            catch (e) {
                console.error(e.message);
            }
        }
        if (lastCid === rcid.toString()) {
            console.log('No new CID found');
            return;
        }
        lastCid = rcid.toString();
        //Else download the new CID Folder
        //remove the content of the folder
        await fs.rm(tempPath, { recursive: true, force: true });
        await downloadFile(ufs, rcid, tempPath);
        // remove the localPath and copy the content of tmp to localPath
        await fs.rm(localPath, { recursive: true, force: true });
        await fs.rename(tempPath, localPath);
        console.log('Download completed');
    }
    finally {
        wip = false;
    }
}
//# sourceMappingURL=update.js.map