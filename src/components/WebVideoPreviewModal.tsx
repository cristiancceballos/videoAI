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
import { AlertCircle, Plus, X } from 'lucide-react-native';
import { preventViewportZoom, resetViewportZoom } from '../utils/viewportUtils';

interface WebVideoPreviewModalProps {
  visible: boolean;
  asset: WebMediaAsset | null;
  onClose: () => void;
  onUpload: (title: string, tags?: string[], thumbnailData?: null, thumbnailOption?: 'server') => void;
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
  const [tags, setTags] = React.useState<string[]>([]);
  const [newTag, setNewTag] = React.useState('');
  const [isAddingTag, setIsAddingTag] = React.useState(false);
  const titleInputRef = React.useRef<any>(null);
  
  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };
  
  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };
  
  const removeTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index));
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
      // Don't auto-focus or select - let user choose when to edit
    }
  }, [asset, visible]);

  const handleUpload = () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title for your video');
      return;
    }

    // Server-side thumbnail generation - Edge Function will create multiple thumbnail options
    onUpload(title.trim(), tags, null, 'server');
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
                selectTextOnFocus={false}
                autoFocus={false}
                multiline={true}
                numberOfLines={2}
                onFocus={preventViewportZoom}
                onBlur={resetViewportZoom}
              />
            </View>
          </View>

          {/* Tags Section */}
          <View style={styles.metadataRow}>
            <Text style={styles.label}>Tags</Text>
            <View style={styles.tagsSection}>
              <View style={styles.tagsContainer}>
                {/* Tag input */}
                {isAddingTag ? (
                  <View style={styles.addTagContainer}>
                    <TextInput
                      style={styles.addTagInput}
                      placeholder="Add tag"
                      placeholderTextColor="#666"
                      value={newTag}
                      onChangeText={setNewTag}
                      onSubmitEditing={addTag}
                      onFocus={preventViewportZoom}
                      onBlur={() => {
                        addTag();
                        setIsAddingTag(false);
                        resetViewportZoom();
                      }}
                      returnKeyType="done"
                      autoFocus={true}
                      editable={!uploading}
                    />
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.tagChip, styles.addTagChip]}
                    onPress={() => setIsAddingTag(true)}
                    disabled={uploading}
                  >
                    <Plus size={16} color="#34C759" />
                    <Text style={[styles.tagText, styles.addTagText]}>Add</Text>
                  </TouchableOpacity>
                )}
                
                {/* Display tags */}
                {tags.map((tag, index) => (
                  <View key={index} style={styles.editableTagChip}>
                    <Text style={styles.tagText}>{tag}</Text>
                    <TouchableOpacity 
                      onPress={() => removeTag(index)}
                      hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                      disabled={uploading}
                    >
                      <X size={14} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
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
  metadataRow: {
    marginTop: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    ...getInterFontConfig('300'),
    color: '#8e8e93',
    marginBottom: 8,
  },
  tagsSection: {
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  addTagChip: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.3)',
    borderStyle: 'dashed' as any,
    gap: 4,
  },
  editableTagChip: {
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tagText: {
    fontSize: 13,
    ...getInterFontConfig('200'),
    color: '#34C759',
  },
  addTagText: {
    fontWeight: '500',
  },
  addTagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 100,
  },
  addTagInput: {
    flex: 1,
    fontSize: 13,
    ...getInterFontConfig('200'),
    color: '#fff',
    padding: 0,
    minWidth: 60,
    outlineStyle: 'none' as any,
  },
});