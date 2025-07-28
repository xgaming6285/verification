require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
const path = require("path");
const https = require("https");
const fs = require("fs");
const os = require("os");
const AWS = require("aws-sdk");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

// MongoDB connection string
const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://dani034406:Daniel6285@cluster0.g0vqepz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const DATABASE_NAME = "temporary";
const COLLECTION_NAME = "verifications";

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" })); // Increased limit for base64 images
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve static files
app.use(express.static("."));

// MongoDB client
let client;
let db;

// AWS configuration - use environment variables for security
AWS.config.update({
  region: process.env.AWS_REGION || "us-east-1",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const rekognition = new AWS.Rekognition();
const s3 = new AWS.S3();

// S3 bucket configuration for session recordings
const SESSION_RECORDING_BUCKET = "verification-form-bucket";

// Multer configuration for handling video uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for video files
  },
  fileFilter: (req, file, cb) => {
    // Accept video files
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed"), false);
    }
  },
});

// Initialize MongoDB connection
async function initializeDatabase() {
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(DATABASE_NAME);
    console.log("✅ Connected to MongoDB - Database:", DATABASE_NAME);
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
}

// Generate self-signed certificate for HTTPS
function generateSelfSignedCert() {
  const certDir = path.join(__dirname, "certs");
  const certPath = path.join(certDir, "server.crt");
  const keyPath = path.join(certDir, "server.key");

  // Create certs directory if it doesn't exist
  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir);
  }

  // Check if certificates already exist
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    console.log("📜 Using existing SSL certificates");
    return { certPath, keyPath };
  }

  try {
    console.log("📜 Generating self-signed SSL certificate...");

    // Use selfsigned library to generate certificate
    const selfsigned = require("selfsigned");
    const attrs = [
      { name: "countryName", value: "BG" },
      { name: "stateOrProvinceName", value: "Sofia" },
      { name: "localityName", value: "Sofia" },
      { name: "organizationName", value: "CreditoPro" },
      { name: "commonName", value: "localhost" },
    ];

    const pems = selfsigned.generate(attrs, {
      keySize: 2048,
      days: 365,
      algorithm: "sha256",
      extensions: [
        {
          name: "basicConstraints",
          cA: false,
        },
        {
          name: "keyUsage",
          keyCertSign: false,
          digitalSignature: true,
          nonRepudiation: false,
          keyEncipherment: true,
          dataEncipherment: false,
        },
        {
          name: "extKeyUsage",
          serverAuth: true,
          clientAuth: false,
          codeSigning: false,
          emailProtection: false,
          timeStamping: false,
        },
        {
          name: "subjectAltName",
          altNames: [
            {
              type: 2, // DNS
              value: "localhost",
            },
            {
              type: 7, // IP
              ip: "127.0.0.1",
            },
            {
              type: 7, // IP
              ip: "::1",
            },
          ],
        },
      ],
    });

    // Save certificate and key to files
    fs.writeFileSync(certPath, pems.cert);
    fs.writeFileSync(keyPath, pems.private);

    console.log("✅ SSL certificate generated successfully");
    return { certPath, keyPath };
  } catch (error) {
    console.warn("⚠️ Could not generate SSL certificate:", error.message);
    console.warn(
      "📥 Falling back to HTTP only (camera may not work on mobile)..."
    );
    return null;
  }
}

// Get local IP addresses
function getLocalIPAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip over internal (i.e. 127.0.0.1) and non-IPv4 addresses
      if (iface.family === "IPv4" && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }

  return addresses;
}

// Helper function to convert base64 image to buffer
function base64ToBuffer(base64String) {
  // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
  const base64Data = base64String.replace(/^data:image\/[a-z]+;base64,/, "");
  return Buffer.from(base64Data, "base64");
}

