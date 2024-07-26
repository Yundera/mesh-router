import {startRequester} from "./Requester.js";
import {Provider} from "./Provider.js";

if(process.env.PROVIDER_ANNONCE_DOMAIN) {
  //start a provider
  new Provider().startProvider(process.env.PROVIDER_ANNONCE_DOMAIN).catch(console.error).then(() => {
    console.log('Provider started');
  });
} else if (process.env.PROVIDER) {
    //connect to a provider
    startRequester(process.env.PROVIDER).catch(console.error).then(() => {
      console.log('Requester started');
    });
} else {
    throw new Error('No mode specified');
}