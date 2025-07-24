import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
  PanResponder,
} from 'react-native';
import { X, Camera, Trash2 } from 'lucide-react-native';
import { VideoWithMetadata } from '../services/videoService';
import { captureVideoFrame, FrameCaptureResult } from '../utils/frameCapture';

interface ThumbnailGeneratorProps {
  visible: boolean;
  video: VideoWithMetadata;
  videoUrl: string;
  onClose: () => void;
  onThumbnailGenerated: (frameData: FrameCaptureResult, timeSeconds: number) => void;
  onThumbnailRemoved: () => void;
}

export function ThumbnailGenerator({
  visible,
  video,
  videoUrl,
  onClose,
  onThumbnailGenerated,
  onThumbnailRemoved,
}: ThumbnailGeneratorProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [previewFrame, setPreviewFrame] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<View>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setCurrentTime(0);
      setDuration(0);
      setPreviewFrame(null);
      setIsCapturing(false);
      setIsLoading(true);
    }
  }, [visible]);

  // Handle video metadata load
  const handleVideoLoad = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setCurrentTime(0);
      setIsLoading(false);
      console.log('📹 Thumbnail generator video loaded, duration:', videoRef.current.duration);
    }
  };

  // Handle time update during scrubbing
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  // Handle progress bar drag gestures
  const progressPanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      // Handle initial touch
      handleProgressUpdate(event);
    },
    onPanResponderMove: (event) => {
      // Handle drag movement
      handleProgressUpdate(event);
    },
    onPanResponderRelease: () => {
      // Drag ended - could add haptic feedback here
      console.log('📊 Progress scrubbing completed');
    },
  });

  const handleProgressUpdate = (event: any) => {
    if (!videoRef.current || duration === 0) return;

    const { locationX } = event.nativeEvent;
    const progressWidth = screenWidth - 80; // Account for time labels and padding
    const percentage = Math.max(0, Math.min(1, locationX / progressWidth));
    const newTime = percentage * duration;

    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    
    // Generate preview of selected frame
    generatePreview(newTime);
  };

  // Generate preview of current frame
  const generatePreview = async (timeSeconds: number) => {
    try {
      setIsCapturing(true);
      const frameData = await captureVideoFrame(videoUrl, timeSeconds, {
        width: 200,
        height: 113, // 16:9 ratio for preview
        quality: 0.7,
      });
      setPreviewFrame(frameData.dataUrl);
    } catch (error) {
      console.error('Failed to generate preview:', error);
    } finally {
      setIsCapturing(false);
    }
  };

  // Handle frame capture and confirm
  const handleCaptureFrame = async () => {
    try {
      setIsLoading(true);
      const frameData = await captureVideoFrame(videoUrl, currentTime, {
        width: 400,
        height: 225, // 16:9 ratio for final thumbnail
        quality: 0.9,
      });
      
      onThumbnailGenerated(frameData, currentTime);
      onClose();
    } catch (error) {
      console.error('Failed to capture frame:', error);
      // TODO: Show error to user
    } finally {
      setIsLoading(false);
    }
  };

  // Handle thumbnail removal
  const handleRemoveThumbnail = () => {
    onThumbnailRemoved();
    onClose();
  };

  // Format time for display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Select Thumbnail Frame</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Video Player */}
        <View style={styles.videoContainer}>
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.loadingText}>Loading video...</Text>
            </View>
          )}
          
          <video
            ref={videoRef}
            src={videoUrl}
            style={styles.video}
            onLoadedMetadata={handleVideoLoad}
            onTimeUpdate={handleTimeUpdate}
            muted
            playsInline
            controls={false}
          />
        </View>

        {/* Preview Frame */}
        {previewFrame && (
          <View style={styles.previewContainer}>
            <Text style={styles.previewLabel}>Preview:</Text>
            <View style={styles.previewFrame}>
              {isCapturing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <img src={previewFrame} style={styles.previewImage} alt="Frame preview" />
              )}
            </View>
          </View>
        )}

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
          <View
            style={styles.progressBar}
            {...progressPanResponder.panHandlers}
          >
            <View style={styles.progressTrack}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }
                ]} 
              />
            </View>
          </View>
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>

        {/* Instructions */}
        <Text style={styles.instructions}>
          Drag the progress bar to select a frame, then tap "Use This Frame" to create your thumbnail.
        </Text>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, styles.removeButton]}
            onPress={handleRemoveThumbnail}
            disabled={isLoading}
          >
            <Trash2 size={16} color="#FF3B30" />
            <Text style={styles.removeButtonText}>No Thumbnail</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.captureButton, isLoading && styles.buttonDisabled]}
            onPress={handleCaptureFrame}
            disabled={isLoading || duration === 0}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Camera size={16} color="#000" />
                <Text style={styles.captureButtonText}>Use This Frame</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: Platform.OS === 'web' ? 20 : 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  closeButton: {
    padding: 8,
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    marginHorizontal: 20,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  } as any,
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 1,
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 16,
  },
  previewContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  previewLabel: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
  },
  previewFrame: {
    width: 100,
    height: 56,
    backgroundColor: '#333',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  } as any,
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginVertical: 20,
  },
  timeText: {
    color: '#fff',
    fontSize: 14,
    minWidth: 40,
    textAlign: 'center',
  },
  progressBar: {
    flex: 1,
    marginHorizontal: 12,
    paddingVertical: 12, // Expand touch area
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  instructions: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  removeButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  removeButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
  captureButton: {
    backgroundColor: '#fff',
  },
  captureButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});