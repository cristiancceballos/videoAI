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
import { Images, Camera, AlertTriangle } from 'lucide-react-native';
import { getInterFontConfig } from '../../utils/fontUtils';
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
      // Validate file size (50MB max)
      if (asset.fileSize > 50 * 1024 * 1024) {
        Alert.alert('File Too Large', 'Please select a video smaller than 50MB');
        return;
      }

      setSelectedAsset(asset);
      setShowPreview(true);
    }
  };

  const handleRecordVideo = async () => {
    const asset = await webMediaService.recordVideoWithCamera();
    if (asset) {
      // Validate file size (50MB max)
      if (asset.fileSize > 50 * 1024 * 1024) {
        Alert.alert('File Too Large', 'The recorded video is too large (>50MB). Please record a shorter video.');
        return;
      }
      
      setSelectedAsset(asset);
      setShowPreview(true);
    }
  };


  const handleUploadAsset = async (title: string, tags?: string[], thumbnailData?: any, thumbnailOption?: 'first' | 'custom' | 'none' | 'server') => {
    if (!selectedAsset || !user) return;

    setUploading(true);
    setShowPreview(false);
    setShowProgress(true);

    try {
      // Starting video upload
      
      const result = await webUploadService.uploadWebVideo(
        selectedAsset,
        user.id,
        title,
        (progress) => {
          setUploadProgress(progress);
        },
        tags
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
        console.error('Upload failed:', result.error);
        const userFriendlyError = result.error?.includes('type integer') 
          ? 'Video file format error. Please try a different video.'
          : result.error?.includes('row-level security')
          ? 'Authentication error. Please sign out and sign back in.'
          : result.error || 'Upload failed. Please try again.';
        
        Alert.alert('Upload Failed', userFriendlyError);
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
            For full functionality, visit the deployed web version
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
            <View style={styles.uploadButtonIcon}>
              <Images size={24} color="#fff" />
            </View>
            <Text style={styles.uploadButtonText}>Choose from Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.uploadButton}
            onPress={handleRecordVideo}
            activeOpacity={0.8}
          >
            <View style={styles.uploadButtonIcon}>
              <Camera size={24} color="#fff" />
            </View>
            <Text style={styles.uploadButtonText}>Take Video</Text>
          </TouchableOpacity>
        </View>

        {/* Limitations Info Section */}
        <View style={styles.infoCard}>
          <View style={styles.infoContent}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Tips for Success:</Text>
              <Text style={styles.infoText}>• Downloaded videos with clear audio work best</Text>
              <Text style={styles.infoText}>• Download your faviorite videos from tiktok/instagram onto your phone and upload here </Text>
              <Text style={styles.infoText}>• Once you uploaded your video from your gallary, delete the video off your phone to save phone storage (: </Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>File Size Limits:</Text>
              <Text style={styles.infoText}>• Maximum upload size: 50MB</Text>
              <Text style={styles.infoText}>• Videos under 25MB get full AI features</Text>
              <Text style={styles.infoText}>• Videos 25-50MB: No AI processing</Text>
            </View>
            
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>For Best AI Results:</Text>
              <Text style={styles.infoText}>• Clear audio quality is essential</Text>
              <Text style={styles.infoText}>• Minimize background noise</Text>
              <Text style={styles.infoText}>• Speaker speaking clearly and at normal pace</Text>
            </View>
            
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Recording vs Downloaded Videos:</Text>
              <Text style={styles.infoText}> Videos you record: ~2.5MB per second</Text>
              <Text style={styles.infoText}> Downloaded videos: ~0.5MB per second</Text>
              <Text style={styles.infoText}> Your camera records at cinema quality!</Text>
              <Text style={styles.infoText}> About a 20-sec recording you record ≈ 50MB limit</Text>
            </View>
          </View>
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
        onClose={() => setShowProgress(false)}
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
    ...getInterFontConfig('300'), // Light 300 Italic with premium -1.8 letterSpacing
    color: '#fff',
  },
  warningText: {
    fontSize: 12,
    ...getInterFontConfig('200'), // ExtraLight 200 Italic with premium -1.0 letterSpacing
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
    ...getInterFontConfig('300'), // Light 300 Italic with premium -1.8 letterSpacing
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
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: isSmallScreen ? 15 : 16,
    fontWeight: '600',
    ...getInterFontConfig('300'), // Light 300 Italic with premium -1.8 letterSpacing
  },
  infoCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#333',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    ...getInterFontConfig('300'),
    color: '#FFD60A',
    marginLeft: 8,
  },
  infoContent: {
    gap: 16,
  },
  infoItem: {
    gap: 6,
  },
  infoLabel: {
    fontSize: 15,
    fontWeight: '600',
    ...getInterFontConfig('300'),
    color: '#fff',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    ...getInterFontConfig('200'),
    color: '#e5e5e7',
    lineHeight: 20,
    marginLeft: 8,
  },
});