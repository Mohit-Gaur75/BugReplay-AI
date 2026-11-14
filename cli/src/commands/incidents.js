import { ApiClient } from '../services/apiClient.js';

export async function incidentsCommand(args = []) {
  let server = null;
  let token = null;
  let apiKey = null;

  for (const arg of args) {
    if (arg.startsWith('--server=')) server = arg.split('=')[1];
    if (arg.startsWith('--token=')) token = arg.split('=')[1];
    if (arg.startsWith('--key=') || arg.startsWith('--api-key=')) apiKey = arg.split('=')[1];
  }

  try {
    const list = await ApiClient.listIncidents({ server, token, apiKey });
    if (!list || list.length === 0) {
      console.log('\nNo incidents found for your account.\n');
      return;
    }

    console.log(`\nFound ${list.length} recent incidents:\n`);
    console.log(`| Incident ID | Project | Status | Error | URL |`);
    console.log(`|-------------|---------|--------|-------|-----|`);

    for (const inc of list) {
      const shortId = inc.id.slice(0, 8);
      const proj = (inc.project_name || 'App').slice(0, 15);
      const status = inc.status;
      const msg = (inc.error_message || 'Error').slice(0, 30);
      const url = (inc.page_url || '').slice(0, 25);
      console.log(`| ${shortId} | ${proj} | ${status} | ${msg} | ${url} |`);
    }

    console.log(`\nTo run local reproduction: npx bugreplay run <incident-id>\n`);
  } catch (err) {
    console.error(`❌ Error fetching incidents: ${err.message}`);
    process.exit(1);
  }
}
