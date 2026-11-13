#!/usr/bin/env node

import { loginCommand } from './commands/login.js';
import { configureCommand } from './commands/configure.js';
import { incidentsCommand } from './commands/incidents.js';
import { runCommand } from './commands/run.js';

const [,, command, ...args] = process.argv;

function printHelp() {
  console.log(`
========================================================================
BugReplay AI — Local Playwright Reproduction CLI
========================================================================

Usage:
  npx bugreplay login --email=<email> --password=<password>
  npx bugreplay login --token=<jwt_token>
  npx bugreplay configure [--server=<url>]
  npx bugreplay incidents
  npx bugreplay run <incident-id> [--output=<dir>] [--headed]
  npx bugreplay --help

Options:
  --output    Directory where .spec.js test will be saved (default: .)
  --headed    Launch browser in visible mode
  --server    BugReplay server API endpoint (default: http://localhost:5000)
`);
}

async function main() {
  switch (command) {
    case 'login':
      await loginCommand(args);
      break;
    case 'configure':
      configureCommand(args);
      break;
    case 'incidents':
      await incidentsCommand();
      break;
    case 'run':
      await runCommand(args);
      break;
    case '--help':
    case '-h':
    case 'help':
    default:
      printHelp();
      break;
  }
}

main().catch((err) => {
  console.error('Fatal CLI Error:', err);
  process.exit(1);
});
