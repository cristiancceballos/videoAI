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
import { Volume2, VolumeX, AlertTriangle, FastForward } from 'lucide-react-native';
import { VideoWithMetadata } from '../services/videoService';
import { VideoDetailsSheet } from './VideoDetailsSheet';
import { getInterFontConfig } from '../utils/fontUtils';

interface TikTokVideoPlayerProps {
  visible: boolean;
  video: VideoWithMetadata | null;
  videoUrl: string | null;
  onClose: () => void;
  loading?: boolean;
  error?: string;
  onUrlExpired?: () => void;
  videos?: VideoWithMetadata[];
  currentIndex?: number;
  onVideoChange?: (index: number) => void;
}

export function TikTokVideoPlayer({
  visible,
  video,
  videoUrl,
  onClose,
  loading = false,
  error,
  onUrlExpired,
  videos = [],
  currentIndex = 0,
  onVideoChange,
}: TikTokVideoPlayerProps) {
  const [videoError, setVideoError] = useState(false);
  const [showDetailsSheet, setShowDetailsSheet] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Current video muted state
  const [hasUserUnmuted, setHasUserUnmuted] = useState(false); // User's audio preference across videos
  const [showMuteFeedback, setShowMuteFeedback] = useState(false); // Brief mute toggle feedback
  const [showProgressBar, setShowProgressBar] = useState(false); // Progress bar visibility
  const [currentTime, setCurrentTime] = useState(0); // Video current time
  const [duration, setDuration] = useState(0); // Video total duration
  const [is2xSpeed, setIs2xSpeed] = useState(false); // 2x speed state
  const videoRef = useRef<HTMLVideoElement>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const panRef = useRef(new Animated.ValueXY()).current;
  const gestureStartTime = useRef(0);
  const lastMoveTime = useRef(0);
  const speedHoldTimeout = useRef<NodeJS.Timeout | null>(null);
  const isHoldingForSpeed = useRef(false);
  const touchStartX = useRef(0);
  const THROTTLE_MS = 16; // ~60fps
  const LONG_PRESS_DELAY = 200; // ms to detect long press

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
      // Reset speed state
      setIs2xSpeed(false);
      if (videoRef.current) {
        videoRef.current.playbackRate = 1;
      }
    } else {
      deactivateKeepAwake(); // Allow screen to sleep when video player closes
      // Ensure complete cleanup when modal closes
      if (videoRef.current) {
        // Remove event listeners
        if (updateTimeRef.current) {
          videoRef.current.removeEventListener('timeupdate', updateTimeRef.current);
          updateTimeRef.current = null;
        }
        if (loadedMetadataRef.current) {
          videoRef.current.removeEventListener('loadedmetadata', loadedMetadataRef.current);
          loadedMetadataRef.current = null;
        }
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load(); // Force cleanup
        videoRef.current.currentTime = 0;
      }
      setVideoError(false);
      setShowDetailsSheet(false);
      setIsMuted(true); // Reset to muted for cleanup
      panRef.setValue({ x: 0, y: 0 });
      fadeAnim.setValue(1);
    }
  }, [visible]);


  // Handle video URL changes and ensure autoplay
  useEffect(() => {
    if (videoUrl && videoRef.current && visible) {
      // Clean up existing event listeners first
      if (updateTimeRef.current) {
        videoRef.current.removeEventListener('timeupdate', updateTimeRef.current);
        updateTimeRef.current = null;
      }
      if (loadedMetadataRef.current) {
        videoRef.current.removeEventListener('loadedmetadata', loadedMetadataRef.current);
        loadedMetadataRef.current = null;
      }
      
      // Reset video state
      setVideoError(false);
      setCurrentTime(0);
      setDuration(0);
      
      // Update src and ensure play
      const video = videoRef.current;
      video.pause();
      video.currentTime = 0;
      video.src = videoUrl;
      
      // Wait for video to be ready then play
      const handleCanPlay = () => {
        requestAnimationFrame(() => {
          video.play().catch(err => {
            console.error('Autoplay failed:', err);
            // If autoplay fails, the user can tap to play
          });
        });
        video.removeEventListener('canplay', handleCanPlay);
      };
      
      video.addEventListener('canplay', handleCanPlay);
      video.load();
      
      // Cleanup function
      return () => {
        video.removeEventListener('canplay', handleCanPlay);
      };
    }
  }, [videoUrl, visible]);

  // Reset video state when video prop changes
  useEffect(() => {
    if (video && visible) {
      // Clear any pending load timeout
      if (videoLoadTimeoutRef.current) {
        clearTimeout(videoLoadTimeoutRef.current);
        videoLoadTimeoutRef.current = null;
      }
    }
  }, [video?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up all refs and listeners
      if (videoRef.current) {
        if (updateTimeRef.current) {
          videoRef.current.removeEventListener('timeupdate', updateTimeRef.current);
        }
        if (loadedMetadataRef.current) {
          videoRef.current.removeEventListener('loadedmetadata', loadedMetadataRef.current);
        }
        videoRef.current.pause();
        videoRef.current.src = '';
      }
      if (videoLoadTimeoutRef.current) {
        clearTimeout(videoLoadTimeoutRef.current);
      }
    };
  }, []);

  // Unified gesture handler for both horizontal (exit) and vertical (details) gestures
  const unifiedPanResponder = PanResponder.create({
    onStartShouldSetPanResponder: (evt) => {
      // Completely disable player gestures when details sheet is open
      if (showDetailsSheet) {
        return false;
      }
      
      const touchY = evt.nativeEvent.pageY;
      const screenHeight = Dimensions.get('window').height;
      const bottomZone = screenHeight * 0.92; // Bottom 8% for progress bar
      
      if (touchY > bottomZone) {
        // In bottom zone - let progress handler take precedence for horizontal drags
        return false;
      }
      
      // Store touch position and start time
      touchStartX.current = evt.nativeEvent.pageX;
      gestureStartTime.current = Date.now();
      
      // Set up long press detection for right side
      const screenWidth = Dimensions.get('window').width;
      const isRightSide = evt.nativeEvent.pageX > screenWidth / 2;
      
      if (isRightSide) {
        speedHoldTimeout.current = setTimeout(() => {
          // Long press detected on right side - activate 2x speed
          isHoldingForSpeed.current = true;
          if (videoRef.current) {
            videoRef.current.playbackRate = 2;
            setIs2xSpeed(true);
          }
        }, LONG_PRESS_DELAY);
      }
      
      return true;
    },
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      // Completely disable player gestures when details sheet is open
      if (showDetailsSheet) {
        return false;
      }
      
      
      const touchY = evt.nativeEvent.pageY;
      const screenHeight = Dimensions.get('window').height;
      const bottomZone = screenHeight * 0.92; // Bottom 8% for progress bar
      
      // Don't capture horizontal gestures in bottom zone - let progress handler handle them
      if (touchY > bottomZone && Math.abs(gestureState.dx) > Math.abs(gestureState.dy)) {
        return false;
      }
      
      // Prioritize swipe-up detection first for consistent details sheet opening
      if (gestureState.dy < -30 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 0.7) {
        return true;
      }
      
      const horizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      const vertical = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      const diagonal = gestureState.dx > 20 && gestureState.dy > 20; // Top-left to bottom-right
      
      // Only capture gestures with significant movement (actual swipes)
      if (horizontal && Math.abs(gestureState.dx) > 20) {
        return true;
      }
      
      if (vertical && gestureState.dy > 30) {
        return true;
      }
      
      if (diagonal) {
        return true;
      }
      
      // Don't capture small movements (taps) - let them be handled by onStartShouldSetPanResponder
      return false;
    },
    onMoveShouldSetPanResponderCapture: () => false,
    onPanResponderGrant: () => {
      panRef.setOffset({
        x: panRef.x._value,
        y: panRef.y._value,
      });
    },
    onPanResponderMove: (evt, gestureState) => {
      // Throttle gesture handling for better performance
      const now = Date.now();
      if (now - lastMoveTime.current < THROTTLE_MS) {
        return;
      }
      lastMoveTime.current = now;
      
      // Cancel speed hold if user moves (indicates not a hold but a swipe)
      if (speedHoldTimeout.current && (Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5)) {
        clearTimeout(speedHoldTimeout.current);
        speedHoldTimeout.current = null;
      }
      
      const horizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      const vertical = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      const diagonal = gestureState.dx > 0 && gestureState.dy > 0 && 
                      Math.abs(gestureState.dx - gestureState.dy) < 50;
      
      // Only show visual feedback for exit gestures, not navigation
      if (diagonal) {
        // Handle diagonal swipe (top-left to bottom-right) for exit
        panRef.setValue({ x: gestureState.dx, y: gestureState.dy });
        // Keep opacity at 1 to prevent white flash
      } else if (horizontal && gestureState.dx > 0 && currentIndex === 0) {
        // Only show exit animation if swiping right on first video
        panRef.setValue({ x: gestureState.dx, y: 0 });
        // Keep opacity at 1 to prevent white flash
      } else if (vertical && gestureState.dy > 0) {
        // Handle vertical swipe down for exit
        panRef.setValue({ x: 0, y: gestureState.dy });
        // Keep opacity at 1 to prevent white flash
      }
      // No visual feedback for horizontal navigation swipes
    },
    onPanResponderRelease: (evt, gestureState) => {
      panRef.flattenOffset();
      
      // Clean up speed hold
      if (speedHoldTimeout.current) {
        clearTimeout(speedHoldTimeout.current);
        speedHoldTimeout.current = null;
      }
      
      if (isHoldingForSpeed.current) {
        // Was holding for speed - reset to normal
        isHoldingForSpeed.current = false;
        if (videoRef.current) {
          videoRef.current.playbackRate = 1;
        }
        setIs2xSpeed(false);
        return; // Don't process other gestures
      }
      
      // Prioritize swipe-up detection first (matches capture logic)
      if (gestureState.dy < -30 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 0.7) {
        // Vertical swipe up threshold met - show details (prioritized)
        setShowDetailsSheet(true);
      } else {
        const horizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        const vertical = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        const diagonal = gestureState.dx > 0 && gestureState.dy > 0; // Moving right and down
        
        // Check for horizontal navigation swipes
        if (horizontal && Math.abs(gestureState.dx) > 50) {
          if (gestureState.dx < -50) {
            // Swipe left - go to next video
            handleNavigateToVideo(currentIndex + 1);
          } else if (gestureState.dx > 50) {
            // Swipe right - go to previous video or exit if first
            if (currentIndex > 0) {
              handleNavigateToVideo(currentIndex - 1);
            } else {
              // First video - exit on swipe right
              handleExit();
            }
          }
        } else if (vertical && gestureState.dy > 50 && gestureState.vy > 0.25) {
          // Vertical swipe down threshold met - exit (50% easier)
          handleExit();
        } else if (diagonal && gestureState.dx > 50 && gestureState.dy > 50 && 
                   gestureState.vx > 0.25 && gestureState.vy > 0.25) {
          // Diagonal swipe (top-left to bottom-right) threshold met - exit
          handleExit();
        } else {
          // Check if this was a tap (short duration, minimal movement)
          const gestureDuration = Date.now() - gestureStartTime.current;
          const totalMovement = Math.sqrt(gestureState.dx * gestureState.dx + gestureState.dy * gestureState.dy);
          
          // Taps are now handled by the touch zones
          
          // Snap back to original position
          Animated.spring(panRef, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
            tension: 40,
            friction: 7,
          }).start();
        }
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
        
        videoRef.current.currentTime = newTime;
        setCurrentTime(newTime);
      }
    },
    onPanResponderRelease: () => {
      // Progress bar will auto-hide after timeout via useEffect
    },
  });

  const handleExit = () => {
    
    // Stop video immediately to prevent white screen
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    
    // Reset all state immediately
    setShowDetailsSheet(false);
    setVideoError(false);
    
    
    // Quick exit animation without opacity change
    Animated.parallel([
      Animated.timing(panRef.x, {
        toValue: Dimensions.get('window').width,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(panRef.y, {
        toValue: Dimensions.get('window').height,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start(() => {
      // Reset animation values before closing
      panRef.setValue({ x: 0, y: 0 });
      fadeAnim.setValue(1);
      onClose();
    });
  };

  const handleNavigateToVideo = (newIndex: number) => {
    if (!onVideoChange || newIndex < 0 || newIndex >= videos.length) {
      // Can't navigate, snap back
      Animated.spring(panRef, {
        toValue: { x: 0, y: 0 },
        useNativeDriver: false,
        tension: 40,
        friction: 7,
      }).start();
      return;
    }

    // Clean up current video
    if (videoRef.current) {
      if (updateTimeRef.current) {
        videoRef.current.removeEventListener('timeupdate', updateTimeRef.current);
        updateTimeRef.current = null;
      }
      if (loadedMetadataRef.current) {
        videoRef.current.removeEventListener('loadedmetadata', loadedMetadataRef.current);
        loadedMetadataRef.current = null;
      }
      videoRef.current.pause();
      videoRef.current.playbackRate = 1; // Reset speed
      // Don't clear src when navigating - the new video URL will update it
    }
    
    // Reset speed state
    setIs2xSpeed(false);
    isHoldingForSpeed.current = false;
    if (speedHoldTimeout.current) {
      clearTimeout(speedHoldTimeout.current);
      speedHoldTimeout.current = null;
    }

    // Set black background during transition
    if (videoRef.current && videoRef.current.parentElement) {
      videoRef.current.parentElement.style.backgroundColor = '#000';
    }
    
    // Animate slide transition
    const direction = newIndex > currentIndex ? -1 : 1;
    Animated.timing(panRef.x, {
      toValue: direction * Dimensions.get('window').width,
      duration: 200,
      useNativeDriver: false,
    }).start(() => {
      // Reset all animations before loading new video
      panRef.setValue({ x: 0, y: 0 });
      fadeAnim.setValue(1); // Reset opacity to full
      // Immediate navigation for better UX
      onVideoChange(newIndex);
    });
  };

  const handleVideoError = (event: any) => {
    // Check if error might be due to expired URL
    if (event?.target?.error?.code === 4 || event?.target?.error?.code === 3) {
      if (onUrlExpired) {
        onUrlExpired();
        return;
      }
    }
    
    setVideoError(true);
  };

  // Store event listeners for cleanup
  const updateTimeRef = useRef<(() => void) | null>(null);
  const loadedMetadataRef = useRef<(() => void) | null>(null);
  const videoLoadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleVideoLoad = () => {
    if (videoRef.current) {
      // Auto-unmute if user has previously chosen audio
      if (hasUserUnmuted) {
        videoRef.current.muted = false;
        setIsMuted(false);
      }
      
      // Set up video progress tracking
      setDuration(videoRef.current.duration || 0);
      
      // Only add listeners if they don't exist
      if (!updateTimeRef.current) {
        let lastUpdateTime = 0;
        updateTimeRef.current = () => {
          const now = Date.now();
          // Throttle updates to 4 times per second
          if (now - lastUpdateTime > 250 && videoRef.current) {
            lastUpdateTime = now;
            setCurrentTime(videoRef.current.currentTime);
          }
        };
        videoRef.current.addEventListener('timeupdate', updateTimeRef.current);
      }
      
      if (!loadedMetadataRef.current) {
        loadedMetadataRef.current = () => {
          if (videoRef.current) {
            setDuration(videoRef.current.duration);
          }
        };
        videoRef.current.addEventListener('loadedmetadata', loadedMetadataRef.current);
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMutedState = !isMuted;
      videoRef.current.muted = newMutedState;
      setIsMuted(newMutedState);
      
      // Remember user preference when they first unmute
      if (!newMutedState && !hasUserUnmuted) {
        setHasUserUnmuted(true);
      }
      
      // Show brief feedback animation
      setShowMuteFeedback(true);
    }
  };

  const handle2xSpeedStart = () => {
    // Start timer for long press
    speedHoldTimeout.current = setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.playbackRate = 2.0;
        setIs2xSpeed(true);
        isHoldingForSpeed.current = true;
      }
    }, LONG_PRESS_DELAY);
  };

  const handle2xSpeedEnd = () => {
    // Clear timeout if released before delay
    if (speedHoldTimeout.current) {
      clearTimeout(speedHoldTimeout.current);
      speedHoldTimeout.current = null;
    }
    
    // If was holding for speed, reset it
    if (isHoldingForSpeed.current) {
      isHoldingForSpeed.current = false;
      if (videoRef.current) {
        videoRef.current.playbackRate = 1.0;
      }
      setIs2xSpeed(false);
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
      animationType="none"
      presentationStyle="fullScreen"
      onRequestClose={handleExit}
      statusBarTranslucent={true}
    >
      <View style={styles.modalBackground}>
        <StatusBar hidden />
        <Animated.View 
          style={[
            styles.container,
            {
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
            <View style={styles.videoWrapper}>
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
                preload="metadata"
              />
              
              {/* Touch areas for mute (left) and 2x speed (right) */}
              <View style={styles.touchOverlay}>
                <TouchableOpacity
                  style={styles.leftTouchArea}
                  onPress={toggleMute}
                  activeOpacity={1}
                />
                <TouchableOpacity
                  style={styles.rightTouchArea}
                  onPress={toggleMute}
                  onPressIn={handle2xSpeedStart}
                  onPressOut={handle2xSpeedEnd}
                  activeOpacity={1}
                />
              </View>
            </View>
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
          
          {/* 2x speed indicator */}
          {is2xSpeed && (
            <View style={styles.speedIndicator}>
              <View style={styles.speedIndicatorContainer}>
                <Text style={styles.speedIndicatorText}>2x speed</Text>
                <FastForward size={16} color="#fff" style={styles.speedIndicatorIcon} />
              </View>
            </View>
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
      </View>
    </Modal>
  );
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const styles = StyleSheet.create({
  modalBackground: {
    flex: 1,
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoWrapper: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  } as any,
  touchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  leftTouchArea: {
    flex: 1,
    height: '100%',
  },
  rightTouchArea: {
    flex: 1,
    height: '100%',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    ...getInterFontConfig('200'), // ExtraLight 200 Italic with premium spacing
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
    ...getInterFontConfig('200'), // ExtraLight 200 Italic with premium spacing
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
    ...getInterFontConfig('300'), // Light 300 Italic with premium spacing
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
    ...getInterFontConfig('300'), // Light 300 Italic with premium spacing
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
    ...getInterFontConfig('300'), // Light 300 Italic with premium spacing
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
  speedIndicator: {
    position: 'absolute',
    bottom: 15,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  speedIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  speedIndicatorText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'sans-serif',
  },
  speedIndicatorIcon: {
    marginLeft: 4,
  },
});