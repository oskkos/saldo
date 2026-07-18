# Use an official Node runtime as the base image
FROM node:24-alpine

# Set the working directory in the container to /app
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY ./prisma ./prisma
COPY package*.json ./

# Install any needed packages specified in package.json
RUN npm install

# Bundle app source inside the Docker image
COPY . .

# npm install ran as root above, so /app (and the node_modules that seeds the
# anonymous volume) is root-owned. The compose service runs as the built-in
# `node` user (UID/GID 1000); give it ownership so it can write node_modules.
RUN chown -R node:node /app

# Start the application
CMD ["npm", "run", "dev"]
