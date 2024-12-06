# Use Alpine as the base image with OpenResty
FROM openresty/openresty:alpine

# Install dependencies using apk
RUN apk add --no-cache \
    gettext \
    openssl \
    curl \
    wget \
    wireguard-tools \
    iproute2 \
    iptables \
    iputils \
    git \
    make \
    nodejs \
    npm

# Set up Yarn Modern (Yarn 2/Berry) and PM2
RUN npm install -g corepack pm2 && \
    corepack enable

# Install lua-resty-http
COPY ./nginx/lua-resty-http/* /usr/local/openresty/lualib/resty/

WORKDIR /app

# Copy package and yarn config
COPY ./package.json ./
#COPY ./.yarnrc.yml ./
RUN yarn install

# Copy the source and config files
COPY ./src ./src
COPY ./tsconfig.json ./
RUN yarn build

# Copy the default Nginx configuration files
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/provider/provider.template.conf /etc/nginx/conf.d/provider.conf.template
COPY nginx/requester/requester.template.conf /etc/nginx/conf.d/requester.conf.template
COPY nginx/compute_ip.lua /etc/nginx/lua/compute_ip.lua
COPY nginx/route.lua /etc/nginx/lua/route.lua
COPY nginx/config.lua /etc/nginx/lua/config.lua
RUN rm /etc/nginx/conf.d/default.conf

# Copy the HTML for the provider and requester
COPY nginx/provider/root/ /usr/share/nginx/html-provider/
COPY nginx/requester/root/ /usr/share/nginx/html-requester/

# Entrypoint script to run Certbot and start Nginx
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
