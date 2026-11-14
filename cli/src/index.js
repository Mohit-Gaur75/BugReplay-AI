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
  npx bugreplay login --email=<email> --password=<password> [--server=<url>]
  npx bugreplay login --token=<jwt_token> [--server=<url>]
  npx bugreplay configure [--server=<url>]
  npx bugreplay incidents [--server=<url>] [--key=<api_key>]
  npx bugreplay run <incident-id> [--output=<dir>] [--headed] [--server=<url>] [--key=<api_key>]
  npx bugreplay --help

Options:
  --output    Directory where .spec.js test will be saved (default: .)
  --headed    Launch browser in visible mode
  --server    BugReplay server API endpoint (default: http://localhost:5001)
  --key       Project API key (alternative to logging in)
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
      await incidentsCommand(args);
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
