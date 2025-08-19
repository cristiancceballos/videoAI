# Public Feed Feature Design Document

## Social Video Sharing Platform Evolution

### Executive Summary
Transform VideoAI from a personal video management tool into a social knowledge-sharing platform with public/private feeds, allowing users to discover and save content from the community while maintaining their private library.

---

## Feature Overview

### Core Concept
- **Private Feed**: Personal video library (current functionality)
- **Public Feed**: Community-shared videos (TikTok-style discovery)
- **Save Mechanism**: Add public videos to personal library
- **Privacy Control**: Choose visibility during upload

### User Value Proposition
- **Content Creators**: Share knowledge, build audience
- **Content Consumers**: Discover curated, AI-tagged content
- **Knowledge Workers**: Build personal knowledge base from community

---

## Technical Architecture

### Database Schema

#### 1. Videos Table Modifications
```sql
ALTER TABLE videos ADD COLUMN visibility TEXT DEFAULT 'private' 
  CHECK (visibility IN ('private', 'public'));
ALTER TABLE videos ADD COLUMN original_owner_id UUID REFERENCES auth.users(id);
ALTER TABLE videos ADD COLUMN is_saved BOOLEAN DEFAULT false;
ALTER TABLE videos ADD COLUMN view_count INTEGER DEFAULT 0;
ALTER TABLE videos ADD COLUMN save_count INTEGER DEFAULT 0;

-- Index for performance
CREATE INDEX idx_videos_visibility ON videos(visibility);
CREATE INDEX idx_videos_public_recent ON videos(created_at DESC) 
  WHERE visibility = 'public';
```

#### 2. Saved Videos (Many-to-Many)
```sql
CREATE TABLE saved_videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  original_video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  saved_video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, original_video_id)
);

CREATE INDEX idx_saved_videos_user ON saved_videos(user_id);
```

#### 3. Video Interactions
```sql
CREATE TABLE video_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  interaction_type TEXT CHECK (interaction_type IN ('view', 'like', 'save', 'report')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, video_id, interaction_type)
);

CREATE INDEX idx_interactions_video ON video_interactions(video_id);
CREATE INDEX idx_interactions_user ON video_interactions(user_id);
```

#### 4. User Profiles (Public Information)
```sql
CREATE TABLE public_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  public_video_count INTEGER DEFAULT 0,
  follower_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_username ON public_profiles(username);
```

### Row Level Security (RLS) Policies

```sql
-- Public videos visible to all authenticated users
CREATE POLICY "Public videos are viewable by all" ON videos
  FOR SELECT USING (
    visibility = 'public' OR 
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM saved_videos 
      WHERE saved_video_id = videos.id 
      AND user_id = auth.uid()
    )
  );

-- Users can only modify their own videos
CREATE POLICY "Users can update own videos" ON videos
  FOR UPDATE USING (auth.uid() = user_id);

-- Private videos only visible to owner
CREATE POLICY "Private videos only for owner" ON videos
  FOR SELECT USING (
    visibility = 'private' AND auth.uid() = user_id
  );
```

---

## User Interface Design

### Upload Flow Enhancement

```typescript
// UploadScreen additions
interface UploadOptions {
  visibility: 'private' | 'public';
  allowSave: boolean;
  allowComments: boolean;
}

<View style={styles.visibilitySection}>
  <Text style={styles.sectionTitle}>Who can see this video?</Text>
  
  <TouchableOpacity 
    style={[styles.option, visibility === 'private' && styles.selected]}
    onPress={() => setVisibility('private')}
  >
    <Lock size={20} color={visibility === 'private' ? '#007AFF' : '#666'} />
    <View style={styles.optionText}>
      <Text style={styles.optionTitle}>Private</Text>
      <Text style={styles.optionDescription}>Only you can see this video</Text>
    </View>
  </TouchableOpacity>
  
  <TouchableOpacity 
    style={[styles.option, visibility === 'public' && styles.selected]}
    onPress={() => setVisibility('public')}
  >
    <Globe size={20} color={visibility === 'public' ? '#007AFF' : '#666'} />
    <View style={styles.optionText}>
      <Text style={styles.optionTitle}>Public</Text>
      <Text style={styles.optionDescription}>Share with the VideoAI community</Text>
    </View>
  </TouchableOpacity>
</View>
```

