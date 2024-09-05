# Use the official nginx image as the base image
FROM openresty/openresty:latest

RUN apt-get update && \
    apt-get install -y gettext-base openssl curl wget && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Node.js (LTS version)
RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Set up Yarn Modern (Yarn 2/Berry)
RUN npm install -g corepack pm2 && \
    corepack enable && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# reference https://github.com/linuxserver/docker-wireguard/blob/master/Dockerfile
# install wireguard-go
RUN apt-get update && \
    apt-get install -y wireguard iproute2 iptables iputils-ping git make curl && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

#RUN curl -OL https://golang.org/dl/go1.18.3.linux-amd64.tar.gz && \
#    tar -C /usr/local -xzf go1.18.3.linux-amd64.tar.gz && \
#    rm go1.18.3.linux-amd64.tar.gz
#ENV PATH="/usr/local/go/bin:${PATH}"

#RUN git clone https://git.zx2c4.com/wireguard-go && \
#    cd wireguard-go && \
#    make && \
#    make install

# Install lua-resty-http
COPY ./nginx/lua-resty-http/* /usr/local/openresty/lualib/resty/

WORKDIR /app

COPY ./package.json ./
COPY ./.yarnrc.yml ./
RUN yarn install

COPY ./src ./src
COPY ./tsconfig.json ./
RUN yarn build

# Copy the default Nginx configuration file and the HTML file to the container
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/provider/provider.template.conf /etc/nginx/conf.d/provider.conf.template
COPY nginx/requester/requester.template.conf /etc/nginx/conf.d/requester.conf.template
COPY nginx/compute_ip.lua /etc/nginx/lua/compute_ip.lua
COPY nginx/route.lua /etc/nginx/lua/route.lua
COPY nginx/config.lua /etc/nginx/lua/config.lua
RUN rm /etc/nginx/conf.d/default.conf

COPY nginx/provider/root/ /usr/share/nginx/html-provider/
COPY nginx/requester/root/ /usr/share/nginx/html-requester/

# Entrypoint script to run Certbot and start Nginx
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
