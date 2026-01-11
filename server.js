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

// Middleware with CORS configuration for cross-domain access
app.use(
  cors({
    origin: [
      "https://ftd-copy-g4r6.vercel.app",
      "https://ftd-backend-xjbf.onrender.com",
      "http://localhost:3000",
      "http://localhost:5173",
    ],
    credentials: true,
  })
);

// JSON body parser with reasonable limit (images are now compressed on client)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Set keep-alive timeout to prevent connection drops during long requests
// Render has a 30-second proxy timeout, so we set this slightly higher
app.use((req, res, next) => {
  // Set timeout for request processing (25 seconds to stay under Render's 30s limit)
  req.setTimeout(25000);
  res.setTimeout(25000);
  next();
});

// Serve static files
app.use(express.static("."));

// MongoDB client
let client;
let db;

// AWS configuration - use environment variables for security
const AWS_REGION = process.env.AWS_REGION || "eu-north-1"; // Stockholm region

AWS.config.update({
  region: AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const rekognition = new AWS.Rekognition();
const s3 = new AWS.S3({
  signatureVersion: "v4",
  region: AWS_REGION,
  s3ForcePathStyle: false,
  endpoint: `https://s3.${AWS_REGION}.amazonaws.com`,
});

// S3 bucket configuration for session recordings
const SESSION_RECORDING_BUCKET =
  process.env.S3_BUCKET_NAME || "verification-form-bucket";

// Multer configuration for handling video uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for video files
  },
  fileFilter: (req, file, cb) => {
    // Accept video files (both webm and mp4) and binary data for chunks
    if (
      file.mimetype.startsWith("video/") ||
      file.mimetype === "application/octet-stream" ||
      file.fieldname === "chunk" // Allow chunks regardless of mimetype
    ) {
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

// Helper function to generate unique session ID
function generateUniqueId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
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

    console.log("📷 Image sizes - ID Front:", (idFrontBuffer.length / 1024).toFixed(1), "KB, Selfie:", (selfieBuffer.length / 1024).toFixed(1), "KB");

    // Validate buffer sizes (AWS requires at least some data)
    if (idFrontBuffer.length < 1000 || selfieBuffer.length < 1000) {
      console.error("❌ Image data too small - ID:", idFrontBuffer.length, "Selfie:", selfieBuffer.length);
      return res.json({
        success: true,
        verified: false,
        similarity: 0,
        confidence: 0,
        message: "Image quality too low. Please capture clearer photos.",
        errorCode: "IMAGE_TOO_SMALL",
      });
    }

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
    console.error("❌ AWS Rekognition error:", error.code, error.message);

    // Handle specific AWS errors with user-friendly messages
    if (error.code === "InvalidParameterException") {
      // This usually means no face detected in one or both images
      console.log("⚠️ InvalidParameterException - likely no face detected in image");
      return res.json({
        success: true,
        verified: false,
        similarity: 0,
        confidence: 0,
        message: "Could not detect a face in one of the images. Please ensure your face is clearly visible.",
        errorCode: "NO_FACE_DETECTED",
      });
    } else if (error.code === "InvalidImageFormatException") {
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

// API endpoint to submit verification data to MongoDB
app.post("/api/submit-verification", async (req, res) => {
  try {
    console.log("📥 Received verification submission request");

    // Extract data from request
    const { personalInfo, photos, photoHistory, metadata } = req.body;

    // Validate required data
    if (!personalInfo) {
      return res.status(400).json({
        success: false,
        error: "Personal information is required",
      });
    }

    if (!photos) {
      return res.status(400).json({
        success: false,
        error: "Photos are required",
      });
    }

    // Generate session ID if not provided
    const sessionId = req.body.sessionId || generateUniqueId();
    const submissionDate = new Date().toISOString();

    // Get verification status from metadata
    const verificationStatus =
      req.body.verificationStatus || metadata?.status || "pending";
    const isRetry = metadata?.isRetry || false;

    console.log(
      `📝 Processing ${verificationStatus} verification for session: ${sessionId}`
    );

    // Create verification document
    const verificationDoc = {
      sessionId: sessionId,
      personalInfo: {
        firstName: personalInfo.firstName || "",
        lastName: personalInfo.lastName || "",
        egn: personalInfo.egn || "",
        phone: personalInfo.phone || "",
        email: personalInfo.email || "",
        income: personalInfo.income || "",
        employment: personalInfo.employment || "",
        address: personalInfo.address || "",
        streetName: personalInfo.streetName || "",
        houseNumber: personalInfo.houseNumber || "",
        apartment: personalInfo.apartment || "",
        city: personalInfo.city || "",
        state: personalInfo.state || "",
        postalCode: personalInfo.postalCode || "",
        country: personalInfo.country || "",
      },
      photos: {},
      photoHistory: photoHistory || {},
      verificationStatus: verificationStatus,
      verificationResult: req.body.verificationResult || {},
      metadata: {
        submissionDate: submissionDate,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        status:
          verificationStatus === "passed" ? "completed" : "verification_failed",
        createdAt: new Date(),
        sessionRecordings: [], // Initialize empty array for recordings
        isRetry: isRetry,
        ...req.body.metadata, // Include any additional metadata from frontend
      },
    };

    // Process photos
    if (photos) {
      for (const [photoType, photoData] of Object.entries(photos)) {
        verificationDoc.photos[photoType] = {
          data: photoData.data || "",
          filename: photoData.filename || `${photoType}.jpg`,
          size: photoData.size || 0,
          type: photoData.type || "image/jpeg",
          capturedAt: photoData.capturedAt || new Date().toISOString(),
        };
      }
    }

    const collection = db.collection(COLLECTION_NAME);

    // Handle retry logic for failed verifications
    if (isRetry && personalInfo.email) {
      console.log(`🔄 Processing retry for email: ${personalInfo.email}`);

      // Check for existing failed verification
      const existingFailedVerification = await collection.findOne({
        "personalInfo.email": personalInfo.email,
        verificationStatus: "failed",
      });

      if (existingFailedVerification) {
        console.log(
          `📝 Found existing failed verification: ${existingFailedVerification.sessionId}`
        );

        if (verificationStatus === "passed") {
          // Replace failed verification with passed one
          console.log(
            "✅ Replacing failed verification with passed verification"
          );

          const updateResult = await collection.replaceOne(
            { _id: existingFailedVerification._id },
            verificationDoc
          );

          if (updateResult.modifiedCount > 0) {
            console.log(
              "✅ Successfully replaced failed verification with passed verification"
            );
            return res.json({
              success: true,
              id: existingFailedVerification._id,
              sessionId: verificationDoc.sessionId,
              message: "Verification updated successfully - passed on retry",
              action: "replaced_failed_with_passed",
            });
          }
        } else if (verificationStatus === "failed") {
          // Update the existing failed verification
          console.log(
            "📝 Updating existing failed verification with new attempt"
          );

          const updateResult = await collection.replaceOne(
            { _id: existingFailedVerification._id },
            verificationDoc
          );

          if (updateResult.modifiedCount > 0) {
            console.log("📝 Updated existing failed verification");
            return res.json({
              success: true,
              id: existingFailedVerification._id,
              sessionId: verificationDoc.sessionId,
              message: "Failed verification updated",
              action: "updated_failed_verification",
            });
          }
        }
      }
    }

    // Insert new verification document
    console.log("📝 Inserting new verification document into MongoDB...");
    const result = await collection.insertOne(verificationDoc);

    if (!result.insertedId) {
      throw new Error("Failed to insert document - no insertedId returned");
    }

    console.log("✅ Verification submitted successfully:", {
      id: result.insertedId,
      sessionId: verificationDoc.sessionId,
      email: personalInfo.email,
      status: verificationStatus,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      id: result.insertedId,
      sessionId: verificationDoc.sessionId,
      message: `Verification submitted successfully - ${verificationStatus}`,
      action: "new_verification",
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

// ==========================================
// S3 Multipart Upload Endpoints for Streaming
// ==========================================

// API endpoint to initiate multipart upload
app.post("/api/initiate-multipart-upload", async (req, res) => {
  try {
    const { sessionId, cameraType, mimeType } = req.body;

    if (!sessionId || !cameraType) {
      return res.status(400).json({
        success: false,
        error: "SessionId and cameraType are required",
      });
    }

    // Determine file extension based on mimetype
    let extension = ".webm";
    if (mimeType && mimeType.includes("mp4")) {
      extension = ".mp4";
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `${sessionId}/${cameraType}_${timestamp}${extension}`;

    console.log(`🚀 Initiating multipart upload: ${filename}`);

    const params = {
      Bucket: SESSION_RECORDING_BUCKET,
      Key: filename,
      ContentType: mimeType || "video/webm",
      Metadata: {
        sessionId: sessionId,
        cameraType: cameraType,
        uploadedAt: new Date().toISOString(),
        mimeType: mimeType || "video/webm",
        streamingUpload: "true",
      },
    };

    const multipartUpload = await s3.createMultipartUpload(params).promise();

    console.log(`✅ Multipart upload initiated: ${multipartUpload.UploadId}`);

    res.json({
      success: true,
      uploadId: multipartUpload.UploadId,
      key: filename,
      message: "Multipart upload initiated",
    });
  } catch (error) {
    console.error("❌ Error initiating multipart upload:", error);
    res.status(500).json({
      success: false,
      error: "Failed to initiate multipart upload",
      details: error.message,
    });
  }
});

// API endpoint to upload a part of the multipart upload
app.post("/api/upload-part", upload.single("chunk"), async (req, res) => {
  try {
    const { uploadId, key, partNumber } = req.body;

    if (!uploadId || !key || !partNumber || !req.file) {
      return res.status(400).json({
        success: false,
        error: "uploadId, key, partNumber, and chunk file are required",
      });
    }

    console.log(
      `📤 Uploading part ${partNumber} for ${key} (${req.file.size} bytes)`
    );

    const params = {
      Bucket: SESSION_RECORDING_BUCKET,
      Key: key,
      UploadId: uploadId,
      PartNumber: parseInt(partNumber),
      Body: req.file.buffer,
    };

    const result = await s3.uploadPart(params).promise();

    console.log(`✅ Part ${partNumber} uploaded, ETag: ${result.ETag}`);

    res.json({
      success: true,
      partNumber: parseInt(partNumber),
      eTag: result.ETag,
      size: req.file.size,
    });
  } catch (error) {
    console.error(`❌ Error uploading part:`, error);
    res.status(500).json({
      success: false,
      error: "Failed to upload part",
      details: error.message,
    });
  }
});

// API endpoint to complete multipart upload
app.post("/api/complete-multipart-upload", async (req, res) => {
  try {
    const { uploadId, key, parts, sessionId, cameraType, duration, mimeType } =
      req.body;

    if (!uploadId || !key || !parts || parts.length === 0) {
      return res.status(400).json({
        success: false,
        error: "uploadId, key, and parts are required",
      });
    }

    console.log(
      `🏁 Completing multipart upload: ${key} with ${parts.length} parts`
    );

    // Sort parts by part number
    const sortedParts = parts.sort((a, b) => a.PartNumber - b.PartNumber);

    const params = {
      Bucket: SESSION_RECORDING_BUCKET,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: sortedParts.map((part) => ({
          ETag: part.ETag,
          PartNumber: part.PartNumber,
        })),
      },
    };

    const result = await s3.completeMultipartUpload(params).promise();

    console.log(`✅ Multipart upload completed: ${result.Location}`);

    // Calculate total size from parts
    const totalSize = parts.reduce((sum, part) => sum + (part.Size || 0), 0);

    // Update MongoDB with recording metadata
    if (db && sessionId) {
      try {
        const collection = db.collection(COLLECTION_NAME);
        await collection.updateOne(
          { sessionId },
          {
            $push: {
              "metadata.sessionRecordings": {
                cameraType: cameraType || "unknown",
                s3Location: result.Location,
                s3Key: key,
                uploadedAt: new Date(),
                duration: parseInt(duration) || 0,
                fileSize: totalSize,
                mimeType: mimeType || "video/webm",
                streamingUpload: true,
                partsCount: parts.length,
                filename: key,
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
      s3Location: result.Location,
      filename: key,
      size: totalSize,
      partsCount: parts.length,
      message: "Multipart upload completed successfully",
    });
  } catch (error) {
    console.error("❌ Error completing multipart upload:", error);
    res.status(500).json({
      success: false,
      error: "Failed to complete multipart upload",
      details: error.message,
    });
  }
});

// API endpoint to abort multipart upload (cleanup on failure)
app.post("/api/abort-multipart-upload", async (req, res) => {
  try {
    const { uploadId, key } = req.body;

    if (!uploadId || !key) {
      return res.status(400).json({
        success: false,
        error: "uploadId and key are required",
      });
    }

    console.log(`🛑 Aborting multipart upload: ${key}`);

    const params = {
      Bucket: SESSION_RECORDING_BUCKET,
      Key: key,
      UploadId: uploadId,
    };

    await s3.abortMultipartUpload(params).promise();

    console.log(`✅ Multipart upload aborted: ${key}`);

    res.json({
      success: true,
      message: "Multipart upload aborted",
    });
  } catch (error) {
    console.error("❌ Error aborting multipart upload:", error);
    res.status(500).json({
      success: false,
      error: "Failed to abort multipart upload",
      details: error.message,
    });
  }
});

// ==========================================
// Legacy Upload Endpoint (fallback)
// ==========================================

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

      const { sessionId, cameraType, duration, size, mimeType, isFallback } =
        req.body;

      if (!sessionId || !cameraType) {
        return res.status(400).json({
          success: false,
          error: "SessionId and cameraType are required",
        });
      }

      // Determine file extension based on mimetype
      let extension = ".webm"; // default
      if (mimeType) {
        if (mimeType.includes("mp4")) {
          extension = ".mp4";
        } else if (mimeType.includes("webm")) {
          extension = ".webm";
        }
      } else if (req.file.mimetype) {
        if (req.file.mimetype.includes("mp4")) {
          extension = ".mp4";
        } else if (req.file.mimetype.includes("webm")) {
          extension = ".webm";
        }
      }

      // Generate unique filename with proper extension
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `${sessionId}/${cameraType}_${timestamp}${extension}`;

      console.log(
        `📹 Uploading session recording: ${filename} (${req.file.size} bytes, ${
          mimeType || req.file.mimetype
        }${isFallback === "true" ? ", fallback" : ""})`
      );

      // Upload to S3
      const uploadParams = {
        Bucket: SESSION_RECORDING_BUCKET,
        Key: filename,
        Body: req.file.buffer,
        ContentType: mimeType || req.file.mimetype,
        Metadata: {
          sessionId: sessionId,
          cameraType: cameraType,
          duration: duration || "0",
          originalSize: size || req.file.size.toString(),
          uploadedAt: new Date().toISOString(),
          mimeType: mimeType || req.file.mimetype || "unknown",
          isFallback: isFallback || "false",
          userAgent: req.headers["user-agent"] || "unknown",
          videoCombined: "true", // Indicates this is a combined video from chunks
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
                  mimeType: mimeType || req.file.mimetype || "unknown",
                  isFallback: isFallback === "true",
                  userAgent: req.headers["user-agent"] || "unknown",
                  filename: filename,
                  videoCombined: true, // Indicates this is a combined video from chunks
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
        mimeType: mimeType || req.file.mimetype,
        isFallback: isFallback === "true",
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

// API endpoint to generate signed URLs for video access (more secure)
app.get("/api/video/:sessionId/:filename", async (req, res) => {
  try {
    const { sessionId, filename } = req.params;

    console.log(`📹 Generating signed URL for: ${sessionId}/${filename}`);

    // Verify the file exists in the correct format
    const key = `${sessionId}/${filename}`;

    // Determine content type based on file extension
    let contentType = "video/webm"; // default
    if (filename.toLowerCase().endsWith(".mp4")) {
      contentType = "video/mp4";
    } else if (filename.toLowerCase().endsWith(".webm")) {
      contentType = "video/webm";
    }

    console.log(`📹 Content type for ${filename}: ${contentType}`);

    // Generate signed URL valid for 1 hour
    const signedUrl = s3.getSignedUrl("getObject", {
      Bucket: SESSION_RECORDING_BUCKET,
      Key: key,
      Expires: 3600, // 1 hour
      ResponseContentType: contentType,
    });

    res.json({
      success: true,
      url: signedUrl,
      expiresIn: 3600,
      contentType: contentType,
      filename: filename,
    });

    console.log(
      `✅ Signed URL generated successfully for ${key} (${contentType})`
    );
  } catch (error) {
    console.error("❌ Error generating signed URL:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate video URL",
      details: error.message,
    });
  }
});

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