### Navigation Structure

```typescript
// Bottom Tab Navigator
<Tab.Navigator>
  <Tab.Screen name="Home" component={HomeScreen} />       // Private feed
  <Tab.Screen name="Discover" component={DiscoverScreen} /> // Public feed
  <Tab.Screen name="Upload" component={UploadScreen} />
  <Tab.Screen name="Search" component={SearchScreen} />
  <Tab.Screen name="Profile" component={ProfileScreen} />
</Tab.Navigator>
```

### Discover Feed (Public)

```typescript
// DiscoverScreen.tsx
const DiscoverScreen = () => {
  const [publicVideos, setPublicVideos] = useState<Video[]>([]);
  const [algorithm, setAlgorithm] = useState<'trending' | 'recent' | 'personalized'>('trending');
  
  const loadPublicVideos = async () => {
    let query = supabase
      .from('videos')
      .select(`
        *,
        profiles:user_id (username, avatar_url),
        interactions:video_interactions(count)
      `)
      .eq('visibility', 'public');
    
    switch(algorithm) {
      case 'trending':
        // Last 7 days, ordered by interaction count
        query = query
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .order('interactions.count', { ascending: false });
        break;
      case 'recent':
        query = query.order('created_at', { ascending: false });
        break;
      case 'personalized':
        // Based on user's saved videos tags
        const userTags = await getUserPreferredTags();
        query = query.contains('tags', userTags);
        break;
    }
    
    const { data } = await query.limit(20);
    setPublicVideos(data);
  };
  
  return (
    <FlatList
      data={publicVideos}
      renderItem={({ item }) => (
        <PublicVideoCard 
          video={item}
          onSave={handleSaveVideo}
          onLike={handleLikeVideo}
        />
      )}
      onRefresh={loadPublicVideos}
    />
  );
};
```

### Save to Library Flow

```typescript
const handleSaveVideo = async (publicVideo: Video) => {
  try {
    // Step 1: Check if already saved
    const { data: existing } = await supabase
      .from('saved_videos')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('original_video_id', publicVideo.id)
      .single();
    
    if (existing) {
      Alert.alert('Already Saved', 'This video is already in your library');
      return;
    }
    
    // Step 2: Create a copy in user's library
    const videoCopy = {
      ...publicVideo,
      id: undefined, // Generate new ID
      user_id: currentUser.id,
      original_owner_id: publicVideo.user_id,
      visibility: 'private', // Saved videos are always private
      is_saved: true,
      // Preserve AI data
      tags: publicVideo.tags,
      ai_status: 'completed',
      created_at: new Date().toISOString()
    };
    
    const { data: newVideo, error } = await supabase
      .from('videos')
      .insert(videoCopy)
      .single();
    
    if (error) throw error;
    
    // Step 3: Create saved_videos reference
    await supabase
      .from('saved_videos')
      .insert({
        user_id: currentUser.id,
        original_video_id: publicVideo.id,
        saved_video_id: newVideo.id
      });
    
    // Step 4: Update interaction
    await supabase
      .from('video_interactions')
      .insert({
        user_id: currentUser.id,
        video_id: publicVideo.id,
        interaction_type: 'save'
      });
    
    // Step 5: Show success
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast('Video saved to your library! 📚');
    
  } catch (error) {
    Alert.alert('Error', 'Failed to save video');
  }
};
```

### Video Attribution

```typescript
// Display saved video with attribution
const VideoCard = ({ video }) => {
  return (
    <View style={styles.videoCard}>
      {video.is_saved && video.original_owner_id && (
        <View style={styles.attribution}>
          <Text style={styles.savedFromText}>
            Saved from @{video.original_owner?.username}
          </Text>
          <TouchableOpacity onPress={() => navigateToOriginal(video.original_video_id)}>
            <Text style={styles.viewOriginal}>View Original</Text>
          </TouchableOpacity>
        </View>
      )}
      {/* Rest of video card */}
    </View>
  );
};
```

---

## Discovery Algorithm

