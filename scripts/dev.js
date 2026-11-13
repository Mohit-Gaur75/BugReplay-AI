import { spawn } from 'child_process';

const BACKEND_PORT = process.env.PORT || '5001';

console.log(`\n======================================================`);
console.log(`🚀 Starting BugReplay AI Full-Stack Environment...`);
console.log(`📡 Backend: http://localhost:${BACKEND_PORT}`);
console.log(`💻 Frontend: http://localhost:5173`);
console.log(`👤 Demo Account: demo@bugreplay.dev / password123`);
console.log(`======================================================\n`);

const server = spawn('npm', ['run', 'dev', '--workspace=server'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PORT: BACKEND_PORT },
});

const client = spawn('npm', ['run', 'dev', '--workspace=client'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, VITE_BACKEND_URL: `http://localhost:${BACKEND_PORT}` },
});

function cleanup() {
  server.kill();
  client.kill();
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
