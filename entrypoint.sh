#!/bin/bash

set -e


#######################
# Start OpenResty/nginx
#######################
if [ -n "${PROVIDER_ANNONCE_DOMAIN+x}" ]; then
  ##########################
  # Provider configuration
  ##########################
  cp /etc/nginx/conf.d/provider.conf.template /etc/nginx/conf.d/provider.conf
else
  ##########################
  # Requester configuration
  ##########################
  cp /etc/nginx/conf.d/requester.conf.template /etc/nginx/conf.d/requester.conf
fi

mkdir -p /var/log/nginx/
touch /var/log/nginx/access.log
touch /var/log/nginx/error.log
openresty -g 'daemon off;' &

#######################
# Start Node app with PM2
#######################

# Start PM2 and the Node.js app
cd /app/dist
# Start Nginx and Node.js app using PM2
pm2 start "tail -f /var/log/nginx/access.log -f /var/log/nginx/error.log -f" --name nginx
pm2 start /app/dist/index.js --name node-app --no-autorestart

# Keep the container running
pm2 log
