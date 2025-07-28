# Secure Video Access Solution (No Public Bucket Required)

## Problem Solved

AWS Block Public Access is preventing public bucket policy. This is actually better for security!

## ✅ Recommended Solution: Use Signed URLs Only

Since you already have the signed URL endpoint added to your server.js, here's how to implement it:

### Step 1: Keep Your Current IAM Policy

Your IAM user only needs these S3 permissions (no public access required):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["rekognition:CompareFaces", "rekognition:DetectFaces"],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:GetObjectAcl",
        "s3:PutObjectAcl",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::verification-form-bucket/*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": "arn:aws:s3:::verification-form-bucket"
    }
  ]
}
```

### Step 2: Update Your Frontend Code

You need to modify how videos are displayed to use the signed URL endpoint instead of direct S3 URLs.

#### In your lead management interface, change video links to:

```javascript
// Instead of using direct S3 URL like:
// https://verification-form-bucket.s3.amazonaws.com/sessionId/video.webm

// Use your secure endpoint:
// /api/video/sessionId/video.webm

async function displayVideo(sessionId, filename) {
  try {
    const response = await fetch(`/api/video/${sessionId}/${filename}`);
    const data = await response.json();

    if (data.success) {
      // Use the signed URL for the video
      const videoElement = document.getElementById("video-player");
      videoElement.src = data.url;
    } else {
      console.error("Failed to get video URL:", data.error);
    }
  } catch (error) {
    console.error("Error fetching video:", error);
  }
}
```

### Step 3: Deploy the Updated Code

```bash
cd verification/
git add .
git commit -m "Add secure video access with signed URLs"
git push
```

Your Render deployment will automatically update.

### Step 4: Test

1. Deploy the changes
2. Try viewing a video in your admin panel
3. The URL will now be generated securely server-side

## Benefits of This Approach

✅ **More Secure**: Videos not publicly accessible  
✅ **Time-limited Access**: URLs expire after 1 hour  
✅ **No AWS Block Public Access conflicts**  
✅ **Better compliance** with security best practices  
✅ **Audit trail**: Server logs all video access requests

## How It Works

1. Frontend requests video: `GET /api/video/sessionId/filename`
2. Server validates request and generates signed S3 URL
3. Signed URL valid for 1 hour only
4. Video plays normally but with secure access

This is actually **better security** than the public bucket approach!
