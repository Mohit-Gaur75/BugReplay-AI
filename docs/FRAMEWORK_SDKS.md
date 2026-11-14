# BugReplay AI Framework SDKs & Developer Ecosystem

BugReplay AI provides first-class developer ecosystem packages and framework SDKs designed for zero runtime overhead, rich telemetry, and automated Playwright repro test generation.

---

## Packages Overview

| Package | Purpose | Peer Dependencies |
| :--- | :--- | :--- |
| **`@bugreplay/sdk`** | Core browser flight recorder, rolling ring buffer, PII masking, DOM event listeners | None |
| **`@bugreplay/react`** | React integration: Context Provider, Error Boundary with Component Stack capture, Hooks & HOCs | `react >= 18.0.0` |
| **`@bugreplay/next`** | Next.js integration: App Router script injection, Error Boundary digest extraction, API route wrapper | `next >= 13.0.0`, `react >= 18.0.0` |

---

## 1. `@bugreplay/react`

### Installation
```bash
npm install @bugreplay/react @bugreplay/sdk
# or
pnpm add @bugreplay/react @bugreplay/sdk
# or
yarn add @bugreplay/react @bugreplay/sdk
```

### 1. Root Setup (`BugReplayProvider`)
Wrap your application root with `<BugReplayProvider>` to initialize the flight recorder once and provide contextual methods throughout your component tree:

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BugReplayProvider } from '@bugreplay/react';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BugReplayProvider
      apiKey="br_live_your_project_key"
      endpoint="https://your-bugreplay-instance.com/api/v1/ingest"
      maxEvents={15}
      maskPii={true}
    >
      <App />
    </BugReplayProvider>
  </React.StrictMode>
);
```

### 2. Error Boundary (`BugReplayErrorBoundary`)
Catches uncaught rendering errors, extracts the React component stack, pushes a `react_component_stack` breadcrumb, and dispatches the incident to BugReplay for Playwright test generation:

```jsx
import React from 'react';
import { BugReplayErrorBoundary } from '@bugreplay/react';
import CheckoutWidget from './CheckoutWidget';

export function CheckoutPage() {
  return (
    <BugReplayErrorBoundary
      extraContext={{ page: 'checkout', tier: 'enterprise' }}
      fallback={({ error, resetError }) => (
        <div className="error-card">
          <h3>Failed to load checkout</h3>
          <p>{error?.message}</p>
          <button onClick={resetError}>Retry</button>
        </div>
      )}
    >
      <CheckoutWidget />
    </BugReplayErrorBoundary>
  );
}
```

### 3. Custom Hook (`useBugReplay`)
Use inside any functional component to access error capture, manual breadcrumb emission, or open the interactive report modal:

```jsx
import React from 'react';
import { useBugReplay } from '@bugreplay/react';

export function PaymentButton() {
  const { captureException, addBreadcrumb, showReportWidget } = useBugReplay();

  const handlePayment = async () => {
    addBreadcrumb({
      type: 'custom',
      action: 'click_pay',
      timestamp: Date.now(),
    });

    try {
      await processTransaction();
    } catch (err) {
      captureException(err, 'Payment execution failed');
    }
  };

  return (
    <div>
      <button onClick={handlePayment}>Pay Now</button>
      <button onClick={showReportWidget}>Report Issue</button>
    </div>
  );
}
```

### 4. Higher-Order Component (`withBugReplay`)
Wrap class or functional components directly:

```jsx
import { withBugReplay } from '@bugreplay/react';
import ComplexChart from './ComplexChart';

export default withBugReplay(ComplexChart, {
  extraContext: { feature: 'data-analytics-v2' },
});
```

---

## 2. `@bugreplay/next`

### Installation
```bash
npm install @bugreplay/next @bugreplay/react @bugreplay/sdk
```

### 1. App Router Root Layout (`app/layout.tsx`)
Injects the non-blocking flight recorder script with configured data attributes:

```tsx
import { BugReplayNextScript } from '@bugreplay/next';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <BugReplayNextScript
          apiKey={process.env.NEXT_PUBLIC_BUGREPLAY_KEY}
          endpoint={process.env.NEXT_PUBLIC_BUGREPLAY_ENDPOINT}
          captureConsole={true}
          captureNetwork={true}
          captureBodyUrls={['/api/orders', '/api/checkout']}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

### 2. Next.js App Router Error Boundaries (`app/error.tsx` & `app/global-error.tsx`)
Next.js obfuscates error messages in production on the client while assigning an error `digest`. `captureNextError` extracts this digest, logs route breadcrumbs, and reports the error:

```tsx
'use client';

import { useEffect } from 'react';
import { captureNextError } from '@bugreplay/next';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Captures error message, digest, route, and flight recorder telemetry
    captureNextError(error, { route: window.location.pathname });
  }, [error]);

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>Something went wrong!</h2>
      {error.digest && <p style={{ color: '#888' }}>Error ID: {error.digest}</p>}
      <button onClick={() => reset()}>Try Again</button>
    </div>
  );
}
```

### 3. API Route & Route Handler Protection (`withBugReplayApi`)
Protects server-side endpoints (both Next.js App Router Route Handlers and Pages Router API routes). Automatically dispatches server incidents to BugReplay when exceptions occur:

#### App Router Route Handler (`app/api/orders/route.ts`):
```ts
import { withBugReplayApi } from '@bugreplay/next';
import { NextResponse } from 'next/server';

async function handler(req: Request) {
  const body = await req.json();
  if (!body.itemId) {
    throw new Error('Item ID is required for order creation');
  }
  return NextResponse.json({ success: true });
}

export const POST = withBugReplayApi(handler, {
  apiKey: process.env.BUGREPLAY_API_KEY,
  endpoint: process.env.BUGREPLAY_ENDPOINT,
});
```

#### Pages Router API Route (`pages/api/users.ts`):
```ts
import { withBugReplayApi } from '@bugreplay/next';
import type { NextApiRequest, NextApiResponse } from 'next';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await database.findUser(req.query.id);
  res.status(200).json(user);
}

export default withBugReplayApi(handler, {
  apiKey: process.env.BUGREPLAY_API_KEY,
});
```

---

## 3. Core `@bugreplay/sdk` ESM & TypeScript

The core `@bugreplay/sdk` now ships with modern ES module entry points and full TypeScript definitions:

```ts
import { init, captureException, addBreadcrumb, getClient } from '@bugreplay/sdk';

init({
  apiKey: 'br_live_my_key',
  endpoint: 'http://localhost:5001/api/v1/ingest',
  maxEvents: 20,
  maskPii: true,
});

captureException(new Error('Fatal UI crash'), 'Optional developer note');
```
