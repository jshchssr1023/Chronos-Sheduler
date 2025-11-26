# 🚀 AITX Chronos Scheduler Suite

A comprehensive full-stack scheduling application for managing car-to-shop assignments with intelligent automation, scenario simulation, and analytics.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Development](#development)

## ✨ Features

### 1. **Scheduler Engine**
- Drag-and-drop car-to-shop assignments
- Monthly capacity tracking
- Auto-calculation of shop utilization
- Over-capacity warnings
- Undo/Redo functionality (in-memory history buffer)

### 2. **Shop Management**
- Full CRUD operations
- Bulk CSV/XLSX upload
- Replace entire shop database with validation
- Automatic car unassignment on shop replacement

### 3. **Car Management**
- Full CRUD operations
- Advanced filtering (Customer, Lease #, Type, Priority, Status, Reason)
- Bulk import/export via CSV/XLSX
- Priority-based scheduling

### 4. **Scenario Simulation**
- Create and save planning scenarios
- Fit engine with color-coded status (Green/Yellow/Red)
- Fit Score % calculation
- Overload Count tracking
- Earliest available slot detection
- Multi-shop support
- XLSX export

### 5. **Analytics**
- Utilization over time charts
- Shop performance metrics
- Forecast generation
- Dashboard KPIs
- Priority distribution
- Interactive zoomable charts

### 6. **Frontend Pages**
- **Dashboard**: KPI cards, quick nav, charts, filters
- **Scheduler**: Unassigned cars, shop selector, monthly grid
- **Analytics**: Collapsible charts, utilization tracking
- **Cars**: Sortable/filterable table
- **Scenarios**: Side-by-side comparison, fit metrics
- **Navigation**: Home, Undo, Redo, Back buttons

## 🛠 Tech Stack

### Backend
- Node.js + Express
- TypeScript
- Prisma ORM
- PostgreSQL
- XLSX (Excel processing)
- Multer (File uploads)

### Frontend
- React 18
- TypeScript
- Vite
- React Router v6
- TailwindCSS
- Chart.js + react-chartjs-2
- Axios
- Lucide React (Icons)
- Roboto Font

## 📦 Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+
- Docker & Docker Compose (optional)

## 🚀 Installation

### 1. Clone and Install Dependencies

```bash
# Backend
cd backend
npm install
cp .env.example .env

# Frontend
cd frontend
npm install
```

### 2. Configure Environment

Edit `backend/.env`:

```env
DATABASE_URL="postgresql://chronos:chronos123@localhost:5432/chronos_db?schema=public"
PORT=3000
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-change-in-production
```

## 🗄 Database Setup

### Option 1: Docker (Recommended)

```bash
# From project root
docker-compose up -d postgres
```

### Option 2: Local PostgreSQL

```bash
# Create database
createdb chronos_db

# Or using psql
psql -U postgres
CREATE DATABASE chronos_db;
CREATE USER chronos WITH PASSWORD 'chronos123';
GRANT ALL PRIVILEGES ON DATABASE chronos_db TO chronos;
```

### Run Migrations and Seed

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

## 🎯 Running the Application

### Development Mode

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```
Backend runs on: http://localhost:3000

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
Frontend runs on: http://localhost:5173

### Production Mode

```bash
# Backend
cd backend
npm run build
npm start

# Frontend
cd frontend
npm run build
npm run preview
```

### Docker Compose (All Services)

```bash
# From project root
docker-compose up
```

Access at: http://localhost:5173

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api
```

### Schedule Endpoints

#### Get All Assignments
```http
GET /schedule/assignments?month=2024-12&shopId=1
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "carId": 1,
      "shopId": 1,
      "month": "2024-12-01T00:00:00.000Z",
      "car": {
        "mark": "CAR-0001",
        "customer": "Enterprise Fleet"
      },
      "shop": {
        "name": "Detroit Auto Center"
      }
    }
  ],
  "count": 1
}
```

#### Get Unassigned Cars
```http
GET /schedule/unassigned
```

#### Assign Car to Shop
```http
POST /schedule/assign
Content-Type: application/json

{
  "carId": 1,
  "shopId": 1,
  "month": "2024-12-01"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "carId": 1,
    "shopId": 1,
    "month": "2024-12-01T00:00:00.000Z"
  },
  "warning": "Shop Detroit Auto Center is over capacity for this month"
}
```

#### Unassign Car
```http
DELETE /schedule/unassign/:id
```

#### Get Utilization
```http
GET /schedule/utilization?month=2024-12
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "shopId": 1,
      "shopName": "Detroit Auto Center",
      "capacity": 50,
      "assigned": 45,
      "utilizationPercent": 90,
      "isOverCapacity": false
    }
  ]
}
```

#### Undo Last Action
```http
POST /schedule/undo
```

#### Redo Last Action
```http
POST /schedule/redo
```

#### Get History Info
```http
GET /schedule/history
```

### Shop Endpoints

#### Get All Shops
```http
GET /shops
```

#### Get Single Shop
```http
GET /shops/:id
```

#### Create Shop
```http
POST /shops
Content-Type: application/json

{
  "name": "New Shop",
  "city": "New York",
  "code": "NY-001",
  "capacity": 40
}
```

#### Update Shop
```http
PUT /shops/:id
```

#### Delete Shop
```http
DELETE /shops/:id
```

#### Upload Shops (CSV/XLSX)
```http
POST /shops/upload
Content-Type: multipart/form-data

file: [shops.xlsx]
```

Expected columns: name, city, code, capacity

#### Download Template
```http
GET /shops/template/download
```

### Car Endpoints

#### Get All Cars (with filters)
```http
GET /cars?customer=Enterprise&priority=High&status=unscheduled&page=1&limit=100
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "mark": "CAR-0001",
      "customer": "Enterprise Fleet",
      "leaseNumber": "LSE-10001",
      "type": "Sedan",
      "level2Type": "Luxury",
      "qualDue": "2024-12-31T00:00:00.000Z",
      "priority": "High",
      "status": "unscheduled",
      "reason": null
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 100,
    "totalPages": 1
  }
}
```

#### Get Single Car
```http
GET /cars/:id
```

#### Create Car
```http
POST /cars
Content-Type: application/json

{
  "mark": "CAR-0101",
  "customer": "Enterprise Fleet",
  "leaseNumber": "LSE-10101",
  "type": "SUV",
  "level2Type": "Standard",
  "qualDue": "2024-12-31",
  "priority": "High",
  "status": "unscheduled",
  "reason": ""
}
```

#### Update Car
```http
PUT /cars/:id
```

#### Delete Car
```http
DELETE /cars/:id
```

#### Bulk Import Cars
```http
POST /cars/bulk-import
Content-Type: multipart/form-data

file: [cars.xlsx]
```

Expected columns: mark, customer, leaseNumber, type, level2Type, qualDue, priority, status, reason

#### Export Cars
```http
GET /cars/export/xlsx
```

#### Download Template
```http
GET /cars/template/download
```

#### Get Statistics
```http
GET /cars/stats/summary
```

### Scenario Endpoints

#### Get All Scenarios
```http
GET /scenarios
```

#### Get Single Scenario
```http
GET /scenarios/:id
```

#### Create Scenario
```http
POST /scenarios
Content-Type: application/json

{
  "name": "Q1 Plan",
  "data": {
    "assignments": [
      {
        "carId": 1,
        "shopId": 1,
        "month": "2024-12-01"
      }
    ]
  }
}
```

#### Update Scenario
```http
PUT /scenarios/:id
```

#### Delete Scenario
```http
DELETE /scenarios/:id
```

#### Evaluate Scenario Fit
```http
POST /scenarios/evaluate
Content-Type: application/json

{
  "assignments": [
    {
      "carId": 1,
      "shopId": 1,
      "month": "2024-12-01"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "fitScore": 80.5,
    "totalOverload": 5,
    "shops": [
      {
        "shopId": 1,
        "shopName": "Detroit Auto Center",
        "capacity": 50,
        "currentAssigned": 40,
        "scenarioAssigned": 10,
        "totalAssigned": 50,
        "utilizationPercent": 100,
        "status": "yellow",
        "overload": 0,
        "earliestSlot": "2025-01"
      }
    ],
    "summary": {
      "green": 4,
      "yellow": 1,
      "red": 0
    }
  }
}
```

#### Apply Scenario
```http
POST /scenarios/:id/apply
```

#### Export Scenario
```http
POST /scenarios/export
Content-Type: application/json

{
  "scenarioId": 1,
  "fitResults": { ... }
}
```

### Analytics Endpoints

#### Get Utilization Over Time
```http
GET /analytics/utilization?startMonth=2024-01-01&endMonth=2024-12-01&shopId=1
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "shopName": "Detroit Auto Center",
      "shopId": 1,
      "data": [
        {
          "month": "2024-01",
          "assigned": 45,
          "capacity": 50,
          "utilizationPercent": 90
        }
      ]
    }
  ]
}
```

#### Get Shop Performance
```http
GET /analytics/shop-performance
```

#### Get Forecast
```http
GET /analytics/forecast?months=6
```

#### Get Dashboard KPIs
```http
GET /analytics/dashboard
```

**Response:**
```json
{
  "success": true,
  "data": {
    "kpis": {
      "totalCars": 100,
      "totalShops": 5,
      "totalAssignments": 40,
      "unscheduledCars": 60,
      "scheduledCars": 40,
      "totalCapacity": 180,
      "utilizationPercent": 22.22,
      "upcomingQuals": 15
    },
    "carsByPriority": {
      "Critical": 10,
      "High": 30,
      "Medium": 40,
      "Low": 20
    }
  }
}
```

#### Get Priority Distribution
```http
GET /analytics/priority-distribution
```

## 📁 Project Structure

```
chronos-scheduler/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Database schema
│   │   └── seed.ts                # Seed data
│   ├── src/
│   │   ├── routes/
│   │   │   ├── schedule.ts        # Schedule endpoints
│   │   │   ├── shops.ts           # Shop endpoints
│   │   │   ├── cars.ts            # Car endpoints
│   │   │   ├── scenarios.ts       # Scenario endpoints
│   │   │   └── analytics.ts       # Analytics endpoints
│   │   ├── middleware/
│   │   │   └── errorHandler.ts   # Error handling
│   │   ├── utils/
│   │   │   └── prisma.ts          # Prisma client
│   │   └── index.ts               # Main server file
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.tsx         # App layout
│   │   │   └── ...                # Other components
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx      # Dashboard page
│   │   │   ├── Scheduler.tsx      # Scheduler page
│   │   │   ├── Cars.tsx           # Cars page
│   │   │   ├── Scenarios.tsx      # Scenarios page
│   │   │   └── Analytics.tsx      # Analytics page
│   │   ├── services/
│   │   │   └── api.ts             # API client
│   │   ├── App.tsx                # Main app component
│   │   ├── main.tsx               # Entry point
│   │   └── index.css              # Global styles
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
├── docker-compose.yml             # Docker setup
└── README.md                      # This file
```

## 🔧 Development

### Backend Development

```bash
cd backend

# Run in watch mode
npm run dev

# Generate Prisma client
npm run prisma:generate

# Create migration
npm run prisma:migrate

# Seed database
npm run prisma:seed

# Open Prisma Studio
npm run prisma:studio
```

### Frontend Development

```bash
cd frontend

# Run dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Code Quality

All code follows these standards:
- ✅ 100% TypeScript
- ✅ Async/await patterns
- ✅ Structured error handling
- ✅ CORS enabled
- ✅ Zero console errors
- ✅ Comprehensive comments

### Testing

```bash
# Backend
cd backend
npm test

# Frontend
cd frontend
npm test
```

## 🐳 Docker Deployment

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: chronos_db
      POSTGRES_USER: chronos
      POSTGRES_PASSWORD: chronos123
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  backend:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://chronos:chronos123@postgres:5432/chronos_db
    depends_on:
      - postgres

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    depends_on:
      - backend

volumes:
  postgres_data:
```

```bash
# Build and run
docker-compose up --build

# Run in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## 🎨 UI Features

- **Roboto Font** throughout
- **Responsive Design** (mobile-friendly)
- **Color-coded Priorities**:
  - 🔴 Critical (Red)
  - 🟠 High (Orange)
  - 🟡 Medium (Yellow)
  - 🟢 Low (Green)
- **Status Indicators**:
  - 🟢 Green: Good capacity
  - 🟡 Yellow: Near capacity (80%+)
  - 🔴 Red: Over capacity
- **Interactive Charts** (zoomable, collapsible)
- **Drag-and-Drop** scheduling
- **Real-time Updates**

## 📊 Sample Data

The seed script creates:
- **5 Shops** (Detroit, LA, Chicago, Houston, Phoenix)
- **100 Cars** (60% unscheduled, 40% scheduled)
- **40 Assignments** (distributed across shops/months)
- **2 Scenarios** (sample planning scenarios)

## 🚨 Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL is running
docker ps
# or
pg_isready

# Reset database
npm run prisma:migrate reset
npm run prisma:seed
```

### Port Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
```

### Prisma Client Issues
```bash
npm run prisma:generate
```

### Module Not Found
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

## 📄 License

MIT

## 👥 Support

For issues or questions, please open an issue on GitHub or contact support.

---

**Built with ❤️ using TypeScript, React, Node.js, and Prisma**
