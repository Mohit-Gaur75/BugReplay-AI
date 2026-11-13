import { saveConfig, loadConfig } from '../utils/configStore.js';

export function configureCommand(args) {
  let server = null;

  for (const arg of args) {
    if (arg.startsWith('--server=')) server = arg.split('=')[1];
  }

  if (server) {
    saveConfig({ serverUrl: server });
    console.log(`✓ Server URL configured to: ${server}`);
  } else {
    const config = loadConfig();
    console.log('\nBugReplay CLI Current Configuration:');
    console.log(`- Server: ${config.serverUrl}`);
    console.log(`- Authenticated: ${config.token ? 'Yes' : 'No'}`);
    if (config.userEmail) console.log(`- User: ${config.userEmail}`);
    console.log('\nTo update: npx bugreplay configure --server=http://localhost:5000\n');
  }
}
