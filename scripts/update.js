import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';
import net from 'net';

const __dirname = import.meta.dirname;
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const backupDir = path.join(rootDir, 'dist-backup');
const logsDir = path.join(rootDir, 'logs');

const isWindows = process.platform === 'win32';
const startTime = Date.now();

let rollbackNeeded = false;
let backupCreated = false;

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
  fs.appendFileSync(path.join(logsDir, 'update.log'), logMessage + '\n');
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

async function waitForPortClosed(port, host = 'localhost', maxAttempts = 30, interval = 500) {
  for (let i = 0; i < maxAttempts; i++) {
    if (!(await checkPort(port, host))) return true;
    await new Promise((r) => setTimeout(r, interval));
  }
  return false;
}

async function httpHealthCheck(url, maxAttempts = 15, interval = 2000) {
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

async function checkPrerequisites() {
  log('Checking prerequisites...', 'step');
  
  const redisOk = await checkPort(6379);
  const mysqlOk = await checkPort(3306);
  
  if (!redisOk) {
    log('Redis not running on port 6379', 'error');
    throw new Error('Redis is required. Start Redis before updating.');
  }
  log('Redis: OK', 'success');
  
  if (!mysqlOk) {
    log('MySQL not running on port 3306', 'warn');
  } else {
    log('MySQL: OK', 'success');
  }
  
  if (!fs.existsSync(distDir)) {
    log('No existing build found. Run npm run start first.', 'error');
    throw new Error('Initial setup required. Run npm run start first.');
  }
  log('Existing build: OK', 'success');
}

async function createBackup() {
  log('Creating backup of current build...', 'step');
  
  if (fs.existsSync(backupDir)) {
    fs.rmSync(backupDir, { recursive: true, force: true });
  }
  
  try {
    fs.cpSync(distDir, backupDir, { recursive: true });
    backupCreated = true;
    log(`Backup created at ${backupDir}`, 'success');
  } catch (error) {
    log('Failed to create backup', 'warn');
  }
}

async function rollback() {
  if (!backupCreated || !fs.existsSync(backupDir)) {
    log('No backup available for rollback', 'error');
    return false;
  }
  
  log('Rolling back to previous build...', 'step');
  
  try {
    if (fs.existsSync(distDir)) {
      fs.rmSync(distDir, { recursive: true, force: true });
    }
    fs.cpSync(backupDir, distDir, { recursive: true });
    log('Rollback completed', 'success');
    return true;
  } catch (error) {
    log(`Rollback failed: ${error.message}`, 'error');
    return false;
  }
}

async function cleanupBackup() {
  if (fs.existsSync(backupDir)) {
    try {
      fs.rmSync(backupDir, { recursive: true, force: true });
      log('Backup cleaned up', 'info');
    } catch {}
  }
}

async function stopServer() {
  log('Stopping server gracefully...', 'step');
  
  const config = parseConfig(path.join(distDir, 'config.ini'));
  const port = parseInt(config.PORT, 10) || 5000;
  
  if (commandExists('pm2')) {
    try {
      const { stdout } = await runCommandOutput('pm2', ['jlist']);
      const processes = JSON.parse(stdout || '[]');
      const ppfunProcess = processes.find((p) => p.name === 'ppfun');
      
      if (ppfunProcess) {
        log('Sending graceful stop signal to PM2...', 'info');
        execSync('pm2 stop ppfun', { stdio: 'inherit' });
        
        if (await waitForPortClosed(port, 'localhost', 30, 500)) {
          log('Server stopped gracefully', 'success');
        } else {
          log('Force stopping server...', 'warn');
          execSync('pm2 delete ppfun', { stdio: 'ignore' });
        }
      }
    } catch {
      try {
        execSync('pm2 stop all', { stdio: 'ignore' });
        execSync('pm2 delete all', { stdio: 'ignore' });
      } catch {}
    }
  }
  
  if (await checkPort(port)) {
    log(`Port ${port} still in use, attempting force kill...`, 'warn');
    if (isWindows) {
      try {
        const { stdout } = await runCommandOutput('netstat', ['-ano', '|', 'findstr', `:${port}`]);
        const lines = stdout.trim().split('\n');
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && /^\d+$/.test(pid)) {
            try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' }); } catch {}
          }
        }
      } catch {}
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  
  if (await checkPort(port)) {
    log(`Warning: Port ${port} still in use`, 'warn');
  } else {
    log('Server stopped', 'success');
  }
}

async function checkGitStatus() {
  log('Checking git status...', 'step');
  
  if (!commandExists('git')) {
    log('Git not found, skipping code update', 'warn');
    return { canPull: false, hasChanges: false };
  }
  
  try {
    const { stdout: statusOut } = await runCommandOutput('git', ['status', '--porcelain'], { cwd: rootDir });
    const hasLocalChanges = statusOut.trim().length > 0;
    
    if (hasLocalChanges) {
      log('Local changes detected:', 'warn');
      console.log(statusOut);
    }
    
    try {
      await runCommand('git', ['fetch', '--quiet'], { cwd: rootDir, timeout: 30000 });
    } catch {
      log('Could not fetch from remote', 'warn');
      return { canPull: false, hasChanges: hasLocalChanges };
    }
    
    const { stdout: behindOut } = await runCommandOutput('git', ['rev-list', '--count', 'HEAD..@{u}'], { cwd: rootDir });
    const behind = parseInt(behindOut.trim(), 10) || 0;
    
    if (behind > 0) {
      log(`${behind} new commit(s) available`, 'info');
    } else {
      log('Already up to date', 'success');
    }
    
    return { canPull: !hasLocalChanges && behind > 0, hasChanges: hasLocalChanges, behind };
  } catch (error) {
    log('Git status check failed', 'warn');
    return { canPull: false, hasChanges: false };
  }
}

async function pullLatestCode() {
  log('Pulling latest code...', 'step');
  
  const gitStatus = await checkGitStatus();
  
  if (!gitStatus.canPull) {
    if (gitStatus.hasChanges) {
      log('Skipping pull due to local changes', 'warn');
    } else if (gitStatus.behind === 0) {
      log('No new commits to pull', 'info');
    }
    return;
  }
  
  try {
    await runCommand('git', ['pull', '--ff-only'], { cwd: rootDir, timeout: 60000 });
    log('Code updated successfully', 'success');
  } catch (error) {
    log('Git pull failed', 'error');
    throw error;
  }
}

async function installDependencies() {
  log('Updating dependencies...', 'step');
  
  const packageJson = path.join(rootDir, 'package.json');
  const packageLock = path.join(rootDir, 'package-lock.json');
  const nodeModules = path.join(rootDir, 'node_modules');
  
  if (!fs.existsSync(packageJson)) {
    throw new Error('package.json not found');
  }
  
  let needsInstall = !fs.existsSync(nodeModules);
  
  if (!needsInstall && fs.existsSync(packageLock)) {
    const lockStat = fs.statSync(packageLock);
    const moduleStat = fs.statSync(nodeModules);
    needsInstall = lockStat.mtime > moduleStat.mtime;
  }
  
  if (!needsInstall) {
    log('Dependencies up to date', 'success');
    return;
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
  rollbackNeeded = true;
  
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
    } else {
      log(`Found ${clientFiles.length} client bundle(s)`, 'info');
    }
  }
  
  if (!valid) {
    throw new Error('Build verification failed');
  }
  
  log('Build verified', 'success');
  rollbackNeeded = false;
}

