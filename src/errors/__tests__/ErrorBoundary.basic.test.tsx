import React from 'react';
import { Text } from 'react-native';
import TestRenderer from 'react-test-renderer';
import {
  DamsGeoErrorBoundary,
  useDamsGeoError,
  withDamsGeoErrorBoundary
} from '../ErrorBoundary';
import { DamsGeoError, DamsGeoErrorCode } from '../DamsGeoError';
import ErrorManager from '../ErrorManager';

// Add type declaration for react-test-renderer
declare module 'react-test-renderer' {
  const TestRenderer: any;
  export default TestRenderer;
}

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

describe('DamsGeoErrorBoundary Basic Tests', () => {
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

  it('should render children when no error occurs', () => {
    const testRenderer = TestRenderer.create(
      <DamsGeoErrorBoundary>
        <WorkingComponent />
      </DamsGeoErrorBoundary>
    );

    const tree = testRenderer.toJSON();
    expect(tree).toMatchSnapshot();
    
    const text = testRenderer.root.findByType(Text);
    expect(text.props.children).toBe('Working Component');
  });

  it('should catch errors and display fallback', () => {
    const testError = new Error('Test error');
    
    const testRenderer = TestRenderer.create(
      <DamsGeoErrorBoundary>
        <ThrowError error={testError} />
      </DamsGeoErrorBoundary>
    );

    // Check that error boundary caught the error
    expect(mockHandleError).toHaveBeenCalledWith(testError, {
      component: 'ErrorBoundary',
      metadata: expect.any(Object)
    });

    // Check that fallback UI is rendered
    const texts = testRenderer.root.findAllByType(Text);
    const titles = texts.map((t: any) => t.props.children);
    expect(titles).toContain('Something Went Wrong');
    expect(titles).toContain('An unexpected error occurred.');
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

    const testRenderer = TestRenderer.create(
      <DamsGeoErrorBoundary>
        <ThrowError error={damsError} />
      </DamsGeoErrorBoundary>
    );

    const texts = testRenderer.root.findAllByType(Text);
    const content = texts.map((t: any) => t.props.children);
    
    expect(content).toContain('Location Error');
    expect(content).toContain('Could not get your location');
    expect(content).toContain('Please check GPS settings');
  });

  it('should call custom onError handler', () => {
    const onError = jest.fn();
    const testError = new Error('Test error');
    
    TestRenderer.create(
      <DamsGeoErrorBoundary onError={onError}>
        <ThrowError error={testError} />
      </DamsGeoErrorBoundary>
    );

    expect(onError).toHaveBeenCalledWith(testError, expect.any(Object));
  });
});

describe('withDamsGeoErrorBoundary Basic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should wrap component with error boundary', () => {
    const TestComponent: React.FC = () => <Text>Test Component</Text>;
    const WrappedComponent = withDamsGeoErrorBoundary(TestComponent);

    const testRenderer = TestRenderer.create(<WrappedComponent />);
    
    const text = testRenderer.root.findByType(Text);
    expect(text.props.children).toBe('Test Component');
  });

  it('should catch errors in wrapped component', () => {
    const ErrorComponent: React.FC = () => {
      throw new Error('Component error');
    };
    const WrappedComponent = withDamsGeoErrorBoundary(ErrorComponent);

    const testRenderer = TestRenderer.create(<WrappedComponent />);
    
    const texts = testRenderer.root.findAllByType(Text);
    const content = texts.map((t: any) => t.props.children);
    expect(content).toContain('Something Went Wrong');
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

    const testRenderer = TestRenderer.create(
      <WrappedComponent message="Hello" count={42} />
    );
    
    const text = testRenderer.root.findByType(Text);
    expect(text.props.children).toBe('Hello - 42');
  });
});

describe('useDamsGeoError Basic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const mockHandleError = jest.fn().mockResolvedValue(undefined);
    (ErrorManager.handleError as jest.Mock) = mockHandleError;
  });

  // Test component that uses the hook
  const TestHookComponent: React.FC<{ onRender?: (hookResult: any) => void }> = ({ onRender }) => {
    const hookResult = useDamsGeoError();
    
    // Call onRender with hook result if provided
    React.useEffect(() => {
      if (onRender) {
        onRender(hookResult);
      }
    }, [hookResult, onRender]);

    return (
      <Text>
        {hookResult.hasError ? hookResult.error?.message : 'no error'}
      </Text>
    );
  };

  it('should initialize with no error', () => {
    let hookResult: any;
    
    TestRenderer.create(
      <TestHookComponent onRender={(result) => { hookResult = result; }} />
    );

    expect(hookResult.error).toBeNull();
    expect(hookResult.hasError).toBe(false);
    expect(typeof hookResult.handleError).toBe('function');
    expect(typeof hookResult.clearError).toBe('function');
  });

  it('should handle errors', async () => {
    let hookResult: any;
    
    const testRenderer = TestRenderer.create(
      <TestHookComponent onRender={(result) => { hookResult = result; }} />
    );

    const testError = new DamsGeoError(
      DamsGeoErrorCode.LOCATION_ERROR,
      'Location error'
    );

    // Call handleError
    await TestRenderer.act(async () => {
      await hookResult.handleError(testError, { context: 'test' });
    });

    // Re-render to get updated state
    testRenderer.update(
      <TestHookComponent onRender={(result) => { hookResult = result; }} />
    );

    expect(hookResult.error).toBe(testError);
    expect(hookResult.hasError).toBe(true);
    expect(ErrorManager.handleError).toHaveBeenCalledWith(testError, { context: 'test' });
  });
});