## React Native Geotracking and Geofencing SDK Implementation Guide

Based on comprehensive research into the DASK-2 blueprint requirements, this guide provides detailed implementation instructions for building a secure, high-performance React Native SDK with native modules, encrypted storage, and advanced geofencing capabilities.

### Native Module Implementation Using JSI Bridge

The JavaScript Interface (JSI) bridge enables synchronous communication between JavaScript and native code, eliminating serialization overhead. For your geotracking SDK, JSI provides the performance necessary for real-time location processing.

**Expo Native Module Setup**: Configure your `app.json` to enable the new architecture with `newArchEnabled: true` for both platforms. The JSI module structure requires creating Swift classes inheriting from `Module` for iOS and Kotlin classes extending `Module` for Android. Register modules using `requireNativeModule<T>()` with TypeScript interfaces for type safety.

**Key Configuration**: Enable JSI in bare workflow by setting `newArchEnabled=true` in `gradle.properties` and `RCT_NEW_ARCH_ENABLED=1` in `ios/.xcode.env`. Use Expo Modules API for managed workflow compatibility.

### SQLCipher Integration with op-sqlite

**Modern SQLCipher integration has been simplified** - op-sqlite now includes SQLCipher support directly. Enable it through package.json configuration:

```json
{
  "op-sqlite": {
    "sqlcipher": true,
    "performanceMode": true,
    "sqliteFlags": "-DSQLITE_TEMP_STORE=2"
  }
}
```

For iOS, SQLCipher compiles with OpenSSL requiring `-DSQLITE_HAS_CODEC` flags and Security.framework linking. Android uses SQLCipher AAR packages but has **critical limitations** with 64-bit architecture support - only armeabi-v7a and x86 are fully supported.

**Database initialization** requires immediate key setting after opening: `db.execute('PRAGMA key = ?', [encryptionKey])`. Performance overhead is 5-15% but can be optimized using `PRAGMA cipher_page_size = 8192` for BLOB-heavy data and `PRAGMA kdf_iter = 64000` with high-entropy keys.

### Secure Key Management Implementation

**iOS Keychain Services** provides hardware-backed encryption with automatic device lock integration. Use `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` for maximum security and `kSecAttrAccessControl` with biometric requirements. The react-native-keychain library wraps these APIs effectively.

**Android Keystore** offers TEE/Secure Element protection where available. Generate keys using `KeyGenParameterSpec.Builder` with `setUserAuthenticationRequired(true)` for biometric protection. Keys never leave secure hardware - all operations occur in system process.

**Key rotation strategy**: Implement scheduled rotation (90-day cycles), maintain version tracking, decrypt with old key, re-encrypt with new key, and securely delete old keys. Use `ACCESS_CONTROL.BIOMETRY_ANY` for biometric protection across platforms.

### Dynamic Geofence Management with Haversine Paging

Native APIs limit active geofences (iOS: 20, Android: 100), necessitating intelligent paging. The Haversine formula calculates distances with 0.5% accuracy for sub-100km ranges:

```javascript
const R = 6371; // Earth radius in km
const dLat = (lat2 - lat1) * Math.PI / 180;
const dLon = (lon2 - lon1) * Math.PI / 180;
const a = Math.sin(dLat/2) ** 2 + 
          Math.cos(lat1 * Math.PI / 180) * 
          Math.cos(lat2 * Math.PI / 180) * 
          Math.sin(dLon/2) ** 2;
const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
return R * c;
```

**Hysteresis implementation** prevents geofence thrashing: use 80% radius for entry threshold and 120% radius for exit threshold. Update active set on significant location changes (>100m) using exponential backoff for battery optimization.

**Spatial data structures**: R-trees provide O(log n) query performance for rectangular geofences. Quadtrees excel at point queries. For simple circular geofences, grid-based approaches are 1.23x-2.47x faster.

### Activity Recognition with Accelerometer Fallback

**Native APIs** provide built-in activity detection: iOS CMMotionActivityManager detects still/walking/running/automotive/cycling with confidence levels. Android ActivityRecognitionClient offers similar capabilities with 0-100 confidence scores using built-in ML models.

**Accelerometer fallback** requires feature extraction from sensor data. Apply 15Hz low-pass Butterworth filters for noise reduction, use 2.56s windows at 100Hz for FFT computation, and extract time-domain features (mean, RMS, zero crossing rate) and frequency-domain features (spectral energy, dominant frequencies).

