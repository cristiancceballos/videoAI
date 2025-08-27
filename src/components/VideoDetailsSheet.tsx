import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Modal,
  ActivityIndicator,
  Animated,
  PanResponder,
  TextInput,
  Platform,
} from 'react-native';
import { VideoWithMetadata, videoService } from '../services/videoService';
import { getInterFontConfig, getInterFontConfigForInputs } from '../utils/fontUtils';
import { Sparkles, AlertCircle, Edit2, MoreVertical, Plus, X, Check } from 'lucide-react-native';
import { supabase } from '../services/supabase';
import { preventViewportZoom, resetViewportZoom } from '../utils/viewportUtils';

interface VideoDetailsSheetProps {
  visible: boolean;
  video: VideoWithMetadata;
  onClose: () => void;
}

export function VideoDetailsSheet({ visible, video, onClose }: VideoDetailsSheetProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [currentAiStatus, setCurrentAiStatus] = useState(video.ai_status);
  
  // Editing states
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(video.title);
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [userTags, setUserTags] = useState<string[]>(video.user_tags || []);
  const [aiTags, setAiTags] = useState<string[]>(video.ai_tags || []);
  const [newTag, setNewTag] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Animation values
  const translateY = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const scrollOffset = useRef(0);
  const scrollViewRef = useRef<ScrollView>(null);
  
  
  // Pan responder for swipe gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        // Allow immediate response on drag handle area
        const touchY = evt.nativeEvent.locationY;
        return touchY < 50; // Drag handle area
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Check if touch is on drag handle or if scrolled to top
        const touchY = evt.nativeEvent.locationY;
        const isOnDragHandle = touchY < 50;
        const isSwipingDown = gestureState.dy > 0;
        const isAtTop = scrollOffset.current <= 0;
        
        return isOnDragHandle || (isSwipingDown && isAtTop && Math.abs(gestureState.dy) > 10);
      },
      onPanResponderMove: (_, gestureState) => {
        // Move the sheet with the finger
        const newValue = Math.max(0, gestureState.dy);
        translateY.setValue(newValue);
        // Update backdrop opacity during swipe
        const opacity = 0.4 * (1 - newValue / screenHeight);
        backdropOpacity.setValue(opacity);
      },
      onPanResponderRelease: (_, gestureState) => {
        // Determine if we should close or snap back
        const shouldClose = gestureState.dy > 100 || gestureState.vy > 0.5;
        
        if (shouldClose) {
          // Animate out and close
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: screenHeight,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(backdropOpacity, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
          ]).start(() => {
            translateY.setValue(0);
            backdropOpacity.setValue(0);
            onClose();
          });
        } else {
          // Snap back to position
          Animated.parallel([
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              tension: 100,
              friction: 10,
            }),
            Animated.timing(backdropOpacity, {
              toValue: 0.4,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible && currentAiStatus === 'completed' && !summary) {
      // Only fetch summary if we don't already have it
      setLoadingSummary(true);
      videoService.getVideoSummary(video.id).then(content => {
        setSummary(content);
        setLoadingSummary(false);
      }).catch(() => {
        setLoadingSummary(false);
      });
    }
    // Don't reset summary when closing - keep it for next open
  }, [visible, video.id, currentAiStatus, summary]);
  
  // Reset editing states when video changes
  useEffect(() => {
    setEditedTitle(video.title);
    setUserTags(video.user_tags || []);
    setAiTags(video.ai_tags || []);
    setIsEditingTitle(false);
    setIsEditingTags(false);
    setCurrentAiStatus(video.ai_status);
    setNewTag(''); // Clear new tag input
  }, [video]);
  
  // Reset state when video ID changes (different video)
  useEffect(() => {
    // Reset for new video
    setSummary(null); // Reset summary for new video
  }, [video.id]);
  
  // Compute merged tags for display
  const displayTags = React.useMemo(() => {
    const merged = [...userTags, ...aiTags];
    // Remove duplicates
    return Array.from(new Set(merged));
  }, [userTags, aiTags]);
  
  // Subscribe to real-time updates for video status and summaries
  useEffect(() => {
    if (!visible || !video.id) return;
    
    // Create channel for real-time updates
    const channel = supabase
      .channel(`video_details_${video.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'videos',
          filter: `id=eq.${video.id}`
        },
        (payload) => {
          // Update AI status when video is updated
          if (payload.new && 'ai_status' in payload.new) {
            setCurrentAiStatus(payload.new.ai_status);
            
            // Update AI tags when AI completes
            if ('ai_tags' in payload.new && payload.new.ai_tags) {
              setAiTags(payload.new.ai_tags as string[]);
            }
            
            // Update user tags if they change
            if ('user_tags' in payload.new && payload.new.user_tags) {
              setUserTags(payload.new.user_tags as string[]);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'summaries',
          filter: `video_id=eq.${video.id}`
        },
        (payload) => {
          // New summary was inserted, fetch it
          if (payload.new && 'content' in payload.new) {
            setSummary(payload.new.content);
            setLoadingSummary(false);
          }
        }
      )
      .subscribe((status, err) => {
        if (err) {
          // Silently handle subscription errors
        }
      });
    
    // Cleanup subscription on unmount or when sheet closes
    return () => {
      supabase.removeChannel(channel);
    };
  }, [visible, video.id]);
  
  // Fallback polling for AI status when processing
  useEffect(() => {
    if (!visible || !video.id || currentAiStatus !== 'processing') return;
    
    const pollInterval = setInterval(async () => {
      try {
        // Check video status
        const { data: videoData, error: videoError } = await supabase
          .from('videos')
          .select('ai_status, user_tags, ai_tags, tags')
          .eq('id', video.id)
          .single();
        
        if (!videoError && videoData) {
          if (videoData.ai_status !== currentAiStatus) {
            setCurrentAiStatus(videoData.ai_status);
            
            // Update separate tag arrays
            if (videoData.user_tags) {
              setUserTags(videoData.user_tags);
            }
            if (videoData.ai_tags) {
              setAiTags(videoData.ai_tags);
            }
          }
          
          // If completed, fetch summary
          if (videoData.ai_status === 'completed') {
            const { data: summaryData, error: summaryError } = await supabase
              .from('summaries')
              .select('content')
              .eq('video_id', video.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();
            
            if (!summaryError && summaryData) {
              setSummary(summaryData.content);
              setLoadingSummary(false);
            }
          }
          
          // Stop polling if status is no longer processing
          if (videoData.ai_status !== 'processing') {
            clearInterval(pollInterval);
          }
        }
      } catch (error) {
        // Silently handle polling errors
      }
    }, 2000); // Poll every 2 seconds
    
    return () => {
      clearInterval(pollInterval);
    };
  }, [visible, video.id, currentAiStatus]);
  
  // Handle entrance/exit animations
  useEffect(() => {
    if (visible) {
      // Reset positions
      translateY.setValue(screenHeight);
      backdropOpacity.setValue(0);
      
      // Animate entrance
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0.4,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset for next open
      backdropOpacity.setValue(0);
    }
  }, [visible, translateY, backdropOpacity]);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  // Handler functions for editing
  const handleSaveTitle = async () => {
    if (!editedTitle.trim() || editedTitle === video.title) {
      setIsEditingTitle(false);
      return;
    }
    
    setIsSaving(true);
    const success = await videoService.updateVideo(video.id, { title: editedTitle });
    if (success) {
      video.title = editedTitle; // Update local reference
      setIsEditingTitle(false);
    }
    setIsSaving(false);
  };

  const handleSaveTags = async () => {
    // If there's text in newTag input, add it first
    let updatedUserTags = [...userTags];
    if (newTag.trim() && !userTags.includes(newTag.trim())) {
      updatedUserTags = [...userTags, newTag.trim()];
      setUserTags(updatedUserTags);
      setNewTag('');
    }
    
    setIsSaving(true);
    // Only update user_tags, not the merged tags
    const success = await videoService.updateVideo(video.id, { user_tags: updatedUserTags });
    if (success) {
      video.user_tags = updatedUserTags; // Update local reference
      setIsEditingTags(false);
    }
    setIsSaving(false);
  };

  const removeTag = (index: number) => {
    // Determine if it's a user tag or AI tag based on position
    if (index < userTags.length) {
      // It's a user tag - remove it
      setUserTags(prev => prev.filter((_, i) => i !== index));
    }
    // We don't allow removing AI tags
  };

  const addTag = () => {
    if (newTag.trim() && !userTags.includes(newTag.trim())) {
      setUserTags(prev => [...prev, newTag.trim()]);
      setNewTag('');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);

    // Date part: e.g., "Jul 21, 2025"
    const datePart = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    // Time part: e.g., "04:52 PM"
    const timePart = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    // Combine with @ instead of 'at'
    return `${datePart} @ ${timePart}`;
  };


  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        {/* Animated Backdrop */}
        <Animated.View 
          style={[
            styles.backdrop,
            {
              opacity: backdropOpacity,
            },
          ]}
          pointerEvents={visible ? 'auto' : 'none'}
        >
          <TouchableOpacity 
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={onClose}
          />
        </Animated.View>
        {/* Bottom Sheet */}
        <Animated.View 
          style={[
            styles.sheet,
            {
              transform: [{ translateY }],
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Drag Handle */}
          <View style={styles.dragHandleContainer}>
            <View style={styles.dragHandle} />
          </View>

          {/* Sheet Content */}
          <ScrollView 
            ref={scrollViewRef}
            style={styles.content}
            showsVerticalScrollIndicator={true}
            bounces={true}
            contentContainerStyle={styles.scrollContent}
            scrollEventThrottle={16}
            nestedScrollEnabled={true}
            onScroll={(event) => {
              scrollOffset.current = event.nativeEvent.contentOffset.y;
            }}
          >
          {/* Video Title */}
          <View style={styles.titleContainer}>
            {isEditingTitle ? (
              <View style={styles.titleEditContainer}>
                <TextInput
                  style={styles.titleInput}
                  value={editedTitle}
                  onChangeText={setEditedTitle}
                  autoFocus
                  multiline
                  numberOfLines={2}
                  editable={!isSaving}
                />
                <TouchableOpacity 
                  onPress={handleSaveTitle}
                  disabled={isSaving}
                  style={styles.iconButton}
                >
                  <Check size={20} color="#34C759" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.titleDisplayContainer}>
                <Text style={styles.title} numberOfLines={2}>
                  {video.title}
                </Text>
                <TouchableOpacity 
                  onPress={() => setIsEditingTitle(true)}
                  style={styles.iconButton}
                >
                  <Edit2 size={18} color="#8e8e93" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Upload Date, Duration, and File Size */}
          <Text style={styles.subtitle}>
            {formatDate(video.created_at)} • {formatDuration(video.duration)} • {formatFileSize(video.file_size)}
          </Text>

          {/* File Size Limitations Warning */}
          {video.file_size && video.file_size > 50 * 1024 * 1024 ? (
            <View style={styles.metadataSection}>
              <View style={styles.warningContainer}>
                <AlertCircle size={24} color="#FF9500" />
                <View style={styles.warningTextContainer}>
                  <Text style={styles.warningTitle}>Large Video File</Text>
                  <Text style={styles.warningText}>
                    This video is over 50MB. Playback and AI features may be limited. Consider uploading a smaller file for the best experience.
                  </Text>
                </View>
              </View>
            </View>
          ) : null}
          
          {/* File Size Warning for large videos */}
          {video.file_size && video.file_size > 25 * 1024 * 1024 && (
            <View style={styles.metadataSection}>
              <View style={styles.warningContainer}>
                <AlertCircle size={24} color="#FFD60A" />
                <View style={styles.warningTextContainer}>
                  <Text style={styles.warningTitle}>Limited AI Features</Text>
                  <Text style={styles.warningText}>
                    Videos over 25MB have limited AI processing. Summary and AI-generated tags may not be available.
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* AI Summary Section - Only show if AI completed and file size is under 25MB */}
          {currentAiStatus === 'completed' && (!video.file_size || video.file_size <= 25 * 1024 * 1024) && (
            <View style={styles.metadataSection}>
              <View style={styles.sectionHeader}>
                <Sparkles size={20} color="#34C759" />
                <Text style={styles.sectionTitle}>AI Summary</Text>
              </View>
              
              {loadingSummary ? (
                <ActivityIndicator size="small" color="#8e8e93" style={styles.loadingIndicator} />
              ) : summary ? (
                <Text style={styles.summaryText}>{summary}</Text>
              ) : (
                <Text style={styles.errorText}>Summary not available</Text>
              )}
            </View>
          )}
          
          {/* Tags Section - Always show for all videos */}
          <View style={styles.metadataSection}>
            <View style={[styles.tagsSection, isEditingTags && styles.tagsSectionEditing]}>
              <View style={styles.tagsSectionHeader}>
                <Text style={styles.tagsSectionTitle}>Tags</Text>
                {isEditingTags ? (
                  <TouchableOpacity 
                    onPress={handleSaveTags}
                    disabled={isSaving}
                    style={styles.saveButton}
                  >
                    <Text style={styles.saveButtonText}>Save</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity 
                    onPress={() => setIsEditingTags(true)}
                    style={styles.iconButton}
                  >
                    <MoreVertical size={20} color="#8e8e93" />
                  </TouchableOpacity>
                )}
              </View>
              
              <View style={styles.tagsContainer}>
                {isEditingTags ? (
                  <>
                    {/* Add tag input at the top */}
                    <View style={styles.addTagContainer}>
                      <TextInput
                        style={styles.addTagInput}
                        placeholder="Add tag"
                        placeholderTextColor="#666"
                        value={newTag}
                        onChangeText={setNewTag}
                        onSubmitEditing={addTag}
                        returnKeyType="done"
                        autoFocus={false}
                        onFocus={preventViewportZoom}
                        onBlur={resetViewportZoom}
                      />
                      <TouchableOpacity onPress={addTag}>
                        <Plus size={18} color="#34C759" />
                      </TouchableOpacity>
                    </View>
                    {/* Existing tags with delete option */}
                    {displayTags.map((tag, index) => (
                      <View key={index} style={styles.editableTagChip}>
                        <Text style={styles.tagText}>{tag}</Text>
                        <TouchableOpacity 
                          onPress={() => removeTag(index)}
                          hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                        >
                          <X size={14} color="#FF3B30" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </>
                ) : (
                  <>
                    {displayTags.map((tag, index) => (
                      <View key={index} style={styles.tagChip}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                    {/* Quick Add Tag Button */}
                    <TouchableOpacity
                      style={[styles.tagChip, styles.addTagChip]}
                      onPress={() => setIsEditingTags(true)}
                    >
                      <Plus size={16} color="#34C759" />
                      <Text style={[styles.tagText, styles.addTagText]}>Add</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </View>
          
          {/* AI Processing Status */}
          {currentAiStatus === 'processing' && (
            <View style={styles.metadataSection}>
              <View style={styles.processingContainer}>
                <ActivityIndicator size="small" color="#FF9500" />
                <Text style={styles.processingText}>AI is analyzing your video...</Text>
              </View>
            </View>
          )}
          
          {/* AI Not Started */}
          {(!currentAiStatus || currentAiStatus === 'pending') && (
            <View style={styles.metadataSection}>
              <Text style={styles.pendingText}>AI analysis will begin shortly</Text>
            </View>
          )}


          {/* Helper text about tags */}
          <Text style={styles.helperText}>
            Tags help improve search 
          </Text>
          
          {/* Add some bottom spacing for better UX */}
          <View style={styles.bottomSpacer} />
        </ScrollView>
        </Animated.View>
      </View>
  </Modal>
  );
}

const { height: screenHeight } = Dimensions.get('window');

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 1)',
  },
  sheet: {
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: screenHeight * 0.85,
    minHeight: screenHeight * 0.4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#48484a',
    borderRadius: 2,
  },
  content: {
    flex: 1,
    maxHeight: screenHeight * 0.75,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 60,
    flexGrow: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    ...getInterFontConfig('300'), // Light 300 Italic with premium spacing
    color: '#fff',
    marginTop: 12,
    marginBottom: 8,
    lineHeight: 28,
  },
  subtitle: {
    fontSize: 16,
    ...getInterFontConfig('200'), // ExtraLight 200 Italic with premium spacing
    color: '#8e8e93',
    marginBottom: 24,
  },
  metadataSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    ...getInterFontConfig('300'), // Light 300 Italic with premium spacing
    color: '#fff',
    marginLeft: 8,
  },
  summaryText: {
    fontSize: 16,
    ...getInterFontConfig('200'), // ExtraLight 200 Italic with premium spacing
    color: '#e5e5e7',
    lineHeight: 24,
    marginBottom: 16,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  tagChip: {
    backgroundColor: '#2c2c2e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  addTagChip: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tagText: {
    fontSize: 14,
    ...getInterFontConfig('200'), // ExtraLight 200 Italic with premium spacing
    color: '#8e8e93',
  },
  addTagText: {
    color: '#34C759',
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  processingText: {
    fontSize: 16,
    ...getInterFontConfig('200'), // ExtraLight 200 Italic with premium spacing
    color: '#FF9500',
    marginLeft: 12,
  },
  pendingText: {
    fontSize: 16,
    ...getInterFontConfig('200'), // ExtraLight 200 Italic with premium spacing
    color: '#8e8e93',
    textAlign: 'center',
    paddingVertical: 20,
  },
  errorText: {
    fontSize: 16,
    ...getInterFontConfig('200'), // ExtraLight 200 Italic with premium spacing
    color: '#8e8e93',
    fontStyle: 'italic',
  },
  loadingIndicator: {
    marginVertical: 20,
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#38383a',
  },
  metadataLabel: {
    fontSize: 16,
    ...getInterFontConfig('200'), // ExtraLight 200 Italic with premium spacing
    color: '#8e8e93',
  },
  metadataValue: {
    fontSize: 16,
    fontWeight: '500',
    ...getInterFontConfig('200'), // ExtraLight 200 Italic with premium spacing
    color: '#fff',
  },
  bottomSpacer: {
    height: 20,
  },
  warningContainer: {
    flexDirection: 'row',
    backgroundColor: '#2c2c2e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'flex-start',
  },
  warningTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '600',
    ...getInterFontConfig('300'),
    color: '#FFD60A',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 14,
    ...getInterFontConfig('200'),
    color: '#e5e5e7',
    lineHeight: 20,
  },
  titleContainer: {
    marginTop: 12,
    marginBottom: 8,
  },
  titleDisplayContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  titleEditContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  titleInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '600',
    ...getInterFontConfigForInputs('300'),
    color: '#fff',
    lineHeight: 28,
    padding: 0,
    marginRight: 8,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
  iconButton: {
    padding: 4,
    marginTop: 2,
  },
  tagsSection: {
    marginTop: 16,
    padding: 0,
    borderRadius: 12,
  },
  tagsSectionEditing: {
    backgroundColor: '#1a1a1a',
    padding: 12,
  },
  tagsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tagsSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    ...getInterFontConfig('300'),
    color: '#fff',
  },
  saveButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#34C759',
    borderRadius: 6,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    ...getInterFontConfig('300'),
    color: '#fff',
  },
  editableTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2c2c2e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
    gap: 6,
  },
  addTagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2c2c2e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  addTagInput: {
    fontSize: 16, // Prevent iOS zoom
    ...getInterFontConfigForInputs('200'),
    color: '#8e8e93',
    minWidth: 60,
    padding: 0,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
  helperText: {
    fontSize: 12,
    ...getInterFontConfig('200'),
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
});