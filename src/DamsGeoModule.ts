// Replaced mock implementation with a direct proxy to the real native module
import { NativeModulesProxy } from 'expo-modules-core';

// Define the native module interface
export interface DamsGeoNativeModule {
  // Event emitter support
  addListener: (eventName: string) => void;
  removeListeners: (count: number) => void;
  
  // Add other native methods as needed
  [key: string]: any;
}

// Forward the exported object directly to the native implementation
export default NativeModulesProxy.DamsGeo as DamsGeoNativeModule;