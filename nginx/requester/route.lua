-- use that to test https://www.mycompiler.io/view/EqT3B2yvRtF

local function extract_parts(ua, domain_pattern)
    -- Replace hyphens with dots
    ua = ua:gsub("%-", ".")

    -- Split the ua string by dots to examine each part
    local parts = {}
    for part in ua:gmatch("[^.]+") do
        table.insert(parts, part)
    end

    local domain, name, service, port

    -- Identify the domain based on the domain_pattern
    for i = #parts, 1, -1 do
        local potential_domain = table.concat(parts, ".", i)
        if potential_domain:find(domain_pattern, 1, true) then
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

local function read_str_from_file(file_path)
    -- local params = ngx.shared.params_meta -- Params shared cache
    -- local cached_content = params:get(file_path)
    -- if cached_content then
    --     return cached_content
    -- end

    local file, err = io.open(file_path, "r")
    if not file then
        ngx.log(ngx.ERR, "Failed to open file: ", err)
        return nil
    end

    local content = file:read("*a") -- Read the entire content of the file
    file:close()

    -- Save the content to the cache before returning it
    -- params:set(file_path, content)

    return content
end

local function set_backend()
    local host = ngx.var.host
    local domain_pattern = read_str_from_file("/var/run/meta/domain")
    if not domain_pattern then
        ngx.log(ngx.ERR, "Domain pattern is nil, using default value")
    end

    local port, service, name = extract_parts(host, domain_pattern)

    if not service then
        local default_host = read_str_from_file("/var/run/meta/default_host")
        local default_port = read_str_from_file("/var/run/meta/default_host_port")
        service = default_host
        port = default_port
    end

    if not port then
        port = 80
    end

    ngx.var.backend = "http://" .. service .. ":" .. port
    -- ngx.log(ngx.NOTICE, "solved: http://" .. service .. ":" .. port)
    -- ngx.log(ngx.ERR, "solved: http://" .. service .. ":" .. port)
end

set_backend()
