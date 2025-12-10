# AWS S3 Setup Guide for CreditoPro Verification

This guide will help you set up a new AWS S3 bucket for storing session recording videos.

## 📋 Summary of Changes

The application has been updated to:
- Use environment variables for AWS region and bucket name
- Default to `eu-north-1` (Stockholm) region
- Read bucket name from `S3_BUCKET_NAME` environment variable

## 🚀 Step-by-Step Setup

### 1. Create a New S3 Bucket

1. **Log in to AWS Console**
   - Go to: https://console.aws.amazon.com/
   - Navigate to S3 service

2. **Create Bucket**
   - Click "Create bucket"
   - **Bucket name**: Choose a globally unique name (e.g., `creditopro-verification-sessions-2025`)
   - **Region**: Select **EU (Stockholm) eu-north-1**
   
3. **Configure Bucket Settings**
   - ✅ **Object Ownership**: ACLs disabled (recommended)
   - ✅ **Block Public Access**: Keep all 4 boxes checked (recommended for security)
   - ✅ **Bucket Versioning**: Optional (Enable if you want version history)
   - ✅ **Encryption**: Enable Server-side encryption with Amazon S3 managed keys (SSE-S3)
   - ✅ **Object Lock**: Disabled (unless you need compliance features)
   
4. **Click "Create bucket"**

### 2. Set Up CORS Configuration (If Needed)

If your frontend needs to upload directly to S3, configure CORS:

1. Go to your bucket → Permissions tab
2. Scroll to "Cross-origin resource sharing (CORS)"
3. Click "Edit" and add:

```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "PUT",
            "POST",
            "GET"
        ],
        "AllowedOrigins": [
            "https://ftd-copy-g4r6.vercel.app",
            "https://www.ftdm2.com",
            "https://ftd-backend-xjbf.onrender.com",
            "http://localhost:3000",
            "https://ftd-copy.onrender.com",
            "http://localhost:5173"
        ],
        "ExposeHeaders": [
            "ETag"
        ],
        "MaxAgeSeconds": 3000
    }
]
```

### 3. Create IAM User with S3 Access

1. **Navigate to IAM**
   - Go to IAM Console: https://console.aws.amazon.com/iam/
   - Click "Users" → "Create user"

2. **Create User**
   - **Username**: `creditopro-verification-s3-user`
   - **AWS Management Console access**: Not needed (unless you want it)
   - Click "Next"

3. **Set Permissions**
   - Choose "Attach policies directly"
   - Search and select:
     - `AmazonS3FullAccess` (or create a custom policy for your specific bucket)
     - `AmazonRekognitionFullAccess` (if using face recognition features)
   - Click "Next" → "Create user"

4. **Create Access Key**
   - Click on the newly created user
   - Go to "Security credentials" tab
   - Scroll to "Access keys"
   - Click "Create access key"
   - Choose "Application running outside AWS"
   - Add description tag (optional): "CreditoPro Verification App"
   - Click "Create access key"
   - **⚠️ IMPORTANT**: Copy both the Access Key ID and Secret Access Key
   - **You can only see the secret once!**

### 4. Update Your Local .env File

Create or update your `.env` file in the project root:

```bash
# MongoDB Configuration
MONGODB_URI=mongodb+srv://your-connection-string

# AWS Credentials (NEW)
AWS_ACCESS_KEY_ID=AKIA...your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key_here
AWS_REGION=eu-north-1

# S3 Bucket Name (NEW)
S3_BUCKET_NAME=creditopro-verification-sessions-2025

# Server Configuration
PORT=3000
HTTPS_PORT=3443
NODE_ENV=development
```

### 5. Update Your Render.com Deployment

If you're using Render.com for deployment:

1. Go to your Render.com dashboard
2. Select your service: `creditopro-verification`
3. Go to "Environment" tab
4. Add/Update these environment variables:
   - `AWS_ACCESS_KEY_ID`: Your new access key
   - `AWS_SECRET_ACCESS_KEY`: Your new secret key
   - `AWS_REGION`: `eu-north-1`
   - `S3_BUCKET_NAME`: Your new bucket name
   - `MONGODB_URI`: Your MongoDB connection string

5. Save changes (Render will automatically redeploy)

## 🔒 Security Best Practices

1. **Never commit .env files to Git**
   - The `.env` file should be in `.gitignore`
   - Use `.env.example` as a template without real credentials

2. **Use IAM policies with least privilege**
   - Instead of `AmazonS3FullAccess`, consider creating a custom policy:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::your-bucket-name/*",
                "arn:aws:s3:::your-bucket-name"
            ]
        }
    ]
}
```

3. **Rotate credentials regularly**
   - Change access keys every 90 days
   - Delete old keys after rotation

4. **Enable MFA for AWS Console access**
   - Adds an extra layer of security

## 🧪 Testing

After setup, test the configuration:

1. Start your local server:
   ```bash
   npm start
   ```

2. Access the verification page
3. Complete a verification with video recording
4. Check your S3 bucket to confirm the video was uploaded

## 📝 Important Notes

### Region Compatibility

- **eu-north-1 (Stockholm)**: Supports S3 and most AWS services
- **AWS Rekognition**: Available in eu-north-1 ✅
- The app now uses the same region for both S3 and Rekognition

### Previous Configuration

The previous setup used:
- Region: `eu-west-1` (Ireland)
- Bucket: `verification-form-bucket`

The new configuration is fully backward compatible and uses environment variables for flexibility.

## 🆘 Troubleshooting

### Problem: "Access Denied" errors
**Solution**: Verify IAM user has correct permissions and credentials are correct in .env file

### Problem: "Bucket not found"
**Solution**: Ensure bucket name in `S3_BUCKET_NAME` matches exactly (case-sensitive)

### Problem: "Region mismatch"
**Solution**: Ensure `AWS_REGION` matches the region where you created your bucket

### Problem: "CORS errors" (if uploading from browser)
**Solution**: Configure CORS policy on your S3 bucket (see step 2)

## 📞 Support

If you encounter issues:
1. Check AWS CloudWatch logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test AWS credentials using AWS CLI: `aws s3 ls s3://your-bucket-name`

---

**Last Updated**: November 2025
**App Version**: 1.0.0


