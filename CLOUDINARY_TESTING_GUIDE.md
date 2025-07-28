# Cloudinary Thumbnail Testing Guide

## Pre-Testing Setup

### 1. Apply Database Schema
Run the schema migration to add Cloudinary fields:
```bash
# Apply to your Supabase project
npx supabase db reset --with-seed
# OR apply specific migration
cat cloudinary-thumbnail-schema.sql | npx supabase db reset --stdin
```

### 2. Set Environment Variables
Add to your `.env` file:
```
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key  
CLOUDINARY_API_SECRET=your_api_secret
```

### 3. Deploy Edge Function
```bash
npx supabase functions deploy cloudinary-thumbnails
```

## Testing Scenarios

### Test 1: Basic Thumbnail Generation
**Objective**: Verify Cloudinary can generate thumbnails from uploaded videos

**Steps**:
1. Upload a short test video (< 30 seconds, common format like MP4)
2. Check that `thumb_status` updates to 'processing'
3. Monitor logs for Cloudinary API calls
4. Verify `thumb_status` updates to 'ready' and `cloudinary_url` is populated
5. Check that thumbnail displays in VideoCard component

**Expected Result**: Real thumbnail replaces SVG placeholder

### Test 2: Error Handling
**Objective**: Verify graceful handling of failed thumbnail generation

**Steps**:
1. Upload a corrupted video file
2. Check that `thumb_status` updates to 'error'
3. Verify `thumb_error_message` contains useful error info
4. Ensure SVG placeholder is still shown

**Expected Result**: Error state handled gracefully, no crashes

### Test 3: Format Support
**Objective**: Test various video formats

**Test Videos**:
- `.mp4` (H.264) - should work
- `.mov` (QuickTime) - should work  
- `.webm` (VP8/VP9) - may work
- `.avi` (older codec) - may fail gracefully

**Expected Result**: Common formats work, unsupported formats fail gracefully

### Test 4: Cost Monitoring
**Objective**: Verify usage tracking works correctly

**Steps**:
1. Check initial usage count is 0
2. Generate 5 thumbnails
3. Verify count increases to 5
4. Check cost estimates are reasonable
5. Test monthly limit warnings

**Expected Result**: Accurate usage tracking and cost estimates

### Test 5: Real-time Updates
**Objective**: Verify UI updates as thumbnail status changes

**Steps**:
1. Upload video and immediately navigate to video list
2. Observe thumbnail placeholder shows processing spinner
3. Watch for real-time update when thumbnail ready
4. Verify thumbnail appears without page refresh

**Expected Result**: Smooth real-time UI updates

### Test 6: Large Video Handling
**Objective**: Test with larger video files

**Steps**:
1. Upload 50MB+ video file
2. Monitor processing time (should be < 2 minutes)
3. Check that signed URL doesn't expire during processing
4. Verify thumbnail quality is good

**Expected Result**: Large files processed successfully within timeout

## Debug Tools

### 1. Check Edge Function Logs
```bash
npx supabase functions logs cloudinary-thumbnails
```

### 2. Database Queries
```sql
-- Check thumbnail status for all videos
SELECT id, title, thumb_status, cloudinary_url, thumb_error_message 
FROM videos 
ORDER BY created_at DESC;

-- Reset thumbnail status for testing
UPDATE videos 
SET thumb_status = 'pending', cloudinary_url = NULL, thumb_error_message = NULL 
WHERE id = 'video_id_here';
```

### 3. Browser Console
Monitor these logs:
- `[CLOUDINARY SERVICE]` - Service calls
- `[VIDEO SERVICE DEBUG]` - Thumbnail URL resolution
- `[COST MONITOR]` - Usage tracking
- `[THUMBNAIL DEBUG]` - Image loading