// API endpoint for AWS Rekognition face verification
app.post("/api/verify-identity", async (req, res) => {
  try {
    const { idFrontImage, selfieOnlyImage } = req.body;

    // Validate required images
    if (!idFrontImage || !selfieOnlyImage) {
      return res.status(400).json({
        success: false,
        error: "Both ID front image and selfie image are required",
      });
    }

    // Convert base64 images to buffers
    const idFrontBuffer = base64ToBuffer(idFrontImage);
    const selfieBuffer = base64ToBuffer(selfieOnlyImage);

    // AWS Rekognition parameters for face comparison
    const params = {
      SourceImage: {
        Bytes: selfieBuffer, // The selfie is the source
      },
      TargetImage: {
        Bytes: idFrontBuffer, // The ID photo is the target
      },
      SimilarityThreshold: 80, // Minimum similarity threshold (80%)
    };

    console.log("🔍 Starting face comparison with AWS Rekognition...");

    // Call AWS Rekognition CompareFaces API
    const result = await rekognition.compareFaces(params).promise();

    console.log("📊 Rekognition result:", {
      faceMatches: result.FaceMatches.length,
      unmatched: result.UnmatchedFaces.length,
    });

    // Check if faces match
    if (result.FaceMatches && result.FaceMatches.length > 0) {
      const similarity = result.FaceMatches[0].Similarity;
      const confidence = result.FaceMatches[0].Face.Confidence;

      console.log(
        `✅ Face verification successful - Similarity: ${similarity.toFixed(
          2
        )}%, Confidence: ${confidence.toFixed(2)}%`
      );

      res.json({
        success: true,
        verified: true,
        similarity: similarity,
        confidence: confidence,
        message: "Identity verification successful",
      });
    } else {
      console.log("❌ Face verification failed - No matching faces found");

      res.json({
        success: true,
        verified: false,
        similarity: 0,
        confidence: 0,
        message: "Identity verification failed - faces do not match",
      });
    }
  } catch (error) {
    console.error("❌ AWS Rekognition error:", error);

    // Handle specific AWS errors
    if (error.code === "InvalidImageFormatException") {
      return res.status(400).json({
        success: false,
        error:
          "Invalid image format. Please ensure images are in JPEG or PNG format.",
      });
    } else if (error.code === "InvalidS3ObjectException") {
      return res.status(400).json({
        success: false,
        error: "Invalid image data provided.",
      });
    } else if (error.code === "ImageTooLargeException") {
      return res.status(400).json({
        success: false,
        error: "Image is too large. Please use smaller images.",
      });
    } else if (error.code === "AccessDenied") {
      return res.status(500).json({
        success: false,
        error: "AWS access denied. Please check your credentials.",
      });
    }

    res.status(500).json({
      success: false,
      error: "Identity verification service temporarily unavailable",
    });
  }
});

// API endpoint to submit verification data
app.post("/api/submit-verification", async (req, res) => {
  try {
    console.log("📥 Received verification submission request");
    const { personalInfo, photos, submissionDate, sessionId } = req.body;

    // Validate required fields
    if (!personalInfo || !photos || !submissionDate) {
      console.error("❌ Missing required fields:", {
        hasPersonalInfo: !!personalInfo,
        hasPhotos: !!photos,
        hasSubmissionDate: !!submissionDate,
      });
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    // Validate personal info
    const requiredFields = [
      "firstName",
      "lastName",
      "egn",
      "phone",
      "email",
      "address",
      "income",
      "employment",
    ];
    for (const field of requiredFields) {
      if (!personalInfo[field]) {
        console.error(`❌ Missing required personal info field: ${field}`);
        return res.status(400).json({
          success: false,
          error: `Missing required field: ${field}`,
        });
      }
    }

    // Validate photos
    const requiredPhotos = [
      "idFront",
      "idBack",
      "selfieWithIdFront",
      "selfieWithIdBack",
      "selfieOnly",
    ];
    for (const photoId of requiredPhotos) {
      if (!photos[photoId]) {
        console.error(`❌ Missing required photo: ${photoId}`);
        return res.status(400).json({
          success: false,
          error: `Missing required photo: ${photoId}`,
        });
      }
    }

    console.log("✅ Validation passed, proceeding with database insertion");

    // Create verification document
    const verificationDoc = {
      sessionId: sessionId || generateSessionId(),
      personalInfo: {
        firstName: personalInfo.firstName,
        lastName: personalInfo.lastName,
        egn: personalInfo.egn,
        phone: personalInfo.phone,
        email: personalInfo.email,
        address: personalInfo.address,
        income: parseInt(personalInfo.income),
        employment: personalInfo.employment,
      },
      photos: {
        idFront: {
          data: photos.idFront,
          capturedAt: new Date().toISOString(),
        },
        idBack: {
          data: photos.idBack,
          capturedAt: new Date().toISOString(),
        },
        selfieWithIdFront: {
          data: photos.selfieWithIdFront,
          capturedAt: new Date().toISOString(),
        },
        selfieWithIdBack: {
          data: photos.selfieWithIdBack,
          capturedAt: new Date().toISOString(),
        },
        selfieOnly: {
          data: photos.selfieOnly,
          capturedAt: new Date().toISOString(),
        },
      },
      metadata: {
        submissionDate: submissionDate,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        status: "pending",
        createdAt: new Date(),
        sessionRecordings: [], // Initialize empty array for recordings
        ...req.body.metadata, // Include any additional metadata from frontend
      },
    };

    // Insert into MongoDB
    console.log(
      "📝 Attempting to insert verification document into MongoDB..."
    );
    const collection = db.collection(COLLECTION_NAME);
    const result = await collection.insertOne(verificationDoc);

    if (!result.insertedId) {
      throw new Error("Failed to insert document - no insertedId returned");
    }

    console.log("✅ Verification submitted successfully:", {
      id: result.insertedId,
      sessionId: verificationDoc.sessionId,
      email: personalInfo.email,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      id: result.insertedId,
      sessionId: verificationDoc.sessionId,
      message: "Verification submitted successfully",
    });
  } catch (error) {
    console.error("❌ Error submitting verification:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    res.status(500).json({
      success: false,
      error: "Internal server error",
      details: error.message,
    });
  }
});

