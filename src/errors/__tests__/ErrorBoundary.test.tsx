import React from 'react';
import { Text, View, Button } from 'react-native';

// Mock react-test-renderer to avoid version mismatch
jest.mock('react-test-renderer', () => ({
  version: '19.1.0'
}), { virtual: true });

import { render, fireEvent } from '@testing-library/react-native';
import {
  DamsGeoErrorBoundary,
  useDamsGeoError,
  withDamsGeoErrorBoundary
} from '../ErrorBoundary';
import { DamsGeoError, DamsGeoErrorCode } from '../DamsGeoError';
import ErrorManager from '../ErrorManager';

// Mock ErrorManager
jest.mock('../ErrorManager');

// Mock __DEV__
(global as any).__DEV__ = true;

// Component that throws an error
const ThrowError: React.FC<{ error: Error }> = ({ error }) => {
  throw error;
};

// Component that works normally
const WorkingComponent: React.FC = () => {
  return <Text>Working Component</Text>;
};

describe('DamsGeoErrorBoundary', () => {
  let mockHandleError: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockHandleError = jest.fn().mockResolvedValue(undefined);
    (ErrorManager.handleError as jest.Mock) = mockHandleError;
    
    // Suppress console errors during tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Error Handling', () => {
    it('should catch errors and display default fallback', () => {
      const testError = new Error('Test error');
      
      const { getByText } = render(
        <DamsGeoErrorBoundary>
          <ThrowError error={testError} />
        </DamsGeoErrorBoundary>
      );

      expect(getByText('Something Went Wrong')).toBeTruthy();
      expect(getByText('An unexpected error occurred.')).toBeTruthy();
      expect(getByText('Try Again')).toBeTruthy();
    });

    it('should display DamsGeoError user message', () => {
      const damsError = new DamsGeoError(
        DamsGeoErrorCode.LOCATION_TIMEOUT,
        'Location timeout',
        {
          userMessage: {
            title: 'Location Error',
            message: 'Could not get your location',
            action: 'Please check GPS settings'
          }
        }
      );

      const { getByText } = render(
        <DamsGeoErrorBoundary>
          <ThrowError error={damsError} />
        </DamsGeoErrorBoundary>
      );

      expect(getByText('Location Error')).toBeTruthy();
      expect(getByText('Could not get your location')).toBeTruthy();
      expect(getByText('Please check GPS settings')).toBeTruthy();
    });

    it('should show debug info in development mode', () => {
      const testError = new DamsGeoError(
        DamsGeoErrorCode.DATABASE_ERROR,
        'Database error'
      );

      const { getByText } = render(
        <DamsGeoErrorBoundary>
          <ThrowError error={testError} />
        </DamsGeoErrorBoundary>
      );

      expect(getByText('Debug Info:')).toBeTruthy();
      expect(getByText('DamsGeoError: Database error')).toBeTruthy();
      expect(getByText('Code: DATABASE_ERROR')).toBeTruthy();
    });

    it('should not show debug info in production mode', () => {
      (global as any).__DEV__ = false;
      
      const testError = new Error('Test error');
      
      const { queryByText } = render(
        <DamsGeoErrorBoundary>
          <ThrowError error={testError} />
        </DamsGeoErrorBoundary>
      );

      expect(queryByText('Debug Info:')).toBeNull();
      
      (global as any).__DEV__ = true;
    });

    it('should report error to ErrorManager', () => {
      const testError = new Error('Test error');
      
      render(
        <DamsGeoErrorBoundary>
          <ThrowError error={testError} />
        </DamsGeoErrorBoundary>
      );

      expect(mockHandleError).toHaveBeenCalledWith(testError, {
        component: 'ErrorBoundary',
        metadata: expect.any(Object)
      });
    });

    it('should call custom onError handler', () => {
      const onError = jest.fn();
      const testError = new Error('Test error');
      
      render(
        <DamsGeoErrorBoundary onError={onError}>
          <ThrowError error={testError} />
        </DamsGeoErrorBoundary>
      );

      expect(onError).toHaveBeenCalledWith(testError, expect.any(Object));
    });

    it('should use custom fallback component', () => {
      const customFallback = (error: Error, reset: () => void) => (
        <View>
          <Text>Custom Error: {error.message}</Text>
          <Button title="Custom Reset" onPress={reset} />
        </View>
      );

      const testError = new Error('Test error');
      
      const { getByText, queryByText } = render(
        <DamsGeoErrorBoundary fallback={customFallback}>
          <ThrowError error={testError} />
        </DamsGeoErrorBoundary>
      );

      expect(getByText('Custom Error: Test error')).toBeTruthy();
      expect(getByText('Custom Reset')).toBeTruthy();
      expect(queryByText('Something Went Wrong')).toBeNull();
    });
  });

  describe('Reset Functionality', () => {
    it('should reset error state when Try Again is pressed', () => {
      const testError = new Error('Test error');
      let errorThrown = true;
      
      const ConditionalError: React.FC = () => {
        if (errorThrown) {
          throw testError;
        }
        return <Text>Component Recovered</Text>;
      };

      const { getByText, queryByText, rerender } = render(
        <DamsGeoErrorBoundary>
          <ConditionalError />
        </DamsGeoErrorBoundary>
      );

      expect(getByText('Something Went Wrong')).toBeTruthy();

      // Reset the error
      errorThrown = false;
      fireEvent.press(getByText('Try Again'));

      // Force re-render
      rerender(
        <DamsGeoErrorBoundary>
          <ConditionalError />
        </DamsGeoErrorBoundary>
      );

      expect(queryByText('Something Went Wrong')).toBeNull();
      expect(getByText('Component Recovered')).toBeTruthy();
    });

    it('should reset with custom fallback reset button', () => {
      const customFallback = (error: Error, reset: () => void) => (
        <View>
          <Text>Error Occurred</Text>
          <Button title="Reset" onPress={reset} />
        </View>
      );

      const testError = new Error('Test error');
      let errorThrown = true;
      
      const ConditionalError: React.FC = () => {
        if (errorThrown) {
          throw testError;
        }
        return <Text>Recovered</Text>;
      };

      const { getByText, queryByText, rerender } = render(
        <DamsGeoErrorBoundary fallback={customFallback}>
          <ConditionalError />
        </DamsGeoErrorBoundary>
      );

      expect(getByText('Error Occurred')).toBeTruthy();

      errorThrown = false;
      fireEvent.press(getByText('Reset'));

      rerender(
        <DamsGeoErrorBoundary fallback={customFallback}>
          <ConditionalError />
        </DamsGeoErrorBoundary>
      );

      expect(queryByText('Error Occurred')).toBeNull();
      expect(getByText('Recovered')).toBeTruthy();
    });
  });

  describe('Normal Rendering', () => {
    it('should render children when no error occurs', () => {
      const { getByText } = render(
        <DamsGeoErrorBoundary>
          <WorkingComponent />
        </DamsGeoErrorBoundary>
      );

      expect(getByText('Working Component')).toBeTruthy();
    });

    it('should pass through props to children', () => {
      const TestComponent: React.FC<{ testProp: string }> = ({ testProp }) => (
        <Text>{testProp}</Text>
      );

      const { getByText } = render(
        <DamsGeoErrorBoundary>
          <TestComponent testProp="Test Value" />
        </DamsGeoErrorBoundary>
      );

      expect(getByText('Test Value')).toBeTruthy();
    });
  });
});

