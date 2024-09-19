import {startRequester} from "./requester/Requester.js";
import {startProvider} from "./provider/Provider.js";
import {config} from "./common/EnvConfig.js";

if(config.PROVIDER_ANNONCE_DOMAIN) {
  //start a provider
  startProvider(config.PROVIDER_ANNONCE_DOMAIN).catch(console.error).then(() => {
    console.log('Provider started');
  });
} else if (config.PROVIDER) {
    //connect to a provider
    startRequester(config.PROVIDER).catch(console.error).then(() => {
      console.log('Requester started');
    });
} else {
    throw new Error('No mode specified');
}