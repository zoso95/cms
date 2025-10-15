# EC2 and DNS Setup

This guide covers setting up your AWS EC2 instance and configuring DNS to point to it.

## Step 1: Launch EC2 Instance

### Instance Configuration

1. Go to AWS Console → EC2 → Launch Instance
2. Configure:
   - **Name**: `afterimage-cms-production`
   - **AMI**: Ubuntu Server 22.04 LTS (64-bit x86)
   - **Instance type**: `t3.large` or larger (2 vCPU, 8GB RAM minimum)
     - Temporal needs memory, don't go smaller than t3.large
   - **Key pair**: Create or select SSH key pair
   - **Storage**: 30 GB gp3 (or larger)

### Security Group

Create security group with these inbound rules:

| Type  | Port  | Source    | Description                    |
|-------|-------|-----------|--------------------------------|
| SSH   | 22    | Your IP   | SSH access                     |
| HTTP  | 80    | 0.0.0.0/0 | HTTP (redirects to HTTPS)      |
| HTTPS | 443   | 0.0.0.0/0 | HTTPS                          |
| Custom| 8233  | 0.0.0.0/0 | Temporal UI (optional: lock down) |

**Security Note**: Consider restricting SSH (port 22) to your IP only, not 0.0.0.0/0.

3. Click **Launch Instance**

## Step 2: Allocate Elastic IP

An Elastic IP ensures your instance keeps the same IP address even after reboots.

1. Go to AWS Console → EC2 → Elastic IPs
2. Click **Allocate Elastic IP address**
3. Click **Allocate**
4. Select the newly created Elastic IP
5. Click **Actions** → **Associate Elastic IP address**
6. Select your EC2 instance
7. Click **Associate**

**Note your Elastic IP** (e.g., `54.123.45.67`) - you'll need this for DNS.

## Step 3: Test SSH Connection

```bash
ssh -i /path/to/your-key.pem ubuntu@YOUR_ELASTIC_IP
```

If this works, you're ready to configure DNS!

## Step 4: Configure Cloudflare DNS

### Prerequisites
- A domain managed by Cloudflare
- Access to your Cloudflare account

### Add A Record for Root Domain

1. Log into Cloudflare
2. Select your domain
3. Go to **DNS** → **Records**
4. Click **Add record**

Configure:
- **Type**: `A`
- **Name**: `@` (or leave blank for root domain)
- **IPv4 address**: Your Elastic IP (e.g., `54.123.45.67`)
- **Proxy status**: ⚠️ **DNS only** (gray cloud icon) - NOT proxied
- **TTL**: Auto
- Click **Save**

### Add A Record for www (Optional)

Repeat above with:
- **Name**: `www`
- Same IP and settings

### Why "DNS only" (Gray Cloud)?

⚠️ **IMPORTANT**: Use "DNS only", NOT "Proxied" (orange cloud)

Reasons:
- Proxied mode routes traffic through Cloudflare's servers
- This breaks SSL certificate validation for Let's Encrypt
- We're handling SSL directly on the EC2 instance with Certbot

You can enable Cloudflare proxy later after SSL is set up, but initial setup MUST be "DNS only".

## Step 5: Verify DNS Propagation

Check if DNS is working:

```bash
# From your local machine
dig your-domain.com

# Look for your Elastic IP in the response
```

Or use online tool: https://dnschecker.org/

DNS propagation typically takes **5-60 minutes**.

## Step 6: Test SSH via Domain

Once DNS propagates, test SSH using your domain:

```bash
ssh -i /path/to/your-key.pem ubuntu@your-domain.com
```

If this works, DNS is properly configured!

## Troubleshooting

### DNS not resolving after 1 hour
- Check that A record points to correct Elastic IP
- Ensure proxy status is "DNS only" (gray cloud)
- Clear your local DNS cache:
  - macOS: `sudo dscacheutil -flushcache`
  - Windows: `ipconfig /flushdns`
  - Linux: `sudo systemd-resolve --flush-caches`

### Can't SSH to domain but can SSH to IP
- DNS hasn't propagated yet, wait longer
- Try from a different network or use mobile hotspot

### Security group issues
- Ensure inbound rule for port 22 allows your IP
- Check that instance is in correct security group

## Next Steps

Once DNS is working, proceed to:
- `02-initial-deployment.md` - Deploy your application