**Machine learning models**: Traditional approaches (SVM, Random Forest) achieve 85-95% accuracy with proper feature engineering. Deep learning (CNN-LSTM) reaches 95-99% but requires optimization for mobile deployment. Use 15-20Hz sampling for activity detection to balance accuracy and battery life.

### Android Foreground Service Implementation

**Modern Android restrictions** require careful foreground service implementation. For Android 14+, declare service types in manifest:

```xml
<service android:name="app.notifee.core.ForegroundService" 
         android:foregroundServiceType="location|dataSync" />
```

Use WorkManager for reliable background scheduling with 15-minute minimum intervals. Implement expedited jobs for time-sensitive tasks on Android 12+. Handle Doze mode with high-priority FCM messages and proper retry logic.

**Battery optimization handling** varies by manufacturer. Request exemption using react-native-battery-optimization-check and implement manufacturer-specific whitelisting for Samsung, Huawei, Xiaomi, and OnePlus devices.

### Database Schema and Multi-Profile Support

**Spatial indexing** using SQLite R-trees provides 50% query performance improvement:

```sql
CREATE VIRTUAL TABLE location_spatial_index USING rtree(
    id INTEGER PRIMARY KEY,
    min_lat REAL, max_lat REAL,
    min_lon REAL, max_lon REAL
);
```

**Multi-tenant partitioning** using tenant_id columns enables row-level isolation within shared database. Create composite indexes with tenant_id first for optimal query performance. Alternative database-per-tenant approach provides higher isolation for compliance requirements.

**Audit trail implementation** uses trigger-based logging with RSA signing for integrity. Store audit records with operation type, old/new values as JSON, and SHA-256 hashes. Sign hashes using 2048-bit RSA keys with PKCS#1 v1.5 padding. Export functionality supports JSON/CSV/XML formats with GZIP compression achieving 60-70% size reduction.

### CI/CD Pipeline Configuration

**GitHub Actions** provides excellent React Native support. Configure parallel jobs for iOS/Android builds, implement dependency caching for node_modules, Gradle, and CocoaPods, and use build matrices for multiple configurations.

**Automated testing** combines Jest for unit tests with mocked native modules, Detox for gray-box E2E testing on simulators, and device farms (AWS Device Farm, Firebase Test Lab) for real device testing. Implement Reassure for performance regression testing.

**Security scanning** includes npm audit for dependency vulnerabilities, ESLint security plugins for code analysis, and Snyk integration for continuous monitoring. Native code requires ProGuard/R8 obfuscation for Android and secure storage implementation verification.

**Distribution setup** uses Fastlane Match for iOS certificate management, environment variables for Android keystore passwords, and automated provisioning profile updates. Package native modules with proper podspec configuration and peer dependency declarations.

### Performance Optimization Strategies

**Battery optimization** requires adaptive sampling based on movement detection, using significant location changes instead of continuous GPS, implementing 100-200m minimum geofence radius, and leveraging WiFi/cellular positioning when appropriate.

**Memory management** with JSI requires avoiding strong references in native code, using `detach()` for performance-critical scenarios, and implementing proper cleanup in component unmounting.

**Query optimization** includes using WAL mode for concurrent access, implementing 512MB-1GB page cache for large datasets, utilizing prepared statements for repeated queries, and monitoring performance with EXPLAIN QUERY PLAN.

## Key Implementation Updates (2025-07-05)

Based on clarified requirements, the following changes simplify the implementation significantly:

### 1. **Expo Modules API Only**
- No custom JSI implementation needed
- Full native capabilities without restrictions
- Simpler development and maintenance

### 2. **Simplified Geofencing**
- Maximum 10 user-drawn zones (not 100)
- No complex paging algorithm required
- Focus on user safety warnings

### 3. **Development Approach**
- Use Expo development builds exclusively
- No Expo Go limitations to worry about
- Full SQLCipher support available

### 4. **Background Tracking Reality**
- **App in Background**: Tracking works but may be suspended (10s to hours)
- **App Force Quit**: No tracking (iOS limitation)
- **Mitigation**: Use significant location changes (30-50m) and silent push notifications

### 5. **Android 14+ Compliance**
- Mandatory `foregroundServiceType` declaration
- Must show notification within 10 seconds
- Strict permission requirements

This updated implementation guide provides the technical foundation for building a robust React Native geotracking SDK with simplified requirements while maintaining security, performance, and cross-platform compatibility.