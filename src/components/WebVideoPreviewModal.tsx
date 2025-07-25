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
import { Camera, Image as ImageIcon, Trash2 } from 'lucide-react-native';
import { WebMediaAsset } from '../services/webMediaService';
import { getInterFontConfig, getInterFontConfigForInputs } from '../utils/fontUtils';
import { ThumbnailGenerator } from './ThumbnailGenerator';
import { FrameCaptureResult } from '../utils/frameCapture';

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
  const [showThumbnailGenerator, setShowThumbnailGenerator] = React.useState(false);
  const [customThumbnailData, setCustomThumbnailData] = React.useState<{ frameData: FrameCaptureResult; timeSeconds: number } | null>(null);

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
    }
  }, [asset, visible]);

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

  // Handle custom thumbnail generation
  const handleThumbnailGenerated = (frameData: FrameCaptureResult, timeSeconds: number) => {
    setCustomThumbnailData({ frameData, timeSeconds });
    setThumbnailOption('custom');
    setShowThumbnailGenerator(false);
  };

  // Handle no thumbnail selection
  const handleNoThumbnail = () => {
    setCustomThumbnailData(null);
    setThumbnailOption('none');
    setShowThumbnailGenerator(false);
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

        <View style={styles.content}>
          <View style={styles.videoContainer}>
            {/* Web-compatible video player */}
            <video
              src={asset.uri}
              controls
              style={styles.video}
              poster="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgdmlld0JveD0iMCAwIDMyMCAxODAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMjAiIGhlaWdodD0iMTgwIiBmaWxsPSIjMzMzIi8+Cjx0ZXh0IHg9IjE2MCIgeT0iOTAiIGZpbGw9IiNmZmYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiI+VmlkZW8gUHJldmlldzwvdGV4dD4KPC9zdmc+"
            />
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Video Title</Text>
            <TextInput
              ref={titleInputRef}
              style={styles.titleInput}
              value={title}
              onChangeText={setTitle}
              placeholder="Enter video title..."
              placeholderTextColor="#666"
              maxLength={100}
              editable={!uploading}
              selectTextOnFocus={true}
              autoFocus={true}
              onFocus={() => {
                // Ensure text is selected when focused
                setTimeout(() => {
                  if (titleInputRef.current && title === 'title') {
                    // Use React Native compatible selection
                    if (titleInputRef.current.setNativeProps) {
                      titleInputRef.current.setNativeProps({
                        selection: { start: 0, end: 5 }
                      });
                    }
                  }
                }, 50);
              }}
            />

            {/* Thumbnail Selection */}
            <View style={styles.thumbnailSection}>
              <Text style={styles.label}>Thumbnail</Text>
              <View style={styles.thumbnailOptions}>
                <TouchableOpacity
                  style={[
                    styles.thumbnailOption,
                    thumbnailOption === 'first' && styles.thumbnailOptionSelected
                  ]}
                  onPress={() => setThumbnailOption('first')}
                  disabled={uploading}
                >
                  <ImageIcon size={16} color={thumbnailOption === 'first' ? '#007AFF' : '#666'} />
                  <Text style={[
                    styles.thumbnailOptionText,
                    thumbnailOption === 'first' && styles.thumbnailOptionTextSelected
                  ]}>
                    First Frame
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.thumbnailOption,
                    thumbnailOption === 'custom' && styles.thumbnailOptionSelected
                  ]}
                  onPress={() => setShowThumbnailGenerator(true)}
                  disabled={uploading}
                >
                  <Camera size={16} color={thumbnailOption === 'custom' ? '#007AFF' : '#666'} />
                  <Text style={[
                    styles.thumbnailOptionText,
                    thumbnailOption === 'custom' && styles.thumbnailOptionTextSelected
                  ]}>
                    Custom Frame
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.thumbnailOption,
                    thumbnailOption === 'none' && styles.thumbnailOptionSelected
                  ]}
                  onPress={() => setThumbnailOption('none')}
                  disabled={uploading}
                >
                  <Trash2 size={16} color={thumbnailOption === 'none' ? '#007AFF' : '#666'} />
                  <Text style={[
                    styles.thumbnailOptionText,
                    thumbnailOption === 'none' && styles.thumbnailOptionTextSelected
                  ]}>
                    No Thumbnail
                  </Text>
                </TouchableOpacity>
              </View>
              
              {thumbnailOption === 'custom' && customThumbnailData && (
                <Text style={styles.thumbnailPreview}>
                  ✓ Custom frame selected at {Math.floor(customThumbnailData.timeSeconds)}s
                </Text>
              )}
            </View>

            <View style={styles.metadata}>
              <View style={styles.metadataRow}>
                <Text style={styles.metadataLabel}>Duration:</Text>
                <Text style={styles.metadataValue}>
                  {formatDuration(asset.duration)}
                </Text>
              </View>
              
              <View style={styles.metadataRow}>
                <Text style={styles.metadataLabel}>Size:</Text>
                <Text style={styles.metadataValue}>
                  {formatFileSize(asset.fileSize)}
                </Text>
              </View>

              {asset.width && asset.height && (
                <View style={styles.metadataRow}>
                  <Text style={styles.metadataLabel}>Resolution:</Text>
                  <Text style={styles.metadataValue}>
                    {asset.width} × {asset.height}
                  </Text>
                </View>
              )}

              <View style={styles.metadataRow}>
                <Text style={styles.metadataLabel}>Format:</Text>
                <Text style={styles.metadataValue}>
                  {asset.file.type || 'Unknown'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Thumbnail Generator Modal */}
      <ThumbnailGenerator
        visible={showThumbnailGenerator}
        video={{
          id: 'temp',
          title: title || 'Preview Video',
          user_id: 'temp',
          status: 'ready' as const,
          storage_path: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          source_type: 'device' as const,
        }}
        videoUrl={asset?.uri || ''}
        onClose={() => setShowThumbnailGenerator(false)}
        onThumbnailGenerated={handleThumbnailGenerated}
        onThumbnailRemoved={handleNoThumbnail}
      />
    </Modal>
  );
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '0:00';
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
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
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
  },
  content: {
    flex: 1,
    padding: 20,
  },
  videoContainer: {
    aspectRatio: 16/9,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  } as any,
  form: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    ...getInterFontConfig('300'), // Light 300 Italic with premium spacing
    color: '#fff',
    marginBottom: 8,
  },
  titleInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    ...getInterFontConfigForInputs('200'), // Regular Inter for better input readability
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 24,
  },
  metadata: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metadataLabel: {
    fontSize: 14,
    ...getInterFontConfig('200'), // ExtraLight 200 Italic with premium spacing
    color: '#888',
  },
  metadataValue: {
    fontSize: 14,
    fontWeight: '500',
    ...getInterFontConfig('200'), // ExtraLight 200 Italic with premium spacing
    color: '#fff',
  },
  thumbnailSection: {
    marginTop: 20,
  },
  thumbnailOptions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  thumbnailOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#333',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 6,
  },
  thumbnailOptionSelected: {
    borderColor: '#007AFF',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  thumbnailOptionText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
  thumbnailOptionTextSelected: {
    color: '#007AFF',
  },
  thumbnailPreview: {
    marginTop: 8,
    fontSize: 12,
    color: '#007AFF',
    textAlign: 'center',
  },
});