// API endpoint to get verification status
app.get("/api/verification-status/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    const collection = db.collection(COLLECTION_NAME);
    const verification = await collection.findOne(
      { sessionId },
      {
        projection: {
          "photos.idFront.data": 0,
          "photos.idBack.data": 0,
          "photos.selfieWithIdFront.data": 0,
          "photos.selfieWithIdBack.data": 0,
          "photos.selfieOnly.data": 0,
        },
      }
    );

    if (!verification) {
      return res.status(404).json({
        success: false,
        error: "Verification not found",
      });
    }

    res.json({
      success: true,
      verification: {
        sessionId: verification.sessionId,
        status: verification.metadata.status,
        submissionDate: verification.metadata.submissionDate,
        personalInfo: verification.personalInfo,
      },
    });
  } catch (error) {
    console.error("❌ Error getting verification status:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    database: db ? "connected" : "disconnected",
  });
});

// Debug endpoint to check verification data
app.get("/api/debug/verification/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!db) {
      return res.status(500).json({
        success: false,
        error: "Database not connected",
      });
    }

    const collection = db.collection(COLLECTION_NAME);
    const verification = await collection.findOne(
      { sessionId },
      {
        projection: {
          "photos.idFront.data": 0,
          "photos.idBack.data": 0,
          "photos.selfieWithIdFront.data": 0,
          "photos.selfieWithIdBack.data": 0,
          "photos.selfieOnly.data": 0,
        },
      }
    );

    if (!verification) {
      return res.status(404).json({
        success: false,
        error: "Verification not found",
      });
    }

    res.json({
      success: true,
      data: {
        sessionId: verification.sessionId,
        metadata: verification.metadata,
        hasSessionRecordings: !!(
          verification.metadata && verification.metadata.sessionRecordings
        ),
        sessionRecordingsCount:
          verification.metadata?.sessionRecordings?.length || 0,
        sessionRecordings: verification.metadata?.sessionRecordings || [],
      },
    });
  } catch (error) {
    console.error("❌ Error in debug endpoint:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Debug endpoint to list all verifications
app.get("/api/debug/verifications", async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({
        success: false,
        error: "Database not connected",
      });
    }

    const collection = db.collection(COLLECTION_NAME);
    const verifications = await collection
      .find(
        {},
        {
          projection: {
            sessionId: 1,
            "personalInfo.firstName": 1,
            "personalInfo.lastName": 1,
            "personalInfo.email": 1,
            "metadata.submissionDate": 1,
            "metadata.sessionRecordings": 1,
            "metadata.status": 1,
          },
        }
      )
      .sort({ "metadata.submissionDate": -1 })
      .limit(10)
      .toArray();

    const summary = verifications.map((v) => ({
      sessionId: v.sessionId,
      name: `${v.personalInfo?.firstName || ""} ${
        v.personalInfo?.lastName || ""
      }`.trim(),
      email: v.personalInfo?.email,
      submissionDate: v.metadata?.submissionDate,
      status: v.metadata?.status || "unknown",
      hasRecordings: !!(
        v.metadata?.sessionRecordings && v.metadata.sessionRecordings.length > 0
      ),
      recordingCount: v.metadata?.sessionRecordings?.length || 0,
      recordings:
        v.metadata?.sessionRecordings?.map((r) => ({
          camera: r.cameraType,
          s3Location: r.s3Location,
          fileSize: r.fileSize,
        })) || [],
    }));

    res.json({
      success: true,
      data: {
        total: verifications.length,
        verifications: summary,
      },
    });
  } catch (error) {
    console.error("❌ Error in debug verifications endpoint:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// API endpoint to upload session recordings to S3
app.post(
  "/api/upload-session-recording",
  upload.single("video"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No video file provided",
        });
      }

      const { sessionId, cameraType, duration, size } = req.body;

      if (!sessionId || !cameraType) {
        return res.status(400).json({
          success: false,
          error: "SessionId and cameraType are required",
        });
      }

      // Generate unique filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `${sessionId}/${cameraType}_${timestamp}.webm`;

      console.log(
        `📹 Uploading session recording: ${filename} (${req.file.size} bytes)`
      );

      // Upload to S3
      const uploadParams = {
        Bucket: SESSION_RECORDING_BUCKET,
        Key: filename,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
        Metadata: {
          sessionId: sessionId,
          cameraType: cameraType,
          duration: duration || "0",
          originalSize: size || req.file.size.toString(),
          uploadedAt: new Date().toISOString(),
        },
      };

      const s3Result = await s3.upload(uploadParams).promise();

      console.log(`✅ Session recording uploaded to S3: ${s3Result.Location}`);

      // Update MongoDB with recording metadata
      if (db) {
        try {
          const collection = db.collection(COLLECTION_NAME);
          await collection.updateOne(
            { sessionId },
            {
              $push: {
                "metadata.sessionRecordings": {
                  cameraType: cameraType,
                  s3Location: s3Result.Location,
                  s3Key: s3Result.Key,
                  uploadedAt: new Date(),
                  duration: parseInt(duration) || 0,
                  fileSize: req.file.size,
                },
              },
            }
          );
          console.log(
            `📝 Recording metadata saved to MongoDB for session: ${sessionId}`
          );
        } catch (dbError) {
          console.warn(
            "⚠️ Failed to update MongoDB with recording metadata:",
            dbError
          );
        }
      }

      res.json({
        success: true,
        message: "Session recording uploaded successfully",
        s3Location: s3Result.Location,
        filename: filename,
        size: req.file.size,
      });
    } catch (error) {
      console.error("❌ Error uploading session recording:", error);
      res.status(500).json({
        success: false,
        error: "Failed to upload session recording",
        details: error.message,
      });
    }
  }
);

