# Docker Container Name Conflict - Quick Fix Guide

## Problem
You're seeing this error:
```
Error response from daemon: Conflict. The container name "/medai-postgres" is already in use by container "3b401fab9c2a..."
```

This happens when a Docker container from a previous run wasn't properly stopped and removed.

## Quick Solution

### Option 1: Run the Cleanup Script (Recommended)

**On Windows:**
```bash
docker-cleanup.bat
```

**On Linux/Mac:**
```bash
chmod +x docker-cleanup.sh
./docker-cleanup.sh
```

Then rebuild:
```bash
docker-compose up --build
```

### Option 2: Run the Complete Rebuild Script

This script does everything automatically (cleanup + rebuild):

**On Windows:**
```bash
docker-rebuild.bat
```

**On Linux/Mac:**
```bash
chmod +x docker-rebuild.sh
./docker-rebuild.sh
```

### Option 3: Manual Commands

If you prefer to run commands manually:

```bash
# Stop all containers
docker-compose down

# Remove the conflicting container
docker rm -f medai-postgres

# Remove any other conflicting containers
docker rm -f corpusmedica-ollama-1

# Rebuild and start
docker-compose up --build
```

## Additional Troubleshooting

### If containers are still running:
```bash
# Stop all running containers
docker stop $(docker ps -q)

# Remove all stopped containers
docker rm $(docker ps -a -q)
```

### If you want a completely fresh start:
```bash
# WARNING: This removes ALL containers, images, and volumes
docker system prune -a --volumes
```

### View running containers:
```bash
docker ps -a
```

### View logs:
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f postgres
docker-compose logs -f backend
```

## Best Practices

1. **Always use `docker-compose down` before rebuilding:**
   ```bash
   docker-compose down
   docker-compose up --build
   ```

2. **Check for running containers before starting:**
   ```bash
   docker ps -a | grep medai
   ```

3. **Use the cleanup script regularly** to avoid conflicts

## Understanding the Error

The container name `/medai-postgres` is defined in your `docker-compose.yml` file:
```yaml
db:
  image: postgres:15
  container_name: medai-postgres  # This name must be unique
```

Docker doesn't allow two containers with the same name, even if one is stopped. The cleanup script removes the old container so Docker can create a new one with the same name.

## Files Created

- `docker-cleanup.bat` / `docker-cleanup.sh` - Quick cleanup script
- `docker-rebuild.bat` / `docker-rebuild.sh` - Complete rebuild script
- `DOCKER_FIX_README.md` - This guide
