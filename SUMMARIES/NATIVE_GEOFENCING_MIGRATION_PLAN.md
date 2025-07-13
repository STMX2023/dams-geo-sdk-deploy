# Native Geofencing Migration Plan

## Migration Overview
Migrating from manual polygon-based geofencing to native circular geofencing for critical battery efficiency improvements.

**Primary Goal:** Enable all-day driver operation with 80-90% battery savings  
**Risk Level:** Medium (mitigated by comprehensive testing)  
**Progress:** 75% Complete (Phases 0-3 done, 4-5 remaining)  
**Last Updated:** 2025-07-12

---

## Current State Analysis
- **Code Health:** 60/100 ✅ (Acceptable for migration)
- **Test Coverage:** 0% → 10 behavioral tests created ✅
- **Complexity:** High in geofencing module (4 functions > threshold)
- **Architecture:** Manual polygon checking, not using native APIs
- **Battery Impact:** High - continuous GPS polling

---

## Phase 0: Risk Mitigation & Test Infrastructure ✅ [COMPLETED]
**Status:** ✅ DONE

### Completed Tasks:
- [x] Write comprehensive behavioral tests (1,678 lines)
- [x] Validate tests pass with current implementation
- [x] Document acceptance criteria
- [x] Create test utilities for migration validation
- [x] Create database migration scripts for schema changes
- [x] Implement feature flag system
- [x] Set up battery measurement baseline

### Database Migration Required:
```sql
-- Add columns for circular geofencing
ALTER TABLE geofences ADD COLUMN latitude REAL;
ALTER TABLE geofences ADD COLUMN longitude REAL;
ALTER TABLE geofences ADD COLUMN radius REAL;
ALTER TABLE geofences ADD COLUMN zone_type TEXT DEFAULT 'polygon';
```

---

## Phase 1: TypeScript API Evolution ✅ [COMPLETED]
**Status:** ✅ DONE (Completed 2025-07-12)
**Duration:** 1 day

### Completed Tasks:
- [x] Update GeofenceZone type for dual-mode support
- [x] Add circular zone detection helpers
- [x] Implement polygon → circle conversion algorithm
- [x] Update database layer for new schema
- [x] Add feature flag checks
- [x] Create GeofenceHelpers.ts with all zone operations
- [x] Add 15 comprehensive tests (all passing)

### Key Achievements:
- **Zero Breaking Changes**: Existing polygon zones continue to work
- **Smart Conversion**: Polygon to circle algorithm with 10% safety buffer
- **Database Compatibility**: Column existence checking for smooth migration
- **Platform Support**: Zone prioritization for iOS (20) and Android (100) limits
- **Performance Ready**: O(1) circular checks vs O(n) polygon checks

### Files Created/Modified:
1. `src/DamsGeo.types.ts` - Added optional center, radius, zoneType fields
2. `src/geofencing/GeofenceHelpers.ts` - New helper functions (422 lines)
3. `src/geofencing/GeofenceManager.ts` - Feature flag integration
4. `src/database/DatabaseManager.ts` - Schema compatibility updates
5. `src/geofencing/__tests__/phase1-api.test.ts` - 15 comprehensive tests

### Breaking Change Strategy:
```typescript
interface GeofenceZone {
  id: string;
  name: string;
  // Legacy polygon support
  coordinates?: Array<{ lat: number; lon: number }>;
  // New circular support
  center?: { latitude: number; longitude: number };
  radius?: number;
  zoneType?: 'polygon' | 'circle';
  isActive: boolean;
}
```

---

## Phase 2: Android Native Implementation ✅ [COMPLETED]
**Status:** ✅ DONE (Completed 2025-07-12)
**Duration:** 1 day

### Completed Tasks:
- [x] Add GeofencingClient to DamsGeoModule.kt
- [x] Create GeofenceBroadcastReceiver
- [x] Update expo-module.config.json for manifest entries
- [x] Implement PendingIntent with proper flags
- [x] Handle 100-geofence Android limit
- [x] Create comprehensive test suite (unit, integration, performance)
- [x] Implement BackgroundWakeTestHarness for validation
- [x] Document test execution procedures

### Key Implementation:
```kotlin
private lateinit var geofencingClient: GeofencingClient
private val geofencePendingIntent: PendingIntent by lazy {
    PendingIntent.getBroadcast(
        context, 0,
        Intent(context, GeofenceBroadcastReceiver::class.java),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
    )
}
```

---

## Phase 3: iOS Native Implementation ✅ [COMPLETED]
**Status:** ✅ DONE (Completed 2025-07-12)
**Duration:** Same day as Phase 2

