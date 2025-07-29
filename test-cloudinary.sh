#!/bin/bash

# Test Cloudinary unsigned upload with video-thumbnails preset

echo "Testing Cloudinary unsigned upload..."
echo "Using preset: video-thumbnails"
echo ""

# Test with a small sample video
curl -X POST \
  https://api.cloudinary.com/v1_1/ddboyfn5x/video/upload \
  -F "file=https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4" \
  -F "upload_preset=video-thumbnails" \
  -F "public_id=test_video_$(date +%s)" \
  -F "resource_type=video" \
  -F "eager=so_3,w_400,h_225,c_fill,f_jpg" \
  -F "eager_async=false" \
  -v

echo ""
echo "Check the response above for errors."
echo "If successful, you should see an 'eager' array with the thumbnail URL."