local http = require "resty.http"
local config = dofile("/etc/nginx/lua/config.lua")

local host = ngx.var.host
local uri = ngx.var.request_uri  -- Get the full request URI
local full_url = host .. uri  -- Concatenate host and URI for full URL processing

-- Attempt to retrieve the cached backend IP
-- local backend_ip = cache:get(host)
-- if backend_ip then
--     ngx.var.backend = backend_ip
--     return
-- end

-- Access the static map
local backend_url = config.override[full_url]
if backend_url then
    ngx.var.backend = backend_url
    return
end

local httpc = http.new()
local res, err = httpc:request_uri("http://127.0.0.1:3000/api/get_ip/" .. host, {
    method = "GET",
    headers = {
        ["Content-Type"] = "application/json",
    }
})

if not res then
    ngx.log(ngx.ERR, "Failed to request: " .. (err or "unknown error"))
    ngx.var.backend = config.default
    -- ngx.exit(542)
    return
end

if res.status == ngx.HTTP_OK then
    -- format http://127.0.0.1:80
    -- cache:set(host, res.body, 60)  -- Cache the IP for 60 seconds
    ngx.var.backend = res.body
else
    ngx.log(ngx.ERR, "Failed to get an IP for host: " .. host)
    ngx.var.backend = config.default
    -- ngx.exit(543)
    return
end
