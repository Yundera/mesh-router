local cjson = require("cjson.safe")

--[[
    Extracts port and service information from a URL subdomain (hyphens and dots are interchangeable).

    This function parses URLs in the following formats:
    - with domain_root = dev.test.localhost
    - http://dev.test.localhost/#/login (default service, default port)
    - http://casaos-dev.test.localhost/#/login (casaos service, default port)
    - http://8080-casaos-dev.test.localhost/#/login (custom port)

    @param hostname string: The hostname to parse (e.g., "8080-casaos-dev.test.localhost")
    @param domain_root string: The root domain to match against (e.g., "test.localhost")
    @return port string|nil: The port number if found
    @return service string|nil: The service name if found
]]
local function extract_parts(ua, domain_root)
    -- Replace hyphens with dots
    ua = ua:gsub("%-", ".")

    -- Split the ua string by dots to examine each part
    local parts = {}
    for part in ua:gmatch("[^.]+") do
        table.insert(parts, part)
    end

    local domain, service, port

    -- Identify the domain based on the domain_pattern
    for i = #parts, 1, -1 do
        local potential_domain = table.concat(parts, ".", i)
        if potential_domain:find(domain_root, 1, true) then
            domain = potential_domain
            if i > 1 then
                service = parts[i - 1]
            end
            if i > 2 and tonumber(parts[i - 2]) then
                port = parts[i - 2]
            end
            break
        end
    end

    return port, service
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

local function does_host_match_domain(host, domain)
    -- Convert host and domain to lowercase for case-insensitive comparison
    host = host:lower()
    domain = domain:lower()

    -- Replace hyphens with dots in the host
    host = host:gsub("%-", ".")

    -- Check if the host ends with the domain
    return host:sub(-#domain) == domain
end

--[[
    Sets the backend URL based on the host and domain configuration.
    Expected config.json structure:
    {
        "domain": [
            "dev.test.localhost",
            "other.domain"
        ],
        "config": {
            "dev.test.localhost": {
                "defaultService": "casaos"
            },
            "other.domain": {
                "defaultService": "service2"
            }
        }
    }
]]
local function set_backend()
    local host = ngx.var.host

    local domain_data = read_json_from_file("/var/run/meta/config.json")
    if not domain_data then
        ngx.log(ngx.ERR, "Domain configs not found")
        ngx.var.backend = "http://default:80"
        return
    end

    -- Check if the data structure is valid
    if not domain_data.domain or not domain_data.config then
        ngx.log(ngx.ERR, "Invalid domain config structure")
        ngx.var.backend = "http://default:80"
        return
    end

    local matched_domain = nil
    local matched_config = nil

    -- Loop through domain array using numeric index
    for i = 1, #domain_data.domain do
        local domain = domain_data.domain[i]
        if does_host_match_domain(host, domain) then
            matched_domain = domain
            matched_config = domain_data.config[domain]
            break
        end
    end

    if matched_domain and matched_config then
        local port, service = extract_parts(host, matched_domain)

        if not service then
            -- Use default service from matched config
            service = matched_config.defaultService
        end

        if not port then
            -- Try to get default port from service config
            port = get_service_default_port(service)
        end

        ngx.var.backend = "http://" .. service .. ":" .. port
    else
        -- No domain match found, use default service
        ngx.var.backend = "http://default:80"
    end
end

set_backend()