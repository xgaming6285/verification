# Fix S3 Video Access Permissions

## Problem

Users getting "Access Denied" when trying to view verification videos stored in S3 bucket `verification-form-bucket`.

## Solution 1: Update AWS IAM Policy (Recommended)

### Step 1: Update IAM User Policy

Replace your current IAM policy with this one that includes proper S3 permissions:

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

### Step 2: Update S3 Bucket Policy

1. Go to AWS S3 Console
2. Select bucket `verification-form-bucket`
3. Go to **Permissions** > **Bucket Policy**
4. Add this policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowPublicReadAccess",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::verification-form-bucket/*"
    }
  ]
}
```

### Step 3: Update CORS Configuration

In the same S3 bucket:

1. Go to **Permissions** > **Cross-origin resource sharing (CORS)**
2. Add this configuration:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
```

## Solution 2: Secure Approach with Signed URLs

For better security, create a new endpoint that generates signed URLs instead of direct S3 access.

### Add to server.js:

```javascript
// Add this endpoint after existing routes
app.get("/api/video/:sessionId/:filename", async (req, res) => {
  try {
    const { sessionId, filename } = req.params;

    // Generate signed URL valid for 1 hour
    const signedUrl = s3.getSignedUrl("getObject", {
      Bucket: SESSION_RECORDING_BUCKET,
      Key: `${sessionId}/${filename}`,
      Expires: 3600, // 1 hour
    });

    res.json({
      success: true,
      url: signedUrl,
    });
  } catch (error) {
    console.error("Error generating signed URL:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate video URL",
    });
  }
});
```

## Quick Test

After applying the changes, test access:

```bash
# Replace with your actual S3 object URL
curl -I "https://verification-form-bucket.s3.amazonaws.com/[session-id]/[video-file].webm"
```

Should return `200 OK` instead of `403 Forbidden`.

## Security Notes

- **Option 1** makes videos publicly accessible (anyone with URL can view)
- **Option 2** provides time-limited access with signed URLs (more secure)
- Consider implementing Option 2 for production environments

## Estimated Time to Fix

- **Option 1:** 5-10 minutes
- **Option 2:** 15-20 minutes (requires code deployment)

Choose Option 1 for immediate fix, Option 2 for better security.
