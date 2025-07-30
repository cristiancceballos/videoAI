# Vercel Environment Variables Setup

To make Bunny.net work in production, you need to add the following environment variables to your Vercel project:

## Steps:

1. Go to your Vercel dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Add these variables for Production:

```
EXPO_PUBLIC_BUNNY_STREAM_LIBRARY_ID=your_library_id
EXPO_PUBLIC_BUNNY_STREAM_API_KEY=your_api_key
EXPO_PUBLIC_BUNNY_STREAM_CDN_HOSTNAME=your_cdn_hostname
```

## Important Notes:

- The `EXPO_PUBLIC_` prefix is required for Expo web to expose these variables to the client
- Make sure there are no quotes around the values
- Double-check there are no trailing spaces
- After adding, you need to redeploy for changes to take effect

## Example Values:
```
EXPO_PUBLIC_BUNNY_STREAM_LIBRARY_ID=123456
EXPO_PUBLIC_BUNNY_STREAM_API_KEY=12345678-1234-1234-1234-123456789012
EXPO_PUBLIC_BUNNY_STREAM_CDN_HOSTNAME=vz-12345678.b-cdn.net
```

## Verification:

After deployment, check the browser console for the debug logs:
```
[BUNNY DEBUG] Environment variables: {
  BUNNY_STREAM_LIBRARY_ID: 'Set',
  BUNNY_STREAM_API_KEY: 'Set',
  BUNNY_STREAM_CDN_HOSTNAME: 'Set',
  ...
}
```

If you see "Not set" for any variable, the environment variables are not configured correctly in Vercel.