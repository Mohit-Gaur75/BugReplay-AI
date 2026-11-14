import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { ApiClient } from '../services/apiClient.js';

export async function runCommand(args) {
  const incidentId = args[0];
  if (!incidentId || incidentId.startsWith('-')) {
    console.error('Usage: npx bugreplay run <incident-id> [--output=<dir>] [--headed] [--server=<url>] [--key=<api_key>] [--token=<token>]');
    process.exit(1);
  }

  let outputDir = '.';
  let isHeaded = false;
  let server = null;
  let token = null;
  let apiKey = null;

  for (const arg of args.slice(1)) {
    if (arg.startsWith('--output=')) outputDir = arg.split('=')[1];
    if (arg === '--headed') isHeaded = true;
    if (arg.startsWith('--server=')) server = arg.split('=')[1];
    if (arg.startsWith('--token=')) token = arg.split('=')[1];
    if (arg.startsWith('--key=') || arg.startsWith('--api-key=')) apiKey = arg.split('=')[1];
  }

  console.log(`\n🔍 Fetching incident ${incidentId} from BugReplay AI...`);

  try {
    const incident = await ApiClient.getIncident(incidentId, { server, token, apiKey });
    if (!incident) {
      console.error(`❌ Incident ${incidentId} not found.`);
      process.exit(1);
    }

    if (!incident.generated_playwright_test) {
      console.warn(`⚠️  Playwright test is still generating for this incident. Current status: ${incident.generation_status}`);
      process.exit(1);
    }

    // Ensure output dir exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `bug-replay-${incident.id.slice(0, 8)}.spec.js`;
    const targetFile = path.resolve(outputDir, filename);

    fs.writeFileSync(targetFile, incident.generated_playwright_test, 'utf8');

    console.log(`\n======================================================`);
    console.log(`✓ Playwright test generated: ${targetFile}`);
    console.log(`🎯 Culprit URL: ${incident.page_url}`);
    console.log(`💥 Error: ${incident.error_message}`);
    if (incident.ai_root_cause_summary) {
      console.log(`💡 Diagnosis: ${incident.ai_root_cause_summary}`);
    }
    console.log(`======================================================\n`);

    console.log(`▶ Launching local Playwright reproduction test...\n`);

    const playwrightArgs = ['playwright', 'test', targetFile];
    if (isHeaded) {
      playwrightArgs.push('--headed');
    }

    const runner = spawn('npx', playwrightArgs, {
      stdio: 'inherit',
      shell: true,
    });

    runner.on('close', (code) => {
      if (code === 0) {
        console.log(`\n✓ Playwright run completed with exit code 0.`);
      } else {
        console.log(`\n⚠️  Playwright exited with code ${code}. Crash sequence successfully reproduced!`);
      }
      process.exit(code || 0);
    });

    runner.on('error', (err) => {
      console.error(`\nCould not execute Playwright automatically: ${err.message}`);
      console.log(`You can run it manually: npx playwright test ${targetFile}`);
      process.exit(0);
    });
  } catch (err) {
    console.error(`❌ Failed to run reproduction: ${err.message}`);
    if (err.message.includes('401') || err.message.includes('Authentication')) {
      console.log(`\n💡 Tip: Authenticate first with:`);
      console.log(`   npx bugreplay login --email=<email> --password=<password>`);
      console.log(`   or pass project key directly: npx bugreplay run ${incidentId} --key=<br_live_...>\n`);
    }
    process.exit(1);
  }
}
