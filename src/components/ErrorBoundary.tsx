import React from 'react';
import firebaseConfig from '../../firebase-applet-config.json';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
  operationContext: string | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
    operationContext: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    let message = error.message || 'An unexpected error occurred.';
    let context: string | null = null;
    try {
      const parsed = JSON.parse(error.message) as {
        error?: string;
        operationType?: string;
        path?: string;
      };
      if (parsed && typeof parsed === 'object' && parsed.error) {
        message = parsed.error;
        context = `${parsed.operationType ?? 'operation'} on ${parsed.path ?? 'Firestore'}`;
      }
    } catch {
      // Plain error message
    }
    return {
      hasError: true,
      errorMessage: message,
      operationContext: context,
    };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Uncaught application error:', error, errorInfo);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, errorMessage: '', operationContext: null });
  };

  public render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isDailyReadQuota = this.state.errorMessage.includes(
      "Quota exceeded for quota metric 'Free daily read units per project (free tier database)'"
    );
    const isQuotaError = this.state.errorMessage.includes('Quota exceeded');
    const upgradeUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`;

    return (
      <div className="min-h-screen bg-[#f7f5fb] flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-[#e8e1ef] rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[#241436] mb-2">Something went wrong</h2>
          <p className="text-sm text-[#6c6277] mb-3">{this.state.errorMessage}</p>
          {this.state.operationContext && (
            <p className="text-xs font-mono bg-[#faf3fc] border border-[#f0dff1] text-[#644475] rounded-lg px-3 py-2 mb-4">
              Context: {this.state.operationContext}
            </p>
          )}
          {isDailyReadQuota && (
            <p className="text-xs text-[#644475] mb-4">
              Free daily read units were reached. You can review or upgrade your Firestore database in the{' '}
              <a
                href={upgradeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-[#56249a]"
              >
                Firebase Console
              </a>
              .
            </p>
          )}
          {!isDailyReadQuota && isQuotaError && (
            <p className="text-xs text-[#644475] mb-4">
              Firestore free-tier quota resets the next day. Details are available under the Spark plan column on{' '}
              <a
                href="https://firebase.google.com/pricing#cloud-firestore"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-[#56249a]"
              >
                Firebase Pricing
              </a>
              .
            </p>
          )}
          <button
            type="button"
            onClick={this.handleReset}
            className="px-4 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#5c28a1] to-[#9e2c9b] hover:opacity-95 cursor-pointer"
          >
            Return to Workspace
          </button>
        </div>
      </div>
    );
  }
}
