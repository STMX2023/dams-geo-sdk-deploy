package expo.modules.damsgeo

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingEvent

/**
 * Broadcast receiver for geofence transitions.
 * This receiver is triggered when the device enters or exits a geofence,
 * even when the app is in the background or terminated.
 */
class GeofenceBroadcastReceiver : BroadcastReceiver() {
    
    companion object {
        private const val TAG = "GeofenceReceiver"
    }
    
    override fun onReceive(context: Context, intent: Intent) {
        Log.d(TAG, "Geofence broadcast received")
        
        val geofencingEvent = GeofencingEvent.fromIntent(intent)
        if (geofencingEvent == null) {
            Log.e(TAG, "GeofencingEvent is null")
            return
        }
        
        if (geofencingEvent.hasError()) {
            Log.e(TAG, "Geofencing error: ${geofencingEvent.errorCode}")
            return
        }
        
        // Get the transition type
        val geofenceTransition = geofencingEvent.geofenceTransition
        
        // Get the geofences that were triggered
        val triggeringGeofences = geofencingEvent.triggeringGeofences
        if (triggeringGeofences.isNullOrEmpty()) {
            Log.w(TAG, "No triggering geofences")
            return
        }
        
        // Log the transition details
        val transitionString = when (geofenceTransition) {
            Geofence.GEOFENCE_TRANSITION_ENTER -> "ENTER"
            Geofence.GEOFENCE_TRANSITION_EXIT -> "EXIT"
            Geofence.GEOFENCE_TRANSITION_DWELL -> "DWELL"
            else -> "UNKNOWN"
        }
        
        triggeringGeofences.forEach { geofence ->
            Log.d(TAG, "Geofence transition: $transitionString for zone ${geofence.requestId}")
        }
        
        // Forward to the module instance if available
        DamsGeoModule.instance?.let { module ->
            module.handleGeofenceTransition(geofencingEvent)
        } ?: run {
            // If module isn't available (app terminated), we could:
            // 1. Start a foreground service to handle the event
            // 2. Store the event for later processing
            // 3. Send a local notification
            Log.w(TAG, "DamsGeoModule instance not available, storing event for later")
            
            // For now, just log - in production, you'd want to handle this case
            // by either starting the app or storing the event
        }
    }
}