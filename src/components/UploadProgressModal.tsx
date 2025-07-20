import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { UploadProgress } from '../services/uploadService';

interface UploadProgressModalProps {
  visible: boolean;
  progress: UploadProgress;
  onCancel: () => void;
  uploading: boolean;
}

export function UploadProgressModal({
  visible,
  progress,
  onCancel,
  uploading,
}: UploadProgressModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
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
            <Text style={styles.successText}>Upload completed!</Text>
          )}
        </View>
      </View>
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
    color: '#888',
  },
  spinner: {
    marginLeft: 8,
  },
  successText: {
    fontSize: 16,
    color: '#34C759',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
  },
});