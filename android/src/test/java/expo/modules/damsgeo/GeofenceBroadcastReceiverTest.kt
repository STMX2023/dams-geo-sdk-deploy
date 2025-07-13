package expo.modules.damsgeo

import android.content.Context
import android.content.Intent
import android.location.Location
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingEvent
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mock
import org.mockito.Mockito.*
import org.mockito.junit.MockitoJUnitRunner
import org.mockito.kotlin.whenever
import org.mockito.kotlin.verify
import org.mockito.kotlin.any
import org.mockito.kotlin.eq

@RunWith(MockitoJUnitRunner::class)
class GeofenceBroadcastReceiverTest {

    @Mock
    private lateinit var mockContext: Context
    
    @Mock
    private lateinit var mockIntent: Intent
    
    @Mock
    private lateinit var mockGeofencingEvent: GeofencingEvent
    
    @Mock
    private lateinit var mockDamsGeoModule: DamsGeoModule
    
    @Mock
    private lateinit var mockLocation: Location
    
    private lateinit var receiver: GeofenceBroadcastReceiver
    
    @Before
    fun setup() {
        receiver = GeofenceBroadcastReceiver()
        DamsGeoModule.instance = mockDamsGeoModule
        
        // Mock static method GeofencingEvent.fromIntent
        mockStatic(GeofencingEvent::class.java).use { mockedStatic ->
            mockedStatic.`when`<GeofencingEvent> { GeofencingEvent.fromIntent(mockIntent) }
                .thenReturn(mockGeofencingEvent)
        }
    }
    
    @Test
    fun `test successful enter transition handling`() {
        // Setup mocks
        val geofence = mock(Geofence::class.java)
        whenever(geofence.requestId).thenReturn("zone1")
        
        whenever(mockGeofencingEvent.hasError()).thenReturn(false)
        whenever(mockGeofencingEvent.geofenceTransition).thenReturn(Geofence.GEOFENCE_TRANSITION_ENTER)
        whenever(mockGeofencingEvent.triggeringGeofences).thenReturn(listOf(geofence))
        whenever(mockGeofencingEvent.triggeringLocation).thenReturn(mockLocation)
        
        mockStatic(GeofencingEvent::class.java).use { mockedStatic ->
            mockedStatic.`when`<GeofencingEvent> { GeofencingEvent.fromIntent(mockIntent) }
                .thenReturn(mockGeofencingEvent)
            
            // Execute
            receiver.onReceive(mockContext, mockIntent)
            
            // Verify
            verify(mockDamsGeoModule).handleGeofenceTransition(mockGeofencingEvent)
        }
    }
    
    @Test
    fun `test successful exit transition handling`() {
        // Setup mocks
        val geofence = mock(Geofence::class.java)
        whenever(geofence.requestId).thenReturn("zone1")
        
        whenever(mockGeofencingEvent.hasError()).thenReturn(false)
        whenever(mockGeofencingEvent.geofenceTransition).thenReturn(Geofence.GEOFENCE_TRANSITION_EXIT)
        whenever(mockGeofencingEvent.triggeringGeofences).thenReturn(listOf(geofence))
        whenever(mockGeofencingEvent.triggeringLocation).thenReturn(mockLocation)
        
        mockStatic(GeofencingEvent::class.java).use { mockedStatic ->
            mockedStatic.`when`<GeofencingEvent> { GeofencingEvent.fromIntent(mockIntent) }
                .thenReturn(mockGeofencingEvent)
            
            // Execute
            receiver.onReceive(mockContext, mockIntent)
            
            // Verify
            verify(mockDamsGeoModule).handleGeofenceTransition(mockGeofencingEvent)
        }
    }
    
    @Test
    fun `test handling when GeofencingEvent is null`() {
        mockStatic(GeofencingEvent::class.java).use { mockedStatic ->
            mockedStatic.`when`<GeofencingEvent> { GeofencingEvent.fromIntent(mockIntent) }
                .thenReturn(null)
            
            // Execute
            receiver.onReceive(mockContext, mockIntent)
            
            // Verify module is not called
            verify(mockDamsGeoModule, never()).handleGeofenceTransition(any())
        }
    }
    
