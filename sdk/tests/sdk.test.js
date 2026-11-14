import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sdkPath = path.resolve(__dirname, '../src/bugreplay.js');

// Load SDK into Node sandbox for unit testing
const sdkCode = fs.readFileSync(sdkPath, 'utf8');

// Mock browser globals
const mockWindow = {
  addEventListener: () => {},
};
const mockDocument = {
  currentScript: null,
  addEventListener: () => {},
  querySelector: () => null,
};

const mockModule = { exports: {} };

const evaluateSdk = new Function('window', 'document', 'module', sdkCode);
evaluateSdk(mockWindow, mockDocument, mockModule);

const { RingBuffer, scrubText, scrubUrl, isSensitiveElement, scrubPayload, BugReplayClient, getDeviceAndNetworkHealth } = mockModule.exports;

describe('Phase 3: Client Capture SDK Subsystems', () => {
  describe('Rolling Ring Buffer', () => {
    test('maintains correct chronological items when under capacity', () => {
      const buffer = new RingBuffer(15);
      buffer.push({ type: 'click', id: 'btn-1' });
      buffer.push({ type: 'click', id: 'btn-2' });

      const items = buffer.getItems();
      assert.equal(items.length, 2);
      assert.equal(items[0].id, 'btn-1');
      assert.equal(items[1].id, 'btn-2');
    });

    test('strictly bounds capacity to 15 items and drops oldest', () => {
      const buffer = new RingBuffer(15);
      for (let i = 1; i <= 25; i++) {
        buffer.push({ type: 'click', id: `btn-${i}` });
      }

      const items = buffer.getItems();
      assert.equal(items.length, 15, 'Capacity must never exceed 15 items');
      assert.equal(items[0].id, 'btn-11', 'Oldest preserved item must be #11');
      assert.equal(items[14].id, 'btn-25', 'Newest item must be #25');
    });

    test('clear() resets buffer state cleanly', () => {
      const buffer = new RingBuffer(15);
      buffer.push({ type: 'click', id: '1' });
      buffer.clear();
      assert.equal(buffer.getItems().length, 0);
    });
  });

  describe('PII Masking & Data Redaction', () => {
    test('scrubText masks 16-digit credit card sequences', () => {
      const raw = 'Payment with card 4111 2222 3333 4444 approved';
      const clean = scrubText(raw);
      assert.equal(clean, 'Payment with card ••••-••••-••••-•••• approved');
      assert.ok(!clean.includes('4111'));
    });

    test('scrubUrl masks sensitive query parameters', () => {
      const rawUrl = 'https://api.example.com/checkout?token=secret123&user=john&password=mypassword';
      const cleanUrl = scrubUrl(rawUrl);
      assert.ok(!cleanUrl.includes('secret123'));
      assert.ok(!cleanUrl.includes('mypassword'));
      assert.ok(cleanUrl.includes('user=john'));
    });

    test('isSensitiveElement identifies password, cvv and data-private inputs', () => {
      const mockPasswordInput = {
        getAttribute: (attr) => (attr === 'type' ? 'password' : null),
        hasAttribute: () => false,
      };
      assert.equal(isSensitiveElement(mockPasswordInput), true);

      const mockCvvInput = {
        getAttribute: (attr) => (attr === 'name' ? 'cvvCode' : null),
        hasAttribute: () => false,
      };
      assert.equal(isSensitiveElement(mockCvvInput), true);

      const mockPrivateDiv = {
        getAttribute: () => null,
        hasAttribute: (attr) => attr === 'data-private',
      };
      assert.equal(isSensitiveElement(mockPrivateDiv), true);

      const mockStandardBtn = {
        getAttribute: (attr) => (attr === 'type' ? 'submit' : null),
        hasAttribute: () => false,
      };
      assert.equal(isSensitiveElement(mockStandardBtn), false);
    });

    test('scrubPayload redacts sensitive keys and credit cards in objects and JSON strings', () => {
      const payload = {
        operationName: 'CheckoutMutation',
        variables: {
          cartId: 'cart_9912',
          password: 'superSecret123',
          apiKey: 'key_live_xyz',
          notes: 'Customer card: 4111 2222 3333 4444 on file',
        },
      };

      const clean = scrubPayload(payload);
      assert.equal(clean.operationName, 'CheckoutMutation');
      assert.equal(clean.variables.cartId, 'cart_9912');
      assert.equal(clean.variables.password, '[REDACTED_PII]');
      assert.equal(clean.variables.apiKey, '[REDACTED_PII]');
      assert.ok(!JSON.stringify(clean).includes('superSecret123'));
      assert.ok(!JSON.stringify(clean).includes('4111'));
      assert.ok(clean.variables.notes.includes('••••-••••-••••-••••'));
    });

    test('shouldCaptureBody matches allowlisted endpoints correctly', () => {
      const client = new BugReplayClient();
      client.init({
        captureBodyUrls: ['/api/v1/graphql', '/api/v1/cart', /\/checkout\/\d+/],
      });

      assert.equal(client.shouldCaptureBody('/api/v1/graphql'), true);
      assert.equal(client.shouldCaptureBody('/api/v1/cart/items'), true);
      assert.equal(client.shouldCaptureBody('/checkout/12345'), true);
      assert.equal(client.shouldCaptureBody('/api/v1/analytics'), false);
      assert.equal(client.shouldCaptureBody('/static/bundle.js'), false);
    });
  });

  describe('Device & Network Health Signals', () => {
    test('getDeviceAndNetworkHealth extracts hardware, network, and battery information safely', () => {
      assert.ok(typeof getDeviceAndNetworkHealth === 'function');
      const health = getDeviceAndNetworkHealth();
      assert.ok(health, 'Expected health object');
      assert.ok(health.device, 'Expected device object');
      assert.ok('dpr' in health.device);
      assert.ok('colorScheme' in health.device);
    });
  });
});
