# BlockBot Deployment Guide

This guide covers deploying BlockBot to a VPS with Docker Compose and Traefik for automatic SSL.

## Requirements

### Server Requirements
- Ubuntu 22.04+ or Debian 12+ (recommended)
- 2GB RAM minimum (4GB recommended)
- 20GB storage
- Docker and Docker Compose installed
- Domain name pointing to server IP

### Prerequisites
```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose (if not included)
sudo apt install docker-compose-plugin

# Add user to docker group (logout/login required)
sudo usermod -aG docker $USER
```

## Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/blockbot.git
cd blockbot
```

### 2. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` with your production values:
```bash
# Required - Database
POSTGRES_PASSWORD=generate-secure-password-here

# Required - Authentication
JWT_SECRET=generate-32-char-minimum-secret
JWT_REFRESH_SECRET=generate-another-32-char-secret

# Required - Email (get from https://resend.com)
RESEND_API_KEY=re_your_api_key

# Required - Domain
DOMAIN=api.yourdomain.com
ACME_EMAIL=admin@yourdomain.com
```

Generate secure secrets:
```bash
# Generate JWT secrets
openssl rand -base64 32
openssl rand -base64 32

# Generate PostgreSQL password
openssl rand -base64 24
```

### 3. Deploy
```bash
docker compose -f docker-compose.prod.yml up -d
```

### 4. Run Migrations
```bash
docker compose -f docker-compose.prod.yml exec api bun run db:migrate
```

### 5. Verify Deployment
```bash
# Check all services are running
docker compose -f docker-compose.prod.yml ps

# Check API health
curl https://your-domain.com/health

# Check detailed health (database + redis)
curl https://your-domain.com/api/v1/health
```

## Configuration Reference

### Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `POSTGRES_PASSWORD` | Yes | PostgreSQL password | `secure-random-string` |
| `JWT_SECRET` | Yes | JWT signing secret (32+ chars) | `openssl rand -base64 32` |
| `JWT_REFRESH_SECRET` | Yes | Refresh token secret (32+ chars) | `openssl rand -base64 32` |
| `RESEND_API_KEY` | Yes | Resend.com API key | `re_xxxxx` |
| `DOMAIN` | Yes | API domain (no https://) | `api.example.com` |
| `ACME_EMAIL` | Yes | Let's Encrypt email | `admin@example.com` |
| `NODE_ENV` | No | Environment | `production` |
| `PORT` | No | Internal port | `3000` |

### Service Architecture

```
                    ┌─────────────┐
                    │   Traefik   │
                    │  (SSL/LB)   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
         ┌────────┐  ┌──────────┐  ┌────────┐
         │ API    │  │ Postgres │  │ Redis  │
         │ (Bun)  │──│   (DB)   │  │(Cache) │
         └────────┘  └──────────┘  └────────┘
```

### Network Configuration

- **Port 80**: HTTP (redirects to HTTPS)
- **Port 443**: HTTPS (Traefik)
- **Internal**: Services communicate on Docker network

Firewall setup:
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp  # SSH
sudo ufw enable
```

## Operations

### View Logs
```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f postgres
docker compose -f docker-compose.prod.yml logs -f traefik
```

### Restart Services
```bash
# Restart all
docker compose -f docker-compose.prod.yml restart

# Restart specific service
docker compose -f docker-compose.prod.yml restart api
```

### Update Application
```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker compose -f docker-compose.prod.yml up -d --build

# Run migrations if needed
docker compose -f docker-compose.prod.yml exec api bun run db:migrate
```

### Database Operations

**Backup:**
```bash
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U blockbot blockbot > backup-$(date +%Y%m%d).sql
```

**Restore:**
```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U blockbot blockbot < backup-20240101.sql
```

**Access PostgreSQL:**
```bash
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U blockbot blockbot
```

### Redis Operations

**Access Redis CLI:**
```bash
docker compose -f docker-compose.prod.yml exec redis redis-cli
```

**Clear rate limit data:**
```bash
docker compose -f docker-compose.prod.yml exec redis \
  redis-cli KEYS "ratelimit:*" | xargs redis-cli DEL
```

## Monitoring

### Health Endpoints

| Endpoint | Purpose | Response |
|----------|---------|----------|
| `/health` | Basic liveness | `{"status":"ok"}` |
| `/api/v1/health` | Detailed status | DB + Redis status with latency |
| `/api/v1/health/live` | Kubernetes liveness | `{"status":"ok"}` |
| `/api/v1/health/ready` | Kubernetes readiness | 200 if dependencies up |

### Monitoring with Healthchecks.io (Optional)

Add to crontab:
```bash
*/5 * * * * curl -fsS --retry 3 https://hc-ping.com/your-uuid > /dev/null
```

### Log Aggregation (Optional)

Logs are JSON-formatted. Send to external service:
```bash
# Example: tail logs to stdout for external collector
docker compose -f docker-compose.prod.yml logs -f --no-log-prefix api | \
  your-log-shipper
```

## Troubleshooting

### SSL Certificate Issues

**Symptoms:** HTTPS not working, certificate errors

**Solutions:**
1. Verify domain DNS is pointing to server
2. Check Traefik logs: `docker compose -f docker-compose.prod.yml logs traefik`
3. Ensure ports 80/443 are open
4. Let's Encrypt rate limits: wait 1 hour if exceeded

**Reset certificates:**
```bash
docker compose -f docker-compose.prod.yml down
docker volume rm blockbot_letsencrypt
docker compose -f docker-compose.prod.yml up -d
```

### Database Connection Errors

**Symptoms:** API returns 503, health check shows database unhealthy

**Solutions:**
1. Check PostgreSQL is running: `docker compose -f docker-compose.prod.yml ps postgres`
2. View PostgreSQL logs: `docker compose -f docker-compose.prod.yml logs postgres`
3. Verify `POSTGRES_PASSWORD` matches in `.env`
4. Check disk space: `df -h`

### Redis Connection Errors

**Symptoms:** Rate limiting not working, health check shows redis unhealthy

**Solutions:**
1. Check Redis is running: `docker compose -f docker-compose.prod.yml ps redis`
2. View Redis logs: `docker compose -f docker-compose.prod.yml logs redis`
3. Test connection: `docker compose -f docker-compose.prod.yml exec redis redis-cli ping`

### API Not Starting

**Symptoms:** Container keeps restarting, 502 errors

**Solutions:**
1. Check API logs: `docker compose -f docker-compose.prod.yml logs api`
2. Verify all environment variables are set
3. Ensure database migrations have run
4. Check memory: `free -m`

### High Memory Usage

**Symptoms:** Slow response times, OOM kills

**Solutions:**
1. Check memory: `docker stats`
2. Add swap space:
   ```bash
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```
3. Restart services to clear memory: `docker compose -f docker-compose.prod.yml restart`

## Security Checklist

- [ ] Strong passwords generated for all secrets
- [ ] Firewall configured (UFW or iptables)
- [ ] SSH key authentication enabled, password disabled
- [ ] Regular backups configured
- [ ] Fail2ban installed for SSH protection
- [ ] Server updates automated (`unattended-upgrades`)

## Scaling (Future)

For horizontal scaling, consider:
- Load balancer in front of multiple API instances
- Managed PostgreSQL (RDS, Cloud SQL)
- Managed Redis (ElastiCache, Redis Cloud)
- Container orchestration (Docker Swarm, Kubernetes)
