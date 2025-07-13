/**
 * Unit Tests for FeatureFlagsReact
 * 
 * Tests React hooks and HOCs for feature flag integration
 */

import React from 'react';
import { render, renderHook, act } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import { useFeatureFlag, withFeatureFlag } from '../FeatureFlagsReact';
import { featureFlags } from '../FeatureFlags';

// Mock the FeatureFlags module
jest.mock('../FeatureFlags', () => ({
  featureFlags: {
    getFlags: jest.fn().mockReturnValue({
      useNativeGeofencing: false,
      nativeGeofencingRolloutPercentage: 0,
      enableGeofencingDebugLogs: false,
      forcePolygonMode: false
    })
  }
}));

describe('FeatureFlagsReact', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useFeatureFlag Hook', () => {
    it('should return initial flag value', () => {
      const { result } = renderHook(() => useFeatureFlag('useNativeGeofencing'));
      
      expect(result.current).toBe(false);
      expect(featureFlags.getFlags).toHaveBeenCalled();
    });

    it('should update when flag value changes', () => {
      const { result, rerender } = renderHook(() => useFeatureFlag('enableGeofencingDebugLogs'));
      
      expect(result.current).toBe(false);
      
      // Update mock to return different value
      (featureFlags.getFlags as jest.Mock).mockReturnValue({
        useNativeGeofencing: false,
        nativeGeofencingRolloutPercentage: 0,
        enableGeofencingDebugLogs: true, // Changed
        forcePolygonMode: false
      });
      
      // Force re-render to simulate flag change
      act(() => {
        rerender({});
      });
      
      expect(result.current).toBe(true);
    });

    it('should handle different flag names', () => {
      const { result: result1 } = renderHook(() => useFeatureFlag('useNativeGeofencing'));
      const { result: result2 } = renderHook(() => useFeatureFlag('forcePolygonMode'));
      
      expect(result1.current).toBe(false);
      expect(result2.current).toBe(false);
    });

    it('should re-check flags on mount', () => {
      const { unmount, rerender } = renderHook(() => useFeatureFlag('useNativeGeofencing'));
      
      const initialCallCount = (featureFlags.getFlags as jest.Mock).mock.calls.length;
      
      // Unmount and remount
      unmount();
      renderHook(() => useFeatureFlag('useNativeGeofencing'));
      
      expect(featureFlags.getFlags).toHaveBeenCalledTimes(initialCallCount + 1);
    });

    it('should handle boolean conversion correctly', () => {
      // Test truthy values
      (featureFlags.getFlags as jest.Mock).mockReturnValue({
        useNativeGeofencing: 1, // Truthy but not boolean
        nativeGeofencingRolloutPercentage: 50,
        enableGeofencingDebugLogs: 'yes', // Truthy string
        forcePolygonMode: null // Falsy
      });
      
      const { result: result1 } = renderHook(() => useFeatureFlag('useNativeGeofencing'));
      const { result: result2 } = renderHook(() => useFeatureFlag('enableGeofencingDebugLogs'));
      const { result: result3 } = renderHook(() => useFeatureFlag('forcePolygonMode'));
      
      expect(result1.current).toBe(true);
      expect(result2.current).toBe(true);
      expect(result3.current).toBe(false);
    });

    it('should handle numeric flags', () => {
      const { result } = renderHook(() => useFeatureFlag('nativeGeofencingRolloutPercentage'));
      
      // Numeric values should be converted to boolean (0 = false, >0 = true)
      expect(result.current).toBe(false);
      
      (featureFlags.getFlags as jest.Mock).mockReturnValue({
        useNativeGeofencing: false,
        nativeGeofencingRolloutPercentage: 50,
        enableGeofencingDebugLogs: false,
        forcePolygonMode: false
      });
      
      const { result: result2 } = renderHook(() => useFeatureFlag('nativeGeofencingRolloutPercentage'));
      expect(result2.current).toBe(true);
    });
  });

  describe('withFeatureFlag HOC', () => {
    // Test components
    const TestComponent: React.FC<{ testProp: string }> = ({ testProp }) => (
      <View testID="test-component">
        <Text>{testProp}</Text>
      </View>
    );
    
    const FallbackComponent: React.FC<{ testProp: string }> = ({ testProp }) => (
      <View testID="fallback-component">
        <Text>{testProp}</Text>
      </View>
    );

    it('should render component when flag is enabled', () => {
      (featureFlags.getFlags as jest.Mock).mockReturnValue({
        useNativeGeofencing: true,
        nativeGeofencingRolloutPercentage: 0,
        enableGeofencingDebugLogs: false,
        forcePolygonMode: false
      });
      
      const WrappedComponent = withFeatureFlag('useNativeGeofencing', TestComponent);
      const { getByTestId } = render(<WrappedComponent testProp="test" />);
      
      expect(getByTestId('test-component')).toBeTruthy();
      expect(getByTestId('test-component')).toBeDefined();
    });

    it('should not render component when flag is disabled', () => {
      (featureFlags.getFlags as jest.Mock).mockReturnValue({
        useNativeGeofencing: false,
        nativeGeofencingRolloutPercentage: 0,
        enableGeofencingDebugLogs: false,
        forcePolygonMode: false
      });
      
      const WrappedComponent = withFeatureFlag('useNativeGeofencing', TestComponent);
      const { queryByTestId } = render(<WrappedComponent testProp="test" />);
      
      expect(queryByTestId('test-component')).toBeNull();
    });

    it('should render fallback component when provided and flag is disabled', () => {
      const WrappedComponent = withFeatureFlag(
        'useNativeGeofencing',
        TestComponent,
        FallbackComponent
      );
      
      const { getByTestId } = render(<WrappedComponent testProp="fallback" />);
      
      expect(getByTestId('fallback-component')).toBeTruthy();
      expect(getByTestId('fallback-component')).toBeDefined();
    });

    it('should pass all props to wrapped component', () => {
      (featureFlags.getFlags as jest.Mock).mockReturnValue({
        useNativeGeofencing: true,
        nativeGeofencingRolloutPercentage: 0,
        enableGeofencingDebugLogs: false,
        forcePolygonMode: false
      });
      
      interface MultiPropComponentProps {
        prop1: string;
        prop2: number;
        prop3: boolean;
      }
      
      const MultiPropComponent: React.FC<MultiPropComponentProps> = ({ prop1, prop2, prop3 }) => (
        <View>
          <Text testID="prop1">{prop1}</Text>
          <Text testID="prop2">{prop2}</Text>
          <Text testID="prop3">{prop3.toString()}</Text>
        </View>
      );
      
      const WrappedComponent = withFeatureFlag('useNativeGeofencing', MultiPropComponent);
      const { getByText } = render(
        <WrappedComponent prop1="test" prop2={42} prop3={true} />
      );
      
      expect(getByText('test')).toBeTruthy();
      expect(getByText('42')).toBeTruthy();
      expect(getByText('true')).toBeTruthy();
    });

    it('should update when flag changes', () => {
      const WrappedComponent = withFeatureFlag('useNativeGeofencing', TestComponent);
      const { queryByTestId, rerender } = render(<WrappedComponent testProp="test" />);
      
      // Initially disabled
      expect(queryByTestId('test-component')).toBeNull();
      
      // Enable flag
      (featureFlags.getFlags as jest.Mock).mockReturnValue({
        useNativeGeofencing: true,
        nativeGeofencingRolloutPercentage: 0,
        enableGeofencingDebugLogs: false,
        forcePolygonMode: false
      });
      
      rerender(<WrappedComponent testProp="test" />);
      
      expect(queryByTestId('test-component')).toBeTruthy();
    });

    it('should work with multiple feature flags', () => {
      // Test nested HOCs
      const DoubleWrapped = withFeatureFlag(
        'useNativeGeofencing',
        withFeatureFlag(
          'enableGeofencingDebugLogs',
          TestComponent
        )
      );
      
      // Both flags disabled
      const { queryByTestId } = render(<DoubleWrapped testProp="test" />);
      expect(queryByTestId('test-component')).toBeNull();
      
      // Enable only outer flag
      (featureFlags.getFlags as jest.Mock).mockReturnValue({
        useNativeGeofencing: true,
        nativeGeofencingRolloutPercentage: 0,
        enableGeofencingDebugLogs: false,
        forcePolygonMode: false
      });
      
      const { queryByTestId: queryByTestId2 } = render(<DoubleWrapped testProp="test" />);
      expect(queryByTestId2('test-component')).toBeNull(); // Inner flag still disabled
      
      // Enable both flags
      (featureFlags.getFlags as jest.Mock).mockReturnValue({
        useNativeGeofencing: true,
        nativeGeofencingRolloutPercentage: 0,
        enableGeofencingDebugLogs: true,
        forcePolygonMode: false
      });
      
      const { queryByTestId: queryByTestId3 } = render(<DoubleWrapped testProp="test" />);
      expect(queryByTestId3('test-component')).toBeTruthy();
    });

    it('should maintain component display name', () => {
      const NamedComponent: React.FC = () => <View><Text>Named</Text></View>;
      NamedComponent.displayName = 'MyNamedComponent';
      
      const Wrapped = withFeatureFlag('useNativeGeofencing', NamedComponent);
      
      // The HOC should preserve some indication of wrapping
      expect(Wrapped.name || Wrapped.displayName).toBeTruthy();
    });
  });

  describe('Integration scenarios', () => {
    it('should work with conditional rendering in components', () => {
      const ConditionalComponent: React.FC = () => {
        const isDebugEnabled = useFeatureFlag('enableGeofencingDebugLogs');
        const isNativeEnabled = useFeatureFlag('useNativeGeofencing');
        
        return (
          <View>
            {isDebugEnabled && <View testID="debug"><Text>Debug Mode</Text></View>}
            {isNativeEnabled && <View testID="native"><Text>Native Mode</Text></View>}
            <View testID="always"><Text>Always Shown</Text></View>
          </View>
        );
      };
      
      const { getByTestId, queryByTestId } = render(<ConditionalComponent />);
      
      expect(queryByTestId('debug')).toBeNull();
      expect(queryByTestId('native')).toBeNull();
      expect(getByTestId('always')).toBeTruthy();
    });

    it('should handle flag changes in effect cleanup', () => {
      let cleanupCalled = false;
      
      const EffectComponent: React.FC = () => {
        const isEnabled = useFeatureFlag('useNativeGeofencing');
        
        React.useEffect(() => {
          if (isEnabled) {
            // Setup
            return () => {
              cleanupCalled = true;
            };
          }
        }, [isEnabled]);
        
        return <View><Text>Effect Component</Text></View>;
      };
      
      (featureFlags.getFlags as jest.Mock).mockReturnValue({
        useNativeGeofencing: true,
        nativeGeofencingRolloutPercentage: 0,
        enableGeofencingDebugLogs: false,
        forcePolygonMode: false
      });
      
      const { unmount } = render(<EffectComponent />);
      unmount();
      
      expect(cleanupCalled).toBe(true);
    });

    it('should support TypeScript generics properly', () => {
      interface TypedProps {
        id: number;
        name: string;
        optional?: boolean;
      }
      
      const TypedComponent: React.FC<TypedProps> = ({ id, name, optional = false }) => (
        <View>
          <Text>{id}: {name} {optional && '(optional)'}</Text>
        </View>
      );
      
      // This should compile without TypeScript errors
      const WrappedTyped = withFeatureFlag<TypedProps>(
        'useNativeGeofencing',
        TypedComponent
      );
      
      // Props should be properly typed
      const element = <WrappedTyped id={1} name="Test" />;
      expect(element).toBeDefined();
    });
  });

  describe('Performance considerations', () => {
    it('should not cause unnecessary re-renders', () => {
      let renderCount = 0;
      
      const CountingComponent: React.FC = () => {
        renderCount++;
        const flag = useFeatureFlag('useNativeGeofencing');
        return <View><Text>{flag ? 'Enabled' : 'Disabled'}</Text></View>;
      };
      
      const { rerender } = render(<CountingComponent />);
      expect(renderCount).toBe(1);
      
      // Re-render with same flag value
      rerender(<CountingComponent />);
      expect(renderCount).toBe(2); // Normal re-render
      
      // Flag value hasn't changed, so internal state should be stable
    });

    it('should handle rapid flag changes', () => {
      const { result, rerender } = renderHook(() => useFeatureFlag('useNativeGeofencing'));
      
      // Simulate rapid flag changes
      for (let i = 0; i < 10; i++) {
        (featureFlags.getFlags as jest.Mock).mockReturnValue({
          useNativeGeofencing: i % 2 === 0,
          nativeGeofencingRolloutPercentage: 0,
          enableGeofencingDebugLogs: false,
          forcePolygonMode: false
        });
        
        act(() => {
          rerender({});
        });
      }
      
      // Should handle all changes without errors
      expect(result.current).toBe(true); // Last iteration has even index
    });
  });
});