import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import http from 'http';
import net from 'net';

const __dirname = import.meta.dirname;
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const logsDir = path.join(rootDir, 'logs');
const tilesDir = path.join(distDir, 'tiles');
const mediaDir = path.join(distDir, 'media');
const backupDir = path.join(distDir, 'backup');

const isWindows = process.platform === 'win32';
const startTime = Date.now();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warn: '\x1b[33m',
    step: '\x1b[35m',
  };
  const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
  console.log(`${colors[type] || colors.info}${logMessage}\x1b[0m`);
  
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  fs.appendFileSync(path.join(logsDir, 'setup.log'), logMessage + '\n');
}

function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const timeout = options.timeout || 300000;
    const proc = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options,
    });
    
    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error(`Command timed out after ${timeout / 1000}s`));
    }, timeout);
    
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`Command failed with code ${code}`));
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function runCommandOutput(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      shell: true,
      ...options,
    });
    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (data) => { stdout += data.toString(); });
    proc.stderr?.on('data', (data) => { stderr += data.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr || `Command failed with code ${code}`));
    });
    proc.on('error', reject);
  });
}

function commandExists(command) {
  try {
    execSync(isWindows ? `where ${command}` : `which ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function checkPort(port, host = 'localhost') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function waitForPort(port, host = 'localhost', maxAttempts = 30, interval = 1000) {
  for (let i = 0; i < maxAttempts; i++) {
    if (await checkPort(port, host)) return true;
    await new Promise((r) => setTimeout(r, interval));
  }
  return false;
}

async function httpHealthCheck(url, maxAttempts = 10, interval = 2000) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          if (res.statusCode >= 200 && res.statusCode < 500) resolve(true);
          else reject(new Error(`HTTP ${res.statusCode}`));
        });
        req.on('error', reject);
        req.setTimeout(5000, () => {
          req.destroy();
          reject(new Error('Timeout'));
        });
      });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, interval));
    }
  }
  return false;
}

function parseConfig(configPath) {
  const config = {};
  if (!fs.existsSync(configPath)) return config;
  
  const content = fs.readFileSync(configPath, 'utf8');
  content.split('\n').forEach((line) => {
    line = line.trim();
    if (line.startsWith('#') || !line.includes('=')) return;
    const sepIdx = line.indexOf('=');
    const key = line.substring(0, sepIdx).trim();
    let value = line.substring(sepIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    config[key] = value;
  });
  return config;
}

async function checkNodeVersion() {
  log('Checking Node.js version...', 'step');
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0], 10);
  
  if (major < 21) {
    log(`Node.js ${version} detected. Required: >= 21.0.0`, 'error');
    log('Please update Node.js: https://nodejs.org/', 'info');
    process.exit(1);
  }
  log(`Node.js ${version} OK`, 'success');
}

async function checkDiskSpace() {
  log('Checking disk space...', 'step');
  try {
    if (isWindows) {
      const { stdout } = await runCommandOutput('wmic', ['logicaldisk', 'get', 'size,freespace,caption']);
      const lines = stdout.trim().split('\n').slice(1);
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3 && rootDir.toUpperCase().startsWith(parts[0].toUpperCase())) {
          const freeGB = parseInt(parts[1], 10) / (1024 ** 3);
          if (freeGB < 2) {
            log(`Low disk space: ${freeGB.toFixed(2)} GB free`, 'warn');
          } else {
            log(`Disk space: ${freeGB.toFixed(2)} GB free`, 'success');
          }
        }
      }
    }
  } catch {
    log('Could not check disk space', 'warn');
  }
}

async function checkRedis() {
  log('Checking Redis...', 'step');
  
  const redisRunning = await checkPort(6379);
  if (redisRunning) {
    log('Redis is already running on port 6379', 'success');
    return true;
  }
  
  if (!commandExists('redis-server') && !commandExists('redis-cli')) {
    log('Redis is not installed.', 'warn');
    log('Installation options:', 'info');
    log('  - Windows: https://github.com/microsoftarchive/redis/releases', 'info');
    log('  - Docker: docker run -d -p 6379:6379 --name redis redis', 'info');
    log('  - WSL: sudo apt install redis-server', 'info');
    
    if (commandExists('docker')) {
      const answer = await question('Start Redis with Docker? (y/n): ');
      if (answer.toLowerCase() === 'y') {
        try {
          await runCommand('docker', ['run', '-d', '-p', '6379:6379', '--name', 'pixuniverse-redis', 'redis']);
          log('Redis started with Docker', 'success');
          await new Promise((r) => setTimeout(r, 3000));
          return true;
        } catch {
          log('Failed to start Redis with Docker', 'error');
        }
      }
    }
    
    const answer = await question('Continue without Redis? (y/n): ');
    if (answer.toLowerCase() !== 'y') process.exit(1);
    return false;
  }
  
  return true;
}

async function startRedis() {
  log('Starting Redis server...', 'step');
  
  const redisRunning = await checkPort(6379);
  if (redisRunning) {
    log('Redis already running', 'success');
    return true;
  }
  
  if (commandExists('redis-server')) {
    spawn('redis-server', [], {
      detached: true,
      stdio: 'ignore',
      shell: true,
      windowsHide: true,
    }).unref();
    
    if (await waitForPort(6379, 'localhost', 15, 1000)) {
      log('Redis server started', 'success');
      return true;
    }
    log('Redis failed to start', 'error');
    return false;
  }
  
  log('Redis not available. Please start manually.', 'warn');
  return false;
}

async function checkMySQL() {
  log('Checking MySQL...', 'step');
  
  const mysqlRunning = await checkPort(3306);
  if (mysqlRunning) {
    log('MySQL is running on port 3306', 'success');
    return true;
  }
  
  if (!commandExists('mysql')) {
    log('MySQL client not found.', 'warn');
    log('Installation options:', 'info');
    log('  - Windows: https://dev.mysql.com/downloads/installer/', 'info');
    log('  - Docker: docker run -d -p 3306:3306 -e MYSQL_ROOT_PASSWORD=root --name mysql mysql', 'info');
    
    if (commandExists('docker')) {
      const answer = await question('Start MySQL with Docker? (y/n): ');
      if (answer.toLowerCase() === 'y') {
        try {
          await runCommand('docker', ['run', '-d', '-p', '3306:3306', '-e', 'MYSQL_ROOT_PASSWORD=root', '--name', 'pixuniverse-mysql', 'mysql']);
          log('MySQL started with Docker (root password: root)', 'success');
          log('Waiting for MySQL to initialize...', 'info');
          await new Promise((r) => setTimeout(r, 30000));
          return true;
        } catch {
          log('Failed to start MySQL with Docker', 'error');
        }
      }
    }
    
    const answer = await question('Continue without MySQL? (y/n): ');
    if (answer.toLowerCase() !== 'y') process.exit(1);
    return false;
  }
  
  log('MySQL client available, but server not running on port 3306', 'warn');
  return false;
}

async function setupDatabase() {
  log('Setting up MySQL database...', 'step');
  
  const configPath = fs.existsSync(path.join(distDir, 'config.ini'))
    ? path.join(distDir, 'config.ini')
    : path.join(rootDir, 'deployment', 'config.ini');
  
  const config = parseConfig(configPath);
  
  const mysqlHost = config.MYSQL_HOST || 'localhost';
  const mysqlUser = config.MYSQL_USER || 'pixuniverse';
  const mysqlPw = config.MYSQL_PW || 'sqlpassword';
  const mysqlDb = config.MYSQL_DATABASE || 'pixuniverse';
  
  log(`Database: ${mysqlDb} | User: ${mysqlUser} | Host: ${mysqlHost}`, 'info');
  
  const rootPassword = await question('MySQL root password (Enter to skip DB setup): ');
  if (!rootPassword && rootPassword !== '') {
    log('Skipping database setup', 'warn');
    return;
  }
  
  const mysqlArgs = ['-u', 'root'];
  const mysqlEnv = rootPassword ? { ...process.env, MYSQL_PWD: rootPassword } : process.env;
  
  const sqlCommands = [
    `CREATE DATABASE IF NOT EXISTS \`${mysqlDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    `CREATE USER IF NOT EXISTS '${mysqlUser}'@'localhost' IDENTIFIED BY '${mysqlPw}'`,
    `CREATE USER IF NOT EXISTS '${mysqlUser}'@'%' IDENTIFIED BY '${mysqlPw}'`,
    `GRANT ALL PRIVILEGES ON \`${mysqlDb}\`.* TO '${mysqlUser}'@'localhost'`,
    `GRANT ALL PRIVILEGES ON \`${mysqlDb}\`.* TO '${mysqlUser}'@'%'`,
    `FLUSH PRIVILEGES`,
  ];
  
  try {
    for (const sql of sqlCommands) {
      await runCommand('mysql', [...mysqlArgs, '-e', `"${sql}"`], { env: mysqlEnv });
    }
    log('Database setup completed', 'success');
  } catch (error) {
    log('Database setup failed. Manual setup required:', 'error');
    log(`  CREATE DATABASE ${mysqlDb} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`, 'info');
    log(`  CREATE USER '${mysqlUser}'@'localhost' IDENTIFIED BY '${mysqlPw}';`, 'info');
    log(`  GRANT ALL PRIVILEGES ON ${mysqlDb}.* TO '${mysqlUser}'@'localhost';`, 'info');
    const answer = await question('Continue anyway? (y/n): ');
    if (answer.toLowerCase() !== 'y') process.exit(1);
  }
}

async function testDatabaseConnection() {
  log('Testing database connection...', 'step');
  
  const configPath = fs.existsSync(path.join(distDir, 'config.ini'))
    ? path.join(distDir, 'config.ini')
    : path.join(rootDir, 'deployment', 'config.ini');
  
  const config = parseConfig(configPath);
  const mysqlUser = config.MYSQL_USER || 'pixuniverse';
  const mysqlPw = config.MYSQL_PW || 'sqlpassword';
  const mysqlDb = config.MYSQL_DATABASE || 'pixuniverse';
  
  try {
    const testEnv = { ...process.env, MYSQL_PWD: mysqlPw };
    await runCommand('mysql', ['-u', mysqlUser, '-e', `"SELECT 1"`, mysqlDb], { timeout: 10000, env: testEnv });
    log('Database connection successful', 'success');
    return true;
  } catch {
    log('Database connection failed', 'warn');
    return false;
  }
}

async function createDirectories() {
  log('Creating required directories...', 'step');
  
  const dirs = [distDir, logsDir, tilesDir, mediaDir, backupDir];
  
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      log(`Created: ${dir}`, 'info');
    }
  }
  log('Directories ready', 'success');
}