### Trending Algorithm
```sql
-- Get trending videos from last 7 days
WITH video_scores AS (
  SELECT 
    v.id,
    v.*,
    COUNT(DISTINCT CASE WHEN vi.interaction_type = 'view' THEN vi.user_id END) as view_count,
    COUNT(DISTINCT CASE WHEN vi.interaction_type = 'like' THEN vi.user_id END) as like_count,
    COUNT(DISTINCT CASE WHEN vi.interaction_type = 'save' THEN vi.user_id END) as save_count,
    -- Calculate engagement score
    (
      COUNT(DISTINCT CASE WHEN vi.interaction_type = 'view' THEN vi.user_id END) * 1 +
      COUNT(DISTINCT CASE WHEN vi.interaction_type = 'like' THEN vi.user_id END) * 3 +
      COUNT(DISTINCT CASE WHEN vi.interaction_type = 'save' THEN vi.user_id END) * 5
    ) as engagement_score,
    -- Time decay factor (newer = higher score)
    EXTRACT(EPOCH FROM (NOW() - v.created_at)) / 3600 as hours_old
  FROM videos v
  LEFT JOIN video_interactions vi ON v.id = vi.video_id
  WHERE v.visibility = 'public'
    AND v.created_at > NOW() - INTERVAL '7 days'
  GROUP BY v.id
)
SELECT *,
  -- Final score with time decay
  engagement_score * POWER(0.95, hours_old / 24) as final_score
FROM video_scores
ORDER BY final_score DESC
LIMIT 50;
```

### Personalized Recommendations
```typescript
const getPersonalizedFeed = async (userId: string) => {
  // Get user's interaction history
  const { data: userInteractions } = await supabase
    .from('video_interactions')
    .select('video_id, videos(tags)')
    .eq('user_id', userId)
    .in('interaction_type', ['like', 'save']);
  
  // Extract preferred tags
  const tagFrequency = {};
  userInteractions.forEach(interaction => {
    interaction.videos.tags?.forEach(tag => {
      tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
    });
  });
  
  // Get top tags
  const preferredTags = Object.entries(tagFrequency)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([tag]) => tag);
  
  // Fetch videos with similar tags
  const { data: recommendations } = await supabase
    .from('videos')
    .select('*')
    .eq('visibility', 'public')
    .contains('tags', preferredTags)
    .neq('user_id', userId) // Don't show own videos
    .limit(50);
  
  return recommendations;
};
```

---

## Content Moderation

### Automated Screening
```typescript
// Using Google Cloud Vision API for content moderation
import { ImageAnnotatorClient } from '@google-cloud/vision';

const moderateVideo = async (videoThumbnail: string) => {
  const client = new ImageAnnotatorClient();
  
  const [result] = await client.safeSearchDetection(videoThumbnail);
  const detections = result.safeSearchAnnotation;
  
  // Check for inappropriate content
  if (
    detections.adult === 'VERY_LIKELY' ||
    detections.violence === 'VERY_LIKELY' ||
    detections.racy === 'VERY_LIKELY'
  ) {
    return { approved: false, reason: 'Content violates community guidelines' };
  }
  
  return { approved: true };
};
```

### User Reporting
```typescript
const reportVideo = async (videoId: string, reason: string) => {
  await supabase
    .from('content_reports')
    .insert({
      video_id: videoId,
      reporter_id: currentUser.id,
      reason,
      status: 'pending'
    });
  
  // Auto-hide after threshold
  const { count } = await supabase
    .from('content_reports')
    .select('id', { count: 'exact' })
    .eq('video_id', videoId);
  
  if (count >= 5) {
    // Temporarily hide video pending review
    await supabase
      .from('videos')
      .update({ visibility: 'under_review' })
      .eq('id', videoId);
  }
};
```

---

## Privacy & Security

### Data Protection
1. **Saved Video Isolation**
   - Saved copies are completely private
   - Original owner cannot see who saved
   - No access to saveers' libraries

2. **User Controls**
   ```typescript
   // Privacy settings
   interface PrivacySettings {
     allowSaves: boolean;        // Can others save my public videos?
     showSaveCount: boolean;      // Display save count publicly?
     allowTagSuggestions: boolean; // Let others suggest tags?
   }
   ```

