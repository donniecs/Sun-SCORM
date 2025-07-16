# Rustici Killer SCORM Platform - Complete Project Structure

## 🎯 Project Overview
**Rustici Killer** is an enterprise-grade SCORM (Sharable Content Object Reference Model) platform designed to compete with and surpass Rustici Software's offerings. This is a comprehensive e-learning content management system with microservices architecture.

## 📁 Root Directory Structure

```
Rustici Killer/
├── .env.development          # Development environment configuration
├── .env.production           # Production environment configuration  
├── .env.staging              # Staging environment configuration
├── .gitignore               # Git ignore rules
├── .eslintrc.json           # ESLint configuration
├── .prettierrc.json         # Prettier code formatting rules
├── package.json             # Root package configuration (monorepo)
├── package-lock.json        # Lock file for dependencies
├── tsconfig.json            # TypeScript configuration
├── turbo.json               # Turbo build system configuration
├── docker-compose.yml       # Docker compose for local development
├── migration.sql            # Database migration scripts
└── README.md               # Main project documentation
```

## 🏗️ Architecture Overview

### Microservices Architecture
- **API Gateway**: Main entry point and routing
- **Frontend**: Next.js React application
- **Content Ingestion**: SCORM package processing
- **LRS Service**: Learning Record Store (xAPI)
- **SCORM Runtime**: Course execution engine
- **Sequencing Engine**: SCORM sequencing logic
- **Webhook Emitter**: Event notifications

## 📂 Detailed Directory Structure

### 1. **apps/** - Application Layer
```
apps/
└── frontend/                 # Next.js Frontend Application
    ├── components/           # Reusable React components
    │   └── Navbar.tsx       # Navigation component
    ├── contexts/            # React contexts
    │   └── AuthContext.tsx  # Authentication context
    ├── pages/               # Next.js pages (routing)
    │   ├── admin/          # Admin dashboard pages
    │   │   ├── org.tsx     # Organization management
    │   │   └── uat.tsx     # User Acceptance Testing
    │   ├── api/            # API routes
    │   │   └── [...path].ts # Dynamic API proxy
    │   ├── courses/        # Course-related pages
    │   │   ├── [id].tsx    # Course detail view
    │   │   └── upload.tsx  # Course upload page
    │   ├── _app.tsx        # App configuration
    │   ├── index.tsx       # Home page
    │   ├── login.tsx       # Login page
    │   ├── register.tsx    # Registration page
    │   └── dashboard.tsx   # User dashboard
    ├── styles/             # CSS styling
    │   ├── globals.css     # Global styles
    │   ├── Admin.module.css # Admin-specific styles
    │   └── UAT.module.css  # UAT-specific styles
    ├── public/             # Static assets
    ├── package.json        # Frontend dependencies
    └── next.config.js      # Next.js configuration
```

### 2. **packages/** - Service Layer
```
packages/
├── api-gateway/             # Central API Gateway Service
│   ├── src/
│   │   ├── index.ts        # Main server entry point
│   │   └── utils/
│   │       └── validateConfig.ts # Configuration validation
│   ├── prisma/             # Database schema and migrations
│   │   ├── schema.prisma   # Database schema definition
│   │   └── migrations/     # Database migration files
│   ├── Dockerfile          # Docker container configuration
│   └── package.json        # Service dependencies
│
├── content-ingestion/       # SCORM Package Processing
│   ├── src/
│   │   └── index.ts        # Content processing logic
│   ├── Dockerfile
│   └── package.json
│
├── lrs-service/            # Learning Record Store (xAPI)
│   ├── src/
│   │   ├── index.ts        # LRS main service
│   │   └── xapi-validator.ts # xAPI statement validation
│   ├── Dockerfile
│   └── package.json
│
├── scorm-runtime/          # SCORM Course Execution Engine
│   ├── src/
│   │   └── index.ts        # Runtime engine
│   ├── prisma/
│   │   └── schema.prisma   # Runtime-specific schema
│   ├── Dockerfile
│   └── package.json
│
├── sequencing-engine/      # SCORM Sequencing Logic
│   ├── src/
│   │   ├── index.ts        # Main sequencing service
│   │   ├── activity-tree-parser.ts # Activity tree parsing
│   │   └── navigation-engine.ts # Navigation logic
│   ├── Dockerfile
│   └── package.json
│
├── types/                  # Shared TypeScript Types
│   ├── src/
│   │   ├── Course.ts       # Course type definitions
│   │   ├── Launch.ts       # Launch type definitions
│   │   └── index.ts        # Type exports
│   └── package.json
│
└── webhook-emitter/        # Event Notification Service
    ├── src/
    │   └── index.ts        # Webhook service
    ├── Dockerfile
    └── package.json
```

