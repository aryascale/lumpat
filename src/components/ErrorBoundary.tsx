import React, { Component, ErrorInfo, ReactNode } from "react";
import { logClientActivity } from "../lib/frontend-logger";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    logClientActivity("FRONTEND_ERROR", error.message, { 
      stack: error.stack, 
      componentStack: errorInfo.componentStack 
    });
  }

  private handleResetAndReload = () => {
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("admin_tab_")) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.error("Failed to clear admin_tab from localStorage:", e);
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-lg w-full border border-red-100 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-black text-stone-900 mb-2 tracking-tight">Terjadi Kesalahan</h1>
            <p className="text-stone-500 mb-4 text-sm">
              Maaf, terjadi kesalahan teknis pada sistem kami.
            </p>
            {this.state.error && (
              <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-left text-xs font-mono text-red-700 overflow-auto max-h-32">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <button 
                className="flex-1 py-3 bg-stone-900 text-white rounded-xl font-bold hover:bg-stone-800 transition-colors text-sm"
                onClick={() => window.location.reload()}
              >
                Muat Ulang Halaman
              </button>
              <button 
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors text-sm"
                onClick={this.handleResetAndReload}
              >
                Reset Tab & Muat Ulang
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
