#!/bin/sh

# In Alpine's ash shell, $UID is automatically set to the effective user ID (0 for root),
# which overrides the environment variable passed from Docker.
# To get the actual environment variable, we extract it from 'env'.
ENV_UID=$(env | grep '^UID=' | cut -d= -f2)
ENV_GID=$(env | grep '^GID=' | cut -d= -f2)

# Fallback to 1000 if not set
USER_ID=${ENV_UID:-1000}
GROUP_ID=${ENV_GID:-1000}

echo "Configuring user 'node' with UID: $USER_ID, GID: $GROUP_ID"

# Update the 'node' user and group with the specified UID/GID
groupmod -o -g "$GROUP_ID" node
usermod -o -u "$USER_ID" node

# Ensure the data directory exists and is owned by the user
mkdir -p /app/data
chown -R node:node /app/data

# Execute the command as the 'node' user
exec su-exec node "$@"
