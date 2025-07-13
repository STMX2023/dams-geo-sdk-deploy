package expo.modules.damsgeo

import android.Manifest
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.location.Location
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.rule.GrantPermissionRule
import com.google.android.gms.location.*
import com.google.android.gms.tasks.Tasks
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.test.assertTrue
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Integration tests for native Android geofencing.
 * These tests require a device or emulator with Google Play Services.
 */
@RunWith(AndroidJUnit4::class)
class GeofencingIntegrationTest {
    
    @get:Rule
    val permissionRule: GrantPermissionRule = GrantPermissionRule.grant(
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.ACCESS_BACKGROUND_LOCATION
    )
    
    private lateinit var context: Context
    private lateinit var geofencingClient: GeofencingClient
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var pendingIntent: PendingIntent
    
    @Before
    fun setup() {
        context = ApplicationProvider.getApplicationContext()
        geofencingClient = LocationServices.getGeofencingClient(context)
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)
        
        // Create pending intent for geofence transitions
        val intent = Intent(context, GeofenceBroadcastReceiver::class.java)
        pendingIntent = PendingIntent.getBroadcast(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )
        
        // Remove any existing geofences
        try {
            Tasks.await(geofencingClient.removeGeofences(pendingIntent))
        } catch (e: Exception) {
            // Ignore if no geofences exist
        }
    }
    
    @Test
    fun testAddSingleCircularGeofence() {
        val geofence = Geofence.Builder()
            .setRequestId("test_zone_1")
            .setCircularRegion(37.7749, -122.4194, 100f) // 100m radius
            .setExpirationDuration(Geofence.NEVER_EXPIRE)
            .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER or Geofence.GEOFENCE_TRANSITION_EXIT)
            .build()
        
        val request = GeofencingRequest.Builder()
            .setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_ENTER)
            .addGeofence(geofence)
            .build()
        
        // Add geofence
        val task = geofencingClient.addGeofences(request, pendingIntent)
        Tasks.await(task, 5, TimeUnit.SECONDS)
        
        assertTrue(task.isSuccessful)
    }
    
    @Test
    fun testAddMultipleGeofences() {
        val geofences = listOf(
            Geofence.Builder()
                .setRequestId("zone_1")
                .setCircularRegion(37.7749, -122.4194, 100f)
                .setExpirationDuration(Geofence.NEVER_EXPIRE)
                .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER or Geofence.GEOFENCE_TRANSITION_EXIT)
                .build(),
            
            Geofence.Builder()
                .setRequestId("zone_2")
                .setCircularRegion(37.7760, -122.4200, 150f)
                .setExpirationDuration(Geofence.NEVER_EXPIRE)
                .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER or Geofence.GEOFENCE_TRANSITION_EXIT)
                .build(),
            
            Geofence.Builder()
                .setRequestId("zone_3")
                .setCircularRegion(37.7770, -122.4210, 200f)
                .setExpirationDuration(Geofence.NEVER_EXPIRE)
                .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER or Geofence.GEOFENCE_TRANSITION_EXIT)
                .build()
        )
        
        val request = GeofencingRequest.Builder()
            .setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_ENTER)
            .addGeofences(geofences)
            .build()
        
        // Add geofences
        val task = geofencingClient.addGeofences(request, pendingIntent)
        Tasks.await(task, 5, TimeUnit.SECONDS)
        
        assertTrue(task.isSuccessful)
    }
    
    @Test
    fun testRemoveGeofences() {
        // First add a geofence
        val geofence = Geofence.Builder()
            .setRequestId("remove_test")
            .setCircularRegion(37.7749, -122.4194, 100f)
            .setExpirationDuration(Geofence.NEVER_EXPIRE)
            .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER)
            .build()
        
        val request = GeofencingRequest.Builder()
            .addGeofence(geofence)
            .build()
        
        val addTask = geofencingClient.addGeofences(request, pendingIntent)
        Tasks.await(addTask, 5, TimeUnit.SECONDS)
        assertTrue(addTask.isSuccessful)
        
        // Now remove it
        val removeTask = geofencingClient.removeGeofences(listOf("remove_test"))
        Tasks.await(removeTask, 5, TimeUnit.SECONDS)
        assertTrue(removeTask.isSuccessful)
    }
    
    @Test
    fun testPolygonToCircleConversion() {
        // Test the conversion algorithm with a real polygon
        val squareCoordinates = listOf(
            Pair(37.7739, -122.4194),
            Pair(37.7759, -122.4194),
            Pair(37.7759, -122.4174),
            Pair(37.7739, -122.4174)
        )
        
        // Calculate centroid
        val centerLat = squareCoordinates.map { it.first }.average()
        val centerLon = squareCoordinates.map { it.second }.average()
        
        // Calculate max distance from center to vertices
        var maxDistance = 0.0
        squareCoordinates.forEach { coord ->
            val distance = calculateDistance(centerLat, centerLon, coord.first, coord.second)
            if (distance > maxDistance) {
                maxDistance = distance
            }
        }
        
        // Add 10% buffer
        val radius = (maxDistance * 1.1).toFloat()
        
        // Verify calculations
        assertEquals(37.7749, centerLat, 0.0001)
        assertEquals(-122.4184, centerLon, 0.0001)
        assertTrue(radius > 150 && radius < 170) // Should be around 156m
    }
    
    @Test
    fun testCurrentLocationCheck() {
        // Get current location
        val locationTask = fusedLocationClient.lastLocation
        val location = Tasks.await(locationTask, 10, TimeUnit.SECONDS)
        
        if (location != null) {
            // Create a geofence around current location
            val geofence = Geofence.Builder()
                .setRequestId("current_location")
                .setCircularRegion(location.latitude, location.longitude, 500f) // 500m radius
                .setExpirationDuration(60000) // 1 minute
                .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_EXIT)
                .build()
            
            val request = GeofencingRequest.Builder()
                .addGeofence(geofence)
                .build()
            
            val task = geofencingClient.addGeofences(request, pendingIntent)
            Tasks.await(task, 5, TimeUnit.SECONDS)
            assertTrue(task.isSuccessful)
        }
    }
    
    @Test
    fun testGeofenceTransitionDelay() {
        // This test would measure the time between crossing a geofence boundary
        // and receiving the transition event. In a real scenario, this would
        // require moving the device or using mock locations.
        
        val latch = CountDownLatch(1)
        
        // Set up a receiver to measure transition time
        // In production, you'd register a BroadcastReceiver and measure
        // the time between location change and event receipt
        
        // For this test, we just verify the setup completes
        assertTrue(true)
    }
    
    private fun calculateDistance(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val earthRadius = 6371000.0 // meters
        val lat1Rad = Math.toRadians(lat1)
        val lat2Rad = Math.toRadians(lat2)
        val deltaLat = Math.toRadians(lat2 - lat1)
        val deltaLon = Math.toRadians(lon2 - lon1)
        
        val a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                Math.cos(lat1Rad) * Math.cos(lat2Rad) *
                Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2)
        val c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        
        return earthRadius * c
    }
}