local config = {}

config.override = {
    ["example.localhost"] = "http://127.0.0.2:80"
}

config.default = "http://127.0.0.1:3000"

return config