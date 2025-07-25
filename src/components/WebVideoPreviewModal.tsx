import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Camera, Image as ImageIcon, Trash2, ChevronDown, ChevronUp } from 'lucide-react-native';
import { WebMediaAsset } from '../services/webMediaService';
import { getInterFontConfig, getInterFontConfigForInputs } from '../utils/fontUtils';
import { FrameCaptureResult, captureVideoFrame } from '../utils/frameCapture';

interface WebVideoPreviewModalProps {
  visible: boolean;
  asset: WebMediaAsset | null;
  onClose: () => void;
  onUpload: (title: string, thumbnailData?: { frameData: FrameCaptureResult; timeSeconds: number } | null, thumbnailOption?: 'first' | 'custom' | 'none') => void;
  uploading: boolean;
}

export function WebVideoPreviewModal({
  visible,
  asset,
  onClose,
  onUpload,
  uploading,
}: WebVideoPreviewModalProps) {
  const [title, setTitle] = React.useState('');
  const titleInputRef = React.useRef<any>(null);
  
  // Thumbnail selection state
  const [thumbnailOption, setThumbnailOption] = React.useState<'first' | 'custom' | 'none'>('first');
  const [showThumbnailEditor, setShowThumbnailEditor] = React.useState(false);
  const [customThumbnailData, setCustomThumbnailData] = React.useState<{ frameData: FrameCaptureResult; timeSeconds: number } | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = React.useState<string | null>(null);
  
  // Video reference for inline thumbnail generation
  const videoRef = React.useRef<HTMLVideoElement>(null);
  
  // Video scrubber state
  const [videoDuration, setVideoDuration] = React.useState(0);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [isVideoLoaded, setIsVideoLoaded] = React.useState(false);
  const [isCapturingFrame, setIsCapturingFrame] = React.useState(false);

  React.useEffect(() => {
    if (asset?.filename) {
      // Set default title to simple 'title' for easy editing
      setTitle('title');
      // Select all text after a short delay to ensure input is rendered
      setTimeout(() => {
        if (titleInputRef.current) {
          titleInputRef.current.focus();
          // Use React Native compatible selection method
          if (titleInputRef.current.setNativeProps) {
            titleInputRef.current.setNativeProps({
              selection: { start: 0, end: 5 }
            });
          }
        }
      }, 100);
      
      // Generate initial thumbnail preview (first frame)
      generateThumbnailPreview();
    }
  }, [asset, visible]);
  
  // Handle video metadata loaded
  const handleVideoLoaded = () => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration);
      setCurrentTime(0);
      setIsVideoLoaded(true);
      console.log('📹 Video loaded for thumbnail generation, duration:', videoRef.current.duration);
    }
  };
  
  // Generate thumbnail preview at specific time
  const generateThumbnailPreview = async (timeSeconds: number = 0) => {
    if (!asset?.uri) return;
    
    try {
      setIsCapturingFrame(true);
      // Capture frame at specified time
      const frameData = await captureVideoFrame(asset.uri, timeSeconds, {
        width: 160,
        height: 240, // 2:3 aspect ratio for mobile-style thumbnail
        quality: 0.7,
      });
      setThumbnailPreview(frameData.dataUrl);
      
      // If this is for custom thumbnail, save the data
      if (thumbnailOption === 'custom') {
        setCustomThumbnailData({ frameData, timeSeconds });
      }
    } catch (error) {
      console.error('Failed to generate thumbnail preview:', error);
    } finally {
      setIsCapturingFrame(false);
    }
  };
  
  // Handle scrubber time change
  const handleTimeChange = (newTime: number) => {
    setCurrentTime(newTime);
    generateThumbnailPreview(newTime);
  };

  const handleUpload = () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title for your video');
      return;
    }

    // Prepare thumbnail data based on selection
    let thumbnailData: { frameData: FrameCaptureResult; timeSeconds: number } | null = null;
    
    if (thumbnailOption === 'custom' && customThumbnailData) {
      thumbnailData = customThumbnailData;
    } else if (thumbnailOption === 'none') {
      thumbnailData = null;
    }
    // For 'first' option, we'll generate it from first frame during upload

    onUpload(title.trim(), thumbnailData, thumbnailOption);
  };


  if (!asset) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Preview Video</Text>
          <TouchableOpacity 
            onPress={handleUpload} 
            style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
            disabled={uploading}
          >
            <Text style={styles.uploadText}>
              {uploading ? 'Uploading...' : 'Upload'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.content}
          activeOpacity={1}
          onPress={() => setShowThumbnailEditor(false)}
        >
          {/* Updated Layout: Title Input | Thumbnail Preview */}
          
          {/* 1. Combined Title and Thumbnail Section */}
          <View style={styles.titleThumbnailSection}>
            {/* Title Input (Left Side) */}
            <View style={styles.titleContainer}>
              <TextInput
                ref={titleInputRef}
                style={styles.titleInput}
                value={title}
                onChangeText={setTitle}
                placeholder="Add description..."
                placeholderTextColor="#666"
                maxLength={100}
                editable={!uploading}
                selectTextOnFocus={true}
                autoFocus={true}
                multiline={true}
                numberOfLines={2}
                onFocus={() => {
                  setTimeout(() => {
                    if (titleInputRef.current && title === 'title') {
                      if (titleInputRef.current.setNativeProps) {
                        titleInputRef.current.setNativeProps({
                          selection: { start: 0, end: 5 }
                        });
                      }
                    }
                  }, 50);
                }}
              />
            </View>
            
            {/* Thumbnail Preview (Right Side) */}
            <TouchableOpacity 
              style={styles.thumbnailPreviewContainer}
              activeOpacity={1}
              onPress={(e) => {
                e.stopPropagation();
                setShowThumbnailEditor(!showThumbnailEditor);
              }}
            >
              <View style={styles.thumbnailPreview}>
                  {/* Hidden video element for frame capture */}
                  <video
                    ref={videoRef}
                    src={asset.uri}
                    style={styles.hiddenVideo}
                    muted
                    playsInline
                    preload="metadata"
                    onLoadedMetadata={handleVideoLoaded}
                  />
                  
                  {/* Thumbnail preview image */}
                  {thumbnailPreview ? (
                    <img 
                      src={thumbnailPreview} 
                      style={styles.thumbnailImage}
                      alt="Video thumbnail"
                    />
                  ) : (
                    <View style={styles.thumbnailPlaceholder}>
                      <ImageIcon size={24} color="#666" />
                    </View>
                  )}
                  
                  <TouchableOpacity 
                    style={styles.editCoverButton}
                    onPress={() => setShowThumbnailEditor(!showThumbnailEditor)}
                    disabled={uploading}
                  >
                    <Text style={styles.editCoverText}>Edit cover</Text>
                  </TouchableOpacity>
                </View>
                
                {/* Expand/Collapse indicator */}
                <TouchableOpacity 
                  style={styles.expandButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    setShowThumbnailEditor(!showThumbnailEditor);
                  }}
                  disabled={uploading}
                >
                  {showThumbnailEditor ? (
                    <ChevronUp size={20} color="#666" />
                  ) : (
                    <ChevronDown size={20} color="#666" />
                  )}
                </TouchableOpacity>
            </TouchableOpacity>
          </View>
            
          {/* 2. Inline Thumbnail Editor (Expandable) */}
          {showThumbnailEditor && (
            <TouchableOpacity 
              style={styles.thumbnailEditor}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
                <Text style={styles.editorTitle}>Choose a cover for your video</Text>
                
                {/* Thumbnail options */}
                <View style={styles.thumbnailOptions}>
                  <TouchableOpacity
                    style={[
                      styles.thumbnailOptionCard,
                      thumbnailOption === 'first' && styles.thumbnailOptionSelected
                    ]}
                    onPress={() => {
                      setThumbnailOption('first');
                      generateThumbnailPreview(); // Regenerate first frame
                    }}
                    disabled={uploading}
                  >
                    <View style={styles.optionPreview}>
                      {thumbnailPreview && (
                        <img src={thumbnailPreview} style={styles.optionImage} alt="First frame" />
                      )}
                    </View>
                    <Text style={styles.optionLabel}>First frame</Text>
                    {thumbnailOption === 'first' && (
                      <View style={styles.selectedIndicator} />
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.thumbnailOptionCard,
                      thumbnailOption === 'custom' && styles.thumbnailOptionSelected
                    ]}
                    onPress={() => {
                      setThumbnailOption('custom');
                      setCurrentTime(0);
                      generateThumbnailPreview(0);
                    }}
                    disabled={uploading}
                  >
                    <View style={styles.optionPreview}>
                      {thumbnailOption === 'custom' && customThumbnailData ? (
                        <img src={customThumbnailData.frameData.dataUrl} style={styles.optionImage} alt="Custom frame" />
                      ) : (
                        <Camera size={20} color="#666" />
                      )}
                    </View>
                    <Text style={styles.optionLabel}>Custom</Text>
                    {thumbnailOption === 'custom' && (
                      <View style={styles.selectedIndicator} />
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.thumbnailOptionCard,
                      thumbnailOption === 'none' && styles.thumbnailOptionSelected
                    ]}
                    onPress={() => {
                      setThumbnailOption('none');
                      setThumbnailPreview(null);
                    }}
                    disabled={uploading}
                  >
                    <View style={styles.optionPreview}>
                      <Trash2 size={20} color="#666" />
                    </View>
                    <Text style={styles.optionLabel}>None</Text>
                    {thumbnailOption === 'none' && (
                      <View style={styles.selectedIndicator} />
                    )}
                  </TouchableOpacity>
                </View>
                
                {/* Video Scrubber for Custom Frame Selection */}
                {thumbnailOption === 'custom' && isVideoLoaded && (
                  <View style={styles.videoScrubber}>
                    <Text style={styles.scrubberTitle}>Select frame</Text>
                    
                    {/* Video preview for scrubbing */}
                    <View style={styles.scrubberVideoContainer}>
                      <View style={styles.scrubberPreview}>
                        {isCapturingFrame ? (
                          <View style={styles.capturingIndicator}>
                            <Text style={styles.capturingText}>Capturing...</Text>
                          </View>
                        ) : thumbnailPreview ? (
                          <img src={thumbnailPreview} style={styles.scrubberImage} alt="Frame preview" />
                        ) : (
                          <View style={styles.scrubberPlaceholder}>
                            <Camera size={32} color="#666" />
                          </View>
                        )}
                      </View>
                    </View>
                    
                    {/* Timeline scrubber */}
                    <View style={styles.timelineContainer}>
                      <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                      <View style={styles.timeline}>
                        <input
                          type="range"
                          min={0}
                          max={videoDuration}
                          step={0.1}
                          value={currentTime}
                          onChange={(e) => handleTimeChange(parseFloat(e.target.value))}
                          style={styles.scrubberSlider}
                          disabled={uploading || isCapturingFrame}
                        />
                      </View>
                      <Text style={styles.timeText}>{formatTime(videoDuration)}</Text>
                    </View>
                    
                    {customThumbnailData && (
                      <Text style={styles.selectedFrameText}>
                        ✓ Frame selected at {formatTime(customThumbnailData.timeSeconds)}
                      </Text>
                    )}
                  </View>
                )}
            </TouchableOpacity>
          )}

          {/* 3. AI Summary Section (Placeholder) */}
          <View style={styles.aiSummarySection}>
            <Text style={styles.aiSummaryTitle}>AI Summary</Text>
            <View style={styles.aiSummaryContent}>
              <Text style={styles.aiSummaryPlaceholder}>
                AI-generated summary will appear here automatically after upload.
              </Text>
            </View>
          </View>
        </View>
      </View>

    </Modal>
  );
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cancelText: {
    color: '#007AFF',
    fontSize: 16,
    ...getInterFontConfig('200'),
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    ...getInterFontConfig('300'),
    color: '#fff',
  },
  uploadButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    ...getInterFontConfig('300'),
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  
  // 1. Title Section (TikTok-style)
  // 1. Combined Title and Thumbnail Section
  titleThumbnailSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    gap: 16,
  },
  titleContainer: {
    flex: 1,
  },
  titleInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    ...getInterFontConfigForInputs('200'),
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
    textAlignVertical: 'top',
    minHeight: 80,
  },
  
  // Thumbnail Preview (Right Side)
  thumbnailPreviewContainer: {
    alignItems: 'center',
  },
  thumbnailPreview: {
    width: 80,
    height: 120,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#333',
    alignSelf: 'flex-start',
  },
  hiddenVideo: {
    position: 'absolute',
    top: -9999,
    left: -9999,
    width: 1,
    height: 1,
    opacity: 0,
  } as any,
  thumbnailImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  } as any,
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#333',
  },
  expandButton: {
    marginTop: 8,
    padding: 4,
    alignItems: 'center',
    alignSelf: 'center',
  },
  editCoverButton: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    backdropFilter: 'blur(10px)',
  },
  editCoverText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
    ...getInterFontConfig('200'),
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  
  // Inline Thumbnail Editor
  thumbnailEditor: {
    marginTop: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  editorTitle: {
    fontSize: 16,
    fontWeight: '600',
    ...getInterFontConfig('300'),
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  editorContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  editorPlaceholder: {
    fontSize: 14,
    ...getInterFontConfig('200'),
    color: '#666',
    textAlign: 'center',
  },
  
  // Inline Thumbnail Options
  thumbnailOptions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  thumbnailOptionCard: {
    width: 80,
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#2a2a2a',
    position: 'relative',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailOptionSelected: {
    backgroundColor: 'rgba(0, 122, 255, 0.15)',
    borderColor: '#007AFF',
    transform: [{ scale: 1.02 }],
  },
  optionPreview: {
    width: 60,
    height: 60,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  optionImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  } as any,
  optionLabel: {
    fontSize: 12,
    ...getInterFontConfig('200'),
    color: '#fff',
    textAlign: 'center',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  
  // Video Scrubber Styles
  videoScrubber: {
    marginTop: 20,
    padding: 18,
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  scrubberTitle: {
    fontSize: 14,
    fontWeight: '600',
    ...getInterFontConfig('300'),
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  scrubberVideoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  scrubberPreview: {
    width: 120,
    height: 180,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  scrubberImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  } as any,
  scrubberPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  capturingIndicator: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  capturingText: {
    fontSize: 12,
    ...getInterFontConfig('200'),
    color: '#007AFF',
  },
  timelineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeText: {
    fontSize: 12,
    ...getInterFontConfig('200'),
    color: '#fff',
    minWidth: 40,
    textAlign: 'center',
  },
  timeline: {
    flex: 1,
  },
  scrubberSlider: {
    width: '100%',
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    outline: 'none',
    appearance: 'none',
    cursor: 'pointer',
  } as any,
  selectedFrameText: {
    fontSize: 12,
    ...getInterFontConfig('200'),
    color: '#007AFF',
    textAlign: 'center',
    marginTop: 8,
  },
  
  // 3. AI Summary Section
  aiSummarySection: {
    marginBottom: 20,
  },
  aiSummaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    ...getInterFontConfig('300'),
    color: '#fff',
    marginBottom: 12,
  },
  aiSummaryContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    minHeight: 100,
    justifyContent: 'center',
  },
  aiSummaryPlaceholder: {
    fontSize: 14,
    ...getInterFontConfig('200'),
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});