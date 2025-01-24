# Define variables
$imageName = "mesh-router"
$containerName = "mesh-router-localhost"
$dockerfilePath = "../.."
$originalPath = Get-Location

# Change to the Dockerfile directory
Push-Location $dockerfilePath

try {
    # Build the Docker image
    Write-Host "Building the Docker image..."
    docker build -t $imageName .

    if ($LASTEXITCODE -ne 0) {
        throw "Docker build failed. Exiting."
    }

    # Check if a container with the same name is already running
    Write-Host "Checking for existing container..."
    $existingContainer = docker ps -aq --filter "name=$containerName"

    if ($existingContainer) {
        Write-Host "Stopping and removing existing container..."
        docker stop $containerName
        docker rm $containerName

        if ($LASTEXITCODE -ne 0) {
            throw "Failed to stop and remove existing container. Exiting."
        }
    }

    # Run the Docker container
    Write-Host "Running the Docker container..."
    #provider network is used locally so we can get an host name to resolve from inside the container (in prod it will just be the domain)
    docker run -d `
    --cap-add NET_ADMIN `
    -e PROVIDER="http://dprovider" `
    -e DEFAULT_HOST="casaos" `
    -e DEFAULT_HOST_PORT="8080" `
    --network meta `
    --network provider `
    --name $containerName $imageName

    if ($LASTEXITCODE -ne 0) {
        throw "Docker run failed. Exiting."
    }

    Write-Host "Docker container $containerName is up and running."
}
catch {
    Write-Host $_
    exit $LASTEXITCODE
}
finally {
    # Ensure to return to the original path
    Pop-Location
}
