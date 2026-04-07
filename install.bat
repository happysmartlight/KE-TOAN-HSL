@echo off
REM ============================================================
REM install.bat - Cai dat moi truong DEV tren Windows
REM Usage: install.bat
REM ============================================================
setlocal enabledelayedexpansion

set "PROJECT_DIR=%~dp0"
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"
set "BACKEND_DIR=%PROJECT_DIR%\backend"
set "FRONTEND_DIR=%PROJECT_DIR%\frontend"
set "ENV_FILE=%BACKEND_DIR%\.env"
set "ENV_EXAMPLE=%BACKEND_DIR%\.env.example"

echo.
echo ==================================================
echo    Ke Toan Noi Bo - Cai dat DEV tren Windows
echo ==================================================
echo.

REM ── 1. Kiem tra Node.js ──────────────────────────────────────
where node >nul 2>nul
if errorlevel 1 (
  echo [X] Node.js chua duoc cai. Tai tai: https://nodejs.org
  pause & exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set "NODE_V=%%v"
echo [OK] Node.js: %NODE_V%

REM ── 2. Kiem tra MariaDB/MySQL client ─────────────────────────
where mysql >nul 2>nul
if errorlevel 1 (
  echo [X] mysql client khong tim thay trong PATH.
  echo     Cai MariaDB tai: https://mariadb.org/download/
  echo     Sau khi cai, them "C:\Program Files\MariaDB XX\bin" vao PATH.
  pause & exit /b 1
)
echo [OK] mysql client da co trong PATH.

REM ── 3. Detect .env va offer reuse ────────────────────────────
set "REUSE_ENV=0"
set "EXISTING_VALID=0"
if exist "%ENV_FILE%" (
  findstr /b /c:"DATABASE_URL=" "%ENV_FILE%" >nul 2>nul
  if not errorlevel 1 (
    findstr /b /c:"JWT_SECRET=" "%ENV_FILE%" >nul 2>nul
    if not errorlevel 1 set "EXISTING_VALID=1"
  )
)

if "%EXISTING_VALID%"=="1" (
  echo.
  echo [i] Phat hien backend\.env co san.
  echo     1^) Su dung lai .env hien tai - bo qua moi cau hoi cau hinh
  echo     2^) Tao moi ^(.env cu se duoc backup^)
  set "REUSE_CHOICE="
  set /p "REUSE_CHOICE=  Chon [1/2] (mac dinh: 1): "
  if "!REUSE_CHOICE!"=="2" (
    call :backup_env
  ) else (
    set "REUSE_ENV=1"
    echo [OK] Se su dung lai .env hien tai.
  )
)

REM ── 4. Hoi DB credentials va tao .env neu khong reuse ────────
if "%REUSE_ENV%"=="1" goto skip_env_setup

echo.
echo [i] Thiet lap MariaDB - nhan Enter de dung mac dinh.

set "DB_NAME=ke_toan_noi_bo"
set /p "IN_DB_NAME=  Ten database   [%DB_NAME%]: "
if not "%IN_DB_NAME%"=="" set "DB_NAME=%IN_DB_NAME%"

set "DB_USER=ketoan"
set /p "IN_DB_USER=  Ten user       [%DB_USER%]: "
if not "%IN_DB_USER%"=="" set "DB_USER=%IN_DB_USER%"

set "DB_PASS="
set /p "DB_PASS=  Mat khau user  [bat buoc, tranh ky tu @ : / ' ^]: "
if "%DB_PASS%"=="" (
  echo [X] Mat khau khong duoc trong.
  pause & exit /b 1
)

echo.
echo [i] Can mat khau MariaDB root de tao database va user.
set "MYSQL_ROOT_PASS="
set /p "MYSQL_ROOT_PASS=  Mat khau root MariaDB: "