async function installDependencies() {
  log('Installing npm dependencies...', 'step');
  
  const packageLock = path.join(rootDir, 'package-lock.json');
  const nodeModules = path.join(rootDir, 'node_modules');
  
  if (fs.existsSync(nodeModules) && fs.existsSync(packageLock)) {
    const lockStat = fs.statSync(packageLock);
    const moduleStat = fs.statSync(nodeModules);
    if (moduleStat.mtime > lockStat.mtime) {
      log('Dependencies up to date', 'success');
      return;
    }
  }
  
  try {
    await runCommand('npm', ['ci', '--prefer-offline'], { cwd: rootDir, timeout: 600000 });
    log('Dependencies installed (ci)', 'success');
  } catch {
    log('npm ci failed, trying npm install...', 'warn');
    await runCommand('npm', ['install'], { cwd: rootDir, timeout: 600000 });
    log('Dependencies installed', 'success');
  }
}

async function buildProject() {
  log('Building project...', 'step');
  
  const serverJs = path.join(distDir, 'server.js');
  const clientAssets = path.join(distDir, 'public', 'assets');
  
  if (fs.existsSync(serverJs) && fs.existsSync(clientAssets)) {
    const answer = await question('Build exists. Rebuild? (y/n): ');
    if (answer.toLowerCase() !== 'y') {
      log('Using existing build', 'info');
      return;
    }
  }
  
  try {
    await runCommand('npm', ['run', 'build', '--', '--langs', 'en'], { cwd: rootDir, timeout: 900000 });
    log('Build completed', 'success');
  } catch (error) {
    log('Build failed', 'error');
    throw error;
  }
  
  await verifyBuild();
}

