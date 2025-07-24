# CreditoPro - Camera-Based Identity Verification System

A modern, step-by-step identity verification system that uses camera capture instead of file uploads. Perfect for mobile users who need to complete KYC (Know Your Customer) verification quickly and efficiently.

## Features

- **📱 Mobile-First Design**: Optimized for mobile devices with camera access
- **📸 Guided Photo Capture**: Step-by-step process with clear instructions
- **🔄 Smart Camera Switching**: Automatically switches between front and back cameras
- **🤖 AWS Rekognition Integration**: Advanced facial verification using AWS AI
- **🛡️ Identity Verification**: Automated comparison between ID photo and selfie
- **🗄️ MongoDB Integration**: Securely stores verification data in MongoDB cluster
- **🌐 Multi-Language Support**: English and Bulgarian translations
- **✅ Real-Time Validation**: Instant feedback and validation
- **🎨 Modern UI**: Beautiful, responsive interface with smooth animations

## Photo Capture Sequence

The system guides users through capturing 5 essential photos:

1. **ID Front Side** (Back Camera) - Clear photo of ID card front
2. **ID Back Side** (Back Camera) - Clear photo of ID card back
3. **Selfie with ID Front** (Front Camera) - User holding ID front side
4. **Selfie with ID Back** (Front Camera) - User holding ID back side
5. **User Selfie** (Front Camera) - Clear selfie of the user

After completing all photos, the system automatically:

- **Compares faces** between ID front photo and user selfie using AWS Rekognition
- **Verifies identity** with 80% similarity threshold
- **Enables submission** only after successful verification

## Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js, Express.js
- **Database**: MongoDB Atlas
- **AI/ML**: AWS Rekognition for facial verification
- **Camera API**: MediaDevices API with getUserMedia
- **Styling**: Custom CSS with CSS Grid and Flexbox

## Prerequisites

- Node.js (v16.0.0 or higher)
- Modern web browser with camera support
- Internet connection for MongoDB Atlas

## Installation

1. **Clone or download the project files**

   ```bash
   git clone <repository-url>
   cd verification
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment Setup**

   **AWS Configuration** (Required for identity verification):
   Create a `.env` file in the project root:

   ```env
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your_aws_access_key_id
   AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
   ```

   See [AWS_SETUP.md](AWS_SETUP.md) for detailed setup instructions.

   **Database Configuration**:
   The MongoDB connection string is already configured in `server.js`:

   ```javascript
   const MONGODB_URI =
     "mongodb+srv://dani034406:Daniel6285@cluster0.g0vqepz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
   ```

   Data is saved to the `temporary` database in the `verifications` collection.

4. **Start the server**

   ```bash
   npm start
   ```

   For development with auto-restart:

   ```bash
   npm run dev
   ```

5. **Access the application**
   Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Usage

### Step 1: Personal Information

- Fill out the personal information form with required details
- All fields are validated before proceeding

### Step 2: Photo Capture & Verification

- Follow the guided 5-photo capture process
- The system will prompt you for camera permissions
- Each photo has specific instructions and tips
- You can retake any photo if needed
- Camera automatically switches between front/back as needed
- **Automatic Verification**: After the final selfie, AWS Rekognition compares faces
- **Real-time Feedback**: Instant verification results with similarity percentage
- **Smart Retry**: Option to retake photos if verification fails

### Step 3: Complete

- Review captured photos and verification results
- Submit button is enabled only after successful identity verification
- Submit the application
- Data is saved securely to MongoDB
- Receive confirmation of successful submission

## File Structure

```
verification/
├── server.js              # Node.js server with MongoDB integration
├── package.json           # Node.js dependencies and scripts
├── verification.html      # Main verification page
├── verification.js        # Client-side JavaScript logic
├── verification-styles.css # Specific styles for verification
├── styles.css             # Global styles
├── index.html             # Landing page
├── script.js              # Landing page scripts
├── js/
│   └── translation-manager.js # Language management
└── translations/
    ├── en.json            # English translations
    └── bg.json            # Bulgarian translations
