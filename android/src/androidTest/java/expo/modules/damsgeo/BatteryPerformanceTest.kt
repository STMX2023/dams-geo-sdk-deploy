package expo.modules.damsgeo

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.location.Location
import android.os.BatteryManager
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.google.android.gms.location.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.test.assertTrue
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Performance tests to measure battery impact of native vs polygon geofencing.
 * These tests simulate real-world usage patterns.
 */
@RunWith(AndroidJUnit4::class)
class BatteryPerformanceTest {
    
    private lateinit var context: Context
    private lateinit var geofencingClient: GeofencingClient
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    
    @Before
    fun setup() {
        context = ApplicationProvider.getApplicationContext()
        geofencingClient = LocationServices.getGeofencingClient(context)
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)
    }
    
    @Test
    fun testBatteryUsagePolygonMode() {
        // Measure battery usage with polygon checking
        val startBattery = getBatteryLevel()
        val startTime = System.currentTimeMillis()
        
        // Simulate polygon geofencing for 60 seconds
        val latch = CountDownLatch(60)
        val locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                // Simulate polygon checking for 5 zones
                for (location in result.locations) {
                    performPolygonChecks(location)
                }
                latch.countDown()
            }
        }
        
        // Request location updates every second (high frequency for testing)
        val locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            1000L
        ).build()
        
        fusedLocationClient.requestLocationUpdates(
            locationRequest,
            locationCallback,
            context.mainLooper
        )
        
        // Wait for test duration
        latch.await(60, TimeUnit.SECONDS)
        fusedLocationClient.removeLocationUpdates(locationCallback)
        
        val endBattery = getBatteryLevel()
        val duration = System.currentTimeMillis() - startTime
        
        val batteryDrain = startBattery - endBattery
        println("Polygon mode - Battery drain: $batteryDrain% in ${duration/1000}s")
        
        // Store result for comparison
        context.getSharedPreferences("battery_test", Context.MODE_PRIVATE)
            .edit()
            .putFloat("polygon_drain", batteryDrain)
            .putLong("polygon_duration", duration)
            .apply()
    }
    
    @Test
    fun testBatteryUsageNativeMode() {
        // Measure battery usage with native geofencing
        val startBattery = getBatteryLevel()
        val startTime = System.currentTimeMillis()
        
        // Set up 5 native geofences
        val geofences = (0 until 5).map { i ->
            Geofence.Builder()
                .setRequestId("battery_test_$i")
                .setCircularRegion(
                    37.7749 + i * 0.01,
                    -122.4194 + i * 0.01,
                    200f
                )
                .setExpirationDuration(60000) // 1 minute
                .setTransitionTypes(
                    Geofence.GEOFENCE_TRANSITION_ENTER or 
                    Geofence.GEOFENCE_TRANSITION_EXIT
                )
                .build()
        }
        
        val request = GeofencingRequest.Builder()
            .setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_ENTER)
            .addGeofences(geofences)
            .build()
        
        val intent = Intent(context, GeofenceBroadcastReceiver::class.java)
        val pendingIntent = android.app.PendingIntent.getBroadcast(
            context,
            9999,
            intent,
            android.app.PendingIntent.FLAG_UPDATE_CURRENT or 
            android.app.PendingIntent.FLAG_MUTABLE
        )
        
        geofencingClient.addGeofences(request, pendingIntent)
        
        // Wait for test duration (native geofencing runs in background)
        Thread.sleep(60000)
        
        // Clean up
        geofencingClient.removeGeofences(pendingIntent)
        
        val endBattery = getBatteryLevel()
        val duration = System.currentTimeMillis() - startTime
        
        val batteryDrain = startBattery - endBattery
        println("Native mode - Battery drain: $batteryDrain% in ${duration/1000}s")
        
        // Compare with polygon mode
        val prefs = context.getSharedPreferences("battery_test", Context.MODE_PRIVATE)
        val polygonDrain = prefs.getFloat("polygon_drain", 0f)
        
        val improvement = if (polygonDrain > 0) {
            ((polygonDrain - batteryDrain) / polygonDrain) * 100
        } else 0f
        
        println("Battery improvement: $improvement%")
        
        // Native mode should use significantly less battery
        assertTrue(batteryDrain < polygonDrain || polygonDrain == 0f)
    }
    
    @Test
    fun testBackgroundBatteryUsage() {
        // Test battery usage when app is in background
        // This would require running the app in background state
        
        val startBattery = getBatteryLevel()
        
        // Set up native geofences that will monitor in background
        val geofence = Geofence.Builder()
            .setRequestId("background_test")
            .setCircularRegion(37.7749, -122.4194, 500f)
            .setExpirationDuration(300000) // 5 minutes
            .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_DWELL)
            .setLoiteringDelay(60000) // 1 minute dwell time
            .build()
        
        val request = GeofencingRequest.Builder()
            .addGeofence(geofence)
            .build()
        
        val intent = Intent(context, GeofenceBroadcastReceiver::class.java)
        val pendingIntent = android.app.PendingIntent.getBroadcast(
            context,
            8888,
            intent,
            android.app.PendingIntent.FLAG_UPDATE_CURRENT or 
            android.app.PendingIntent.FLAG_MUTABLE
        )
        
        geofencingClient.addGeofences(request, pendingIntent)
        
        // In a real test, the app would be backgrounded here
        println("Background geofencing active - monitor battery usage externally")
        
        // Clean up after delay
        Thread.sleep(5000)
        geofencingClient.removeGeofences(pendingIntent)
        
        val endBattery = getBatteryLevel()
        println("Background test - Battery level: $startBattery% -> $endBattery%")
    }
    
    private fun getBatteryLevel(): Float {
        val batteryStatus = context.registerReceiver(
            null,
            IntentFilter(Intent.ACTION_BATTERY_CHANGED)
        )
        
        val level = batteryStatus?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = batteryStatus?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        
        return if (level >= 0 && scale > 0) {
            (level.toFloat() / scale.toFloat()) * 100
        } else {
            0f
        }
    }
    
    private fun performPolygonChecks(location: Location) {
        // Simulate checking 5 polygon zones
        val testPolygons = listOf(
            // Zone 1 - 4 vertices
            listOf(
                Pair(37.7739, -122.4204),
                Pair(37.7759, -122.4204),
                Pair(37.7759, -122.4184),
                Pair(37.7739, -122.4184)
            ),
            // Zone 2 - 6 vertices
            listOf(
                Pair(37.7760, -122.4210),
                Pair(37.7770, -122.4205),
                Pair(37.7775, -122.4195),
                Pair(37.7770, -122.4185),
                Pair(37.7760, -122.4180),
                Pair(37.7755, -122.4190)
            ),
            // Zone 3 - 8 vertices
            listOf(
                Pair(37.7780, -122.4220),
                Pair(37.7790, -122.4215),
                Pair(37.7795, -122.4205),
                Pair(37.7795, -122.4195),
                Pair(37.7790, -122.4185),
                Pair(37.7780, -122.4180),
                Pair(37.7770, -122.4185),
                Pair(37.7770, -122.4195)
            ),
            // Zone 4 - 5 vertices
            listOf(
                Pair(37.7800, -122.4230),
                Pair(37.7810, -122.4225),
                Pair(37.7810, -122.4215),
                Pair(37.7805, -122.4210),
                Pair(37.7800, -122.4220)
            ),
            // Zone 5 - 10 vertices
            listOf(
                Pair(37.7820, -122.4240),
                Pair(37.7830, -122.4238),
                Pair(37.7835, -122.4232),
                Pair(37.7838, -122.4225),
                Pair(37.7835, -122.4218),
                Pair(37.7830, -122.4212),
                Pair(37.7820, -122.4210),
                Pair(37.7810, -122.4212),
                Pair(37.7805, -122.4218),
                Pair(37.7805, -122.4228)
            )
        )
        
        // Perform ray-casting algorithm for each polygon
        testPolygons.forEach { polygon ->
            isPointInPolygon(location.latitude, location.longitude, polygon)
        }
    }
    
    private fun isPointInPolygon(lat: Double, lon: Double, polygon: List<Pair<Double, Double>>): Boolean {
        var inside = false
        var p1 = polygon[0]
        
        for (i in 1..polygon.size) {
            val p2 = polygon[i % polygon.size]
            
            if (lon > minOf(p1.second, p2.second)) {
                if (lon <= maxOf(p1.second, p2.second)) {
                    if (lat <= maxOf(p1.first, p2.first)) {
                        if (p1.second != p2.second) {
                            val xinters = (lon - p1.second) * (p2.first - p1.first) / 
                                         (p2.second - p1.second) + p1.first
                            if (p1.first == p2.first || lat <= xinters) {
                                inside = !inside
                            }
                        }
                    }
                }
            }
            p1 = p2
        }
        
        return inside
    }
}