// Serve the main verification page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "verification.html"));
});

// Generate session ID
function generateSessionId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("📥 SIGTERM received, shutting down gracefully...");
  if (client) {
    await client.close();
  }
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("📥 SIGINT received, shutting down gracefully...");
  if (client) {
    await client.close();
  }
  process.exit(0);
});

// Start server
async function startServer() {
  await initializeDatabase();

  const localIPs = getLocalIPAddresses();

  // Skip HTTPS in production (Render handles SSL automatically)
  const isProduction = process.env.NODE_ENV === "production";

  // Try to start HTTPS server (only in development)
  const certConfig = !isProduction ? generateSelfSignedCert() : null;

  if (certConfig && !isProduction) {
    try {
      const httpsOptions = {
        key: fs.readFileSync(certConfig.keyPath),
        cert: fs.readFileSync(certConfig.certPath),
      };

      https
        .createServer(httpsOptions, app)
        .listen(HTTPS_PORT, "0.0.0.0", () => {
          console.log(`🔒 HTTPS Server running on port ${HTTPS_PORT}`);
          console.log(`📱 Local access: https://localhost:${HTTPS_PORT}`);

          if (localIPs.length > 0) {
            console.log(`📲 Mobile access (choose your network IP):`);
            localIPs.forEach((ip) => {
              console.log(`   https://${ip}:${HTTPS_PORT}`);
            });
          }

          console.log(`\n📋 Instructions for mobile testing:`);
          console.log(`1. Connect your phone to the same WiFi network`);
          console.log(`2. Open browser on your phone`);
          console.log(`3. Navigate to one of the HTTPS URLs above`);
          console.log(
            `4. Accept the security warning (self-signed certificate)`
          );
          console.log(`5. Test the camera functionality`);
          console.log(
            `\n⚠️  You'll see a "Not Secure" warning - this is normal for self-signed certificates`
          );
          console.log(
            `\n🔧 Alternative: Use Chrome with --ignore-certificate-errors flag for easier testing`
          );
        });
    } catch (error) {
      console.error("❌ HTTPS server failed to start:", error);
      console.log(
        "📥 Falling back to HTTP server (camera may not work on mobile)..."
      );
      startHTTPServer();
    }
  } else {
    startHTTPServer();
  }

  function startHTTPServer() {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 HTTP Server running on port ${PORT}`);
      console.log(`📱 Local access: http://localhost:${PORT}`);

      if (localIPs.length > 0) {
        console.log(`📲 Network access:`);
        localIPs.forEach((ip) => {
          console.log(`   http://${ip}:${PORT}`);
        });
      }

      console.log(`\n⚠️  Note: Camera access requires HTTPS on mobile devices`);
      console.log(`📋 To test camera on mobile with HTTP:`);
      console.log(
        `   - Use Chrome and enable "Insecure origins treated as secure"`
      );
      console.log(
        `   - Go to chrome://flags/#unsafely-treat-insecure-origin-as-secure`
      );
      console.log(`   - Add your server IP and restart Chrome`);
    });
  }
}

startServer().catch((error) => {
  console.error("❌ Failed to start server:", error);
  process.exit(1);
});
