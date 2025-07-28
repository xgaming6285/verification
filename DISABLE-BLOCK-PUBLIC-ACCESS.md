# Alternative: Disable Block Public Access (Not Recommended)

## ⚠️ Warning

This makes your S3 bucket publicly accessible. Use only if you understand the security implications.

## Steps to Disable Block Public Access

### Option A: For This Specific Bucket Only

1. **Go to AWS S3 Console**
2. **Select your bucket**: `verification-form-bucket`
3. **Click "Permissions" tab**
4. **Find "Block public access (bucket settings)"**
5. **Click "Edit"**
6. **Uncheck these options:**

   - ❌ Block public access to buckets and objects granted through new access control lists (ACLs)
   - ❌ Block public access to buckets and objects granted through any access control lists (ACLs)
   - ❌ Block public access to buckets and objects granted through new public bucket or access point policies
   - ❌ Block public access to buckets and objects granted through any public bucket or access point policies

7. **Click "Save changes"**
8. **Type "confirm" when prompted**

### Option B: For Your Entire AWS Account (Not Recommended)

1. **Go to AWS S3 Console**
2. **Click "Block Public Access settings for this account"** (left sidebar)
3. **Click "Edit"**
4. **Uncheck the same options as above**
5. **Save changes**

## Then Apply the Bucket Policy

After disabling Block Public Access, you can apply the bucket policy:

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

## Security Implications

❌ **Videos become publicly accessible** to anyone with the URL  
❌ **No access control** or expiration  
❌ **Potential data exposure** if URLs are leaked  
❌ **Not compliant** with many security standards

## ✅ Better Alternative

Use the **Signed URL approach** instead (see SECURE-VIDEO-ACCESS.md) - it's more secure and doesn't require disabling AWS security features.

## Quick Decision Guide

- **Need it working in 2 minutes?** → Disable Block Public Access
- **Want proper security?** → Use Signed URLs (recommended)
- **Production environment?** → Definitely use Signed URLs