### 3. **database/** - Data Layer
```
database/
└── migration.sql           # Database setup scripts
```

### 4. **scripts/** - Automation & Deployment
```
scripts/
├── bootstrap-staging.ps1   # Staging environment setup
├── build-docker.ps1        # Docker build automation
├── build-docker.sh         # Docker build (Linux/Mac)
├── deploy.ps1              # Deployment script
├── setup-database.ps1      # Database initialization
└── test-deployment.ps1     # Deployment testing
```

### 5. **infra/** - Infrastructure as Code
```
infra/                      # Infrastructure configuration
└── (Infrastructure files)
```

### 6. **test_scorm_files/** - Test Data
```
test_scorm_files/
├── imsmanifest.xml         # SCORM manifest example
├── index.html              # Test course content
├── script.js               # Test course logic
├── style.css               # Test course styling
└── test_scorm_course.zip   # Packaged test course
```

## 🔧 Technology Stack

### Frontend
- **Framework**: Next.js 14+ (React 18+)
- **Styling**: Tailwind CSS + CSS Modules
- **Language**: TypeScript
- **Build Tool**: Turbo (Monorepo)

### Backend Services
- **Runtime**: Node.js
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **API**: REST + GraphQL capabilities
- **Authentication**: JWT-based

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Orchestration**: Kubernetes ready
- **CI/CD**: GitHub Actions
- **Monitoring**: Built-in logging and metrics

## 🗄️ Database Schema

### Core Models (via Prisma)
```typescript
// Key database models
- User          // User accounts and authentication
- Tenant        // Multi-tenant organization support
- Course        // SCORM course metadata
- Launch        // Course launch sessions
- Registration  // User-course registrations
- Progress      // Learning progress tracking
- XAPIStatement // xAPI learning records
```

## 🚀 Key Features

### Phase 13 Implementation (Current)
- **Superior Tracking System**: Advanced progress monitoring beyond Rustici's capabilities
- **Dispatch System**: Course-to-organization licensing and distribution
- **Admin Dashboard**: Comprehensive management interface
- **Real-time Analytics**: Live progress and completion tracking

### SCORM Compliance
- **SCORM 1.2**: Full compliance
- **SCORM 2004**: Complete support
- **xAPI Integration**: Learning Record Store
- **Sequencing Engine**: Advanced navigation logic

### Enterprise Features
- **Multi-tenancy**: Organization isolation
- **Scalable Architecture**: Microservices design
- **Security**: Enterprise-grade authentication
- **Performance**: Optimized for high-volume usage

## 🛠️ Development Commands

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Build all services
npm run build

# Run tests
npm run test

# Docker development
docker-compose up

# Deploy to staging
./scripts/deploy.ps1 staging

# Database migration
./scripts/setup-database.ps1
```

## 📊 Environment Configuration

### Development (.env.development)
- Local database connections
- Debug logging enabled
- Development API endpoints

### Production (.env.production)
- Production database connections
- Optimized performance settings
- Production API endpoints

### Staging (.env.staging)
- Staging environment configuration
- Testing-specific settings
- Staging API endpoints

## 🔍 Key Files to Understand

### Critical Configuration Files
- `turbo.json`: Monorepo build configuration
- `docker-compose.yml`: Local development environment
- `packages/api-gateway/src/index.ts`: Main API entry point
- `packages/api-gateway/prisma/schema.prisma`: Database schema
- `apps/frontend/pages/_app.tsx`: Frontend application setup

### Implementation Logs
- `PHASE_13_IMPLEMENTATION_LOG.md`: Current development progress
- `DEPLOYMENT_GUIDE.md`: Deployment instructions
- `PRODUCTION_READINESS.md`: Production checklist

## 🎯 Competitive Advantages Over Rustici

1. **Superior Tracking**: More granular progress monitoring
2. **Modern Architecture**: Microservices vs monolithic
3. **Real-time Analytics**: Live progress visualization
4. **Multi-tenancy**: Built-in organization support
5. **Open Source**: Customizable and extensible
6. **Performance**: Optimized for scale

## 📈 Current Status

- **Phase 13A**: Superior tracking system ✅ COMPLETE
- **Phase 13B**: Dispatch system 🔄 IN PROGRESS
- **API Gateway**: Running on port 3000 ✅ OPERATIONAL
- **Frontend**: Running on port 3001 ✅ OPERATIONAL
- **Database**: PostgreSQL with Prisma ✅ OPERATIONAL

This structure represents a production-ready SCORM platform designed to compete with and exceed Rustici Software's capabilities through superior architecture, performance, and feature set.
