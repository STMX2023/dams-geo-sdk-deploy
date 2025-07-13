package expo.modules.damsgeo

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat

class LocationService : Service() {
  companion object {
    const val NOTIFICATION_ID = 12345
    const val CHANNEL_ID = "dams_location_service"
    const val ACTION_PAUSE = "com.dams.geo.action.PAUSE"
    const val ACTION_RESUME = "com.dams.geo.action.RESUME"
    const val ACTION_STOP = "com.dams.geo.action.STOP"
  }

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
    
    // Android 14+ requires showing notification within 10 seconds
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(
        NOTIFICATION_ID, 
        createNotification(),
        ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION or ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
      )
    } else {
      startForeground(NOTIFICATION_ID, createNotification())
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_PAUSE -> handlePause()
      ACTION_RESUME -> handleResume()
      ACTION_STOP -> handleStop()
    }
    
    // Ensure notification is shown within 10 seconds (Android 14+ requirement)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      ServiceCompat.startForeground(
        this,
        NOTIFICATION_ID,
        createNotification(),
        ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION or ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
      )
    } else {
      startForeground(NOTIFICATION_ID, createNotification())
    }
    
    return START_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? {
    return null
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Location Tracking",
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        description = "Tracks your location for safety alerts"
        setShowBadge(false)
      }
      
      val notificationManager = getSystemService(NotificationManager::class.java)
      notificationManager.createNotificationChannel(channel)
    }
  }

  private fun createNotification(): Notification {
    // Get the launch intent for the app
    val intent = packageManager.getLaunchIntentForPackage(packageName)
    val pendingIntent = PendingIntent.getActivity(
      this, 0, intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    
    // Create pause action
    val pauseIntent = Intent(this, LocationService::class.java).apply {
      action = ACTION_PAUSE
    }
    val pausePendingIntent = PendingIntent.getService(
      this, 1, pauseIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("DAMS Location Active")
      .setContentText("Your location is being used for safety alerts")
      .setSmallIcon(getNotificationIcon())
      .setContentIntent(pendingIntent)
      .setOngoing(true)
      .addAction(
        android.R.drawable.ic_media_pause,
        "Pause 30 min",
        pausePendingIntent
      )
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .build()
  }

  private fun updateNotification(text: String) {
    val notification = NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("DAMS Location")
      .setContentText(text)
      .setSmallIcon(getNotificationIcon())
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()
    
    val notificationManager = getSystemService(NotificationManager::class.java)
    notificationManager.notify(NOTIFICATION_ID, notification)
  }
  
  private fun getNotificationIcon(): Int {
    // Try to use custom icon, fall back to system icon if not found
    return try {
      resources.getIdentifier("ic_location_notification", "drawable", packageName).takeIf { it != 0 }
        ?: android.R.drawable.ic_menu_mylocation
    } catch (e: Exception) {
      android.R.drawable.ic_menu_mylocation
    }
  }

  private fun handlePause() {
    updateNotification("Location tracking paused for 30 minutes")
    
    // Schedule resume after 30 minutes using AlarmManager
    // This will be implemented in the main module
    sendBroadcast(Intent("com.dams.geo.PAUSE_TRACKING"))
  }

  private fun handleResume() {
    updateNotification("Your location is being used for safety alerts")
    sendBroadcast(Intent("com.dams.geo.RESUME_TRACKING"))
  }

  private fun handleStop() {
    sendBroadcast(Intent("com.dams.geo.STOP_TRACKING"))
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }
}