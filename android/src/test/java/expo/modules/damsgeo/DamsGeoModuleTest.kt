package expo.modules.damsgeo

import android.content.Context
import android.location.Location
import com.google.android.gms.location.*
import com.google.android.gms.tasks.Task
import com.google.android.gms.tasks.OnSuccessListener
import com.google.android.gms.tasks.OnFailureListener
import com.google.android.gms.tasks.OnCompleteListener
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.events.EventEmitter
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mock
import org.mockito.Mockito.*
import org.mockito.junit.MockitoJUnitRunner
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.assertNotNull

@RunWith(MockitoJUnitRunner::class)
class DamsGeoModuleTest {

    @Mock
    private lateinit var mockContext: Context
    
    @Mock
    private lateinit var mockAppContext: AppContext
    
    @Mock
    private lateinit var mockGeofencingClient: GeofencingClient
    
    @Mock
    private lateinit var mockFusedLocationClient: FusedLocationProviderClient
    
    @Mock
    private lateinit var mockActivityRecognitionClient: ActivityRecognitionClient
    
    @Mock
    private lateinit var mockEventEmitter: EventEmitter
    
    @Mock
    private lateinit var mockTask: Task<Void>
    
    private lateinit var damsGeoModule: DamsGeoModule
    
    @Before
    fun setup() {
        // Setup mock context
        whenever(mockAppContext.reactContext).thenReturn(mockContext)
        
        // Create module instance with mocks
        damsGeoModule = spy(DamsGeoModule())
        
        // Use reflection to set private fields
        val fusedLocationField = DamsGeoModule::class.java.getDeclaredField("fusedLocationClient")
        fusedLocationField.isAccessible = true
        fusedLocationField.set(damsGeoModule, mockFusedLocationClient)
        
        val geofencingField = DamsGeoModule::class.java.getDeclaredField("geofencingClient")
        geofencingField.isAccessible = true
        geofencingField.set(damsGeoModule, mockGeofencingClient)
        
        val appContextField = DamsGeoModule::class.java.getDeclaredField("appContext")
        appContextField.isAccessible = true
        appContextField.set(damsGeoModule, mockAppContext)
        
        // Set module instance
        DamsGeoModule.instance = damsGeoModule
    }
    
    @Test
    fun `test polygon to circle conversion with square`() {
        // Create a square polygon (approximately 100m x 100m)
        val square = listOf(
            mapOf("lat" to 37.7739, "lon" to -122.4194),
            mapOf("lat" to 37.7759, "lon" to -122.4194),
            mapOf("lat" to 37.7759, "lon" to -122.4174),
            mapOf("lat" to 37.7739, "lon" to -122.4174)
        )
        
        val zone = mapOf(
            "id" to "test1",
            "name" to "Test Zone",
            "coordinates" to square,
            "isActive" to true
        )
        
        // Use reflection to call private method
        val convertMethod = DamsGeoModule::class.java.getDeclaredMethod("convertToNativeGeofence", Map::class.java)
        convertMethod.isAccessible = true
        val geofence = convertMethod.invoke(damsGeoModule, zone) as Geofence?
        
        assertNotNull(geofence)
        assertEquals("test1", geofence.requestId)
        
        // The centroid should be approximately at (37.7749, -122.4184)
        // The radius should be around 156m (diagonal of square + 10% buffer)
    }
    
    @Test
    fun `test circular zone direct usage`() {
        val zone = mapOf(
            "id" to "test2",
            "name" to "Circular Zone",
            "center" to mapOf("latitude" to 37.7749, "longitude" to -122.4194),
            "radius" to 100.0,
            "isActive" to true
        )
        
        val convertMethod = DamsGeoModule::class.java.getDeclaredMethod("convertToNativeGeofence", Map::class.java)
        convertMethod.isAccessible = true
        val geofence = convertMethod.invoke(damsGeoModule, zone) as Geofence?
        
        assertNotNull(geofence)
        assertEquals("test2", geofence.requestId)
    }
    
