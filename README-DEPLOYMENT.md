# CreditoPro Verification - Deployment Guide

## 🚀 Quick Deploy to Render

### Prerequisites

1. GitHub repository for this verification app
2. MongoDB Atlas account
3. AWS account with Rekognition access
4. Render account

### Step 1: Prepare Repository

Ensure your verification folder is in its own Git repository:

```bash
cd verification/
git init
git add .
git commit -m "Initial verification app commit"
git remote add origin <your-github-repo-url>
git push -u origin main
```

### Step 2: Environment Variables Setup

You need to set these **sensitive environment variables** in Render dashboard:

#### Required Variables:

- `MONGODB_URI` - Your MongoDB connection string
- `AWS_ACCESS_KEY_ID` - AWS access key for Rekognition
- `AWS_SECRET_ACCESS_KEY` - AWS secret key for Rekognition
- `AWS_REGION` - AWS region (default: us-east-1)
- `NODE_ENV` - Set to "production"

#### Current Hardcoded Values (UPDATE THESE!):

- MongoDB: `mongodb+srv://dani034406:Daniel6285@cluster0.g0vqepz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`
- AWS Key: `AKIAWR2VGD2QWZOJIGPD`
- AWS Secret: `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`

### Step 3: Deploy to Render

1. **Connect Repository:**

   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click "New" → "Web Service"
   - Connect your GitHub repository

2. **Configure Service:**

   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Auto-Deploy:** Yes

3. **Set Environment Variables:**
   In Render dashboard, add all the required environment variables listed above.

4. **Deploy:**
   - Click "Create Web Service"
   - Render will automatically deploy your app

### Step 4: Post-Deployment Configuration

#### SSL/HTTPS Setup:

- Render provides automatic HTTPS
- Remove self-signed certificate generation for production
- Camera functionality will work properly with Render's SSL

#### Domain Setup:

- Use Render's provided domain: `https://your-app-name.onrender.com`
- Or configure custom domain in Render dashboard

### Step 5: Testing

1. **Basic Health Check:**

   ```
   curl https://your-app-name.onrender.com/
   ```

2. **Camera Access:**
   - Test on mobile devices with HTTPS
   - Verify face detection works
   - Test ID verification flow

### Step 6: Security Considerations

1. **AWS IAM Permissions:**
   Create minimal IAM policy:

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
         "Action": ["s3:PutObject", "s3:GetObject"],
         "Resource": "arn:aws:s3:::verification-form-bucket/*"
       }
     ]
   }
   ```

2. **MongoDB Security:**

   - Use MongoDB Atlas with IP whitelist
   - Enable authentication
   - Use strong passwords

3. **Rate Limiting:**
   Consider adding rate limiting for verification endpoints

### Step 7: Monitoring

1. **Render Logs:**

   - Monitor deployment logs in Render dashboard
   - Set up log alerts for errors

2. **AWS Costs:**
   - Monitor Rekognition usage
   - Set up billing alerts

### Troubleshooting

#### Common Issues:

1. **Camera not working:**

   - Ensure HTTPS is properly configured
   - Check browser permissions

2. **AWS Rekognition errors:**

   - Verify credentials and permissions
   - Check AWS region configuration

3. **MongoDB connection issues:**

   - Verify connection string
   - Check IP whitelist in MongoDB Atlas

4. **Build failures:**
   - Check Node.js version compatibility
   - Verify all dependencies in package.json

### Cost Estimates

- **Render:** $7/month for basic web service
- **MongoDB Atlas:** Free tier available (512MB)
- **AWS Rekognition:** ~$1-2/month for moderate usage

### Support

For deployment issues:

- Render Docs: https://render.com/docs
- AWS Rekognition: https://docs.aws.amazon.com/rekognition/
- MongoDB Atlas: https://docs.atlas.mongodb.com/
