this folder is used to test the dual-provider configuration

to use this configuration run
run-dual-provider-requester-dev.ps1

then go to http://dev.test2.localhost:8080/#/login
and http://dev.test.localhost/#/login

you should see the same casaos login page on both domains


sample configuration for nsl.sh and custom domain
```yaml
providers:
- provider: https://nsl.sh,EkGcLEimm9TIa5TdketObbnbRQ52@nasselle.com,k1k5dy2ydthiaa4zpp3skaydo1dmcoovqi3ahlckiundmc5k0jv753m4c4adfu4i9rqmesfzba5o7czapiksualxfg9kvhd49ekg
  defaultService: casaos
- provider: http://mesh-router-domain,wiseferret
  defaultService: casaos
  services:
  casaos:
  defaultPort: '8080'
```