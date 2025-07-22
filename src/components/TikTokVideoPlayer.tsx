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
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [showDetailsSheet, setShowDetailsSheet] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const panRef = useRef(new Animated.ValueXY()).current;
  const gestureStartTime = useRef(0);

  // Auto-hide controls after 3 seconds
  useEffect(() => {
    if (showControls) {
      const timer = setTimeout(() => {
        setShowControls(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showControls]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (visible) {
      setVideoError(false);
      setIsPlaying(false);
      setShowControls(false);
      setShowDetailsSheet(false);
      panRef.setValue({ x: 0, y: 0 });
    }
  }, [visible]);

  // Unified gesture handler for both horizontal (exit) and vertical (details) gestures
  const unifiedPanResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      console.log('🎯 Gesture detected:', { dx: gestureState.dx, dy: gestureState.dy });
      
      const horizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      const vertical = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      
      // Horizontal swipe (exit) - right direction only
      if (horizontal && gestureState.dx > 20) {
        console.log('👉 Horizontal swipe detected for exit');
        return true;
      }
      
      // Vertical swipe (details) - upward direction only
      if (vertical && gestureState.dy < -30) {
        console.log('☝️ Vertical swipe detected for details');
        return true;
      }
      
      return false;
    },
    onMoveShouldSetPanResponderCapture: () => false,
    onPanResponderGrant: () => {
      console.log('🤏 Gesture granted');
      gestureStartTime.current = Date.now();
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
        
        if (gestureDuration < 300 && totalMovement < 30) {
          // This was a tap - toggle play/pause
          console.log('👆 Tap detected - toggling play/pause');
          togglePlayPause();
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

  const handleExit = () => {
    // Animate exit
    Animated.parallel([
      Animated.timing(panRef.x, {
        toValue: Dimensions.get('window').width,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start(() => {
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
    setIsPlaying(true);
    if (videoRef.current) {
      videoRef.current.play().catch(console.error);
    }
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
    setShowControls(true);
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
            <video
              ref={videoRef}
              src={videoUrl}
              autoPlay
              muted
              playsInline
              loop
              style={styles.video}
              onError={handleVideoError}
              onLoadedData={handleVideoLoad}
              preload="auto"
              key={videoUrl}
            />
          )}

          {/* Minimal Play/Pause Overlay */}
          {showControls && !loading && !error && (
            <Animated.View style={styles.controlsOverlay}>
              <TouchableOpacity style={styles.playButton} onPress={togglePlayPause}>
                <Text style={styles.playButtonText}>
                  {isPlaying ? '⏸️' : '▶️'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>

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
  controlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonText: {
    fontSize: 32,
    color: '#fff',
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
});