async function startServer() {
  log('Starting server...', 'step');
  
  const config = parseConfig(path.join(distDir, 'config.ini'));
  const port = parseInt(config.PORT, 10) || 5000;
  
  if (await checkPort(port)) {
    log(`Port ${port} still in use, waiting...`, 'warn');
    await waitForPortClosed(port, 'localhost', 10, 1000);
  }
  
  if (commandExists('pm2') && fs.existsSync(path.join(distDir, 'ecosystem.yml'))) {
    log('Starting with PM2...', 'info');
    
    try {
      execSync('pm2 delete ppfun', { stdio: 'ignore' });
    } catch {}
    
    try {
      await runCommand('pm2', ['start', 'ecosystem.yml'], { cwd: distDir });
      log('PM2 process started', 'success');
      
      log('Waiting for server to be ready...', 'info');
      if (await waitForPort(port, 'localhost', 30, 1000)) {
        log(`Server listening on port ${port}`, 'success');
        
        if (await httpHealthCheck(`http://localhost:${port}`)) {
          log('Health check passed', 'success');
        } else {
          log('Health check failed - server may not be fully ready', 'warn');
        }
      } else {
        throw new Error(`Server failed to start on port ${port}`);
      }
      
      await runCommand('pm2', ['save'], { cwd: distDir });
      log('PM2 configuration saved', 'info');
      
      await new Promise((r) => setTimeout(r, 1000));
      await runCommand('pm2', ['logs', '--lines', '30', '--nostream'], { cwd: distDir });
      
    } catch (error) {
      log(`PM2 start failed: ${error.message}`, 'error');
      throw error;
    }
  } else {
    log('Starting with Node.js (no PM2)...', 'info');
    
    const proc = spawn('node', ['server.js'], {
      cwd: distDir,
      detached: true,
      stdio: 'ignore',
      shell: true,
    });
    proc.unref();
    
    if (await waitForPort(port, 'localhost', 30, 1000)) {
      log(`Server started on port ${port}`, 'success');
    } else {
      throw new Error('Server failed to start');
    }
  }
}

