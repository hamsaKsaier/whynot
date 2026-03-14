# Deployment Guide

This guide covers deploying WhyNot to production environments.

## Prerequisites

- Docker and Docker Compose installed
- PostgreSQL 15+ (or use the included database service)
- Node.js 20+ (for local development)
- OpenAI or Anthropic API key

## Production Deployment

### 1. Environment Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Update the following critical values:

```env
NODE_ENV=production
POSTGRES_PASSWORD=<strong-password>
OPENAI_API_KEY=<your-api-key>
DATABASE_URL=postgresql://thundercode:<password>@database:5432/thundercode
```

### 2. Database Setup

The database service will automatically run migrations on first startup. The migration file is located at:
- `services/database/migrations/001_initial_schema.sql`

To manually run migrations:

```bash
docker compose exec database psql -U thundercode -d thundercode -f /docker-entrypoint-initdb.d/001_initial_schema.sql
```

### 3. Build and Start Services

```bash
docker compose build
docker compose up -d
```

### 4. Verify Deployment

Check service health:

```bash
# Gateway
curl http://localhost:3000/health

# Test Executor
curl http://localhost:3001/health

# AI Service
curl http://localhost:8000/health
```

### 5. Production Considerations

#### Security

- Change all default passwords
- Use strong database passwords
- Enable HTTPS (use a reverse proxy like Nginx)
- Configure firewall rules
- Review and adjust CORS settings
- Set appropriate rate limits

#### Performance

- Adjust database connection pool size in `shared/database/connection.ts`
- Configure appropriate resource limits in `docker-compose.yml`
- Set up database backups
- Monitor disk usage for screenshots

#### Monitoring

- Set up log aggregation (ELK, Loki, etc.)
- Configure metrics collection (Prometheus, etc.)
- Set up alerts for service health
- Monitor database performance

#### Scaling

For horizontal scaling:

1. **Gateway**: Can be scaled behind a load balancer
2. **Test Executor**: Scale based on test execution load
3. **AI Service**: Scale based on generation requests
4. **Database**: Use read replicas for query scaling

Example docker-compose scaling:

```bash
docker compose up -d --scale gateway=3 --scale test-executor=5
```

## Reverse Proxy Setup (Nginx)

Example Nginx configuration:

```nginx
upstream gateway {
    server gateway:3000;
}

server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://gateway;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## Database Backups

Set up automated backups:

```bash
# Backup script
docker compose exec database pg_dump -U thundercode thundercode > backup_$(date +%Y%m%d).sql

# Restore
docker compose exec -T database psql -U thundercode thundercode < backup_20240101.sql
```

## Health Checks

All services expose health check endpoints:

- Gateway: `GET /health`
- Test Executor: `GET /health`
- AI Service: `GET /health`

Health checks include dependency status and can be used for load balancer health checks.

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues and solutions.

























