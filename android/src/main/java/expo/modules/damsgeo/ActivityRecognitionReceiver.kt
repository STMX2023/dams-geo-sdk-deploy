package expo.modules.damsgeo

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.google.android.gms.location.ActivityRecognitionResult
import com.google.android.gms.location.DetectedActivity

class ActivityRecognitionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context?, intent: Intent?) {
    if (ActivityRecognitionResult.hasResult(intent)) {
      val result = ActivityRecognitionResult.extractResult(intent)
      handleDetectedActivities(result.probableActivities)
    }
  }
  
  private fun handleDetectedActivities(activities: List<DetectedActivity>) {
    // Find the most probable activity
    val mostProbableActivity = activities.maxByOrNull { it.confidence }
    
    mostProbableActivity?.let { activity ->
      val activityType = when (activity.type) {
        DetectedActivity.STILL -> "stationary"
        DetectedActivity.ON_FOOT, DetectedActivity.WALKING -> "walking"
        DetectedActivity.IN_VEHICLE -> "vehicle"
        DetectedActivity.RUNNING -> "walking"
        else -> "unknown"
      }
      
      // Send activity update to the module
      DamsGeoModule.instance?.handleActivityUpdate(activityType, activity.confidence)
      println("[DamsGeo] Detected activity: $activityType with confidence ${activity.confidence}")
    }
  }
}