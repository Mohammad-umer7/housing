# Deployment Guide - MOE Strategist

## Pre-Deployment Checklist

- [ ] All environment variables configured
- [ ] Dependencies installed and tested
- [ ] Build process completes without errors
- [ ] No console errors or warnings
- [ ] All features tested locally
- [ ] Database/API endpoints ready
- [ ] Authentication system implemented
- [ ] SSL certificate ready (HTTPS)
- [ ] Security headers configured
- [ ] Monitoring/logging setup

---

## Local Build Testing

### 1. Create Production Build
```bash
npm run build
```

Expected output:
```
> next build

✓ Compiled successfully
```

### 2. Test Production Build Locally
```bash
npm run start
```

Access: `http://localhost:3000`

### 3. Test in Different Browsers
- Chrome/Chromium
- Firefox
- Safari
- Edge

---

## Environment Variables

Create `.env.local` file:
```env
# API Configuration
NEXT_PUBLIC_API_URL=https://your-api.com/api
NEXT_PUBLIC_APP_NAME=MOE Strategist

# Feature Flags
NEXT_PUBLIC_ENABLE_DEMO_MODE=false

# Analytics (optional)
NEXT_PUBLIC_ANALYTICS_ID=your_id_here
```

---

## Deployment Options

### Option 1: Vercel (Recommended)

#### Prerequisites
- Vercel account (free tier available)
- GitHub repository

#### Steps
1. Push code to GitHub
2. Visit [vercel.com](https://vercel.com)
3. Click "New Project"
4. Import your GitHub repository
5. Configure environment variables
6. Click "Deploy"

#### Post-Deploy
```bash
# Vercel CLI (optional)
npm i -g vercel
vercel
```

---

### Option 2: Docker

#### Create Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
```

#### Build & Run
```bash
# Build image
docker build -t moe-strategist .

# Run container
docker run -p 3000:3000 moe-strategist
```

#### Docker Compose (with environment)
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://api:3001/api
    depends_on:
      - api

  api:
    image: your-api-image
    ports:
      - "3001:3001"
```

---

### Option 3: AWS (EC2)

#### Prerequisites
- AWS account
- EC2 instance (t2.micro or larger)
- Node.js 18+ installed

#### Deployment Steps
```bash
# SSH into instance
ssh -i your-key.pem ec2-user@your-instance-ip

# Clone repository
git clone your-repo.git
cd MOE\ Stratigest

# Install & build
npm install
npm run build

# Start with PM2 (recommended)
npm install -g pm2
pm2 start "npm run start" --name "moe-strategist"
pm2 save
pm2 startup
```

#### Configure Nginx
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

### Option 4: DigitalOcean (App Platform)

#### Steps
1. Visit DigitalOcean App Platform
2. Connect GitHub repository
3. Configure build settings:
   - Build Command: `npm run build`
   - Run Command: `npm run start`
4. Set environment variables
5. Deploy

---

### Option 5: Self-Hosted (VPS)

#### SSH Setup
```bash
ssh root@your-vps-ip

# Update system
apt update && apt upgrade -y

# Install Node.js
curl -sL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs

# Install PM2
npm install -g pm2

# Clone and deploy
git clone your-repo.git
cd MOE\ Stratigest
npm install
npm run build
pm2 start "npm run start"
```

#### SSL Certificate (Let's Encrypt)
```bash
apt install certbot python3-certbot-nginx
certbot certonly --standalone -d your-domain.com
```

---

## Performance Optimization

### Image Optimization
- Use Next.js `Image` component
- Optimize images before upload
- Configure CDN

### Caching Headers
```typescript
// next.config.js
module.exports = {
  headers: async () => {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600'
          }
        ]
      }
    ]
  }
}
```

### Database Connection Pooling
- Use connection pools for database
- Implement query caching
- Monitor connection usage

---

## Security Best Practices

### SSL/TLS
```bash
# Redirect HTTP to HTTPS
# Configure in server or .env
```

### Security Headers
```typescript
// next.config.js
module.exports = {
  headers: async () => {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          }
        ]
      }
    ]
  }
}
```

### Environment Variables
- Never commit `.env.local` to git
- Use secure secrets management
- Rotate credentials regularly

### Database Security
- Use strong passwords
- Enable SSL connections
- Regular backups
- Access control lists (ACLs)

---

## Monitoring & Logging

### Application Monitoring
- Set up error tracking (Sentry)
- Performance monitoring (New Relic)
- Analytics (Google Analytics, Mixpanel)

### Log Management
```bash
# View PM2 logs
pm2 logs moe-strategist

# Persistent logging
pm2 log-file > /var/log/moe-strategist.log
```

---

## Database Setup

### PostgreSQL
```sql
CREATE DATABASE moe_strategist;
CREATE USER admin WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE moe_strategist TO admin;
```

### MongoDB
```bash
# Connection string
mongodb+srv://user:password@cluster.mongodb.net/moe-strategist
```

---

## API Integration

### Required Endpoints
- `POST /api/auth/signin`
- `GET /api/countries`
- `GET /api/metrics`
- `POST /api/reports`

### Backend Documentation
See API.md for full endpoint specifications

---

## Rollback Procedure

### Vercel
1. Go to Deployments
2. Find previous successful deployment
3. Click "Redeploy"

### Docker
```bash
# Pull previous image version
docker pull your-registry/moe-strategist:v1.0.0

# Run previous version
docker run -p 3000:3000 your-registry/moe-strategist:v1.0.0
```

### PM2
```bash
# List saved apps
pm2 list

# Rollback to previous
git checkout previous-commit
npm run build
pm2 reload moe-strategist
```

---

## Troubleshooting Deployment

### Build Fails
```bash
# Clear cache
rm -rf .next node_modules
npm install
npm run build
```

### Port Already in Use
```bash
# Find process
lsof -i :3000

# Kill process
kill -9 <PID>
```

### Memory Issues
```bash
# Increase Node heap
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

### API Connection Issues
- Verify API URL in env variables
- Check network connectivity
- Review CORS configuration
- Check API server status

---

## Post-Deployment

### Verification Checklist
- [ ] Site loads without errors
- [ ] Sign-in works
- [ ] Dashboard displays correctly
- [ ] Charts render
- [ ] API calls succeed
- [ ] Theme toggle works
- [ ] Responsive on mobile
- [ ] SSL certificate valid
- [ ] Analytics tracking

### Monitoring Setup
- Set up error alerts
- Configure performance alerts
- Enable uptime monitoring
- Create regular backup schedule

### Documentation
- Update deployment procedures
- Document API endpoints
- Create runbooks for common issues
- Record configuration details

---

## Scheduled Maintenance

### Daily
- Monitor error logs
- Check application health
- Review analytics

### Weekly
- Database maintenance
- Log rotation
- Performance review

### Monthly
- Security updates
- Dependency updates
- Backup verification
- Feature deployment

---

## Disaster Recovery

### Backup Strategy
```bash
# Automated daily backups
0 2 * * * /path/to/backup-script.sh
```

### Recovery Time Objective (RTO)
- Target: 1 hour
- Critical systems: 15 minutes

### Recovery Point Objective (RPO)
- Target: 4 hours
- Database: 1 hour

---

## Contact & Support

- Deployment Issues: DevOps Team
- Application Bugs: Development Team
- Security Issues: Security Team
- Performance: Infrastructure Team

---

**Last Updated**: June 2026
**Version**: 1.0.0