async function showStatus() {
  log('Current status:', 'step');
  
  const config = parseConfig(path.join(distDir, 'config.ini'));
  const port = parseInt(config.PORT, 10) || 5000;
  
  const serverRunning = await checkPort(port);
  const redisRunning = await checkPort(6379);
  const mysqlRunning = await checkPort(3306);
  
  log(`Server (port ${port}): ${serverRunning ? 'RUNNING' : 'STOPPED'}`, serverRunning ? 'success' : 'error');
  log(`Redis (port 6379): ${redisRunning ? 'RUNNING' : 'STOPPED'}`, redisRunning ? 'success' : 'error');
  log(`MySQL (port 3306): ${mysqlRunning ? 'RUNNING' : 'STOPPED'}`, mysqlRunning ? 'success' : 'warn');
  
  if (commandExists('pm2')) {
    try {
      const { stdout } = await runCommandOutput('pm2', ['jlist']);
      const processes = JSON.parse(stdout || '[]');
      const ppfun = processes.find((p) => p.name === 'ppfun');
      if (ppfun) {
        log(`PM2 status: ${ppfun.pm2_env.status} | Restarts: ${ppfun.pm2_env.restart_time} | Uptime: ${Math.round(ppfun.pm2_env.pm_uptime / 1000)}s`, 'info');
      }
    } catch {}
  }
}

async function main() {
  console.log('\n\x1b[35m╔════════════════════════════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[35m║              PIXUNIVERSE - UPDATE & RESTART                ║\x1b[0m');
  console.log('\x1b[35m╚════════════════════════════════════════════════════════════╝\x1b[0m\n');
  
  try {
    await checkPrerequisites();
    await createBackup();
    await stopServer();
    await pullLatestCode();
    await installDependencies();
    await buildProject();
    await startServer();
    await showStatus();
    await cleanupBackup();
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    log(`Update completed successfully in ${duration}s`, 'success');
    
  } catch (error) {
    log(`Update failed: ${error.message}`, 'error');
    
    if (rollbackNeeded && backupCreated) {
      log('Attempting rollback...', 'warn');
      if (await rollback()) {
        try {
          await startServer();
          log('Rollback successful - previous version restored', 'success');
        } catch (startError) {
          log(`Failed to start after rollback: ${startError.message}`, 'error');
        }
      }
    }
    
    log(`Check logs at: ${path.join(logsDir, 'update.log')}`, 'info');
    process.exit(1);
  }
}

main();