describe('useDamsGeoError', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const mockHandleError = jest.fn().mockResolvedValue(undefined);
    (ErrorManager.handleError as jest.Mock) = mockHandleError;
  });

  // Test component that uses the hook
  const TestComponent: React.FC = () => {
    const { error, hasError, handleError, clearError } = useDamsGeoError();

    return (
      <View>
        <Text testID="hasError">{hasError ? 'true' : 'false'}</Text>
        <Text testID="errorMessage">{error?.message || 'no error'}</Text>
        <Button
          testID="handleDamsError"
          title="Handle DamsGeo Error"
          onPress={() => handleError(
            new DamsGeoError(DamsGeoErrorCode.LOCATION_ERROR, 'Location error'),
            { context: 'test' }
          )}
        />
        <Button
          testID="handleRegularError"
          title="Handle Regular Error"
          onPress={() => handleError(new Error('Regular error'))}
        />
        <Button
          testID="clearError"
          title="Clear Error"
          onPress={clearError}
        />
      </View>
    );
  };

  it('should initialize with no error', () => {
    const { getByTestId } = render(<TestComponent />);

    expect(getByTestId('hasError').props.children).toBe('false');
    expect(getByTestId('errorMessage').props.children).toBe('no error');
  });

  it('should handle DamsGeoError', async () => {
    const { getByTestId } = render(<TestComponent />);

    fireEvent.press(getByTestId('handleDamsError'));

    // Wait for state update
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(getByTestId('hasError').props.children).toBe('true');
    expect(getByTestId('errorMessage').props.children).toBe('Location error');
    expect(ErrorManager.handleError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: DamsGeoErrorCode.LOCATION_ERROR,
        message: 'Location error'
      }),
      { context: 'test' }
    );
  });

  it('should not set error for non-DamsGeoError', async () => {
    const { getByTestId } = render(<TestComponent />);

    fireEvent.press(getByTestId('handleRegularError'));

    // Wait for state update
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(getByTestId('hasError').props.children).toBe('false');
    expect(getByTestId('errorMessage').props.children).toBe('no error');
    expect(ErrorManager.handleError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Regular error'
      }),
      undefined
    );
  });

  it('should clear error', async () => {
    const { getByTestId } = render(<TestComponent />);

    // First set an error
    fireEvent.press(getByTestId('handleDamsError'));
    await new Promise(resolve => setTimeout(resolve, 0));
    
    expect(getByTestId('hasError').props.children).toBe('true');

    // Then clear it
    fireEvent.press(getByTestId('clearError'));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(getByTestId('hasError').props.children).toBe('false');
    expect(getByTestId('errorMessage').props.children).toBe('no error');
  });
});

