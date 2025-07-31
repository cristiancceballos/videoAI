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
import { Image as ImageIcon, ChevronDown, ChevronUp } from 'lucide-react-native';
import { WebMediaAsset } from '../services/webMediaService';
import { getInterFontConfig, getInterFontConfigForInputs } from '../utils/fontUtils';

interface WebVideoPreviewModalProps {
  visible: boolean;
  asset: WebMediaAsset | null;
  onClose: () => void;
  onUpload: (title: string, thumbnailData?: null, thumbnailOption?: 'server') => void;
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
  
  // Server-side thumbnail message
  const [showThumbnailInfo, setShowThumbnailInfo] = React.useState(false);
  
  // Cleanup blob URL when component unmounts
  React.useEffect(() => {
    return () => {
      if (asset?.uri) {
        console.log('🧹 [CLEANUP DEBUG] Cleaning up blob URL on component unmount');
        URL.revokeObjectURL(asset.uri);
      }
    };
  }, [asset?.uri]);


  React.useEffect(() => {
    if (asset?.filename) {
      console.log('🎬 [INIT DEBUG] Initializing WebVideoPreviewModal for:', asset.filename);
      
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
    }
  }, [asset, visible]);

  const handleUpload = () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title for your video');
      return;
    }

    console.log('🚀 [UPLOAD DEBUG] Starting server-side upload with thumbnail generation');
    // Server-side thumbnail generation - Edge Function will create multiple thumbnail options
    onUpload(title.trim(), null, 'server');
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
            
            {/* Server Thumbnail Info (Right Side) */}
            <TouchableOpacity 
              style={styles.thumbnailPreviewContainer}
              activeOpacity={1}
              onPress={(e) => {
                e.stopPropagation();
                setShowThumbnailInfo(!showThumbnailInfo);
              }}
            >
              <View style={styles.thumbnailPreview}>
                <View style={styles.thumbnailPlaceholder}>
                  <ImageIcon size={24} color="#666" />
                </View>
                
                <TouchableOpacity 
                  style={styles.editCoverButton}
                  onPress={() => setShowThumbnailInfo(!showThumbnailInfo)}
                  disabled={uploading}
                >
                  <Text style={styles.editCoverText}>Auto thumbnails</Text>
                </TouchableOpacity>
              </View>
              
              {/* Expand/Collapse indicator */}
              <TouchableOpacity 
                style={styles.expandButton}
                onPress={(e) => {
                  e.stopPropagation();
                  setShowThumbnailInfo(!showThumbnailInfo);
                }}
                disabled={uploading}
              >
                {showThumbnailInfo ? (
                  <ChevronUp size={20} color="#666" />
                ) : (
                  <ChevronDown size={20} color="#666" />
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          </View>
            
          {/* 2. Server Thumbnail Info (Expandable) */}
          {showThumbnailInfo && (
            <View style={styles.thumbnailEditor}>
              <Text style={styles.editorTitle}>🤖 Automatic Thumbnail Generation</Text>
              
              <View style={styles.serverThumbnailInfo}>
                <Text style={styles.serverInfoText}>
                  After upload, our AI will automatically generate multiple thumbnail options for your video:
                </Text>
                
                <View style={styles.serverInfoList}>
                  <Text style={styles.serverInfoItem}>• First frame (0%)</Text>
                  <Text style={styles.serverInfoItem}>• Quarter point (25%)</Text>
                  <Text style={styles.serverInfoItem}>• Midpoint (50%)</Text>
                  <Text style={styles.serverInfoItem}>• Three-quarter point (75%)</Text>
                </View>
                
                <Text style={styles.serverInfoFooter}>
                  The best thumbnail will be automatically selected as your video cover.
                </Text>
              </View>
            </View>
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
  
  // Server Thumbnail Info Styles
  serverThumbnailInfo: {
    alignItems: 'center',
  },
  serverInfoText: {
    fontSize: 14,
    ...getInterFontConfig('200'),
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  serverInfoList: {
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  serverInfoItem: {
    fontSize: 13,
    ...getInterFontConfig('200'),
    color: '#999',
    marginBottom: 4,
    textAlign: 'left',
  },
  serverInfoFooter: {
    fontSize: 12,
    ...getInterFontConfig('200'),
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
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