    @Test
    fun `test handling when GeofencingEvent has error`() {
        whenever(mockGeofencingEvent.hasError()).thenReturn(true)
        whenever(mockGeofencingEvent.errorCode).thenReturn(GeofenceStatusCodes.GEOFENCE_NOT_AVAILABLE)
        
        mockStatic(GeofencingEvent::class.java).use { mockedStatic ->
            mockedStatic.`when`<GeofencingEvent> { GeofencingEvent.fromIntent(mockIntent) }
                .thenReturn(mockGeofencingEvent)
            
            // Execute
            receiver.onReceive(mockContext, mockIntent)
            
            // Verify module is not called
            verify(mockDamsGeoModule, never()).handleGeofenceTransition(any())
        }
    }
    
    @Test
    fun `test handling when no triggering geofences`() {
        whenever(mockGeofencingEvent.hasError()).thenReturn(false)
        whenever(mockGeofencingEvent.triggeringGeofences).thenReturn(emptyList())
        
        mockStatic(GeofencingEvent::class.java).use { mockedStatic ->
            mockedStatic.`when`<GeofencingEvent> { GeofencingEvent.fromIntent(mockIntent) }
                .thenReturn(mockGeofencingEvent)
            
            // Execute
            receiver.onReceive(mockContext, mockIntent)
            
            // Verify module is not called
            verify(mockDamsGeoModule, never()).handleGeofenceTransition(any())
        }
    }
    
    @Test
    fun `test handling when DamsGeoModule instance is null`() {
        // Set instance to null to simulate app terminated
        DamsGeoModule.instance = null
        
        // Setup valid geofencing event
        val geofence = mock(Geofence::class.java)
        whenever(geofence.requestId).thenReturn("zone1")
        
        whenever(mockGeofencingEvent.hasError()).thenReturn(false)
        whenever(mockGeofencingEvent.geofenceTransition).thenReturn(Geofence.GEOFENCE_TRANSITION_ENTER)
        whenever(mockGeofencingEvent.triggeringGeofences).thenReturn(listOf(geofence))
        
        mockStatic(GeofencingEvent::class.java).use { mockedStatic ->
            mockedStatic.`when`<GeofencingEvent> { GeofencingEvent.fromIntent(mockIntent) }
                .thenReturn(mockGeofencingEvent)
            
            // Execute - should handle gracefully
            receiver.onReceive(mockContext, mockIntent)
            
            // No crash should occur
            // In production, this would store event or start a service
        }
    }
    
    @Test
    fun `test multiple geofences triggered simultaneously`() {
        // Setup multiple geofences
        val geofence1 = mock(Geofence::class.java)
        whenever(geofence1.requestId).thenReturn("zone1")
        
        val geofence2 = mock(Geofence::class.java)
        whenever(geofence2.requestId).thenReturn("zone2")
        
        whenever(mockGeofencingEvent.hasError()).thenReturn(false)
        whenever(mockGeofencingEvent.geofenceTransition).thenReturn(Geofence.GEOFENCE_TRANSITION_ENTER)
        whenever(mockGeofencingEvent.triggeringGeofences).thenReturn(listOf(geofence1, geofence2))
        whenever(mockGeofencingEvent.triggeringLocation).thenReturn(mockLocation)
        
        mockStatic(GeofencingEvent::class.java).use { mockedStatic ->
            mockedStatic.`when`<GeofencingEvent> { GeofencingEvent.fromIntent(mockIntent) }
                .thenReturn(mockGeofencingEvent)
            
            // Execute
            receiver.onReceive(mockContext, mockIntent)
            
            // Verify handleGeofenceTransition is called once with all geofences
            verify(mockDamsGeoModule, times(1)).handleGeofenceTransition(mockGeofencingEvent)
        }
    }
}