### 4. Cloudinary Dashboard
Check your [Cloudinary Console](https://console.cloudinary.com/):
- Media Library → Videos folder for uploaded content
- Usage Analytics for credit consumption
- Transformations for generated thumbnails

## Common Issues & Solutions

### Issue: Edge Function Times Out
**Cause**: Large video file or slow Cloudinary processing
**Solution**: 
- Check video file size (limit to 100MB)
- Increase Edge Function timeout if needed
- Verify internet connection speed

### Issue: "Missing Cloudinary environment variables"
**Cause**: Environment variables not properly set
**Solution**:
- Verify `.env` file has correct values
- Ensure Edge Function has access to environment variables
- Redeploy Edge Function after env changes

### Issue: Signed URL Expired
**Cause**: Video processing took longer than URL expiry (1 hour)
**Solution**:
- Increase signed URL expiry time
- Implement retry logic with fresh URLs
- Check processing queue delays

### Issue: Thumbnail Not Displaying
**Cause**: CORS issues or invalid Cloudinary URL
**Solution**:
- Check browser network tab for failed requests
- Verify Cloudinary URL format is correct
- Test URL directly in browser

### Issue: Cost Monitoring Not Working
**Cause**: LocalStorage issues or browser restrictions
**Solution**:
- Check browser localStorage permissions
- Clear localStorage and test again
- Verify costMonitoring service is imported

## Performance Benchmarks

**Target Metrics**:
- Thumbnail generation: < 30 seconds for typical videos
- Cost per thumbnail: ~$0.007 (within free tier initially)
- Success rate: > 95% for common video formats
- Real-time update latency: < 5 seconds

## Rollback Plan

If issues arise, you can:

1. **Disable Cloudinary**: Set all `thumb_status` to 'error' to fallback to SVG
```sql
UPDATE videos SET thumb_status = 'error' WHERE thumb_status IN ('pending', 'processing');
```

2. **Switch back to old system**: Continue using existing SVG thumbnail generation

3. **Gradual rollout**: Only enable for new uploads while keeping existing thumbnails

## Production Deployment Checklist

- [ ] Database schema applied successfully
- [ ] Environment variables configured  
- [ ] Edge Function deployed and tested
- [ ] Cost monitoring limits set appropriately
- [ ] Error handling tested thoroughly
- [ ] Real-time updates working
- [ ] Performance meets targets
- [ ] Rollback plan documented
- [ ] Monitoring alerts configured

## Client-Side Extraction Testing (Approach C)

### Test Scenarios for HTML5 Canvas Approach

**Test 1: Basic Canvas Extraction**
**Objective**: Verify browser can extract frames from common video formats

**Steps**:
1. Upload MP4 video (H.264 codec)
2. Check if video loads in HTML5 video element
3. Verify canvas draws frame at specified time
4. Test blob conversion to JPEG
5. Verify upload to Supabase Storage

**Expected Result**: Frame extracted and uploaded successfully
**Actual Result**: ❌ Failed - Inconsistent frame extraction across browsers

**Test 2: Video Format Compatibility**
**Objective**: Test various video formats and codecs

**Test Videos**:
- `.mp4` (H.264) - ⚠️ Partial success
- `.mov` (H.264) - ❌ Failed often
- `.webm` (VP8) - ❌ Failed
- Mobile recordings - ❌ Failed (H.265/HEVC not supported)

**Test 3: Browser Compatibility**
**Browsers Tested**:
- Chrome: ⚠️ Works for some formats
- Firefox: ❌ Inconsistent seeking
- Safari: ❌ Video loading issues
- Mobile browsers: ❌ Poor compatibility

**Test 4: Memory Usage**
**Objective**: Test with large video files

**Results**:
- Files <10MB: Usually works
- Files 10-50MB: ⚠️ Inconsistent
- Files >50MB: ❌ Browser crashes/hangs

### Debug Tools for Client-Side Approach

```javascript
// Test video compatibility
const video = document.createElement('video');
video.addEventListener('canplay', () => console.log('Video can play'));
video.addEventListener('error', (e) => console.error('Video error:', e));
video.src = URL.createObjectURL(file);

// Test canvas extraction
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
video.addEventListener('seeked', () => {
  try {
    ctx.drawImage(video, 0, 0, 400, 225);
    console.log('Frame extracted successfully');
  } catch (error) {
    console.error('Canvas extraction failed:', error);
  }
});
```

### Known Issues with Client-Side Approach

1. **Video Codec Support**: HTML5 video doesn't support H.265/HEVC (common in mobile recordings)
2. **Seeking Accuracy**: `video.currentTime` doesn't always seek to exact frame
3. **CORS Issues**: Some video files trigger CORS errors in canvas
4. **Memory Leaks**: Large videos cause browser memory issues
5. **Mobile Limitations**: Poor support on mobile browsers

### Troubleshooting Client-Side Failures

**Issue**: Canvas throws "tainted canvas" error
**Solution**: Ensure video element has `crossorigin="anonymous"`

**Issue**: Video seeking not accurate
**Solution**: Use `video.seeked` event instead of `timeupdate`

**Issue**: Browser crashes with large files
**Solution**: Add file size limits (<50MB)

**Issue**: No frame extracted on mobile
**Solution**: Use different approach for mobile browsers

## Conclusion

### Status Summary
- **Cloudinary Approach**: ❌ FAILED (Environment variable issues)
- **Client-Side Approach**: ❌ FAILED (Browser compatibility)
- **Current State**: No working thumbnail solution

### Recommendations
1. **Implement FFmpeg worker** (Approach A) for reliable thumbnail generation
2. **Fix Cloudinary environment variables** as fallback option
3. **Accept SVG placeholders** as interim solution
4. **Consider alternative SaaS providers** (Mux, AWS Elemental)

**Next Steps**: Pivot to dedicated worker approach or maintain status quo with SVG placeholders.