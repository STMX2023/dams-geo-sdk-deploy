/**
 * React-specific utilities for Feature Flags
 * 
 * Provides React hooks and HOCs for feature flag integration
 */

import React from 'react';
import { featureFlags } from './FeatureFlags';
import type { FeatureFlags } from './FeatureFlags';

/**
 * React hook for checking feature flag status
 */
export function useFeatureFlag(flagName: keyof FeatureFlags): boolean {
  const [isEnabled, setIsEnabled] = React.useState(false);
  
  React.useEffect(() => {
    // Check flag status on mount and updates
    const checkFlag = () => {
      const flags = featureFlags.getFlags();
      const flagValue = flags[flagName];
      setIsEnabled(!!flagValue);
    };
    
    checkFlag();
    
    // Could add listener for flag changes here if needed
  }, [flagName]);
  
  return isEnabled;
}

/**
 * Higher-order component for conditional rendering based on feature flags
 */
export function withFeatureFlag<P extends object>(
  flagName: keyof FeatureFlags,
  Component: React.ComponentType<P>,
  FallbackComponent?: React.ComponentType<P>
): React.ComponentType<P> {
  return (props: P) => {
    const isEnabled = useFeatureFlag(flagName);
    
    if (isEnabled) {
      return <Component {...props} />;
    }
    
    if (FallbackComponent) {
      return <FallbackComponent {...props} />;
    }
    
    return null;
  };
}