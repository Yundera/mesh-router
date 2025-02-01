local config = {}


config.override = {
    --[[
    ["example.localhost/abc"] = "http://gateway:80",
    ["example.localhost/api/ping"] = "http://127.0.0.1:3000",
    ["example.localhost/api/register"] = "http://127.0.0.1:3000"
    ]]
}

config.default = "http://127.0.0.1:3000"

return config