describe('withDamsGeoErrorBoundary', () => {
  it('should wrap component with error boundary', () => {
    const TestComponent: React.FC = () => <Text>Test Component</Text>;
    const WrappedComponent = withDamsGeoErrorBoundary(TestComponent);

    const { getByText } = render(<WrappedComponent />);

    expect(getByText('Test Component')).toBeTruthy();
  });

  it('should catch errors in wrapped component', () => {
    const ErrorComponent: React.FC = () => {
      throw new Error('Component error');
    };
    const WrappedComponent = withDamsGeoErrorBoundary(ErrorComponent);

    const { getByText } = render(<WrappedComponent />);

    expect(getByText('Something Went Wrong')).toBeTruthy();
  });

  it('should use custom fallback', () => {
    const ErrorComponent: React.FC = () => {
      throw new Error('Component error');
    };
    
    const customFallback = (error: Error) => (
      <Text>Custom Fallback: {error.message}</Text>
    );
    
    const WrappedComponent = withDamsGeoErrorBoundary(ErrorComponent, customFallback);

    const { getByText } = render(<WrappedComponent />);

    expect(getByText('Custom Fallback: Component error')).toBeTruthy();
  });

  it('should pass props to wrapped component', () => {
    interface TestProps {
      message: string;
      count: number;
    }

    const TestComponent: React.FC<TestProps> = ({ message, count }) => (
      <Text>{message} - {count}</Text>
    );

    const WrappedComponent = withDamsGeoErrorBoundary(TestComponent);

    const { getByText } = render(
      <WrappedComponent message="Hello" count={42} />
    );

    expect(getByText('Hello - 42')).toBeTruthy();
  });
});