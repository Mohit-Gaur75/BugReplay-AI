import { spawn } from 'child_process';

console.log(`\n======================================================`);
console.log(`🚀 Starting BugReplay AI Full-Stack Environment...`);
console.log(`📡 Backend: http://localhost:5000`);
console.log(`💻 Frontend: http://localhost:5173`);
console.log(`👤 Demo Account: demo@bugreplay.dev / password123`);
console.log(`======================================================\n`);

const server = spawn('npm', ['run', 'dev', '--workspace=server'], {
  stdio: 'inherit',
  shell: true,
});

const client = spawn('npm', ['run', 'dev', '--workspace=client'], {
  stdio: 'inherit',
  shell: true,
});

function cleanup() {
  server.kill();
  client.kill();
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
