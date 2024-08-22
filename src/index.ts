import {startRequester} from "./Requester.js";
import {Provider} from "./Provider.js";
import {config} from "./EnvConfig.js";

if(config.PROVIDER_ANNONCE_DOMAIN) {
  //start a provider
  new Provider().startProvider(config.PROVIDER_ANNONCE_DOMAIN).catch(console.error).then(() => {
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