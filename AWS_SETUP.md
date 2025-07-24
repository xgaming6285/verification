# AWS Rekognition Setup for Identity Verification

This application uses AWS Rekognition to verify user identity by comparing ID photos with selfies. Follow these steps to set up AWS Rekognition integration.

## Prerequisites

1. AWS Account with Rekognition access
2. Node.js project with AWS SDK installed

## Setup Instructions

### 1. Install Dependencies

The AWS SDK is already included in package.json. Run:

```bash
npm install
```

### 2. Create AWS IAM User

1. Go to AWS IAM Console
2. Create a new user for the application
3. Attach the following policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["rekognition:CompareFaces", "rekognition:DetectFaces"],
      "Resource": "*"
    }
  ]
}
```

### 3. Set Environment Variables

Create a `.env` file in your project root:

```env
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here

# Database Configuration
MONGODB_URI=your_mongodb_connection_string

# Server Configuration
PORT=3000
HTTPS_PORT=3443
```

### 4. AWS Regions

Recommended regions for AWS Rekognition:

- `us-east-1` (N. Virginia) - Primary
- `us-west-2` (Oregon)
- `eu-west-1` (Ireland)
- `ap-southeast-2` (Sydney)

### 5. Testing

The verification system:

1. Captures ID front photo and selfie
2. Sends both images to AWS Rekognition
3. Compares faces with 80% similarity threshold
4. Returns verification result

### 6. Error Handling

The system handles these AWS errors:

- `InvalidImageFormatException` - Unsupported image format
- `ImageTooLargeException` - Image exceeds size limits
- `AccessDenied` - Invalid credentials
- Network errors - Service unavailable

### 7. Security Notes

- Store AWS credentials securely
- Use IAM roles in production
- Limit permissions to minimum required
- Monitor AWS usage and costs

### 8. Cost Considerations

AWS Rekognition pricing (as of 2024):

- CompareFaces: $0.001 per image processed
- First 1 million images per month: $1.00
- Additional images: $0.80 per 1,000 images

### 9. Production Deployment

For production:

1. Use AWS IAM roles instead of access keys
2. Enable AWS CloudTrail logging
3. Set up monitoring and alerts
4. Implement rate limiting
5. Add image validation and resizing

## Troubleshooting

### Common Issues:

1. **Access Denied Error**

   - Verify AWS credentials
   - Check IAM permissions
   - Ensure region is correct

2. **Image Format Error**

   - Ensure images are JPEG or PNG
   - Check image size (max 15MB)
   - Validate base64 encoding

3. **No Face Detected**

   - Improve image quality
   - Ensure face is clearly visible
   - Check lighting conditions

4. **Low Similarity Score**
   - Retake photos with better quality
   - Ensure same person in both images
   - Check face orientation and position

## Support

For AWS Rekognition documentation:
https://docs.aws.amazon.com/rekognition/