```

## AWS Rekognition Verification

The system uses AWS Rekognition to automatically verify user identity:

### Verification Process
1. **Face Detection**: Detects faces in both ID photo and selfie
2. **Feature Analysis**: Analyzes facial features and landmarks
3. **Comparison**: Compares similarity between the two faces
4. **Threshold Check**: Requires minimum 80% similarity to pass
5. **Result**: Returns verification status with confidence scores

### Verification States
- **⏳ In Progress**: Analyzing facial features and comparing images
- **✅ Success**: Identity verified (similarity ≥ 80%)
- **❌ Failed**: Faces don't match or similarity too low
- **⚠️ Error**: Technical issues (poor image quality, no face detected, etc.)

### Error Handling
- **Automatic Retry**: Option to retake photos on failure
- **Clear Feedback**: Specific error messages for different failure types
- **Quality Tips**: Guidance for better photo capture

## API Endpoints

### POST /api/verify-identity

Performs AWS Rekognition face verification.

**Request Body:**
```json
{
  "idFrontImage": "base64_string",
  "selfieOnlyImage": "base64_string"
}
```

**Response:**
```json
{
  "success": true,
  "verified": true,
  "similarity": 85.5,
  "confidence": 99.2,
  "message": "Identity verification successful"
}
```

### POST /api/submit-verification

Submits verification data to MongoDB.

**Request Body:**

```json
{
  "personalInfo": {
    "firstName": "string",
    "lastName": "string",
    "egn": "string",
    "phone": "string",
    "email": "string",
    "address": "string",
    "income": "number",
    "employment": "string"
  },
  "photos": {
    "idFront": "base64_string",
    "idBack": "base64_string",
    "selfieWithIdFront": "base64_string",
    "selfieWithIdBack": "base64_string",
    "selfieOnly": "base64_string"
  },
  "submissionDate": "ISO_string",
  "sessionId": "string"
}
```

### GET /api/verification-status/:sessionId

Retrieves verification status by session ID.

### GET /api/health

Health check endpoint.

## Database Schema

Data is stored in MongoDB with the following structure:

```javascript
{
  sessionId: "unique-session-id",
  personalInfo: {
    firstName: "John",
    lastName: "Doe",
    egn: "1234567890",
    phone: "+359888123456",
    email: "john@example.com",
    address: "123 Main St, Sofia",
    income: 2500,
    employment: "employed"
  },
  photos: {
    idFront: { data: "base64...", capturedAt: "2024-01-01T00:00:00Z" },
    idBack: { data: "base64...", capturedAt: "2024-01-01T00:00:00Z" },
    selfieWithIdFront: { data: "base64...", capturedAt: "2024-01-01T00:00:00Z" },
    selfieWithIdBack: { data: "base64...", capturedAt: "2024-01-01T00:00:00Z" },
    selfieOnly: { data: "base64...", capturedAt: "2024-01-01T00:00:00Z" }
  },
  metadata: {
    submissionDate: "2024-01-01T00:00:00Z",
    ipAddress: "127.0.0.1",
    userAgent: "Browser info",
    status: "pending",
    createdAt: "2024-01-01T00:00:00Z"
  }
}
```

## Browser Compatibility

- **Chrome/Chromium**: Full support
- **Firefox**: Full support
- **Safari**: Full support (iOS 11+)
- **Edge**: Full support

## Mobile Support

The application is optimized for mobile devices and requires:

- Camera access permissions
- Modern mobile browser
- Stable internet connection

## Security Features

- **Data Validation**: Server-side validation of all inputs
- **Secure Storage**: Photos stored as base64 in MongoDB
- **Session Management**: Unique session IDs for tracking
- **Input Sanitization**: Protection against malicious input

## Troubleshooting

### Camera Access Issues

- Ensure camera permissions are granted
- Check if other applications are using the camera
- Try refreshing the page or restarting the browser

### Connection Issues

- Verify internet connection
- Check MongoDB Atlas connectivity
- Ensure server is running on port 3000

### Photo Capture Problems

- Ensure good lighting conditions
- Hold the camera steady
- Make sure ID text is clearly readable

## Development

For development and customization:

1. **Modify Translations**: Edit files in `/translations/` folder
2. **Update Styles**: Modify `verification-styles.css` for UI changes
3. **Add Features**: Extend `verification.js` for new functionality
4. **Database Changes**: Update MongoDB schema in `server.js`

## Production Deployment

For production deployment:

1. Set up environment variables for sensitive data
2. Configure proper MongoDB Atlas security
3. Set up HTTPS with SSL certificates
4. Configure production logging
5. Set up monitoring and health checks

## Support

For issues or questions:

- 📞 Phone: 0700 12 345
- 📧 Email: info@creditopro.bg

## License

© 2024 CreditoPro. All rights reserved.