echo [i] Dang tao database va user...
mysql -u root -p%MYSQL_ROOT_PASS% -e "CREATE DATABASE IF NOT EXISTS %DB_NAME% CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER IF NOT EXISTS '%DB_USER%'@'localhost' IDENTIFIED BY '%DB_PASS%'; ALTER USER '%DB_USER%'@'localhost' IDENTIFIED BY '%DB_PASS%'; GRANT ALL PRIVILEGES ON %DB_NAME%.* TO '%DB_USER%'@'localhost'; FLUSH PRIVILEGES;"
if errorlevel 1 (
  echo [X] Tao database that bai. Kiem tra mat khau root va thu lai.
  pause & exit /b 1
)
echo [OK] Database '%DB_NAME%' va user '%DB_USER%' da san sang.

REM ── 4b. Hoi INITIAL_ADMIN_PASSWORD ─────────────────────────
echo.
echo [i] Mat khau admin dau tien cua web app:
echo     Yeu cau: tu 12 ky tu, co chu thuong/HOA/so/dac biet.
set "ADMIN_PASS="
set /p "ADMIN_PASS=  Mat khau admin: "
if "%ADMIN_PASS%"=="" (
  echo [!] Bo qua - ban se phai tu set INITIAL_ADMIN_PASSWORD trong .env truoc khi dang nhap.
)

REM ── 4c. Sinh JWT_SECRET bang PowerShell (2 GUID = 64 hex chars, khong dung pipe de tranh loi escape) ──
set "JWT_SECRET="
for /f "delims=" %%j in ('powershell -NoProfile -Command "([Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N'))"') do set "JWT_SECRET=%%j"
if "%JWT_SECRET%"=="" (
  echo [X] Khong sinh duoc JWT_SECRET. PowerShell co san khong?
  pause & exit /b 1
)

REM ── 4d. Ghi backend\.env (ngoai if block de redirect on dinh) ──
call :write_env

:skip_env_setup

REM ── 5. Backend: npm install + prisma ─────────────────────────
echo.
echo [i] Cai backend dependencies...
cd /d "%BACKEND_DIR%"
call npm install
if errorlevel 1 (
  echo [X] npm install backend that bai.
  pause & exit /b 1
)

echo [i] Prisma generate...
call npx prisma generate
if errorlevel 1 (
  echo [!] Neu loi EPERM, chay: taskkill /F /IM node.exe roi chay lai install.bat
  pause & exit /b 1
)

REM ── 5b. (Tuy chon) Reset database neu co bang cu ─────────────
REM Doc DATABASE_URL tu .env de biet ten DB hien tai
call :read_db_name_from_env
if "%DB_NAME%"=="" set "DB_NAME=ke_toan_noi_bo"

set "TBL_COUNT=0"
if defined MYSQL_ROOT_PASS (
  for /f %%c in ('mysql -u root -p%MYSQL_ROOT_PASS% -N -B -e "USE %DB_NAME%; SHOW TABLES;" 2^>nul ^| find /c /v ""') do set "TBL_COUNT=%%c"
)

set "RESET_DB=0"
if %TBL_COUNT% gtr 0 (
  echo.
  echo [!] Database '%DB_NAME%' da co %TBL_COUNT% bang ^(du lieu cu^).
  echo     Ban co muon XOA TOAN BO DU LIEU va tao lai tu dau khong?
  set "IN_RESET="
  set /p "IN_RESET=  Reset database? [y/N]: "
  if /i "!IN_RESET!"=="y" (
    echo.
    echo [!] THAO TAC NAY KHONG THE HOAN TAC.
    set "IN_C1="
    set /p "IN_C1=  Go 'YES' (in HOA) de xac nhan lan 1: "
    if "!IN_C1!"=="YES" (
      set "IN_C2="
      set /p "IN_C2=  Go ten database '%DB_NAME%' de xac nhan lan cuoi: "
      if "!IN_C2!"=="%DB_NAME%" (
        set "RESET_DB=1"
        echo [!] Da xac nhan. Database se bi wipe.
      ) else (
        echo [i] Ten database khong khop. Bo qua reset.
      )
    ) else (
      echo [i] Khong xac nhan YES. Bo qua reset.
    )
  )
)

