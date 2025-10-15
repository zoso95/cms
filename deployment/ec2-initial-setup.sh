#!/bin/bash

# EC2 Initial Setup Script
# Run this on a fresh Ubuntu 22.04 EC2 instance
# Usage: bash ec2-initial-setup.sh your-domain.com your-email@example.com

set -e  # Exit on error

DOMAIN=$1
EMAIL=$2

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo "Usage: bash ec2-initial-setup.sh your-domain.com your-email@example.com"
    exit 1
fi

echo "=================================================="
echo "Starting EC2 setup for domain: $DOMAIN"
echo "=================================================="

# Update system
echo "Updating system packages..."
sudo apt update
sudo apt upgrade -y

# Install Docker
echo "Installing Docker..."
sudo apt install -y ca-certificates curl gnupg lsb-release
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add current user to docker group
echo "Adding user to docker group..."
sudo usermod -aG docker $USER

# Install Docker Compose
echo "Installing Docker Compose..."
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Certbot for SSL
echo "Installing Certbot..."
sudo apt install -y certbot

# Create SSL directory
echo "Creating SSL directory..."
sudo mkdir -p ~/cms/ssl

# Stop any services using port 80
echo "Stopping services on port 80..."
sudo systemctl stop nginx 2>/dev/null || true
sudo systemctl stop apache2 2>/dev/null || true

# Obtain SSL certificate
echo "Obtaining SSL certificate from Let's Encrypt..."
sudo certbot certonly --standalone \
    -d $DOMAIN \
    --non-interactive \
    --agree-tos \
    --email $EMAIL \
    --preferred-challenges http

# Copy certificates to cms/ssl directory
echo "Copying SSL certificates..."
sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem ~/cms/ssl/
sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem ~/cms/ssl/
sudo chown -R $USER:$USER ~/cms/ssl

# Set up certificate renewal cron job
echo "Setting up automatic SSL renewal..."
(sudo crontab -l 2>/dev/null; echo "0 0 1 * * certbot renew --quiet && cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem ~/cms/ssl/ && cp /etc/letsencrypt/live/$DOMAIN/privkey.pem ~/cms/ssl/ && cd ~/cms && docker-compose -f docker-compose.production.yml restart nginx") | sudo crontab -

# Create cms directory structure
echo "Creating directory structure..."
mkdir -p ~/cms/frontend
mkdir -p ~/cms/backend
mkdir -p ~/cms/worker

# Install Node.js (for building frontend locally if needed)
echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Configure firewall
echo "Configuring firewall..."
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8233/tcp
sudo ufw --force enable

echo "=================================================="
echo "EC2 setup complete!"
echo "=================================================="
echo ""
echo "Next steps:"
echo "1. Log out and back in for Docker group membership to take effect"
echo "2. Upload your code to ~/cms/"
echo "3. Create .env.production files in backend/ and worker/"
echo "4. Build frontend with production env vars"
echo "5. Run: docker-compose -f docker-compose.production.yml up -d"
echo ""
echo "SSL certificates installed for: $DOMAIN"
echo "Certificates will auto-renew on the 1st of each month"
