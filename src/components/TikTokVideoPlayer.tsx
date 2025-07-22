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
      console.log('📱 Modal opened - resetting state');
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
      console.log('📱 Modal closed - ensuring complete cleanup');
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
      const touchY = evt.nativeEvent.pageY;
      const screenHeight = Dimensions.get('window').height;
      const bottomZone = screenHeight * 0.75; // Bottom 25% for progress bar
      
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
      console.log('🎯 Gesture movement detected:', { dx: gestureState.dx, dy: gestureState.dy });
      
      const touchY = evt.nativeEvent.pageY;
      const screenHeight = Dimensions.get('window').height;
      const bottomZone = screenHeight * 0.75; // Bottom 25% for progress bar
      
      // Don't capture horizontal gestures in bottom zone - let progress handler handle them
      if (touchY > bottomZone && Math.abs(gestureState.dx) > Math.abs(gestureState.dy)) {
        console.log('👇 Horizontal gesture in bottom zone - deferring to progress handler');
        return false;
      }
      
      const horizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      const vertical = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      
      // Only capture gestures with significant movement (actual swipes)
      if (horizontal && gestureState.dx > 20) {
        console.log('👉 Horizontal swipe detected for exit');
        return true;
      }
      
      if (vertical && gestureState.dy < -30) {
        console.log('☝️ Vertical swipe detected for details');
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
      
      if (horizontal && gestureState.dx > 0) {
        // Handle horizontal swipe for exit
        console.log('➡️ Horizontal move:', gestureState.dx);
        panRef.setValue({ x: gestureState.dx, y: 0 });
        // Fade out as user swipes
        const opacity = Math.max(0.3, 1 - gestureState.dx / 200);
        fadeAnim.setValue(opacity);
      }
      // Vertical gestures don't need visual feedback during move
    },
    onPanResponderRelease: (evt, gestureState) => {
      console.log('🔄 Gesture released:', { dx: gestureState.dx, dy: gestureState.dy, vx: gestureState.vx, vy: gestureState.vy });
      panRef.flattenOffset();
      
      const horizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      const vertical = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      
      if (horizontal && gestureState.dx > 100 && gestureState.vx > 0.5) {
        // Horizontal swipe threshold met - exit
        console.log('🚪 Exit threshold met - closing video');
        handleExit();
      } else if (vertical && gestureState.dy < -50 && gestureState.vy < -0.5) {
        // Vertical swipe threshold met - show details
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
      const bottomZone = screenHeight * 0.75; // Bottom 25% of screen
      
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
              <Text style={styles.errorText}>⚠️</Text>
              <Text style={styles.errorMessage}>{error}</Text>
              <TouchableOpacity onPress={handleExit} style={styles.errorButton}>
                <Text style={styles.errorButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}

          {videoError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>⚠️</Text>
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
                <Text style={styles.muteIcon}>
                  {isMuted ? '🔇' : '🔊'}
                </Text>
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
                <Text style={styles.muteFeedbackIcon}>
                  {isMuted ? '🔇' : '🔊'}
                </Text>
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
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }
                ]} 
              />
            </View>
            <Text style={styles.progressTime}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </Text>
          </View>
        )}

        {/* Video Details Sheet */}
        <VideoDetailsSheet
          visible={showDetailsSheet}
          video={video}
          onClose={() => setShowDetailsSheet(false)}
        />

        {/* Subtle swipe indicator at bottom */}
        {!showDetailsSheet && (
          <View style={styles.swipeIndicator}>
            <View style={styles.swipeBar} />
          </View>
        )}
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
  errorText: {
    fontSize: 48,
    marginBottom: 16,
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
  muteIcon: {
    fontSize: 14,
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
    fontSize: 32,
    marginBottom: 8,
  },
  muteFeedbackText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  progressContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  swipeIndicator: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  swipeBar: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
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
    height: screenHeight * 0.25, // Bottom 25% of screen for progress detection
    backgroundColor: 'transparent',
  },
});