    @Test
    fun `test native geofencing setup with multiple zones`() {
        // Mock successful geofence operations
        whenever(mockGeofencingClient.removeGeofences(any<android.app.PendingIntent>())).thenReturn(mockTask)
        whenever(mockGeofencingClient.addGeofences(any(), any())).thenReturn(mockTask)
        whenever(mockTask.addOnCompleteListener(any())).thenReturn(mockTask)
        whenever(mockTask.addOnSuccessListener(any())).thenReturn(mockTask)
        whenever(mockTask.addOnFailureListener(any())).thenReturn(mockTask)
        
        val zones = listOf(
            mapOf(
                "id" to "zone1",
                "name" to "Zone 1",
                "center" to mapOf("latitude" to 37.7749, "longitude" to -122.4194),
                "radius" to 100,
                "isActive" to true
            ),
            mapOf(
                "id" to "zone2",
                "name" to "Zone 2",
                "center" to mapOf("latitude" to 37.7760, "longitude" to -122.4200),
                "radius" to 150,
                "isActive" to true
            )
        )
        
        // Call setGeofenceZones
        val setMethod = DamsGeoModule::class.java.getDeclaredMethod("setGeofenceZones", List::class.java)
        setMethod.isAccessible = true
        setMethod.invoke(damsGeoModule, zones)
        
        // Verify geofencing client was called
        verify(mockGeofencingClient).removeGeofences(any<android.app.PendingIntent>())
        
        // Simulate complete callback
        val completeCaptor = argumentCaptor<OnCompleteListener<Void>>()
        verify(mockTask).addOnCompleteListener(completeCaptor.capture())
        completeCaptor.firstValue.onComplete(mockTask)
        
        // Verify addGeofences was called
        val requestCaptor = argumentCaptor<GeofencingRequest>()
        verify(mockGeofencingClient).addGeofences(requestCaptor.capture(), any())
    }
    
    @Test
    fun `test Android 100 geofence limit enforcement`() {
        val zones = (1..101).map { i ->
            mapOf(
                "id" to "zone$i",
                "name" to "Zone $i",
                "center" to mapOf("latitude" to 37.7749 + i * 0.001, "longitude" to -122.4194),
                "radius" to 100,
                "isActive" to true
            )
        }
        
        // Mock event sending
        doNothing().`when`(damsGeoModule).sendEvent(any(), any())
        
        // Call setGeofenceZones with 101 zones
        val setMethod = DamsGeoModule::class.java.getDeclaredMethod("setGeofenceZones", List::class.java)
        setMethod.isAccessible = true
        setMethod.invoke(damsGeoModule, zones)
        
        // Verify error event was sent
        verify(damsGeoModule).sendEvent(
            eq("onError"),
            argThat { map ->
                map["code"] == "GEOFENCE_LIMIT" &&
                map["message"] == "Maximum 100 geofence zones allowed"
            }
        )
    }
    
    @Test
    fun `test geofence transition handling for enter event`() {
        val triggeringGeofences = listOf(
            mock(Geofence::class.java).apply {
                whenever(requestId).thenReturn("zone1")
            }
        )
        
        val location = mock(Location::class.java).apply {
            whenever(latitude).thenReturn(37.7749)
            whenever(longitude).thenReturn(-122.4194)
        }
        
        val geofencingEvent = mock(GeofencingEvent::class.java).apply {
            whenever(hasError()).thenReturn(false)
            whenever(geofenceTransition).thenReturn(Geofence.GEOFENCE_TRANSITION_ENTER)
            whenever(triggeringGeofences).thenReturn(triggeringGeofences)
            whenever(triggeringLocation).thenReturn(location)
        }
        
        // Set up active zones
        val activeZones = listOf(
            mapOf(
                "id" to "zone1",
                "name" to "Test Zone",
                "isActive" to true
            )
        )
        val activeField = DamsGeoModule::class.java.getDeclaredField("activeGeofences")
        activeField.isAccessible = true
        activeField.set(damsGeoModule, activeZones.toMutableList())
        
        // Mock event sending
        doNothing().`when`(damsGeoModule).sendEvent(any(), any())
        
        // Call handleGeofenceTransition
        damsGeoModule.handleGeofenceTransition(geofencingEvent)
        
        // Verify enter event was sent
        verify(damsGeoModule).sendEvent(
            eq("onGeofenceEnter"),
            argThat { map ->
                map["zoneId"] == "zone1" &&
                map["zoneName"] == "Test Zone" &&
                (map["location"] as Map<*, *>)["lat"] == 37.7749 &&
                (map["location"] as Map<*, *>)["lon"] == -122.4194
            }
        )
    }
    