echo [i] Prisma push schema...
if "%RESET_DB%"=="1" (
  call npx prisma db push --force-reset --accept-data-loss
) else (
  call npx prisma db push --accept-data-loss
)
if errorlevel 1 (
  echo [X] Prisma db push that bai.
  pause & exit /b 1
)

REM ── 6. Frontend: npm install ─────────────────────────────────
echo.
echo [i] Cai frontend dependencies...
cd /d "%FRONTEND_DIR%"
call npm install
if errorlevel 1 (
  echo [X] npm install frontend that bai.
  pause & exit /b 1
)

REM ── Done ─────────────────────────────────────────────────────
cd /d "%PROJECT_DIR%"
echo.
echo ==================================================
echo [OK] Hoan tat cai dat DEV!
echo ==================================================
echo.
echo De chay he thong, mo 2 terminal:
echo.
echo   Terminal 1 ^(Backend^):
echo     cd backend
echo     npm run dev
echo.
echo   Terminal 2 ^(Frontend^):
echo     cd frontend
echo     npm run dev
echo.
echo Sau do mo trinh duyet: http://localhost:5173
echo.
if "%REUSE_ENV%"=="0" (
  if "%ADMIN_PASS%"=="" (
    echo [!] CHUA SET INITIAL_ADMIN_PASSWORD!
    echo     Mo backend\.env, them dong:
    echo       INITIAL_ADMIN_PASSWORD="MatKhauManh@123"
    echo     roi khoi dong lai backend.
  ) else (
    echo Dang nhap lan dau:
    echo     Username: admin
    echo     Password: ^<INITIAL_ADMIN_PASSWORD vua set^>
    echo Sau khi dang nhap: doi mat khau va XOA INITIAL_ADMIN_PASSWORD khoi backend\.env
  )
)
echo ==================================================
echo.
pause
endlocal
goto :eof

REM ============================================================
REM Subroutines
REM ============================================================

:backup_env
for /f "tokens=2 delims==" %%a in ('wmic os get LocalDateTime /value 2^>nul') do set "DT=%%a"
set "TS=%DT:~0,8%-%DT:~8,6%"
move /y "%ENV_FILE%" "%ENV_FILE%.bak.%TS%" >nul
echo [OK] Da backup .env cu -^> .env.bak.%TS%
goto :eof

:write_env
> "%ENV_FILE%" echo DATABASE_URL="mysql://%DB_USER%:%DB_PASS%@localhost:3306/%DB_NAME%"
>> "%ENV_FILE%" echo JWT_SECRET="%JWT_SECRET%"
>> "%ENV_FILE%" echo PORT=3001
>> "%ENV_FILE%" echo BIND_HOST=0.0.0.0
>> "%ENV_FILE%" echo ALLOWED_ORIGINS=http://localhost:5173
if not "%ADMIN_PASS%"=="" (
  >> "%ENV_FILE%" echo INITIAL_ADMIN_USERNAME="admin"
  >> "%ENV_FILE%" echo INITIAL_ADMIN_PASSWORD="%ADMIN_PASS%"
)
echo [OK] Da ghi backend\.env
goto :eof

:read_db_name_from_env
set "DB_NAME="
if not exist "%ENV_FILE%" goto :eof
for /f "tokens=*" %%l in ('findstr /b /c:"DATABASE_URL=" "%ENV_FILE%"') do set "DB_LINE=%%l"
REM DB_LINE = DATABASE_URL="mysql://user:pass@host:port/dbname"
REM Strip quotes truoc khi parse de tranh loi quoting trong for /f
set "DB_LINE=%DB_LINE:"=%"
REM Sau strip: DATABASE_URL=mysql://user:pass@host:port/dbname
set "AFTER_PROTO=%DB_LINE:*://=%"
REM AFTER_PROTO = user:pass@host:port/dbname
for /f "tokens=2 delims=/" %%a in ("%AFTER_PROTO%") do set "DB_NAME=%%a"
for /f "tokens=1 delims=?" %%a in ("%DB_NAME%") do set "DB_NAME=%%a"
goto :eof
