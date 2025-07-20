import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { MediaAsset } from '../services/mediaService';

interface VideoPreviewModalProps {
  visible: boolean;
  asset: MediaAsset | null;
  onClose: () => void;
  onUpload: (title: string) => void;
  uploading: boolean;
}

export function VideoPreviewModal({
  visible,
  asset,
  onClose,
  onUpload,
  uploading,
}: VideoPreviewModalProps) {
  const [title, setTitle] = React.useState('');
  const [isPlaying, setIsPlaying] = React.useState(false);

  React.useEffect(() => {
    if (asset?.filename) {
      // Remove file extension and format title
      const nameWithoutExt = asset.filename.replace(/\.[^/.]+$/, '');
      const formattedTitle = nameWithoutExt
        .replace(/[_-]/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
      setTitle(formattedTitle);
    }
  }, [asset]);

  const handleUpload = () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title for your video');
      return;
    }
    onUpload(title.trim());
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
            <Video
              source={{ uri: asset.uri }}
              style={styles.video}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              isLooping={false}
              shouldPlay={isPlaying}
            />
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Video Title</Text>
            <TextInput
              style={styles.titleInput}
              value={title}
              onChangeText={setTitle}
              placeholder="Enter video title..."
              placeholderTextColor="#666"
              maxLength={100}
              editable={!uploading}
            />

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

function formatFileSize(bytes?: number): string {
  if (!bytes) return 'Unknown';
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
  },
  video: {
    flex: 1,
  },
  form: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  titleInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
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
    color: '#888',
  },
  metadataValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
});