import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const env = { ...process.env, APP_ENV: 'development', ALLOW_LOCAL_DEMO: '1' };
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) {
    if (child.pid && process.platform === 'win32') {
      // Exact child PID trees only; never a broad executable-name kill.
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
    } else child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 500).unref();
}
function start(command, args) {
  const child = spawn(command, args, { cwd: root, env, stdio: 'inherit', windowsHide: true });
  children.push(child);
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => { if (!stopping) stop(code ?? 1); });
}
console.log('Local fictional-data preview: http://127.0.0.1:5174 (no paid calls or cloud sync)');
start('uv', ['run', '--directory', 'backend', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8002']);
start('uv', ['run', '--directory', 'backend', 'python', '-m', 'app.worker']);
start(process.execPath, [process.env.npm_execpath, '--prefix', 'frontend', 'run', 'dev']);
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
