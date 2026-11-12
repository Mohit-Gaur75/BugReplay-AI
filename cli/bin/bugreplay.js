#!/usr/bin/env node

/**
 * BugReplay AI - Local Reproduction CLI
 * Replicate any production crash locally with a single command:
 *   npx bugreplay run <incident-id> [--server=http://localhost:3001] [--headed]
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const args = process.argv.slice(2);
const command = args[0];
const incidentId = args[1];

function printBanner() {
  console.log('\x1b[36m%s\x1b[0m', `
  ╔═══════════════════════════════════════════════════════╗
  ║                 BugReplay AI CLI                      ║
  ║     5-Second Local Reproduction for Production Bugs   ║
  ╚═══════════════════════════════════════════════════════╝
  `);
}

function printHelp() {
  printBanner();
  console.log(`
Usage:
  npx bugreplay run <incident-id> [options]

Commands:
  run <incident-id>     Download and run the Playwright test for an incident

Options:
  --server=<url>        BugReplay server URL (default: http://localhost:3001)
  --headed              Run Playwright in headed mode to see browser actions
  --output=<path>       Custom directory to save the synthesized .spec.js
  --help, -h            Show this help guide

Examples:
  npx bugreplay run inc_demo_broken_checkout_01
  npx bugreplay run inc_demo_broken_checkout_01 --headed
  `);
}

if (!command || command === '--help' || command === '-h') {
  printHelp();
  process.exit(0);
}

if (command !== 'run' || !incidentId) {
  console.error('\x1b[31m%s\x1b[0m', 'Error: Missing incident ID.');
  console.log('Usage: npx bugreplay run <incident-id>');
  process.exit(1);
}

// Parse options
const serverArg = args.find((a) => a.startsWith('--server='));
const serverUrl = serverArg ? serverArg.split('=')[1] : process.env.BUGREPLAY_SERVER || 'http://localhost:3001';
const isHeaded = args.includes('--headed');
const outputArg = args.find((a) => a.startsWith('--output='));
const outputDir = outputArg ? outputArg.split('=')[1] : path.resolve(process.cwd(), '.bugreplay');

async function main() {
  printBanner();
  console.log('\x1b[34m[1/3]\x1b[0m Fetching synthesized Playwright spec for incident:', `\x1b[33m${incidentId}\x1b[0m`);
  console.log('\x1b[90mServer target: %s\x1b[0m', serverUrl);

  const endpoint = `${serverUrl}/api/v1/incidents/${incidentId}/test-file`;

  try {
    const res = await fetch(endpoint);
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(`Incident "${incidentId}" not found or has no generated test.`);
      }
      throw new Error(`Failed to download test spec: HTTP ${res.status} ${res.statusText}`);
    }

    const testCode = await res.text();

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `bugreplay-${incidentId}.spec.js`;
    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, testCode, 'utf-8');

    console.log('\x1b[32m[2/3]\x1b[0m Saved Playwright test script to: \x1b[32m%s\x1b[0m', filePath);

    console.log('\x1b[34m[3/3]\x1b[0m Booting Playwright test runner...');
    const playwrightArgs = ['playwright', 'test', filePath];
    if (isHeaded) {
      playwrightArgs.push('--headed');
    }

    console.log('\x1b[90mRunning: npx %s\x1b[0m\n', playwrightArgs.join(' '));

    // Execute Playwright runner via npx
    const runner = spawn(/^win/.test(process.platform) ? 'npx.cmd' : 'npx', playwrightArgs, {
      stdio: 'inherit',
      shell: true
    });

    runner.on('close', (code) => {
      if (code === 0) {
        console.log('\n\x1b[32m✔ Playwright executed successfully. Crash reproduction verified.\x1b[0m');
      } else {
        console.log(`\n\x1b[33mℹ Playwright exited with code ${code}.\x1b[0m`);
        console.log('\x1b[90mIf Playwright is not yet installed in this directory, install with: npm i -D @playwright/test\x1b[0m');
      }
      process.exit(code || 0);
    });

    runner.on('error', (err) => {
      console.error('\x1b[31mFailed to start Playwright runner:\x1b[0m', err.message);
      console.log('\x1b[90mYou can run the generated test manually with: npx playwright test %s\x1b[0m', filePath);
      process.exit(1);
    });
  } catch (err) {
    console.error('\n\x1b[31mError:\x1b[0m', err.message);
    process.exit(1);
  }
}

main();
