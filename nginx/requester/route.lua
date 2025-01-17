-- use that to test https://www.mycompiler.io/view/EqT3B2yvRtF
local cjson = require("cjson.safe")

local function extract_parts(ua, domain_configs)
    -- Replace hyphens with dots
    ua = ua:gsub("%-", ".")

    -- Split the ua string by dots to examine each part
    local parts = {}
    for part in ua:gmatch("[^.]+") do
        table.insert(parts, part)
    end

    local domain, name, service, port

    -- Identify the domain by checking against all configured domains
    for i = #parts, 1, -1 do
        local potential_domain = table.concat(parts, ".", i)
        -- Check if this domain exists in our config
        if domain_configs[potential_domain] then
            domain = potential_domain
            if i > 1 then
                name = parts[i - 1]
            end
            if i > 2 then
                service = parts[i - 2]
            end
            if i > 3 and tonumber(parts[i - 3]) then
                port = parts[i - 3]
            end
            break
        end
    end

    return port, service, name, domain
end

local function read_json_from_file(file_path)
    local file, err = io.open(file_path, "r")
    if not file then
        ngx.log(ngx.ERR, "Failed to open config file: ", err)
        return nil
    end

    local content = file:read("*a")
    file:close()

    local decoded, err = cjson.decode(content)
    if not decoded then
        ngx.log(ngx.ERR, "Failed to decode JSON: ", err)
        return nil
    end

    return decoded
end

local function get_service_default_port(service)
    local service_config = read_json_from_file("/var/run/meta/" .. service .. ".json")
    if service_config and service_config.defaultPort then
        return tonumber(service_config.defaultPort)
    end
    return 80
end

local function set_backend()
    local host = ngx.var.host
    local domain_configs = read_json_from_file("/var/run/meta/config.json")
    if not domain_configs then
        ngx.log(ngx.ERR, "Domain configs not found")
    end

    local port, service, name, domain = extract_parts(host, domain_configs)

    if not service then
        -- If domain is found in config, use its default service
        if domain and domain_configs[domain] then
            service = domain_configs[domain].defaultService
        else
            -- Fallback to default service
            service = "default"
        end
    end

    if not port then
        -- Try to get default port from service config
        port = get_service_default_port(service)
    end

    ngx.var.backend = "http://" .. service .. ":" .. port
end

set_backend()