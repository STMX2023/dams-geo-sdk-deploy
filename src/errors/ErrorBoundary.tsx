/**
 * React Native Error Boundary for DAMS Geo SDK
 * 
 * Provides error boundaries for SDK-related components
 */

import React, { Component, ReactNode } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { DamsGeoError, isDamsGeoError } from './DamsGeoError';
import ErrorManager from './ErrorManager';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component for catching React errors
 */
export class DamsGeoErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }
  
  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error
    };
  }
  
  componentDidCatch(error: Error, errorInfo: any) {
    // Report to ErrorManager
    ErrorManager.handleError(error, {
      component: 'ErrorBoundary',
      metadata: errorInfo
    });
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }
  
  resetError = () => {
    this.setState({
      hasError: false,
      error: null
    });
  };
  
  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.resetError);
      }
      
      // Default error UI
      return <DefaultErrorFallback error={this.state.error} reset={this.resetError} />;
    }
    
    return this.props.children;
  }
}

/**
 * Default error fallback component
 */
const DefaultErrorFallback: React.FC<{ error: Error; reset: () => void }> = ({ error, reset }) => {
  const damsError = isDamsGeoError(error) ? error : null;
  const userMessage = damsError?.userMessage;
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {userMessage?.title || 'Something Went Wrong'}
      </Text>
      
      <Text style={styles.message}>
        {userMessage?.message || 'An unexpected error occurred.'}
      </Text>
      
      {userMessage?.action && (
        <Text style={styles.action}>{userMessage.action}</Text>
      )}
      
      <Button title="Try Again" onPress={reset} />
      
      {__DEV__ && (
        <View style={styles.debugInfo}>
          <Text style={styles.debugTitle}>Debug Info:</Text>
          <Text style={styles.debugText}>
            {error.name}: {error.message}
          </Text>
          {damsError && (
            <Text style={styles.debugText}>
              Code: {damsError.code}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

/**
 * Hook for error handling in functional components
 */
export function useDamsGeoError() {
  const [error, setError] = React.useState<DamsGeoError | null>(null);
  
  const clearError = React.useCallback(() => {
    setError(null);
  }, []);
  
  const handleError = React.useCallback(async (error: unknown, context?: any) => {
    const damsError = isDamsGeoError(error) ? error : null;
    if (damsError) {
      setError(damsError);
    }
    
    await ErrorManager.handleError(error, context);
  }, []);
  
  return {
    error,
    clearError,
    handleError,
    hasError: error !== null
  };
}

/**
 * Higher-order component for adding error boundary
 */
export function withDamsGeoErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: (error: Error, reset: () => void) => ReactNode
): React.ComponentType<P> {
  return (props: P) => (
    <DamsGeoErrorBoundary fallback={fallback}>
      <Component {...props} />
    </DamsGeoErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5'
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333'
  },
  message: {
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
    color: '#666'
  },
  action: {
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
    color: '#007AFF',
    fontStyle: 'italic'
  },
  debugInfo: {
    marginTop: 30,
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ddd'
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333'
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace'
  }
});