    @Test
    fun `test geofence transition handling for exit event`() {
        val triggeringGeofences = listOf(
            mock(Geofence::class.java).apply {
                whenever(requestId).thenReturn("zone1")
            }
        )
        
        val location = mock(Location::class.java).apply {
            whenever(latitude).thenReturn(37.7749)
            whenever(longitude).thenReturn(-122.4194)
        }
        
        val geofencingEvent = mock(GeofencingEvent::class.java).apply {
            whenever(hasError()).thenReturn(false)
            whenever(geofenceTransition).thenReturn(Geofence.GEOFENCE_TRANSITION_EXIT)
            whenever(triggeringGeofences).thenReturn(triggeringGeofences)
            whenever(triggeringLocation).thenReturn(location)
        }
        
        // Set up active zones
        val activeZones = listOf(
            mapOf(
                "id" to "zone1",
                "name" to "Test Zone",
                "isActive" to true
            )
        )
        val activeField = DamsGeoModule::class.java.getDeclaredField("activeGeofences")
        activeField.isAccessible = true
        activeField.set(damsGeoModule, activeZones.toMutableList())
        
        // Mock event sending
        doNothing().`when`(damsGeoModule).sendEvent(any(), any())
        
        // Call handleGeofenceTransition
        damsGeoModule.handleGeofenceTransition(geofencingEvent)
        
        // Verify exit event was sent
        verify(damsGeoModule).sendEvent(
            eq("onGeofenceExit"),
            argThat { map ->
                map["zoneId"] == "zone1" &&
                map["zoneName"] == "Test Zone" &&
                (map["location"] as Map<*, *>)["lat"] == 37.7749 &&
                (map["location"] as Map<*, *>)["lon"] == -122.4194
            }
        )
    }
    
    @Test
    fun `test calculateDistance accuracy`() {
        // Test distance calculation between two known points
        // San Francisco Ferry Building to Coit Tower (approximately 1.3km)
        val lat1 = 37.7955  // Ferry Building
        val lon1 = -122.3937
        val lat2 = 37.8024  // Coit Tower
        val lon2 = -122.4058
        
        val calculateMethod = DamsGeoModule::class.java.getDeclaredMethod(
            "calculateDistance",
            Double::class.java,
            Double::class.java,
            Double::class.java,
            Double::class.java
        )
        calculateMethod.isAccessible = true
        val distance = calculateMethod.invoke(damsGeoModule, lat1, lon1, lat2, lon2) as Double
        
        // Should be approximately 1300 meters (allow 5% error)
        assertTrue(distance > 1235 && distance < 1365)
    }
    
    @Test
    fun `test manual polygon checking is skipped when native is enabled`() {
        // Set useNativeGeofencing to true
        val nativeField = DamsGeoModule::class.java.getDeclaredField("useNativeGeofencing")
        nativeField.isAccessible = true
        nativeField.set(damsGeoModule, true)
        
        val location = mock(Location::class.java).apply {
            whenever(latitude).thenReturn(37.7749)
            whenever(longitude).thenReturn(-122.4194)
        }
        
        // Mock sendLocationUpdate
        doNothing().`when`(damsGeoModule).sendEvent(any(), any())
        
        // Call checkGeofences - should return early
        val checkMethod = DamsGeoModule::class.java.getDeclaredMethod("checkGeofences", Location::class.java)
        checkMethod.isAccessible = true
        checkMethod.invoke(damsGeoModule, location)
        
        // Verify no geofence events were sent (only location update)
        verify(damsGeoModule, never()).sendEvent(eq("onGeofenceEnter"), any())
        verify(damsGeoModule, never()).sendEvent(eq("onGeofenceExit"), any())
    }
}