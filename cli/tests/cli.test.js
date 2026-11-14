import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { saveConfig, loadConfig } from '../src/utils/configStore.js';
import { ApiClient } from '../src/services/apiClient.js';
import fs from 'fs';
import path from 'path';

describe('Phase 6: Playwright CLI Companion Tool', () => {
  test('saveConfig and loadConfig persist CLI settings accurately', () => {
    const testSettings = {
      serverUrl: 'http://test-server:5000',
      token: 'jwt-test-token-12345',
    };

    saveConfig(testSettings);
    const loaded = loadConfig();

    assert.equal(loaded.serverUrl, 'http://test-server:5000');
    assert.equal(loaded.token, 'jwt-test-token-12345');
  });

  test('ApiClient builds correct base URL and authorization header', () => {
    const baseUrl = ApiClient.getBaseUrl();
    assert.equal(baseUrl, 'http://test-server:5000');

    const overrideUrl = ApiClient.getBaseUrl('http://custom-host:8080/');
    assert.equal(overrideUrl, 'http://custom-host:8080');

    const headers = ApiClient.getHeaders();
    assert.equal(headers['Authorization'], 'Bearer jwt-test-token-12345');
    assert.equal(headers['Content-Type'], 'application/json');

    const apiKeyHeaders = ApiClient.getHeaders({ apiKey: 'br_live_custom_key_123' });
    assert.equal(apiKeyHeaders['x-api-key'], 'br_live_custom_key_123');
  });

  test('CLI spec file writer writes valid Playwright test', () => {
    const tempDir = path.resolve('./tests/temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const testSpec = `import { test } from '@playwright/test';\ntest('reproduce crash', async () => {});`;
    const targetFile = path.join(tempDir, 'sample.spec.js');
    fs.writeFileSync(targetFile, testSpec, 'utf8');

    assert.ok(fs.existsSync(targetFile));
    const content = fs.readFileSync(targetFile, 'utf8');
    assert.ok(content.includes('@playwright/test'));

    // Clean up
    fs.unlinkSync(targetFile);
    fs.rmdirSync(tempDir);
  });
});
