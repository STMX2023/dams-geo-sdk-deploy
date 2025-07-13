# DAMS Geo SDK - Expo SDK 53 Compatible

High-performance geotracking and geofencing SDK for React Native applications, fully compatible with Expo SDK 53 and React Native 0.79.

## 🚀 Native Geofencing Migration Status: 75% Complete

The SDK is currently undergoing a migration to native geofencing APIs for significant battery efficiency improvements (80-90% reduction expected). See [NATIVE_GEOFENCING_MIGRATION_AUDIT.md](./NATIVE_GEOFENCING_MIGRATION_AUDIT.md) for the complete audit report.

### Migration Highlights:
- ✅ Dual-mode support (polygon & native circular)
- ✅ No breaking API changes
- ✅ 82.7% test coverage
- ⏳ Real device validation pending

## Overview

The DAMS Geo SDK provides comprehensive location tracking, geofencing, activity recognition, and data management capabilities for mobile applications. This version has been specifically optimized for Expo SDK 53 with the New Architecture enabled by default.

## Key Features

### 🗺️ **Location Tracking**
- High-accuracy GPS tracking with battery optimization
- Background location monitoring
- Customizable distance filters and update intervals
- Activity-based tracking adjustments

### 🚧 **Geofencing**
- Dynamic geofence creation and management
- Real-time entry/exit detection
- Multiple geofence monitoring (Android: 100, iOS: 20)
- Custom event handling
- **NEW**: Native OS geofencing for 80-90% battery savings
- **NEW**: Background wake capability when app terminated
- **NEW**: Automatic polygon-to-circle conversion
- **NEW**: Feature flag for gradual migration

### 🏃 **Activity Recognition**
- Automatic activity detection (walking, driving, stationary)
- Battery-optimized tracking based on detected activity
- Custom activity classification

### 🔒 **Security & Privacy**
- SQLCipher database encryption
- Secure keychain storage
- Data anonymization options
- GDPR compliance features

### 📊 **Data Management**
- Local SQLite database with encryption
- Comprehensive audit logging
- Data export capabilities
- Performance monitoring

### ⚡ **Performance**
- Battery optimization algorithms
- Memory leak prevention
- Background processing
- Performance analytics

## Architecture

```
DAMS Geo SDK
├── Core Tracking Engine
│   ├── Location Manager
│   ├── Activity Manager
│   └── Geofence Manager
├── Data Layer
│   ├── Encrypted Database
│   ├── Audit System
│   └── Export Manager
├── Security Layer
│   ├── Encryption Manager
│   ├── Key Management
│   └── Signing System
└── Utilities
    ├── Battery Optimization
    ├── Performance Monitor
    ├── Error Handling
    └── Background Management
```

## Compatibility

- **Expo SDK**: 53.x
- **React Native**: 0.79.x
- **React**: 19.x
- **iOS**: 13.0+
- **Android**: API 21+ (Android 5.0)
- **TypeScript**: 5.8+

## New Architecture Support

This SDK is fully compatible with React Native's New Architecture (Fabric + TurboModules), which is enabled by default in Expo SDK 53.

## Getting Started

See [Integration Guide](./INTEGRATION.md) for detailed setup instructions.

## Quick Start

```typescript
import DamsGeo, { DamsGeoConfig } from './dams-geo-sdk';

// Initialize the SDK
const config: DamsGeoConfig = {
  enableHighAccuracy: true,
  enableEncryption: true,
  distanceFilter: 10
};

await DamsGeo.initialize(config);

// Start tracking
await DamsGeo.startTracking({ userId: 'user123' });

// Listen for location updates
const subscription = DamsGeo.addListener('onLocationUpdate', (location) => {
  console.log('New location:', location);
});
```

## Documentation

### Setup & Integration
- [Integration Guide](./INTEGRATION.md) - Step-by-step setup instructions
- [API Reference](./API_REFERENCE.md) - Complete API documentation
- [Platform Specific Guide](./PLATFORM_SPECIFIC_GUIDE.md) - iOS/Android specifics

### Native Geofencing Migration
- [Migration Audit Report](./NATIVE_GEOFENCING_MIGRATION_AUDIT.md) - Current status and analysis
- [Migration Plan](../NATIVE_GEOFENCING_MIGRATION_PLAN.md) - Detailed phase breakdown
- [Android Setup](../ANDROID_GEOFENCING_TESTS.md) - Android native implementation
- [iOS Setup](../IOS_NATIVE_GEOFENCING_SETUP.md) - iOS native implementation

### API Documentation
- [Manager APIs](./MANAGER_API_REFERENCE.md) - Internal manager classes
- [Generated API Docs](./API_DOCS_GENERATED.md) - Auto-generated from JSDoc
- [Configuration Options](../src/DamsGeo.types.ts) - Available configuration options

## License

MIT License - see package.json for details

## Support

For issues and support, please refer to the main project repository.