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
// Removed unused imports
import { WebMediaAsset } from '../services/webMediaService';
import { getInterFontConfig, getInterFontConfigForInputs } from '../utils/fontUtils';
import { AlertCircle } from 'lucide-react-native';

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
  
  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };
  
  // Removed thumbnail-related state
  
  // Cleanup blob URL when component unmounts
  React.useEffect(() => {
    return () => {
      if (asset?.uri) {
        URL.revokeObjectURL(asset.uri);
      }
    };
  }, [asset?.uri]);


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
            style={[styles.uploadButton, (uploading || asset.fileSize > 50 * 1024 * 1024) && styles.uploadButtonDisabled]}
            disabled={uploading || asset.fileSize > 50 * 1024 * 1024}
          >
            <Text style={styles.uploadText}>
              {uploading ? 'Uploading...' : asset.fileSize > 50 * 1024 * 1024 ? 'Too Large' : 'Upload'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.content}
          activeOpacity={1}
        >
          {/* Simplified Layout: Title Input Only */}
          
          {/* Title Input Section */}
          <View style={styles.titleSection}>
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
          </View>

          {/* Video Size and Restrictions Section */}
          <View style={styles.sizeSection}>
            <Text style={styles.sizeTitle}>Video Information</Text>
            <View style={styles.sizeContent}>
              <Text style={styles.sizeText}>
                Size: {formatFileSize(asset.fileSize)}
              </Text>
              
              {asset.fileSize > 50 * 1024 * 1024 ? (
                <View style={[styles.restrictionCard, styles.restrictionError]}>
                  <AlertCircle size={20} color="#FF3B30" />
                  <View style={styles.restrictionTextContainer}>
                    <Text style={styles.restrictionTitle}>❌ File Too Large</Text>
                    <Text style={styles.restrictionText}>
                      Maximum upload size is 50MB. Please select a smaller video.
                    </Text>
                  </View>
                </View>
              ) : asset.fileSize > 25 * 1024 * 1024 ? (
                <View style={[styles.restrictionCard, styles.restrictionWarning]}>
                  <AlertCircle size={20} color="#FFD60A" />
                  <View style={styles.restrictionTextContainer}>
                    <Text style={styles.restrictionTitle}>⚠️ Limited Features</Text>
                    <Text style={styles.restrictionText}>
                      AI processing not available for videos over 25MB
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={[styles.restrictionCard, styles.restrictionSuccess]}>
                  <AlertCircle size={20} color="#34C759" />
                  <View style={styles.restrictionTextContainer}>
                    <Text style={styles.restrictionTitle}>✅ Full AI Features Available</Text>
                    <Text style={styles.restrictionText}>
                      Your video will be processed with AI summary and tags
                    </Text>
                  </View>
                </View>
              )}
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
  
  // Title Section
  titleSection: {
    marginBottom: 24,
  },
  titleContainer: {
    width: '100%',
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
  // Size and Restrictions Section
  sizeSection: {
    marginBottom: 20,
  },
  sizeTitle: {
    fontSize: 16,
    fontWeight: '600',
    ...getInterFontConfig('300'),
    color: '#fff',
    marginBottom: 12,
  },
  sizeContent: {
    gap: 12,
  },
  sizeText: {
    fontSize: 16,
    ...getInterFontConfig('200'),
    color: '#e5e5e7',
    marginBottom: 8,
  },
  restrictionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    gap: 12,
  },
  restrictionSuccess: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.3)',
  },
  restrictionWarning: {
    backgroundColor: 'rgba(255, 214, 10, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 214, 10, 0.3)',
  },
  restrictionError: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  restrictionTextContainer: {
    flex: 1,
  },
  restrictionTitle: {
    fontSize: 15,
    fontWeight: '600',
    ...getInterFontConfig('300'),
    color: '#fff',
    marginBottom: 4,
  },
  restrictionText: {
    fontSize: 14,
    ...getInterFontConfig('200'),
    color: '#e5e5e7',
    lineHeight: 20,
  },
});