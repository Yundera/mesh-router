# MeshRouter

## Sponsor
Thanks for sponsoring this project

**Yundera** : [yundera.com](https://yundera.com) - Easy to use cloud server for open source container applications.  
**NSL.SH** : [nsl.sh](https://nsl.sh) - free domain for opensouce project.

## Sibling project
[CasaIMG](https://github.com/worph/casa-img) - providing easy management of docker images and compatible with mesh router.

## Domain format
the name is one of the following:  
`<name>` : Name proposed by the user on registration (if accepted by the provider)  
`<domain>` : The domain is the domain of the provider (eg domain.com).  

The service (optional) is the hostname on the requester's network to forward the request to. (default to "default" hostname or DEFAULT_HOST is defined).
The port (optional) to use on the service (default to 80).  
`<port>.<service>.<name>.<domain>`

Since some certificate authorities do not allow the use of multiple sub sub domain in the certificate, the following format is also supported.
The points can be replaced by dash (-) in the domain name.  
`<port>-<service>-<name>.<domain>`

## Domain Routing: How It Works

This image supports two modes: **Domain Provider** and **Domain Requester**.

- **Domain Provider**: Supplies a domain to the requester, e.g., `domain.com`.
- **Domain Requester**: Registers with the provider to obtain a subdomain, e.g., `name.domain.com`. Any further sub-subdomains (e.g., `sub.name.domain.com`) will be routed to the requester. Communication between the provider and requester is secured and encrypted using a VPN (Wireguard).

### Requester

The requester registers with the provider to receive a subdomain. It can then redirect traffic to any container on the same network using the hostname.

For example, if you have a container named `casaos` on the same network as the requester, traffic to `casaos.name.domain.com` will be redirected to it.

If a default host is defined (e.g., `default`), traffic to `name.domain.com` will be redirected to the container named `default`.

#### Example Configuration for the Requester

```sh
docker run -d \
  --cap-add NET_ADMIN \
  -e PROVIDER="https://domain.com" \    # The provider URL to register with
  -e DEFAULT_HOST="casaos" \            # Default host to redirect requests from name.domain.com
  -e NAME="nas" \                       # Desired subdomain name
  --network meta \                      # Network to communicate with other containers
  --sysctl net.ipv4.ip_forward=1 \      # Enable IP forwarding
  --sysctl net.ipv4.conf.all.src_valid_mark=1 \  # Required for Wireguard
  $imageName
```

### Provider

#### Scope:

- TLS management (HTTPS)
- Routing of subdomains
- VPN functionality (protects requester anonymity)
- HTTPS only (no TCP port sharing)
- Provides mechanisms for NAS IP subscription
- Endpoint provisioning (e.g., `Jellyfin-metazla.metadata.box`)
- Stateless (no persistent storage) – acts as a gateway for web2
- Allows NAS to register through VPN to avoid NAT issues

#### Cloudflare

It is recommended to set up Cloudflare for TLS management and DDoS protection. The provider container will use a self-signed certificate for end-to-end encryption.

#### Example Configuration for the Provider

```sh
docker run -d \
  --cap-add NET_ADMIN \
  -e PROVIDER_ANNOUNCE_DOMAIN=domain.com \  # The domain to be provided
  -p 3000:3000 \                           # Port for requester registration
  -p 443:443 \                             # Main HTTPS entry point
  -p 51820:51820/udp \                     # Wireguard VPN port for NAS tunnels
  --sysctl net.ipv4.ip_forward=1 \      # Enable IP forwarding
  --sysctl net.ipv4.conf.all.src_valid_mark=1 \ # Required for Wireguard
  $imageName
```
```yml
  routing:
    image: $imageName
    ports:
      - "80:80"
      - "443:443"
      - "51820:51820/udp"
    environment:
      - PROVIDER_ANNONCE_DOMAIN=domain.com
      - VPN_ENDPOINT_ANNOUNCE=x.x.x.x # Use the direct IP (beware a domain behind cloudflare will not work)
    cap_add:
      - NET_ADMIN
      - SYS_MODULE
    sysctls:
      - net.ipv4.ip_forward=1
      - net.ipv4.conf.all.src_valid_mark=1
    volumes:
      - ./config.lua:/etc/nginx/lua/config.lua #optional
```