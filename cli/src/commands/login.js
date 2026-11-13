import { ApiClient } from '../services/apiClient.js';
import { saveConfig } from '../utils/configStore.js';

export async function loginCommand(args) {
  let email = null;
  let password = null;
  let token = null;

  for (const arg of args) {
    if (arg.startsWith('--email=')) email = arg.split('=')[1];
    if (arg.startsWith('--password=')) password = arg.split('=')[1];
    if (arg.startsWith('--token=')) token = arg.split('=')[1];
  }

  if (token) {
    saveConfig({ token });
    console.log('✓ Successfully authenticated using token.');
    return;
  }

  if (!email || !password) {
    console.error('Usage: npx bugreplay login --email=<email> --password=<password>');
    console.error('   or: npx bugreplay login --token=<jwt_token>');
    process.exit(1);
  }

  try {
    const result = await ApiClient.login(email, password);
    saveConfig({ token: result.token, userEmail: result.user.email });
    console.log(`\n==============================================`);
    console.log(`✓ Welcome back, ${result.user.email}!`);
    console.log(`🔑 Authentication token stored in ~/.bugreplay/config.json`);
    console.log(`==============================================\n`);
  } catch (err) {
    console.error(`❌ Authentication failed: ${err.message}`);
    process.exit(1);
  }
}
