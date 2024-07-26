#!/bin/bash

set -e

#######################
# Start WireGuard
#######################

# Generate server private and public keys if they do not exist
if [ ! -f /etc/wireguard/server_private.key ]; then
  wg genkey | tee /etc/wireguard/server_private.key | wg pubkey > /etc/wireguard/server_public.key
fi

SERVER_WG_PRIVATE_KEY=$(cat /etc/wireguard/server_private.key)
export SERVER_WG_PUBLIC_KEY=$(cat /etc/wireguard/server_public.key)


SERVER_WG_PRIVATE_KEY=oFzpG3+yTtRGtD0CKd9lzaYtnDVbiR/emGv1Gny7+3g=
export SERVER_WG_PUBLIC_KEY=mnluKQZliNKHHV5cJHf3Mm4st4KIb7F+D/uH11wunlY=

echo "public key: $SERVER_WG_PUBLIC_KEY"

# Create WireGuard configuration
cat <<EOF > /etc/wireguard/wg0.conf
[Interface]
Address = 10.16.0.1/16
SaveConfig = true
ListenPort = 51820
PrivateKey = ${SERVER_WG_PRIVATE_KEY}

[Peer]
PublicKey = np1bI1Qk/5+u5APN6FEikAImZ5FaQnDpsNalD6S4njM=
AllowedIPs = 10.16.0.2/32
EOF
wg-quick up wg0

#######################
# Start OpenResty/nginx
#######################

if [ -n "${PROVIDER_ANNONCE_DOMAIN+x}" ]; then
  # activate the configuration
  envsubst '${PROVIDER_ANNONCE_DOMAIN}' < /etc/nginx/conf.d/provider.conf.template > /etc/nginx/conf.d/provider.conf
fi

if [ -n "${PROVIDER+x}" ]; then
  # a provider is provided so it's a requester
  envsubst '${PROVIDER},${DEFAULT_HOST},${DEFAULT_HOST_PORT}' < /etc/nginx/conf.d/requester.conf.template > /etc/nginx/conf.d/requester.conf
fi

mkdir -p /var/log/nginx/
touch /var/log/nginx/access.log
touch /var/log/nginx/error.log
openresty -g 'daemon off;' &


# Start PM2 and the Node.js app
cd /app/dist
# Start Nginx and Node.js app using PM2
pm2 start "tail -f /var/log/nginx/access.log -f /var/log/nginx/error.log -f" --name nginx
pm2 start /app/dist/index.js --name node-app --no-autorestart

# Keep the container running
pm2 log
