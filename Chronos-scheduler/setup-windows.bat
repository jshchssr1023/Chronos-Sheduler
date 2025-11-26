@echo off
REM Windows Setup Script for AITX Chronos Scheduler

echo ========================================
echo AITX Chronos Scheduler - Windows Setup
echo ========================================
echo.

REM Step 1: Copy package.json
echo [1/7] Fixing package.json...
copy backend-package.json backend\package.json /Y
if %errorlevel% neq 0 (
    echo ERROR: Could not copy package.json
    pause
    exit /b 1
)
echo Done!
echo.

REM Step 2: Install dependencies
echo [2/7] Installing backend dependencies...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo ERROR: npm install failed
    pause
    exit /b 1
)
echo Done!
echo.

REM Step 3: Copy .env file
echo [3/7] Setting up environment...
if not exist .env (
    copy .env.example .env
)
echo Done!
echo.

REM Step 4: Start PostgreSQL with Docker
echo [4/7] Starting PostgreSQL...
cd ..
docker-compose up -d postgres
if %errorlevel% neq 0 (
    echo WARNING: Docker Compose failed. Make sure Docker is running.
    echo You may need to start PostgreSQL manually.
    pause
)
echo Waiting for PostgreSQL to start...
timeout /t 10 /nobreak
echo Done!
echo.

REM Step 5: Generate Prisma Client
echo [5/7] Generating Prisma Client...
cd backend
call npm run prisma:generate
if %errorlevel% neq 0 (
    echo ERROR: Prisma generate failed
    pause
    exit /b 1
)
echo Done!
echo.

REM Step 6: Run Migrations
echo [6/7] Running database migrations...
call npm run prisma:migrate
if %errorlevel% neq 0 (
    echo ERROR: Prisma migrate failed
    echo Make sure PostgreSQL is running
    pause
    exit /b 1
)
echo Done!
echo.

REM Step 7: Seed Database
echo [7/7] Seeding database...
call npm run prisma:seed
if %errorlevel% neq 0 (
    echo ERROR: Database seeding failed
    pause
    exit /b 1
)
echo Done!
echo.

echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo To start the backend server, run:
echo   cd backend
echo   npm run dev
echo.
echo Backend will be available at: http://localhost:3000
echo.
pause
