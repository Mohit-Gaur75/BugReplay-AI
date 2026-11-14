import React, { Component, ComponentType, ReactNode, ErrorInfo } from 'react';
import { BugReplayOptions, BugReplayClientInstance, TelemetryBreadcrumb } from '@bugreplay/sdk';

export interface BugReplayProviderProps extends BugReplayOptions {
  children: ReactNode;
}

export function BugReplayProvider(props: BugReplayProviderProps): React.JSX.Element;

export interface FallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  resetError: () => void;
}

export interface BugReplayErrorBoundaryProps {
  children?: ReactNode;
  fallback?: ReactNode | ((props: FallbackProps) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  extraContext?: Record<string, any> | (() => Record<string, any>);
}

export interface BugReplayErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class BugReplayErrorBoundary extends Component<BugReplayErrorBoundaryProps, BugReplayErrorBoundaryState> {
  resetError(): void;
}

export interface UseBugReplayReturn {
  apiKey: string | null;
  client: BugReplayClientInstance | null;
  captureException: (error: Error | string, note?: string) => void;
  addBreadcrumb: (event: TelemetryBreadcrumb) => void;
  showReportWidget: () => void;
}

export function useBugReplay(): UseBugReplayReturn;

export function withBugReplay<P extends object>(
  WrappedComponent: ComponentType<P>,
  errorBoundaryProps?: BugReplayErrorBoundaryProps
): ComponentType<P>;

export {
  init,
  captureException,
  addBreadcrumb,
  showReportWidget,
  getClient,
} from '@bugreplay/sdk';