### Completed Tasks:
- [x] Implement CLLocationManager region monitoring
- [x] Add didEnterRegion/didExitRegion delegates
- [x] Handle 20-region iOS limit with prioritization
- [x] Verify Info.plist permissions
- [x] Create comprehensive test suite
- [x] Implement region persistence
- [x] Document setup requirements

### iOS-Specific Handling:
```swift
// Enforce 20-region limit
if circularZones.count > 20 {
    let sorted = circularZones.sorted { distance(to: $0) < distance(to: $1) }
    monitorRegions(Array(sorted.prefix(20)))
}
```

---

## Phase 4: Battery & Performance Validation
**Status:** ⏳ NOT STARTED

### Validation Metrics:
- [ ] Battery baseline: Current polygon implementation
- [ ] Target: <2% drain/hour with 5 zones
- [ ] Background reliability: 99%+
- [ ] Memory usage comparison
- [ ] CPU wake time reduction

### Test Scenarios:
1. Driving session with 5 active zones
2. Background operation
3. Device reboot with zone persistence
4. Network offline operation

---

## Phase 5: Migration & Rollout
**Status:** ⏳ NOT STARTED

### Rollout Strategy:
- [ ] Deploy with feature flag disabled
- [ ] 5% pilot users
- [ ] 25% rollout
- [ ] 50% rollout
- [ ] 100% rollout
- [ ] Remove feature flag

### Data Migration:
- [ ] Convert existing polygons to bounding circles
- [ ] Backup original polygon data
- [ ] Provide admin UI for zone adjustment
- [ ] Monitor zone accuracy post-conversion

---

## Critical Success Criteria

### Must Have Before Production:
- [x] Behavioral test coverage
- [x] Database migration tested
- [x] Feature flags working
- [ ] Battery savings verified (>80%)
- [ ] Background reliability confirmed
- [ ] Rollback plan tested

### Acceptance Criteria:
- All behavioral tests pass ✅
- Battery usage reduced by >80%
- Background events <30s latency
- No data loss during migration
- API backward compatible

---

## Risk Register

| Risk | Impact | Mitigation | Status |
|------|--------|------------|--------|
| Zero test coverage | HIGH | Write tests first ✅ | RESOLVED |
| Data loss during migration | HIGH | Backup & rollback plan | PENDING |
| iOS 20-zone limit | MEDIUM | Smart prioritization | PLANNED |
| Battery regression | HIGH | A/B testing with metrics | PLANNED |
| Background reliability | HIGH | Extensive device testing | PLANNED |

---

## Progress Tracking

### Overall Progress: 30% Complete
- Phase 0: ✅ 100% (Risk mitigation & test infrastructure)
- Phase 1: ✅ 100% (TypeScript API evolution)
- Phase 2: ⏳ 0% (Android native implementation)
- Phase 3: ⏳ 0% (iOS native implementation)
- Phase 4: ⏳ 0% (Battery & performance validation)
- Phase 5: ⏳ 0% (Migration & rollout)

### Key Milestones:
- [x] Test suite created (Phase 0)
- [x] Migration plan approved
- [x] Feature flag implemented (Phase 0)
- [x] TypeScript API ready for native (Phase 1)
- [ ] Native Android working
- [ ] Native iOS working
- [ ] Battery savings verified
- [ ] Production rollout complete

---

## Team Notes

### Architecture Decisions:
1. **Hybrid approach**: Support both polygon and circular zones during transition
2. **Feature flags**: Enable gradual rollout and quick rollback
3. **Data preservation**: Keep polygon data for potential rollback
4. **Platform differences**: Handle iOS/Android limits differently

### Phase 1 Technical Details:
- **Helper Functions**: All zone operations centralized in GeofenceHelpers.ts
- **Type Detection**: Automatic detection based on presence of center/coordinates
- **Conversion Algorithm**: Centroid calculation with maximum vertex distance + 10% buffer
- **Database Strategy**: Column existence checking allows gradual schema migration
- **Test Coverage**: 15 behavioral tests ensure API compatibility

### Known Limitations:
- iOS: Maximum 20 monitored regions
- Android: Maximum 100 geofences
- Circular zones only (polygons converted to bounding circles)
- GPS accuracy affects boundary precision

### Success Metrics:
- **Battery**: 80%+ reduction in power usage
- **Reliability**: 99%+ background event delivery
- **Performance**: <30s event latency
- **Adoption**: 0 rollback requests

### Next Steps:
With the TypeScript API layer complete and all tests passing, the project is ready to proceed with Phase 2: Android Native Implementation. The dual-mode API provides a stable foundation for implementing native geofencing while maintaining backward compatibility.