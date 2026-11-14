import React from 'react';
export * from '@bugreplay/react';

export interface BugReplayNextScriptProps {
  apiKey?: string;
  endpoint?: string;
  src?: string;
  captureConsole?: boolean;
  captureNetwork?: boolean;
  captureBodyUrls?: string[];
}

export function BugReplayNextScript(props: BugReplayNextScriptProps): React.JSX.Element;

export interface NextErrorContext {
  digest?: string;
  route?: string;
  [key: string]: any;
}

export function captureNextError(error: any, context?: NextErrorContext): void;

export interface WithBugReplayApiOptions {
  apiKey?: string;
  endpoint?: string;
}

export function withBugReplayApi<T extends (...args: any[]) => any>(
  handler: T,
  options?: WithBugReplayApiOptions
): T;
