import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { UploadProgress } from '../services/webUploadService';
import { getInterFontConfig } from '../utils/fontUtils';

interface UploadProgressModalProps {
  visible: boolean;
  progress: UploadProgress;
  onCancel: () => void;
  uploading: boolean;
  onClose?: () => void;
}

export function UploadProgressModal({
  visible,
  progress,
  onCancel,
  uploading,
  onClose,
}: UploadProgressModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose || onCancel}
    >
      <TouchableOpacity 
        style={styles.overlay}
        activeOpacity={1}
        onPress={!uploading ? (onClose || onCancel) : undefined}
      >
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Uploading Video</Text>
            {uploading && (
              <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${progress.percentage}%` }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {Math.round(progress.percentage)}%
            </Text>
          </View>

          <View style={styles.details}>
            <Text style={styles.detailText}>
              {formatBytes(progress.loaded)} / {formatBytes(progress.total)}
            </Text>
            {uploading && (
              <ActivityIndicator color="#007AFF" style={styles.spinner} />
            )}
          </View>

          {!uploading && (
            <View style={styles.completedContainer}>
              <Text style={styles.successText}>Upload completed!</Text>
              <TouchableOpacity 
                onPress={onClose || onCancel}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modal: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 320,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    ...getInterFontConfig('300'), // Light 300 Italic with premium spacing
    color: '#fff',
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#333',
    borderRadius: 8,
  },
  cancelText: {
    color: '#fff',
    fontSize: 14,
    ...getInterFontConfig('200'), // ExtraLight 200 Italic with premium spacing
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 16,
    fontWeight: '600',
    ...getInterFontConfig('300'), // Light 300 Italic with premium spacing
    color: '#fff',
    textAlign: 'center',
  },
  details: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 14,
    ...getInterFontConfig('200'), // ExtraLight 200 Italic with premium spacing
    color: '#888',
  },
  spinner: {
    marginLeft: 8,
  },
  completedContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  successText: {
    fontSize: 16,
    color: '#34C759',
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '600',
    ...getInterFontConfig('300'), // Light 300 Italic with premium spacing
  },
  closeButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    ...getInterFontConfig('300'), // Light 300 Italic with premium spacing
    textAlign: 'center',
  },
});