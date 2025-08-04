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

          {/* 3. AI Summary Section (Placeholder) */}
          <View style={styles.aiSummarySection}>
            <Text style={styles.aiSummaryTitle}>AI Summary</Text>
            <View style={styles.aiSummaryContent}>
              <Text style={styles.aiSummaryPlaceholder}>
                AI-generated slob will appear here automatically after upload... just not today
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
  // AI Summary Section
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