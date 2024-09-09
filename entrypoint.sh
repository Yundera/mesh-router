#!/bin/bash

set -e

#######################
# Start WireGuard
#######################

if [ -n "${PROVIDER_ANNONCE_DOMAIN+x}" ]; then
  echo "PROVIDER_ANNONCE_DOMAIN is set to '$PROVIDER_ANNONCE_DOMAIN'"
  ##########################
  # provider configuration
  ##########################
  # activate the configuration
  envsubst '${PROVIDER_ANNONCE_DOMAIN}' < /etc/nginx/conf.d/provider.conf.template > /etc/nginx/conf.d/provider.conf

  # Generate server private and public keys if they do not exist
  if [ ! -f /etc/wireguard/server_private.key ]; then
    wg genkey | tee /etc/wireguard/server_private.key | wg pubkey > /etc/wireguard/server_public.key
  fi

  SERVER_WG_PRIVATE_KEY=$(cat /etc/wireguard/server_private.key)
  export SERVER_WG_PUBLIC_KEY=$(cat /etc/wireguard/server_public.key)


  SERVER_WG_PRIVATE_KEY=oFzpG3+yTtRGtD0CKd9lzaYtnDVbiR/emGv1Gny7+3g=
  export SERVER_WG_PUBLIC_KEY=mnluKQZliNKHHV5cJHf3Mm4st4KIb7F+D/uH11wunlY=

  echo "public key: $SERVER_WG_PUBLIC_KEY"

  # Check if wg0.conf exists and is not empty
  if [ ! -s /etc/wireguard/wg0.conf ]; then
    echo "Creating WireGuard configuration..."

    cat <<EOF > /etc/wireguard/wg0.conf
[Interface]
Address = 10.16.0.1/16
SaveConfig = true
ListenPort = 51820
PrivateKey = ${SERVER_WG_PRIVATE_KEY}

PostUp = iptables -t nat -A POSTROUTING -s 10.16.0.0/16 -o \$(ip route | grep default | awk '{print \$5}') -j MASQUERADE; iptables -A INPUT -p udp -m udp --dport 51820 -j ACCEPT; iptables -A FORWARD -i wg0 -j ACCEPT; iptables -A FORWARD -o wg0 -j ACCEPT;
PostDown = iptables -t nat -D POSTROUTING -s 10.16.0.0/16 -o \$(ip route | grep default | awk '{print \$5}') -j MASQUERADE; iptables -D INPUT -p udp -m udp --dport 51820 -j ACCEPT; iptables -D FORWARD -i wg0 -j ACCEPT; iptables -D FORWARD -o wg0 -j ACCEPT;
EOF

  else
    echo "WireGuard configuration already exists and is not empty."
  fi

  wg-quick up wg0
fi

if [ -n "${PROVIDER+x}" ]; then
  ##########################
  # Requester configuration
  ##########################
  # a provider is provided so it's a requester
  envsubst '${PROVIDER},${DEFAULT_HOST},${DEFAULT_HOST_PORT}' < /etc/nginx/conf.d/requester.conf.template > /etc/nginx/conf.d/requester.conf
fi


#######################
# Start OpenResty/nginx and node
#######################
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
