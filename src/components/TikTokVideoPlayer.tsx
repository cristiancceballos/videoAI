import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Dimensions,
  PanResponder,
  Animated,
  StatusBar,
} from 'react-native';
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';
import { Volume2, VolumeX, AlertTriangle } from 'lucide-react-native';
import { VideoWithMetadata } from '../services/videoService';
import { VideoDetailsSheet } from './VideoDetailsSheet';

interface TikTokVideoPlayerProps {
  visible: boolean;
  video: VideoWithMetadata | null;
  videoUrl: string | null;
  onClose: () => void;
  loading?: boolean;
  error?: string;
  onUrlExpired?: () => void;
}

export function TikTokVideoPlayer({
  visible,
  video,
  videoUrl,
  onClose,
  loading = false,
  error,
  onUrlExpired,
}: TikTokVideoPlayerProps) {
  const [videoError, setVideoError] = useState(false);
  const [showDetailsSheet, setShowDetailsSheet] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Current video muted state
  const [hasUserUnmuted, setHasUserUnmuted] = useState(false); // User's audio preference across videos
  const [showMuteFeedback, setShowMuteFeedback] = useState(false); // Brief mute toggle feedback
  const [showProgressBar, setShowProgressBar] = useState(false); // Progress bar visibility
  const [currentTime, setCurrentTime] = useState(0); // Video current time
  const [duration, setDuration] = useState(0); // Video total duration
  const videoRef = useRef<HTMLVideoElement>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const panRef = useRef(new Animated.ValueXY()).current;
  const gestureStartTime = useRef(0);

  // Auto-hide mute feedback after animation
  useEffect(() => {
    if (showMuteFeedback) {
      const timer = setTimeout(() => {
        setShowMuteFeedback(false);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [showMuteFeedback]);
  
  // Auto-hide progress bar after showing
  useEffect(() => {
    if (showProgressBar) {
      const timer = setTimeout(() => {
        setShowProgressBar(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showProgressBar]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (visible) {
      console.log('Modal opened - resetting state and preventing screen sleep');
      activateKeepAwake(); // Prevent screen from sleeping during video playback
      setVideoError(false);
      setShowDetailsSheet(false);
      setShowMuteFeedback(false);
      setShowProgressBar(false);
      setCurrentTime(0);
      setDuration(0);
      setIsMuted(hasUserUnmuted ? false : true); // Respect user's audio preference
      panRef.setValue({ x: 0, y: 0 });
      fadeAnim.setValue(1);
    } else {
      console.log('Modal closed - ensuring complete cleanup and allowing screen sleep');
      deactivateKeepAwake(); // Allow screen to sleep when video player closes
      // Ensure complete cleanup when modal closes
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
      setVideoError(false);
      setShowDetailsSheet(false);
      setIsMuted(true); // Reset to muted for cleanup
      panRef.setValue({ x: 0, y: 0 });
      fadeAnim.setValue(1);
    }
  }, [visible]);

  // Unified gesture handler for both horizontal (exit) and vertical (details) gestures
  const unifiedPanResponder = PanResponder.create({
    onStartShouldSetPanResponder: (evt) => {
      // Completely disable player gestures when details sheet is open
      if (showDetailsSheet) {
        console.log('🚫 Details sheet open - ignoring player gesture');
        return false;
      }
      
      const touchY = evt.nativeEvent.pageY;
      const screenHeight = Dimensions.get('window').height;
      const bottomZone = screenHeight * 0.92; // Bottom 8% for progress bar
      
      if (touchY > bottomZone) {
        // In bottom zone - let progress handler take precedence for horizontal drags
        console.log('👇 Touch in bottom zone - deferring to progress handler');
        return false;
      }
      
      console.log('👆 Touch started - toggling mute');
      toggleMute();
      gestureStartTime.current = Date.now();
      return true;
    },
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      // Completely disable player gestures when details sheet is open
      if (showDetailsSheet) {
        console.log('🚫 Details sheet open - ignoring player gesture movement');
        return false;
      }
      
      console.log('🎯 Gesture movement detected:', { dx: gestureState.dx, dy: gestureState.dy });
      
      const touchY = evt.nativeEvent.pageY;
      const screenHeight = Dimensions.get('window').height;
      const bottomZone = screenHeight * 0.92; // Bottom 8% for progress bar
      
      // Don't capture horizontal gestures in bottom zone - let progress handler handle them
      if (touchY > bottomZone && Math.abs(gestureState.dx) > Math.abs(gestureState.dy)) {
        console.log('👇 Horizontal gesture in bottom zone - deferring to progress handler');
        return false;
      }
      
      const horizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      const vertical = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      const diagonal = gestureState.dx > 20 && gestureState.dy > 20; // Top-left to bottom-right
      
      // Only capture gestures with significant movement (actual swipes)
      if (horizontal && gestureState.dx > 20) {
        console.log('👉 Horizontal swipe detected for exit');
        return true;
      }
      
      if (vertical && gestureState.dy < -30) {
        console.log('☝️ Vertical swipe up detected for details');
        return true;
      }
      
      if (vertical && gestureState.dy > 30) {
        console.log('👇 Vertical swipe down detected for exit');
        return true;
      }
      
      if (diagonal) {
        console.log('↘️ Diagonal swipe detected for exit');
        return true;
      }
      
      // Don't capture small movements (taps) - let them be handled by onStartShouldSetPanResponder
      return false;
    },
    onMoveShouldSetPanResponderCapture: () => false,
    onPanResponderGrant: () => {
      console.log('🤏 Gesture granted for swipe');
      panRef.setOffset({
        x: panRef.x._value,
        y: panRef.y._value,
      });
    },
    onPanResponderMove: (evt, gestureState) => {
      const horizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      const vertical = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      const diagonal = gestureState.dx > 0 && gestureState.dy > 0 && 
                      Math.abs(gestureState.dx - gestureState.dy) < 50; // Similar X and Y movement
      
      if (diagonal) {
        // Handle diagonal swipe (top-left to bottom-right) for exit
        console.log('↘️ Diagonal move:', { dx: gestureState.dx, dy: gestureState.dy });
        panRef.setValue({ x: gestureState.dx, y: gestureState.dy });
        // Fade out based on diagonal distance
        const distance = Math.sqrt(gestureState.dx * gestureState.dx + gestureState.dy * gestureState.dy);
        const opacity = Math.max(0.3, 1 - distance / 280); // Adjusted for diagonal distance
        fadeAnim.setValue(opacity);
      } else if (horizontal && gestureState.dx > 0) {
        // Handle horizontal swipe for exit
        console.log('➡️ Horizontal move:', gestureState.dx);
        panRef.setValue({ x: gestureState.dx, y: 0 });
        // Fade out as user swipes right
        const opacity = Math.max(0.3, 1 - gestureState.dx / 200);
        fadeAnim.setValue(opacity);
      } else if (vertical && gestureState.dy > 0) {
        // Handle vertical swipe down for exit
        console.log('⬇️ Vertical down move:', gestureState.dy);
        panRef.setValue({ x: 0, y: gestureState.dy });
        // Fade out as user swipes down
        const opacity = Math.max(0.3, 1 - gestureState.dy / 200);
        fadeAnim.setValue(opacity);
      }
      // Vertical up gestures don't need visual feedback during move
    },
    onPanResponderRelease: (evt, gestureState) => {
      console.log('🔄 Gesture released:', { dx: gestureState.dx, dy: gestureState.dy, vx: gestureState.vx, vy: gestureState.vy });
      panRef.flattenOffset();
      
      const horizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      const vertical = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      const diagonal = gestureState.dx > 0 && gestureState.dy > 0; // Moving right and down
      
      if (horizontal && gestureState.dx > 50 && gestureState.vx > 0.25) {
        // Horizontal swipe right threshold met - exit (50% easier)
        console.log('🚪 Horizontal exit threshold met - closing video');
        handleExit();
      } else if (vertical && gestureState.dy > 50 && gestureState.vy > 0.25) {
        // Vertical swipe down threshold met - exit (50% easier)
        console.log('⬇️ Vertical down exit threshold met - closing video');
        handleExit();
      } else if (diagonal && gestureState.dx > 50 && gestureState.dy > 50 && 
                 gestureState.vx > 0.25 && gestureState.vy > 0.25) {
        // Diagonal swipe (top-left to bottom-right) threshold met - exit
        console.log('↘️ Diagonal exit threshold met - closing video');
        handleExit();
      } else if (vertical && gestureState.dy < -30) {
        // Vertical swipe up threshold met - show details (matches capture threshold)
        console.log('📊 Details threshold met - showing sheet');
        setShowDetailsSheet(true);
      } else {
        // Check if this was a tap (short duration, minimal movement)
        const gestureDuration = Date.now() - gestureStartTime.current;
        const totalMovement = Math.sqrt(gestureState.dx * gestureState.dx + gestureState.dy * gestureState.dy);
        
        if (gestureDuration < 500 && totalMovement < 50) {
          // This was a tap - toggle mute
          console.log('👆 Tap detected - toggling mute');
          console.log('👆 Tap details:', { duration: gestureDuration, movement: totalMovement });
          toggleMute();
        } else {
          console.log('❌ Not a tap:', { duration: gestureDuration, movement: totalMovement });
        }
        
        // Snap back to original position
        console.log('↩️ Snapping back to original position');
        Animated.parallel([
          Animated.spring(panRef, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }),
          Animated.spring(fadeAnim, {
            toValue: 1,
            useNativeDriver: false,
          }),
        ]).start();
      }
    },
  });

  // Progress bar gesture handler for horizontal drag at bottom
  const progressPanResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      const touchY = evt.nativeEvent.pageY;
      const screenHeight = Dimensions.get('window').height;
      const bottomZone = screenHeight * 0.92; // Bottom 8% of screen
      
      // Only activate in bottom zone with horizontal movement
      const isBottomZone = touchY > bottomZone;
      const isHorizontalDrag = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      const hasMovement = Math.abs(gestureState.dx) > 10;
      
      if (isBottomZone && isHorizontalDrag && hasMovement) {
        console.log('📉 Progress bar drag detected');
        setShowProgressBar(true);
        return true;
      }
      
      return false;
    },
    onPanResponderMove: (evt, gestureState) => {
      // Update progress based on horizontal drag
      if (videoRef.current && duration > 0) {
        const screenWidth = Dimensions.get('window').width;
        const progressPercent = Math.max(0, Math.min(1, gestureState.moveX / screenWidth));
        const newTime = progressPercent * duration;
        
        console.log('📊 Updating video time to:', newTime);
        videoRef.current.currentTime = newTime;
        setCurrentTime(newTime);
      }
    },
    onPanResponderRelease: () => {
      console.log('📉 Progress drag ended');
      // Progress bar will auto-hide after timeout via useEffect
    },
  });

  const handleExit = () => {
    console.log('🚪 handleExit called - starting cleanup');
    
    // Stop video immediately to prevent white screen
    if (videoRef.current) {
      console.log('⏹️ Stopping video playback');
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    
    // Reset all state immediately
    setShowDetailsSheet(false);
    setVideoError(false);
    
    console.log('🧹 State cleaned up, starting exit animation');
    
    // Quick exit animation
    Animated.parallel([
      Animated.timing(panRef.x, {
        toValue: Dimensions.get('window').width,
        duration: 150, // Faster animation to reduce white screen chance
        useNativeDriver: false,
      }),
      Animated.timing(panRef.y, {
        toValue: Dimensions.get('window').height,
        duration: 150,
        useNativeDriver: false,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }),
    ]).start(() => {
      console.log('✅ Exit animation complete, calling onClose');
      // Reset animation values before closing
      panRef.setValue({ x: 0, y: 0 });
      fadeAnim.setValue(1);
      onClose();
    });
  };

  const handleVideoError = (event: any) => {
    console.error('❌ Video playback error:', event);
    
    // Check if error might be due to expired URL
    if (event?.target?.error?.code === 4 || event?.target?.error?.code === 3) {
      console.log('🔄 Video error might be expired URL, attempting refresh...');
      if (onUrlExpired) {
        onUrlExpired();
        return;
      }
    }
    
    setVideoError(true);
  };

  const handleVideoLoad = () => {
    console.log('✅ Video loaded successfully - starting autoplay');
    if (videoRef.current) {
      videoRef.current.play().catch(console.error);
      
      // Auto-unmute if user has previously chosen audio
      if (hasUserUnmuted) {
        console.log('🔊 Auto-unmuting video based on user preference');
        videoRef.current.muted = false;
        setIsMuted(false);
      }
      
      // Set up video progress tracking
      setDuration(videoRef.current.duration || 0);
      
      const updateTime = () => {
        if (videoRef.current) {
          setCurrentTime(videoRef.current.currentTime);
        }
      };
      
      videoRef.current.addEventListener('timeupdate', updateTime);
      videoRef.current.addEventListener('loadedmetadata', () => {
        if (videoRef.current) {
          setDuration(videoRef.current.duration);
        }
      });
    }
  };

  const toggleMute = () => {
    console.log('🔊 toggleMute called, current isMuted:', isMuted);
    
    if (videoRef.current) {
      const newMutedState = !isMuted;
      videoRef.current.muted = newMutedState;
      setIsMuted(newMutedState);
      
      // Remember user preference when they first unmute
      if (!newMutedState && !hasUserUnmuted) {
        console.log('🔊 First time unmuting - remembering preference');
        setHasUserUnmuted(true);
      }
      
      // Show brief feedback animation
      setShowMuteFeedback(true);
      console.log('🔊 Mute state changed to:', newMutedState ? 'muted' : 'unmuted');
    }
  };


  // Helper function to format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!video) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={handleExit}
      statusBarTranslucent={true}
    >
      <StatusBar hidden />
      <Animated.View 
        style={[
          styles.container,
          {
            opacity: fadeAnim,
            transform: panRef.getTranslateTransform(),
          }
        ]}
        {...unifiedPanResponder.panHandlers}
      >
        {/* Video Player */}
        <View style={styles.videoContainer}>
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.loadingText}>
                {videoUrl ? 'Refreshing video...' : 'Loading video...'}
              </Text>
            </View>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <View style={styles.errorIcon}>
                <AlertTriangle size={48} color="#FF3B30" />
              </View>
              <Text style={styles.errorMessage}>{error}</Text>
              <TouchableOpacity onPress={handleExit} style={styles.errorButton}>
                <Text style={styles.errorButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}

          {videoError && (
            <View style={styles.errorContainer}>
              <View style={styles.errorIcon}>
                <AlertTriangle size={48} color="#FF3B30" />
              </View>
              <Text style={styles.errorMessage}>
                Unable to play this video. It may be corrupted or in an unsupported format.
              </Text>
              <TouchableOpacity onPress={handleExit} style={styles.errorButton}>
                <Text style={styles.errorButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}

          {videoUrl && !loading && !error && (
            <TouchableOpacity
              style={styles.videoTouchArea}
              onPress={() => {
                console.log('🎯 Fallback tap handler triggered');
                toggleMute();
              }}
              activeOpacity={1}
            >
              <video
                ref={videoRef}
                src={videoUrl}
                autoPlay
                muted={isMuted}
                playsInline
                loop
                style={styles.video}
                onError={handleVideoError}
                onLoadedData={handleVideoLoad}
                preload="auto"
                key={videoUrl}
              />
            </TouchableOpacity>
          )}

          {/* Instagram-style persistent mute button */}
          {!loading && !error && (
            <TouchableOpacity style={styles.muteButton} onPress={toggleMute}>
              <View style={styles.muteIconContainer}>
                {isMuted ? (
                  <VolumeX size={16} color="#fff" />
                ) : (
                  <Volume2 size={16} color="#fff" />
                )}
              </View>
            </TouchableOpacity>
          )}
          
          {/* Progress bar gesture detection overlay - bottom 25% of screen */}
          {!loading && !error && videoUrl && (
            <View 
              style={styles.progressGestureOverlay}
              {...progressPanResponder.panHandlers}
            />
          )}
          
          {/* Mute toggle feedback */}
          {showMuteFeedback && (
            <Animated.View style={styles.muteFeedback}>
              <View style={styles.muteFeedbackContainer}>
                <View style={styles.muteFeedbackIcon}>
                  {isMuted ? (
                    <VolumeX size={24} color="#fff" />
                  ) : (
                    <Volume2 size={24} color="#fff" />
                  )}
                </View>
                <Text style={styles.muteFeedbackText}>
                  {isMuted ? 'Muted' : 'Unmuted'}
                </Text>
              </View>
            </Animated.View>
          )}
          
          {/* Debug overlay to verify render conditions */}
          {__DEV__ && (
            <View style={styles.debugOverlay}>
              <Text style={styles.debugText}>L:{String(loading)}</Text>
              <Text style={styles.debugText}>E:{String(!!error)}</Text>
              <Text style={styles.debugText}>M:{String(isMuted)}</Text>
              <Text style={styles.debugText}>P:{String(showProgressBar)}</Text>
            </View>
          )}
        </View>

        {/* TikTok-style Progress Bar - Only on drag */}
        {showProgressBar && (
          <>
            {/* Time stamp above progress bar */}
            <View style={styles.progressTimeContainer}>
              <Text style={styles.progressTime}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </Text>
            </View>
            {/* Progress bar at very bottom */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }
                  ]} 
                />
              </View>
            </View>
          </>
        )}

        {/* Video Details Sheet */}
        <VideoDetailsSheet
          visible={showDetailsSheet}
          video={video}
          onClose={() => setShowDetailsSheet(false)}
        />

      </Animated.View>
    </Modal>
  );
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoTouchArea: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  } as any,
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorIcon: {
    marginBottom: 16,
    alignItems: 'center',
  },
  errorMessage: {
    color: '#FF3B30',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  errorButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  errorButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  muteButton: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  muteIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  muteFeedback: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  muteFeedbackContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  muteFeedbackIcon: {
    marginBottom: 8,
    alignItems: 'center',
  },
  muteFeedbackText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  progressTimeContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  progressTime: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    textAlign: 'center',
  },
  debugOverlay: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 8,
    borderRadius: 4,
  },
  debugText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  progressGestureOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: screenHeight * 0.08, // Bottom 8% of screen for progress detection
    backgroundColor: 'transparent',
  },
});