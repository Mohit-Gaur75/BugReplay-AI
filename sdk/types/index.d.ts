export interface BugReplayOptions {
  apiKey?: string;
  endpoint?: string;
  maxEvents?: number;
  captureConsole?: boolean;
  captureNetwork?: boolean;
  captureClicks?: boolean;
  captureBodyUrls?: string[];
  maskPii?: boolean;
}

export interface TelemetryBreadcrumb {
  type: 'click' | 'network' | 'console' | 'user_report' | 'custom' | string;
  timestamp?: number;
  [key: string]: any;
}

export interface BugReplayClientInstance {
  init(options?: BugReplayOptions): void;
  captureIncident(errorDetails: { errorMessage: string; errorType?: string; errorStack?: string }, userNote?: string): void;
  showReportWidget(): void;
  buffer?: {
    getItems(): TelemetryBreadcrumb[];
    clear(): void;
    push(item: TelemetryBreadcrumb): void;
  };
}

export function init(options: BugReplayOptions): BugReplayClientInstance | null;
export function captureException(error: Error | string, note?: string): void;
export function addBreadcrumb(event: TelemetryBreadcrumb): void;
export function showReportWidget(): void;
export function getClient(): BugReplayClientInstance | null;

declare const _default: {
  init: typeof init;
  captureException: typeof captureException;
  addBreadcrumb: typeof addBreadcrumb;
  showReportWidget: typeof showReportWidget;
  getClient: typeof getClient;
};

export default _default;

declare global {
  interface Window {
    BugReplay?: BugReplayClientInstance;
    __BUGREPLAY_INITIALIZED__?: boolean;
  }
}
