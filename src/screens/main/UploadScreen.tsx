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
import { useAuth } from '../../contexts/AuthContext';
import { webMediaService, WebMediaAsset } from '../../services/webMediaService';
import { webUploadService, UploadProgress } from '../../services/webUploadService';
import { WebVideoPreviewModal } from '../../components/WebVideoPreviewModal';
import { UploadProgressModal } from '../../components/UploadProgressModal';

export function UploadScreen() {
  const { user } = useAuth();
  const [urlInput, setUrlInput] = useState('');
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

  const handleUrlUpload = () => {
    if (!urlInput.trim()) {
      Alert.alert('Error', 'Please enter a video URL');
      return;
    }

    const validation = webUploadService.validateVideoUrl(urlInput.trim());
    if (!validation.valid) {
      Alert.alert('Invalid URL', validation.error || 'Please enter a valid YouTube or TikTok URL');
      return;
    }

    // TODO: Implement URL video processing in Phase 3
    Alert.alert(
      'Coming Soon',
      `${validation.type?.toUpperCase()} video processing will be available in the next update!`
    );
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
            text: 'OK',
            onPress: () => {
              setShowProgress(false);
              setSelectedAsset(null);
              setUrlInput('');
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
            <Text style={styles.uploadButtonText}>Choose File</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.uploadButton}
            onPress={handleRecordVideo}
            activeOpacity={0.8}
          >
            <Text style={styles.uploadButtonIcon}>📹</Text>
            <Text style={styles.uploadButtonText}>Record Video</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>From URL</Text>
          
          <TextInput
            style={styles.urlInput}
            placeholder="Paste YouTube or TikTok URL..."
            placeholderTextColor="#666"
            value={urlInput}
            onChangeText={setUrlInput}
            autoCapitalize="none"
            autoCorrect={false}
            multiline={false}
          />

          <TouchableOpacity 
            style={[
              styles.uploadButton, 
              !urlInput.trim() && styles.uploadButtonDisabled
            ]}
            onPress={handleUrlUpload}
            disabled={!urlInput.trim()}
            activeOpacity={0.8}
          >
            <Text style={styles.uploadButtonIcon}>🔗</Text>
            <Text style={styles.uploadButtonText}>Upload from URL</Text>
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
  urlInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: isSmallScreen ? 14 : 16,
    fontSize: isSmallScreen ? 15 : 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 12,
    minHeight: 50,
    textAlignVertical: 'center',
  },
});