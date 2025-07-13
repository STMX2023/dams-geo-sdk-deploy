// Mock native modules that aren't available in test environment
jest.mock('./src/DamsGeoModule', () => ({
  default: {
    addListener: jest.fn(),
    removeListeners: jest.fn(),
    initialize: jest.fn().mockResolvedValue(true),
    startTracking: jest.fn().mockResolvedValue(true),
    stopTracking: jest.fn().mockResolvedValue(true),
    setGeofenceZones: jest.fn().mockResolvedValue(true),
    getTrackingStatus: jest.fn().mockResolvedValue({ isTracking: false }),
  },
}));

// Mock react-native modules
jest.mock('react-native', () => {
  const React = require('react');
  return {
    NativeModules: {
      DamsGeo: {
        addListener: jest.fn(),
        removeListeners: jest.fn(),
      },
    },
    NativeEventEmitter: jest.fn(() => ({
      addListener: jest.fn(),
      removeListener: jest.fn(),
      removeAllListeners: jest.fn(),
    })),
    Platform: {
      OS: 'ios',
      select: jest.fn((obj) => obj.ios),
    },
    View: ({ children, testID }) => React.createElement('View', { testID }, children),
    Text: ({ children, testID }) => React.createElement('Text', { testID }, children),
  };
});

// Mock database for unit tests
jest.mock('./src/database/DatabaseManager', () => ({
  DatabaseManager: {
    getInstance: jest.fn(() => ({
      initialize: jest.fn().mockResolvedValue(true),
      saveLocation: jest.fn().mockResolvedValue(true),
      saveGeofences: jest.fn().mockResolvedValue(true),
      getGeofences: jest.fn().mockResolvedValue([]),
      close: jest.fn().mockResolvedValue(true),
    })),
  },
}));

// Performance polyfill for tests
if (typeof performance === 'undefined') {
  global.performance = {
    now: () => Date.now(),
  };
}