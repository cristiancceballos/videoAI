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
  
  // Single video reference for all thumbnail operations
  const videoRef = React.useRef<HTMLVideoElement>(null);
  // Canvas reference for alternative video processing
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  
  // Cleanup blob URL when component unmounts
  React.useEffect(() => {
    return () => {
      if (asset?.uri) {
        console.log('🧹 [CLEANUP DEBUG] Cleaning up blob URL on component unmount');
        URL.revokeObjectURL(asset.uri);
      }
    };
  }, [asset?.uri]);
  
  // Video scrubber state
  const [videoDuration, setVideoDuration] = React.useState(0);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [isVideoLoaded, setIsVideoLoaded] = React.useState(false);
  const [isCapturingFrame, setIsCapturingFrame] = React.useState(false);

  // Video format validation
  const validateVideoFormat = (asset: WebMediaAsset): boolean => {
    if (!asset?.file?.type) {
      console.warn('⚠️ [FORMAT DEBUG] No file type available for validation');
      return true; // Allow if we can't determine type
    }
    
    const supportedFormats = [
      'video/mp4',
      'video/webm',
      'video/ogg',
      'video/quicktime', // .mov files
      'video/x-msvideo', // .avi files
    ];
    
    const isSupported = supportedFormats.includes(asset.file.type);
    console.log(`📋 [FORMAT DEBUG] Video format: ${asset.file.type}, Supported: ${isSupported}`);
    
    return isSupported;
  };

  // Comprehensive blob URL validation
  const validateBlobUrl = async (blobUrl: string): Promise<boolean> => {
    try {
      console.log('🔍 [BLOB DEBUG] Validating blob URL:', blobUrl.substring(0, 100) + '...');
      
      // Test 1: Check if blob URL is properly formatted
      if (!blobUrl.startsWith('blob:')) {
        console.error('❌ [BLOB DEBUG] Invalid blob URL format - not a blob URL');
        return false;
      }
      
      // Test 2: Try to fetch the blob to see if it's accessible  
      const response = await fetch(blobUrl, { method: 'HEAD' });
      if (!response.ok) {
        console.error('❌ [BLOB DEBUG] Blob URL fetch failed:', response.status, response.statusText);
        return false;
      }
      
      console.log('✅ [BLOB DEBUG] Blob URL is valid and accessible');
      console.log('📊 [BLOB DEBUG] Blob info:', {
        size: response.headers.get('Content-Length'),
        type: response.headers.get('Content-Type'),
        status: response.status
      });
      
      return true;
    } catch (error) {
      console.error('❌ [BLOB DEBUG] Blob URL validation failed:', error);
      return false;
    }
  };

  // Canvas-based video loading as fallback
  const loadVideoWithCanvas = async (blobUrl: string): Promise<boolean> => {
    try {
      console.log('🎨 [CANVAS DEBUG] Attempting canvas-based video loading...');
      
      // Create a new video element specifically for canvas processing
      const tempVideo = document.createElement('video');
      tempVideo.crossOrigin = 'anonymous';
      tempVideo.muted = true;
      tempVideo.playsInline = true;
      tempVideo.preload = 'metadata';
      
      return new Promise<boolean>((resolve) => {
        const handleCanvasLoad = () => {
          console.log('✅ [CANVAS DEBUG] Canvas video loaded successfully');
          
          // Copy successful loading state to main video element
          if (videoRef.current && tempVideo.duration > 0) {
            setVideoDuration(tempVideo.duration);
            setCurrentTime(0);
            setIsVideoLoaded(true);
            
            // Try to set the main video element source
            videoRef.current.src = blobUrl;
            
            console.log('🎯 [CANVAS DEBUG] Canvas approach succeeded - video ready for thumbnails');
            resolve(true);
          } else {
            console.error('❌ [CANVAS DEBUG] Canvas loaded but main video ref not available');
            resolve(false);
          }
          
          // Cleanup temp video
          tempVideo.remove();
        };
        
        const handleCanvasError = (error: any) => {
          console.error('❌ [CANVAS DEBUG] Canvas video loading failed:', error);
          tempVideo.remove();
          resolve(false);
        };
        
        tempVideo.addEventListener('loadedmetadata', handleCanvasLoad);
        tempVideo.addEventListener('error', handleCanvasError);
        
        // Set timeout for canvas loading
        setTimeout(() => {
          tempVideo.removeEventListener('loadedmetadata', handleCanvasLoad);
          tempVideo.removeEventListener('error', handleCanvasError);
          tempVideo.remove();
          console.warn('⏰ [CANVAS DEBUG] Canvas loading timeout');
          resolve(false);
        }, 10000);
        
        tempVideo.src = blobUrl;
        tempVideo.load();
      });
      
    } catch (error) {
      console.error('❌ [CANVAS DEBUG] Canvas loading exception:', error);
      return false;
    }
  };

  React.useEffect(() => {
    if (asset?.filename) {
      console.log('🎬 [INIT DEBUG] Initializing WebVideoPreviewModal for:', asset.filename);
      console.log('📊 [INIT DEBUG] Asset details:', {
        filename: asset.filename,
        fileSize: asset.fileSize,
        duration: asset.duration,
        uri: asset.uri?.substring(0, 100) + '...'
      });
      
      // Validate video format
      if (!validateVideoFormat(asset)) {
        console.warn('⚠️ [INIT DEBUG] Potentially unsupported video format detected');
      }
      
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
      
      // Comprehensive blob URL validation
      if (asset.uri) {
        validateBlobUrl(asset.uri).then(isValid => {
          if (isValid) {
            console.log('✅ [INIT DEBUG] Blob URL validation passed - ready for video loading');
          } else {
            console.error('❌ [INIT DEBUG] Blob URL validation failed - video loading may fail');
          }
        });
      }
      
      // Don't generate initial thumbnail here - wait for video to load properly
      console.log('⏳ [INIT DEBUG] Waiting for video to load before generating thumbnail');
    }
  }, [asset, visible]);
  
  // Handle video metadata loaded
  const handleVideoLoaded = async () => {
    if (videoRef.current) {
      const duration = videoRef.current.duration;
      const videoWidth = videoRef.current.videoWidth;
      const videoHeight = videoRef.current.videoHeight;
      
      console.log('📹 [VIDEO DEBUG] Video metadata loaded:', {
        duration,
        videoWidth,
        videoHeight,
        readyState: videoRef.current.readyState,
        src: asset?.uri?.substring(0, 50) + '...'
      });
      
      // Validate video has proper dimensions and duration
      if (duration > 0 && videoWidth > 0 && videoHeight > 0) {
        setVideoDuration(duration);
        setCurrentTime(0);
        setIsVideoLoaded(true);
        
        console.log('✅ [VIDEO DEBUG] Video successfully loaded and ready for thumbnail generation');
        
        // Generate initial thumbnail preview for first frame option
        if (thumbnailOption === 'first') {
          console.log('🎬 [VIDEO DEBUG] Auto-generating first frame thumbnail');
          setTimeout(() => generateThumbnailPreview(0), 200);
        }
      } else {
        console.error('❌ [VIDEO DEBUG] Invalid video metadata, trying canvas fallback...', { duration, videoWidth, videoHeight });
        
        // Try canvas-based loading as fallback
        if (asset?.uri) {
          console.log('🎨 [VIDEO DEBUG] Attempting canvas-based fallback loading...');
          const canvasSuccess = await loadVideoWithCanvas(asset.uri);
          if (canvasSuccess) {
            console.log('✅ [VIDEO DEBUG] Canvas fallback succeeded!');
            return;
          }
        }
        
        console.error('❌ [VIDEO DEBUG] All fallback methods failed');
        setIsVideoLoaded(false);
      }
    } else {
      console.error('❌ [VIDEO DEBUG] Video ref not available in handleVideoLoaded');
    }
  };
  
  // Generate thumbnail preview at specific time
  const generateThumbnailPreview = async (timeSeconds: number = 0) => {
    if (!asset?.uri) {
      console.warn('🚫 [THUMBNAIL DEBUG] No asset URI available for thumbnail generation');
      return;
    }
    
    // Wait for video to be loaded before attempting frame capture
    if (!isVideoLoaded || !videoRef.current) {
      console.warn('⏳ [THUMBNAIL DEBUG] Video not loaded yet, skipping thumbnail generation');
      return;
    }
    
    try {
      console.log(`🎬 [THUMBNAIL DEBUG] Starting thumbnail generation at time: ${timeSeconds}s`);
      setIsCapturingFrame(true);
      
      // Ensure video is at the correct time before capture
      if (videoRef.current.currentTime !== timeSeconds) {
        console.log(`⏭️ [THUMBNAIL DEBUG] Setting video time from ${videoRef.current.currentTime}s to ${timeSeconds}s`);
        videoRef.current.currentTime = timeSeconds;
        
        // Wait a brief moment for the video to seek to the new time
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Capture frame at specified time
      const frameData = await captureVideoFrame(asset.uri, timeSeconds, {
        width: 160,
        height: 240, // 2:3 aspect ratio for mobile-style thumbnail
        quality: 0.7,
      });
      
      console.log('✅ [THUMBNAIL DEBUG] Thumbnail preview generated successfully');
      setThumbnailPreview(frameData.dataUrl);
      
      // If this is for custom thumbnail, save the data
      if (thumbnailOption === 'custom') {
        console.log('💾 [THUMBNAIL DEBUG] Saving custom thumbnail data');
        setCustomThumbnailData({ frameData, timeSeconds });
      }
    } catch (error) {
      console.error('❌ [THUMBNAIL DEBUG] Failed to generate thumbnail preview:', error);
      if (error instanceof Error) {
        console.error('❌ [THUMBNAIL DEBUG] Error details:', error.message);
      }
      // Don't show user error for preview failures, they can still upload
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
    
    console.log('🚀 [UPLOAD DEBUG] Starting upload with thumbnail option:', thumbnailOption);
    
    if (thumbnailOption === 'custom' && customThumbnailData) {
      thumbnailData = customThumbnailData;
      console.log('🖼️ [UPLOAD DEBUG] Using custom thumbnail at time:', customThumbnailData.timeSeconds);
    } else if (thumbnailOption === 'none') {
      thumbnailData = null;
      console.log('🚫 [UPLOAD DEBUG] No thumbnail selected');
    } else if (thumbnailOption === 'first') {
      console.log('🎬 [UPLOAD DEBUG] Will generate first frame thumbnail during upload');
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
                      console.log('🎯 [UI DEBUG] User selected "First frame" thumbnail option');
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
                
                {/* Full Video Player Interface for Custom Frame Selection */}
                {thumbnailOption === 'custom' && isVideoLoaded && (
                  <View style={styles.fullVideoScrubber}>
                    <Text style={styles.videoScrubberTitle}>Select your thumbnail frame</Text>
                    
                    {/* Large Video Preview */}
                    <View style={styles.largeVideoContainer}>
                      <View style={styles.largeVideoPreview}>
                        {isCapturingFrame ? (
                          <View style={styles.loadingOverlay}>
                            <Text style={styles.loadingText}>Capturing frame...</Text>
                          </View>
                        ) : (
                          <>
                            {/* Single video element for all operations */}
                            <video
                              ref={videoRef}
                              src={asset.uri}
                              style={styles.fullVideo}
                              muted
                              playsInline
                              preload="metadata"
                              onLoadedMetadata={handleVideoLoaded}
                              onError={async (e) => {
                                console.error('❌ [VIDEO DEBUG] Video element error:', e);
                                console.error('❌ [VIDEO DEBUG] Video src:', asset.uri?.substring(0, 50) + '...');
                                
                                if (videoRef.current?.error) {
                                  console.error('❌ [VIDEO DEBUG] HTMLMediaElement error:', {
                                    code: videoRef.current.error.code,
                                    message: videoRef.current.error.message
                                  });
                                }
                                
                                // Try canvas fallback on video error
                                if (asset?.uri) {
                                  console.log('🎨 [VIDEO DEBUG] Error triggered - attempting canvas fallback...');
                                  const canvasSuccess = await loadVideoWithCanvas(asset.uri);
                                  if (!canvasSuccess) {
                                    console.error('❌ [VIDEO DEBUG] Canvas fallback also failed');
                                  }
                                }
                              }}
                              onLoadStart={() => {
                                console.log('🎬 [VIDEO DEBUG] Video loading started');
                              }}
                              onCanPlay={() => {
                                console.log('✅ [VIDEO DEBUG] Video can play');
                              }}
                              poster={thumbnailPreview || undefined}
                            />
                            
                            {/* Hidden canvas for video processing fallback */}
                            <canvas
                              ref={canvasRef}
                              style={{ display: 'none' }}
                              width={400}
                              height={225}
                            />
                            
                            {/* Play button overlay */}
                            <View style={styles.videoOverlay}>
                              <View style={styles.playButtonContainer}>
                                <Camera size={48} color="rgba(255, 255, 255, 0.9)" />
                                <Text style={styles.playButtonText}>Drag to select frame</Text>
                              </View>
                            </View>
                          </>
                        )}
                      </View>
                    </View>
                    
                    {/* Prominent Timeline Scrubber */}
                    <View style={styles.prominentTimelineContainer}>
                      <Text style={styles.prominentTimeText}>{formatTime(currentTime)}</Text>
                      <View style={styles.prominentTimeline}>
                        <input
                          type="range"
                          min={0}
                          max={videoDuration}
                          step={0.1}
                          value={currentTime}
                          onChange={(e) => handleTimeChange(parseFloat(e.target.value))}
                          style={styles.prominentSlider}
                          disabled={uploading || isCapturingFrame}
                        />
                      </View>
                      <Text style={styles.prominentTimeText}>{formatTime(videoDuration)}</Text>
                    </View>
                    
                    {/* Selection Confirmation */}
                    {customThumbnailData && (
                      <View style={styles.selectionConfirmation}>
                        <Text style={styles.confirmationText}>
                          ✓ Frame selected at {formatTime(customThumbnailData.timeSeconds)}
                        </Text>
                      </View>
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
        </TouchableOpacity>
      </View>

    </Modal>
  );
}


function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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
  
  // Full Video Player Interface Styles
  fullVideoScrubber: {
    marginTop: 20,
    backgroundColor: '#000',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  videoScrubberTitle: {
    fontSize: 16,
    fontWeight: '600',
    ...getInterFontConfig('300'),
    color: '#fff',
    padding: 20,
    paddingBottom: 16,
    textAlign: 'center',
  },
  largeVideoContainer: {
    aspectRatio: 16/9,
    backgroundColor: '#1a1a1a',
    position: 'relative',
    overflow: 'hidden',
  },
  largeVideoPreview: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  fullVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  } as any,
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  playButtonContainer: {
    alignItems: 'center',
    padding: 20,
  },
  playButtonText: {
    fontSize: 14,
    ...getInterFontConfig('200'),
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 8,
    textAlign: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    zIndex: 1,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    ...getInterFontConfig('200'),
  },
  // Prominent Timeline Controls
  prominentTimelineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 16,
    gap: 16,
    backgroundColor: '#1a1a1a',
  },
  prominentTimeText: {
    fontSize: 14,
    ...getInterFontConfig('200'),
    color: '#fff',
    minWidth: 45,
    textAlign: 'center',
    fontWeight: '500',
  },
  prominentTimeline: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
  },
  prominentSlider: {
    width: '100%',
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
    outline: 'none',
    appearance: 'none',
    cursor: 'pointer',
    accentColor: '#007AFF',
  } as any,
  selectionConfirmation: {
    padding: 16,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderTopWidth: 1,
    borderTopColor: '#007AFF',
  },
  confirmationText: {
    fontSize: 14,
    ...getInterFontConfig('200'),
    color: '#007AFF',
    textAlign: 'center',
    fontWeight: '500',
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