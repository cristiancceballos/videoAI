import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { webMediaService, WebMediaAsset } from '../../services/webMediaService';
import { webUploadService, UploadProgress } from '../../services/webUploadService';
import { WebVideoPreviewModal } from '../../components/WebVideoPreviewModal';
import { UploadProgressModal } from '../../components/UploadProgressModal';

export function UploadScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [selectedAsset, setSelectedAsset] = useState<WebMediaAsset | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    loaded: 0,
    total: 0,
    percentage: 0,
  });
  const [uploading, setUploading] = useState(false);

  const handlePickFromDevice = async () => {
    const asset = await webMediaService.pickVideoFromDevice();
    if (asset) {
      // Validate file size and duration
      if (webMediaService.isFileTooLarge(asset.fileSize)) {
        Alert.alert('File Too Large', 'Please select a video smaller than 100MB');
        return;
      }
      
      if (webMediaService.isDurationTooLong(asset.duration)) {
        Alert.alert('Video Too Long', 'Please select a video shorter than 30 minutes');
        return;
      }

      setSelectedAsset(asset);
      setShowPreview(true);
    }
  };

  const handleRecordVideo = async () => {
    const asset = await webMediaService.recordVideoWithCamera();
    if (asset) {
      setSelectedAsset(asset);
      setShowPreview(true);
    }
  };


  const handleUploadAsset = async (title: string) => {
    if (!selectedAsset || !user) return;

    setUploading(true);
    setShowPreview(false);
    setShowProgress(true);

    try {
      const result = await webUploadService.uploadWebVideo(
        selectedAsset,
        user.id,
        title,
        (progress) => {
          setUploadProgress(progress);
        }
      );

      setUploading(false);

      if (result.success) {
        Alert.alert('Success', 'Video uploaded successfully!', [
          {
            text: 'View in Library',
            onPress: () => {
              setShowProgress(false);
              setSelectedAsset(null);
              // Navigate to Home tab to see the uploaded video
              navigation.navigate('Home' as never);
            },
          },
          {
            text: 'Upload Another',
            style: 'cancel',
            onPress: () => {
              setShowProgress(false);
              setSelectedAsset(null);
            },
          },
        ]);
      } else {
        Alert.alert('Upload Failed', result.error || 'Something went wrong');
        setShowProgress(false);
      }
    } catch (error) {
      setUploading(false);
      setShowProgress(false);
      Alert.alert('Error', 'Upload failed. Please try again.');
    }
  };

  const handleCancelUpload = () => {
    // TODO: Implement upload cancellation
    setUploading(false);
    setShowProgress(false);
    Alert.alert('Upload Cancelled');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Upload Video</Text>
        {Platform.OS !== 'web' && (
          <Text style={styles.warningText}>
            ⚠️ For full functionality, visit the deployed web version
          </Text>
        )}
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>From Device</Text>
          
          <TouchableOpacity 
            style={styles.uploadButton}
            onPress={handlePickFromDevice}
            activeOpacity={0.8}
          >
            <Text style={styles.uploadButtonIcon}>📱</Text>
            <Text style={styles.uploadButtonText}>Choose from Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.uploadButton}
            onPress={handleRecordVideo}
            activeOpacity={0.8}
          >
            <Text style={styles.uploadButtonIcon}>📹</Text>
            <Text style={styles.uploadButtonText}>Take Video</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      <WebVideoPreviewModal
        visible={showPreview}
        asset={selectedAsset}
        onClose={() => {
          setShowPreview(false);
          setSelectedAsset(null);
        }}
        onUpload={handleUploadAsset}
        uploading={uploading}
      />

      <UploadProgressModal
        visible={showProgress}
        progress={uploadProgress}
        onCancel={handleCancelUpload}
        uploading={uploading}
      />
    </KeyboardAvoidingView>
  );
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isSmallScreen = screenWidth < 375;
const isVerySmallScreen = screenWidth < 320;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingHorizontal: isSmallScreen ? 16 : 20,
    paddingTop: Platform.OS === 'web' ? 20 : 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: isSmallScreen ? 20 : 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  warningText: {
    fontSize: 12,
    color: '#FF9500',
    textAlign: 'center',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: isSmallScreen ? 16 : 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: isSmallScreen ? 28 : 32,
  },
  sectionTitle: {
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  uploadButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: isVerySmallScreen ? 16 : isSmallScreen ? 18 : 20,
    alignItems: 'center',
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 56,
  },
  uploadButtonDisabled: {
    backgroundColor: '#333',
    opacity: 0.6,
  },
  uploadButtonIcon: {
    fontSize: isSmallScreen ? 18 : 20,
    marginRight: 12,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: isSmallScreen ? 15 : 16,
    fontWeight: '600',
  },
});