3. **Content Ownership**
   - Original creator attribution required
   - DMCA takedown process
   - Watermark option for creators

### Security Measures
```sql
-- Prevent data leaks with RLS
CREATE POLICY "Users cannot see others' private videos" ON videos
  FOR SELECT USING (
    visibility = 'public' OR 
    auth.uid() = user_id
  );

-- Audit trail for public videos
CREATE TABLE video_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID REFERENCES videos(id),
  action TEXT, -- 'made_public', 'made_private', 'deleted'
  user_id UUID REFERENCES auth.users(id),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  previous_state JSONB,
  new_state JSONB
);
```

---

## Potential Pitfalls & Mitigation

### 1. Storage Costs
**Problem**: Duplicating videos for each save
**Solution**: 
- Reference original file URL instead of copying
- Use CDN for public videos
- Implement storage quotas per user

```typescript
// Reference-based saving
const saveVideoReference = async (originalVideo: Video) => {
  // Don't copy file, just metadata
  const reference = {
    ...originalVideo,
    id: undefined,
    user_id: currentUser.id,
    storage_path: originalVideo.storage_path, // Same file
    is_reference: true
  };
};
```

### 2. Content Quality
**Problem**: Low-quality or spam content
**Solution**:
- Minimum AI confidence score for public videos
- Community voting system
- Verified creator badges

### 3. Performance at Scale
**Problem**: Feed loading slowly
**Solution**:
- Implement cursor-based pagination
- Pre-generate feed cache
- CDN for popular content
- Database read replicas

### 4. Legal Compliance
**Problem**: Copyright, GDPR, content laws
**Solution**:
- Clear Terms of Service
- DMCA process
- Data export/deletion tools
- Age verification

---

## Monetization Opportunities

### Freemium Model
```typescript
interface PremiumFeatures {
  unlimitedSaves: boolean;      // Free: 10/month
  advancedAnalytics: boolean;   // See who viewed/saved
  noAds: boolean;               // Remove feed ads
  longerVideos: boolean;        // 5min vs 1min
  priorityProcessing: boolean;  // Faster AI analysis
  customWatermark: boolean;     // Brand videos
}
```

### Creator Economy
- Creator Fund (share ad revenue)
- Tipping/Donations
- Sponsored content tags
- Premium content gates

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Database schema updates
- [ ] RLS policies
- [ ] Basic visibility toggle
- [ ] Public profile creation

### Phase 2: Discovery Feed (Week 3-4)
- [ ] Discover screen UI
- [ ] Trending algorithm
- [ ] Infinite scroll
- [ ] Basic interactions (view, like)

### Phase 3: Save Functionality (Week 5)
- [ ] Save to library flow
- [ ] Attribution system
- [ ] Saved videos management
- [ ] Storage optimization

### Phase 4: Social Features (Week 6-7)
- [ ] User profiles
- [ ] Following system
- [ ] Comments (optional)
- [ ] Share functionality

### Phase 5: Moderation & Safety (Week 8)
- [ ] Content reporting
- [ ] Automated screening
- [ ] Admin dashboard
- [ ] User blocking

### Phase 6: Polish & Launch (Week 9-10)
- [ ] Performance optimization
- [ ] Analytics integration
- [ ] A/B testing
- [ ] Gradual rollout

---

## Success Metrics

### User Engagement
- Daily Active Users (DAU)
- Videos uploaded per day
- Save rate (saves/views)
- Retention (Day 1, 7, 30)

### Content Quality
- Average AI confidence score
- Report rate
- Creator diversity
- Tag accuracy

### Platform Health
- Upload success rate
- Processing time
- Feed load time
- Storage efficiency

---

## Conclusion

The public feed feature transforms VideoAI into a knowledge-sharing platform while preserving its core value as a personal video organizer. The key is balancing:

1. **Privacy** - Users control their content visibility
2. **Discovery** - Relevant content surfaces naturally
3. **Attribution** - Creators get recognition
4. **Safety** - Community stays positive

This evolution positions VideoAI as unique in the market: the only video platform that combines AI-powered organization with social discovery, perfect for knowledge workers and content creators alike.