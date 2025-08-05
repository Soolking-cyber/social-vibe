'use client';

import React from 'react';

interface SimpleErrorBoundaryState {
  hasError: boolean;
}

interface SimpleErrorBoundaryProps {
  children: React.ReactNode;
}

export class SimpleErrorBoundary extends React.Component<SimpleErrorBoundaryProps, SimpleErrorBoundaryState> {
  constructor(props: SimpleErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): SimpleErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Just log the error, don't do any complex operations
    console.error('Simple error boundary caught:', error.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '16px',
          backgroundColor: '#1e293b',
          border: '1px solid #475569',
          borderRadius: '8px',
          color: '#e2e8f0',
          textAlign: 'center' as const
        }}>
          <p>⚠️ Component failed to load</p>
          <p style={{ fontSize: '14px', color: '#94a3b8', marginTop: '8px' }}>
            Please refresh the page to try again
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}