# Use the official Node.js LTS image
FROM node:lts

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the application code
COPY . .

# Specify the command to run your application
CMD ["npm", "start"]
