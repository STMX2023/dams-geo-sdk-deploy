# API Documentation

*Generated from source code analysis*

## Table of Contents

- [Classs](#classs)
- [Interfaces](#interfaces)
- [Functions](#functions)
- [Consts](#consts)

## Classes

### AnalyticsErrorReporter
*src/errors/ErrorReporter.ts:210*

Custom analytics error reporter

```typescript
export class AnalyticsErrorReporter extends BaseErrorReporter {
```

### BackgroundWakeTestHarness
*src/utils/BackgroundWakeTestHarness.ts:8*

Test harness for validating background wake functionality of native geofencing

```typescript
export class BackgroundWakeTestHarness {
```

### BatterySimulator
*src/geofencing/__tests__/test-utils.ts:207*

Battery Simulation Helper Estimates battery impact based on operation count

```typescript
export class BatterySimulator {
```

### ChildLogger
*src/logging/Logger.ts:286*

Child logger with additional context

```typescript
export class ChildLogger {
```

### CompositeErrorReporter
*src/errors/ErrorReporter.ts:265*

Composite error reporter that sends to multiple services

```typescript
export class CompositeErrorReporter extends BaseErrorReporter {
```

### ConsoleErrorReporter
*src/errors/ErrorReporter.ts:186*

Console error reporter for development

```typescript
export class ConsoleErrorReporter extends BaseErrorReporter {
```

### CrashlyticsErrorReporter
*src/errors/ErrorReporter.ts:135*

Crashlytics error reporter implementation

```typescript
export class CrashlyticsErrorReporter extends BaseErrorReporter {
```

### DamsGeoError
*src/errors/DamsGeoError.ts:104*

Base error class for all DAMS Geo SDK errors

```typescript
export class DamsGeoError extends Error {
```

### DamsGeoErrorBoundary
*src/errors/ErrorBoundary.tsx:26*

Error boundary component for catching React errors

```typescript
export class DamsGeoErrorBoundary extends Component<Props, State> {
```

### DefaultErrorHandlers
*src/errors/ErrorManager.ts:372*

Default error handlers for common scenarios

```typescript
export class DefaultErrorHandlers {
```

### ErrorContextManager
*src/errors/ErrorContext.ts:71*

Captures and manages error context

```typescript
export class ErrorContextManager {
```

### ErrorDebugger
*src/errors/ErrorContext.ts:335*

Error debugging utilities

```typescript
export class ErrorDebugger {
```

### ErrorManager
*src/errors/ErrorManager.ts:45*

Manages all error handling for the SDK

```typescript
export class ErrorManager extends EventEmitter {
```

### PerformanceMeasure
*src/geofencing/__tests__/test-utils.ts:175*

Performance Testing Utilities

```typescript
export class PerformanceMeasure {
```

### RecoveryStrategies
*src/errors/RecoveryStrategies.ts:23*

Collection of recovery strategies for common error scenarios

```typescript
export class RecoveryStrategies {
```

### RetryManager
*src/errors/RetryManager.ts:52*

Manages retry logic and circuit breakers

```typescript
export class RetryManager {
```

### SentryErrorReporter
*src/errors/ErrorReporter.ts:40*

Sentry error reporter implementation

```typescript
export class SentryErrorReporter extends BaseErrorReporter {
```

## Interfaces

### BatterySnapshot
*src/metrics/BatteryMetrics.ts:8*

Battery Metrics Collection for Geofencing Migration Measures battery impact of polygon vs native geofencing to validate the migration's primary goal.

**Properties:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| timestamp | `number` | Yes |  |
| batteryLevel | `number` | Yes |  |
| isCharging | `boolean` | Yes |  |
| temperature | `number` | No |  |

### FeatureFlags
*src/config/FeatureFlags.ts:8*

Feature Flag System for Geofencing Migration Enables gradual rollout and quick rollback of native geofencing

**Properties:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| useNativeGeofencing | `boolean` | Yes |  |
| nativeGeofencingRolloutPercentage | `number` | Yes |  |
| enableGeofencingDebugLogs | `boolean` | Yes |  |
| forcePolygonMode | `boolean` | Yes |  |

### GeofenceZone
*src/geofencing/__tests__/GeofenceManager.unit.test.ts:7*

Unit Tests for GeofenceManager Testing the core logic without full module dependencies

**Properties:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | `string` | Yes |  |
| name | `string` | Yes |  |
| coordinates | `Array<{ lat: number` | Yes |  |
| lon | `number }>` | Yes |  |
| isActive | `boolean` | Yes |  |

### LocationUpdate
*src/DamsGeo.types.ts:5*

Core Types for DAMS Geo SDK

**Properties:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| lat | `number` | Yes |  |
| lon | `number` | Yes |  |
| accuracy | `number` | Yes |  |
| speed | `number | null` | Yes |  |

### Migration
*src/database/migrations/001_add_circular_geofence_support.ts:8*

Database Migration: Add Circular Geofence Support This migration adds support for circular geofences while maintaining backward compatibility with existing polygon data.

**Properties:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| version | `number` | Yes |  |
| name | `string` | Yes |  |
| up | `(db: any) => Promise<void>` | Yes |  |
| down | `(db: any) => Promise<void>` | Yes |  |

## Functions

### DefaultErrorFallback
*src/errors/ErrorBoundary.tsx:80*

Default error fallback component

**Signature:**
```typescript
const DefaultErrorFallback: React.FC<
```

### computeBoundingCircle
*src/database/migrations/001_add_circular_geofence_support.ts:112*

Compute the minimum bounding circle for a polygon Uses the simple approach of finding center and max radius

**Signature:**
```typescript
function computeBoundingCircle(coordinates: Array<
```

### convertPolygonToCircle
*src/geofencing/__tests__/test-utils.ts:81*

Polygon to Circle Conversion This simulates the conversion that will happen during migration

**Signature:**
```typescript
export const convertPolygonToCircle = (polygonZone: GeofenceZone):
```

### createError
*src/errors/DamsGeoError.ts:332*

Helper function to create errors with proper context

**Signature:**
```typescript
export function createError(
  code: DamsGeoErrorCode,
  message: string,
  context?: ErrorContext,
  originalError?: Error
```

### createErrorReporter
*src/errors/ErrorReporter.ts:299*

Factory function to create appropriate error reporter

**Signature:**
```typescript
export function createErrorReporter(config:
```

### createHybridZone
*src/geofencing/GeofenceHelpers.ts:130*

Create a hybrid zone that has both representations Used during migration period

**Signature:**
```typescript
export function createHybridZone(zone: GeofenceZone): GeofenceZone
```

### createLocation
*src/geofencing/__tests__/test-utils.ts:12*

Location Creation Utilities

**Signature:**
```typescript
export const createLocation = (
  lat: number, 
  lon: number, 
  options: Partial<LocationUpdate> =
```

### expectGeofenceEvent
*src/geofencing/__tests__/test-utils.ts:318*

Event Validation Helpers

**Signature:**
```typescript
export const expectGeofenceEvent = (
  event: any,
  expectedType: 'enter' | 'exit',
  expectedZoneId: string
): void =>
```

### generatePolygonFromCircle
*src/geofencing/GeofenceHelpers.ts:163*

Generate polygon coordinates from a circle Used for backward compatibility

**Signature:**
```typescript
export function generatePolygonFromCircle(
  center:
```

### getZoneType
*src/geofencing/GeofenceHelpers.ts:25*

Get zone type with fallback detection

**Signature:**
```typescript
export function getZoneType(zone: GeofenceZone): 'polygon' | 'circle'
```

### getZonesForNativeMonitoring
*src/geofencing/GeofenceHelpers.ts:223*

Get all zones that need native monitoring Filters and prioritizes zones for platform limits

**Signature:**
```typescript
export function getZonesForNativeMonitoring(
  zones: GeofenceZone[],
  currentLocation:
```

### haversineDistance
*src/database/migrations/001_add_circular_geofence_support.ts:159*

Calculate distance between two points using Haversine formula

**Signature:**
```typescript
function haversineDistance(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
```

### haversineDistance
*src/geofencing/GeofenceHelpers.ts:185*

Calculate distance between two points using Haversine formula

**Signature:**
```typescript
export function haversineDistance(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
```

### initializeErrorHandling
*src/errors/index.ts:105*

Initialize error handling system

**Signature:**
```typescript
export function initializeErrorHandling(options?:
```

### isCircularZone
*src/geofencing/GeofenceHelpers.ts:11*

Check if a zone is circular (has center and radius)

**Signature:**
```typescript
export function isCircularZone(zone: GeofenceZone): boolean
```

### isDamsGeoError
*src/errors/DamsGeoError.ts:347*

Type guard to check if an error is a DamsGeoError

**Signature:**
```typescript
export function isDamsGeoError(error: any): error is DamsGeoError
```

### isPointInCircle
*src/geofencing/GeofenceHelpers.ts:209*

Check if a point is inside a circle More efficient than polygon checking

**Signature:**
```typescript
export function isPointInCircle(
  lat: number,
  lon: number,
  center:
```

### isPolygonZone
*src/geofencing/GeofenceHelpers.ts:18*

Check if a zone is polygon-based (has coordinates)

**Signature:**
```typescript
export function isPolygonZone(zone: GeofenceZone): boolean
```

### logBreadcrumb
*src/errors/ErrorContext.ts:486*

Breadcrumb helper functions

**Signature:**
```typescript
export function logBreadcrumb(
  category: string,
  message: string,
  level: Breadcrumb['level'] = 'info',
  data?: any
```

### mockNativeGeofenceEvent
*src/geofencing/__tests__/test-utils.ts:335*

Mock Native Module Response Simulates what native geofencing would return

**Signature:**
```typescript
export const mockNativeGeofenceEvent = (
  type: 'enter' | 'exit',
  zoneId: string,
  location: LocationUpdate
) => (
```

### polygonToCircle
*src/geofencing/GeofenceHelpers.ts:81*

Convert polygon zone to circular representation Uses minimum bounding circle algorithm

**Signature:**
```typescript
export function polygonToCircle(zone: GeofenceZone):
```

### setupAndroidMemoryMonitoring
*src/utils/MemoryProfiler.ts:334*

Helper function for Android native memory monitoring

**Signature:**
```typescript
export function setupAndroidMemoryMonitoring(): void {
```

### setupIOSMemoryMonitoring
*src/utils/MemoryProfiler.ts:327*

Helper function for iOS native memory monitoring

**Signature:**
```typescript
export function setupIOSMemoryMonitoring(): void {
```

### toDamsGeoError
*src/errors/DamsGeoError.ts:354*

Convert unknown errors to DamsGeoError

**Signature:**
```typescript
export function toDamsGeoError(error: unknown, context?: ErrorContext): DamsGeoError
```

### useDamsGeoError
*src/errors/ErrorBoundary.tsx:120*

Hook for error handling in functional components

**Signature:**
```typescript
export function useDamsGeoError()
```

### useFeatureFlag
*src/config/FeatureFlagsReact.tsx:14*

React hook for checking feature flag status

**Signature:**
```typescript
export function useFeatureFlag(flagName: keyof FeatureFlags): boolean
```

### validateZone
*src/geofencing/GeofenceHelpers.ts:46*

Validate a geofence zone has required fields

**Signature:**
```typescript
export function validateZone(zone: GeofenceZone): void
```

### withAutoRecovery
*src/errors/RecoveryStrategies.ts:375*

Automatic recovery decorator

**Signature:**
```typescript
export function withAutoRecovery(
  errorCodes?: DamsGeoErrorCode[],
  maxAttempts: number = 3
)
```

### withDamsGeoErrorBoundary
*src/errors/ErrorBoundary.tsx:147*

Higher-order component for adding error boundary

**Signature:**
```typescript
export function withDamsGeoErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: (error: Error, reset: () => void) => ReactNode
): React.ComponentType<P>
```

### withFeatureFlag
*src/config/FeatureFlagsReact.tsx:36*

Higher-order component for conditional rendering based on feature flags

**Signature:**
```typescript
export function withFeatureFlag<P extends object>(
  flagName: keyof FeatureFlags,
  Component: React.ComponentType<P>,
  FallbackComponent?: React.ComponentType<P>
): React.ComponentType<P>
```

### withRetry
*src/errors/RetryManager.ts:424*

Decorator for adding retry logic to methods

**Signature:**
```typescript
export function withRetry(options?: RetryOptions)
```