async function verifyBuild() {
  log('Verifying build...', 'step');
  
  const requiredFiles = [
    path.join(distDir, 'server.js'),
    path.join(distDir, 'config.ini'),
    path.join(distDir, 'canvases.json'),
  ];
  
  const requiredDirs = [
    path.join(distDir, 'public'),
    path.join(distDir, 'public', 'assets'),
    path.join(distDir, 'workers'),
  ];
  
  let valid = true;
  
  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      log(`Missing: ${file}`, 'error');
      valid = false;
    }
  }
  
  for (const dir of requiredDirs) {
    if (!fs.existsSync(dir)) {
      log(`Missing directory: ${dir}`, 'error');
      valid = false;
    }
  }
  
  const assetsDir = path.join(distDir, 'public', 'assets');
  if (fs.existsSync(assetsDir)) {
    const clientFiles = fs.readdirSync(assetsDir).filter((f) => f.startsWith('client.en'));
    if (clientFiles.length === 0) {
      log('Missing language bundles (client.en.*.js)', 'error');
      valid = false;
    }
  }
  
  if (!valid) {
    throw new Error('Build verification failed');
  }
  
  log('Build verified', 'success');
}

async function startServer() {
  log('Starting server...', 'step');
  
  const config = parseConfig(path.join(distDir, 'config.ini'));
  const port = parseInt(config.PORT, 10) || 5000;
  
  const portInUse = await checkPort(port);
  if (portInUse) {
    log(`Port ${port} already in use`, 'warn');
    const answer = await question('Kill existing process? (y/n): ');
    if (answer.toLowerCase() === 'y') {
      if (commandExists('pm2')) {
        try { execSync('pm2 kill', { stdio: 'ignore' }); } catch {}
      }
      if (isWindows) {
        try { execSync(`netstat -ano | findstr :${port}`, { stdio: 'ignore' }); } catch {}
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  
  if (commandExists('pm2') && fs.existsSync(path.join(distDir, 'ecosystem.yml'))) {
    log('Starting with PM2...', 'info');
    try {
      await runCommand('pm2', ['start', 'ecosystem.yml'], { cwd: distDir });
      log('Server started with PM2', 'success');
      
      if (await waitForPort(port, 'localhost', 30, 1000)) {
        log(`Server listening on port ${port}`, 'success');
        if (await httpHealthCheck(`http://localhost:${port}`)) {
          log('Health check passed', 'success');
        }
      }
      
      await runCommand('pm2', ['logs', '--lines', '30'], { cwd: distDir });
    } catch (error) {
      log('PM2 failed, using direct node...', 'warn');
      await runCommand('node', ['server.js'], { cwd: distDir });
    }
  } else {
    log('Starting with Node.js...', 'info');
    await runCommand('node', ['server.js'], { cwd: distDir });
  }
}

async function main() {
  console.log('\n\x1b[35m╔════════════════════════════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[35m║              PIXUNIVERSE - FULL SETUP                      ║\x1b[0m');
  console.log('\x1b[35m╚════════════════════════════════════════════════════════════╝\x1b[0m\n');
  
  try {
    await checkNodeVersion();
    await checkDiskSpace();
    await createDirectories();
    await checkRedis();
    await checkMySQL();
    await installDependencies();
    await buildProject();
    await setupDatabase();
    await testDatabaseConnection();
    await startRedis();
    await startServer();
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    log(`Setup completed in ${duration}s`, 'success');
  } catch (error) {
    log(`Setup failed: ${error.message}`, 'error');
    log(`Check logs at: ${path.join(logsDir, 'setup.log')}`, 'info');
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
