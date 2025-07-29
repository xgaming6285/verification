// Verification Page JavaScript
let currentStep = 1;
let currentFieldStep = 1; // Current field step within personal information (1-14)
let totalFieldSteps = 14; // Total number of field steps
let currentPhotoStep = 1;
let capturedPhotos = {};
let photoHistory = {}; // Store all versions of photos including retakes
let currentStream = null;
let translationManager = null;
let isVerificationInProgress = false;
let verificationPassed = false;

// Country and address data
const COUNTRIES = {
  BG: { name: "Bulgaria", hasStates: false, postalFormat: /^\d{4}$/ },
  US: {
    name: "United States",
    hasStates: true,
    postalFormat: /^\d{5}(-\d{4})?$/,
  },
  GB: {
    name: "United Kingdom",
    hasStates: false,
    postalFormat: /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i,
  },
  DE: { name: "Germany", hasStates: true, postalFormat: /^\d{5}$/ },
  FR: { name: "France", hasStates: false, postalFormat: /^\d{5}$/ },
  CA: {
    name: "Canada",
    hasStates: true,
    postalFormat: /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i,
  },
  AU: { name: "Australia", hasStates: true, postalFormat: /^\d{4}$/ },
  IT: { name: "Italy", hasStates: false, postalFormat: /^\d{5}$/ },
  ES: { name: "Spain", hasStates: false, postalFormat: /^\d{5}$/ },
  NL: {
    name: "Netherlands",
    hasStates: false,
    postalFormat: /^\d{4}\s?[A-Z]{2}$/i,
  },
  IN: { name: "India", hasStates: true, postalFormat: /^\d{6}$/ },
  BR: { name: "Brazil", hasStates: true, postalFormat: /^\d{5}-?\d{3}$/ },
  RU: { name: "Russia", hasStates: false, postalFormat: /^\d{6}$/ },
  JP: { name: "Japan", hasStates: false, postalFormat: /^\d{3}-?\d{4}$/ },
  CN: { name: "China", hasStates: false, postalFormat: /^\d{6}$/ },
};

const STATES_PROVINCES = {
  US: [
    { code: "AL", name: "Alabama" },
    { code: "AK", name: "Alaska" },
    { code: "AZ", name: "Arizona" },
    { code: "AR", name: "Arkansas" },
    { code: "CA", name: "California" },
    { code: "CO", name: "Colorado" },
    { code: "CT", name: "Connecticut" },
    { code: "DE", name: "Delaware" },
    { code: "FL", name: "Florida" },
    { code: "GA", name: "Georgia" },
    { code: "HI", name: "Hawaii" },
    { code: "ID", name: "Idaho" },
    { code: "IL", name: "Illinois" },
    { code: "IN", name: "Indiana" },
    { code: "IA", name: "Iowa" },
    { code: "KS", name: "Kansas" },
    { code: "KY", name: "Kentucky" },
    { code: "LA", name: "Louisiana" },
    { code: "ME", name: "Maine" },
    { code: "MD", name: "Maryland" },
    { code: "MA", name: "Massachusetts" },
    { code: "MI", name: "Michigan" },
    { code: "MN", name: "Minnesota" },
    { code: "MS", name: "Mississippi" },
    { code: "MO", name: "Missouri" },
    { code: "MT", name: "Montana" },
    { code: "NE", name: "Nebraska" },
    { code: "NV", name: "Nevada" },
    { code: "NH", name: "New Hampshire" },
    { code: "NJ", name: "New Jersey" },
    { code: "NM", name: "New Mexico" },
    { code: "NY", name: "New York" },
    { code: "NC", name: "North Carolina" },
    { code: "ND", name: "North Dakota" },
    { code: "OH", name: "Ohio" },
    { code: "OK", name: "Oklahoma" },
    { code: "OR", name: "Oregon" },
    { code: "PA", name: "Pennsylvania" },
    { code: "RI", name: "Rhode Island" },
    { code: "SC", name: "South Carolina" },
    { code: "SD", name: "South Dakota" },
    { code: "TN", name: "Tennessee" },
    { code: "TX", name: "Texas" },
    { code: "UT", name: "Utah" },
    { code: "VT", name: "Vermont" },
    { code: "VA", name: "Virginia" },
    { code: "WA", name: "Washington" },
    { code: "WV", name: "West Virginia" },
    { code: "WI", name: "Wisconsin" },
    { code: "WY", name: "Wyoming" },
  ],
  CA: [
    { code: "AB", name: "Alberta" },
    { code: "BC", name: "British Columbia" },
    { code: "MB", name: "Manitoba" },
    { code: "NB", name: "New Brunswick" },
    { code: "NL", name: "Newfoundland and Labrador" },
    { code: "NT", name: "Northwest Territories" },
    { code: "NS", name: "Nova Scotia" },
    { code: "NU", name: "Nunavut" },
    { code: "ON", name: "Ontario" },
    { code: "PE", name: "Prince Edward Island" },
    { code: "QC", name: "Quebec" },
    { code: "SK", name: "Saskatchewan" },
    { code: "YT", name: "Yukon" },
  ],
  AU: [
    { code: "NSW", name: "New South Wales" },
    { code: "VIC", name: "Victoria" },
    { code: "QLD", name: "Queensland" },
    { code: "WA", name: "Western Australia" },
    { code: "SA", name: "South Australia" },
    { code: "TAS", name: "Tasmania" },
    { code: "ACT", name: "Australian Capital Territory" },
    { code: "NT", name: "Northern Territory" },
  ],
  DE: [
    { code: "BW", name: "Baden-Württemberg" },
    { code: "BY", name: "Bavaria" },
    { code: "BE", name: "Berlin" },
    { code: "BB", name: "Brandenburg" },
    { code: "HB", name: "Bremen" },
    { code: "HH", name: "Hamburg" },
    { code: "HE", name: "Hesse" },
    { code: "MV", name: "Mecklenburg-Vorpommern" },
    { code: "NI", name: "Lower Saxony" },
    { code: "NW", name: "North Rhine-Westphalia" },
    { code: "RP", name: "Rhineland-Palatinate" },
    { code: "SL", name: "Saarland" },
    { code: "SN", name: "Saxony" },
    { code: "ST", name: "Saxony-Anhalt" },
    { code: "SH", name: "Schleswig-Holstein" },
    { code: "TH", name: "Thuringia" },
  ],
  IN: [
    { code: "AP", name: "Andhra Pradesh" },
    { code: "AR", name: "Arunachal Pradesh" },
    { code: "AS", name: "Assam" },
    { code: "BR", name: "Bihar" },
    { code: "CT", name: "Chhattisgarh" },
    { code: "GA", name: "Goa" },
    { code: "GJ", name: "Gujarat" },
    { code: "HR", name: "Haryana" },
    { code: "HP", name: "Himachal Pradesh" },
    { code: "JH", name: "Jharkhand" },
    { code: "KA", name: "Karnataka" },
    { code: "KL", name: "Kerala" },
    { code: "MP", name: "Madhya Pradesh" },
    { code: "MH", name: "Maharashtra" },
    { code: "MN", name: "Manipur" },
    { code: "ML", name: "Meghalaya" },
    { code: "MZ", name: "Mizoram" },
    { code: "NL", name: "Nagaland" },
    { code: "OR", name: "Odisha" },
    { code: "PB", name: "Punjab" },
    { code: "RJ", name: "Rajasthan" },
    { code: "SK", name: "Sikkim" },
    { code: "TN", name: "Tamil Nadu" },
    { code: "TG", name: "Telangana" },
    { code: "TR", name: "Tripura" },
    { code: "UP", name: "Uttar Pradesh" },
    { code: "UT", name: "Uttarakhand" },
    { code: "WB", name: "West Bengal" },
  ],
  BR: [
    { code: "AC", name: "Acre" },
    { code: "AL", name: "Alagoas" },
    { code: "AP", name: "Amapá" },
    { code: "AM", name: "Amazonas" },
    { code: "BA", name: "Bahia" },
    { code: "CE", name: "Ceará" },
    { code: "DF", name: "Distrito Federal" },
    { code: "ES", name: "Espírito Santo" },
    { code: "GO", name: "Goiás" },
    { code: "MA", name: "Maranhão" },
    { code: "MT", name: "Mato Grosso" },
    { code: "MS", name: "Mato Grosso do Sul" },
    { code: "MG", name: "Minas Gerais" },
    { code: "PA", name: "Pará" },
    { code: "PB", name: "Paraíba" },
    { code: "PR", name: "Paraná" },
    { code: "PE", name: "Pernambuco" },
    { code: "PI", name: "Piauí" },
    { code: "RJ", name: "Rio de Janeiro" },
    { code: "RN", name: "Rio Grande do Norte" },
    { code: "RS", name: "Rio Grande do Sul" },
    { code: "RO", name: "Rondônia" },
    { code: "RR", name: "Roraima" },
    { code: "SC", name: "Santa Catarina" },
    { code: "SP", name: "São Paulo" },
    { code: "SE", name: "Sergipe" },
    { code: "TO", name: "Tocantins" },
  ],
};

// Video Recording Manager Class for Session Recording
class VideoRecordingManager {
  constructor() {
    this.isRecording = false;
    this.mediaRecorders = [];
    this.recordedChunks = [];
    this.videoChunks = new Map(); // Store chunks per camera type
    this.sessionId = null;
    this.startTime = null;
    this.streams = [];
  }

  async initializeRecording() {
    try {
      this.sessionId =
        localStorage.getItem("kyc_session_id") || this.generateSessionId();
      localStorage.setItem("kyc_session_id", this.sessionId);

      console.log("🎥 Initializing session recording...", this.sessionId);

      // Try to get both front and back camera streams
      const frontCameraStream = await this.getCameraStream("user");
      const backCameraStream = await this.getCameraStream("environment");

      if (frontCameraStream) {
        this.streams.push({ type: "front", stream: frontCameraStream });
      }

      if (backCameraStream) {
        this.streams.push({ type: "back", stream: backCameraStream });
      }

      console.log(
        `📹 Initialized ${this.streams.length} camera streams for recording`
      );
      return true;
    } catch (error) {
      console.error("❌ Failed to initialize recording:", error);
      return false;
    }
  }

  async getCameraStream(facingMode) {
    try {
      // iOS-compatible constraints
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

      let constraints;

      if (isIOS && facingMode === "user") {
        // Special constraints for iOS front camera to avoid black screen
        constraints = {
          video: {
            facingMode: { exact: "user" }, // Force front camera
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
            frameRate: { ideal: 30, max: 30 },
          },
          audio: true,
        };
      } else if (isIOS) {
        // Regular iOS constraints for back camera
        constraints = {
          video: {
            facingMode: facingMode,
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
            frameRate: { ideal: 30, max: 30 },
          },
          audio: true,
        };
      } else {
        // Non-iOS devices
        constraints = {
          video: {
            facingMode: facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: true,
        };
      }

      console.log(
        `📱 Getting ${facingMode} camera stream for ${
          isIOS ? "iOS" : "other"
        } device with constraints:`,
        constraints
      );

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Verify the stream has video tracks and they're active
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length === 0) {
        throw new Error(`No video tracks found for ${facingMode} camera`);
      }

      const videoTrack = videoTracks[0];
      console.log(`📹 ${facingMode} camera track:`, {
        label: videoTrack.label,
        kind: videoTrack.kind,
        enabled: videoTrack.enabled,
        readyState: videoTrack.readyState,
        settings: videoTrack.getSettings
          ? videoTrack.getSettings()
          : "not available",
      });

      return stream;
    } catch (error) {
      console.warn(`⚠️ Could not access ${facingMode} camera:`, error);

      // iOS fallback with simpler constraints
      if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        try {
          console.log("🔄 Trying iOS fallback constraints...");

          let fallbackConstraints;
          if (facingMode === "user") {
            // More permissive front camera constraints
            fallbackConstraints = {
              video: {
                facingMode: "user",
                width: { min: 320, ideal: 640 },
                height: { min: 240, ideal: 480 },
              },
              audio: true,
            };
          } else {
            fallbackConstraints = {
              video: { facingMode: facingMode },
              audio: true,
            };
          }

          const fallbackStream = await navigator.mediaDevices.getUserMedia(
            fallbackConstraints
          );

          // Log fallback stream details
          const videoTracks = fallbackStream.getVideoTracks();
          if (videoTracks.length > 0) {
            const videoTrack = videoTracks[0];
            console.log(`📹 ${facingMode} camera fallback track:`, {
              label: videoTrack.label,
              enabled: videoTrack.enabled,
              readyState: videoTrack.readyState,
            });
          }

          return fallbackStream;
        } catch (fallbackError) {
          console.warn("⚠️ iOS fallback also failed:", fallbackError);
        }
      }

      return null;
    }
  }

  generateSessionId() {
    return "rec_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
  }

  startRecording() {
    if (this.isRecording || this.streams.length === 0) {
      return false;
    }

    this.isRecording = true;
    this.startTime = new Date();
    this.recordedChunks = [];
    this.mediaRecorders = [];

    console.log("🔴 Starting session recording...");

    this.streams.forEach((streamInfo, index) => {
      try {
        // Determine the best codec for this camera type and device
        const mimeType = this.getBestMimeType(streamInfo.type);

        console.log(`🎬 Using codec ${mimeType} for ${streamInfo.type} camera`);

        // Enhanced MediaRecorder options for better compression
        const recordingOptions = {
          mimeType: mimeType,
          videoBitsPerSecond: this.getOptimalBitrate(streamInfo.type),
          audioBitsPerSecond: 128000, // 128 kbps for good audio quality
        };

        const mediaRecorder = new MediaRecorder(
          streamInfo.stream,
          recordingOptions
        );

        const chunks = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);

            // Store chunks for later combination by camera type
            if (!this.videoChunks.has(streamInfo.type)) {
              this.videoChunks.set(streamInfo.type, []);
            }
            this.videoChunks.get(streamInfo.type).push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          console.log(
            `📹 ${streamInfo.type} camera recording stopped, chunks collected for combination`
          );
        };

        mediaRecorder.start(1000); // Record in 1-second chunks
        this.mediaRecorders.push(mediaRecorder);

        console.log(
          `🎬 Started recording from ${streamInfo.type} camera with ${mimeType}`
        );
      } catch (error) {
        console.error(
          `❌ Failed to start recording from ${streamInfo.type} camera:`,
          error
        );

        // Try fallback recording with default codec
        this.tryFallbackRecording(streamInfo);
      }
    });

    return true;
  }

  getBestMimeType(cameraType) {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    // Define codec preferences based on device and camera type
    const codecPreferences = {
      ios: {
        front: [
          'video/mp4; codecs="avc1.42E01E"', // H.264 Baseline Profile - most compatible with iOS front camera
          'video/mp4; codecs="avc1.64001E"', // H.264 Main Profile
          "video/mp4", // Generic MP4
          'video/webm; codecs="vp8,opus"', // VP8 fallback
          "video/webm", // Generic WebM
        ],
        back: [
          'video/mp4; codecs="avc1.64001E"', // H.264 Main Profile
          'video/mp4; codecs="avc1.42E01E"', // H.264 Baseline Profile
          'video/webm; codecs="vp9,opus"', // VP9 (original codec)
          "video/mp4", // Generic MP4
          'video/webm; codecs="vp8,opus"', // VP8 fallback
          "video/webm", // Generic WebM
        ],
      },
      other: [
        'video/webm; codecs="vp9,opus"', // VP9 (original - works well on Android/Desktop)
        'video/webm; codecs="vp8,opus"', // VP8 fallback
        'video/mp4; codecs="avc1.64001E"', // H.264 Main Profile
        'video/mp4; codecs="avc1.42E01E"', // H.264 Baseline Profile
        "video/webm", // Generic WebM
        "video/mp4", // Generic MP4
      ],
    };

    let preferences;
    if (isIOS) {
      preferences =
        codecPreferences.ios[cameraType] || codecPreferences.ios.back;
    } else {
      preferences = codecPreferences.other;
    }

    // Find the first supported codec
    for (const mimeType of preferences) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        console.log(
          `✅ Selected codec: ${mimeType} for ${cameraType} camera on ${
            isIOS ? "iOS" : "other"
          }`
        );
        return mimeType;
      }
    }

    // If no preferred codecs are supported, use the first available
    console.warn(
      `⚠️ No preferred codecs supported, using default for ${cameraType} camera`
    );
    return this.getDefaultMimeType();
  }

  getDefaultMimeType() {
    const defaultCodecs = [
      'video/webm; codecs="vp9,opus"',
      'video/webm; codecs="vp8,opus"',
      "video/mp4",
      "video/webm",
    ];

    for (const mimeType of defaultCodecs) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }

    // Last resort - let MediaRecorder choose
    return "";
  }

  tryFallbackRecording(streamInfo) {
    try {
      console.log(
        `🔄 Attempting fallback recording for ${streamInfo.type} camera`
      );

      const fallbackMimeType = this.getDefaultMimeType();
      const mediaRecorder = new MediaRecorder(
        streamInfo.stream,
        fallbackMimeType ? { mimeType: fallbackMimeType } : {}
      );

      const chunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);

          // Store chunks for later combination by camera type (fallback)
          if (!this.videoChunks.has(streamInfo.type)) {
            this.videoChunks.set(streamInfo.type, []);
          }
          this.videoChunks.get(streamInfo.type).push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log(
          `📹 ${streamInfo.type} camera fallback recording stopped, chunks collected for combination`
        );
      };

      mediaRecorder.start(1000);
      this.mediaRecorders.push(mediaRecorder);

      console.log(
        `✅ Fallback recording started for ${streamInfo.type} camera`
      );
    } catch (fallbackError) {
      console.error(
        `❌ Fallback recording also failed for ${streamInfo.type} camera:`,
        fallbackError
      );
    }
  }

  getOptimalBitrate(cameraType) {
    // Dynamic bitrate based on device capabilities and camera type
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isMobile =
      /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

    // Base bitrates for different scenarios (in bps)
    const baseBitrates = {
      desktop: {
        front: 2500000, // 2.5 Mbps for front camera (lower motion)
        back: 3500000, // 3.5 Mbps for back camera (potential document scanning)
      },
      mobile: {
        front: 1500000, // 1.5 Mbps for mobile front camera
        back: 2000000, // 2 Mbps for mobile back camera
      },
      ios: {
        front: 2000000, // 2 Mbps for iOS front camera (good quality/efficiency balance)
        back: 2500000, // 2.5 Mbps for iOS back camera
      },
    };

    let deviceType = "desktop";
    if (isIOS) deviceType = "ios";
    else if (isMobile) deviceType = "mobile";

    return (
      baseBitrates[deviceType][cameraType] || baseBitrates[deviceType].front
    );
  }

  combineVideoChunks(cameraType, mimeType) {
    const chunks = this.videoChunks.get(cameraType);
    if (!chunks || chunks.length === 0) {
      return null;
    }

    // Combine all chunks into a single blob
    const combinedBlob = new Blob(chunks, { type: mimeType });

    console.log(
      `🎬 Combined ${chunks.length} chunks for ${cameraType} camera into ${combinedBlob.size} bytes (${mimeType})`
    );

    return combinedBlob;
  }

  stopRecording() {
    if (!this.isRecording) {
      return false;
    }

    this.isRecording = false;
    console.log("⏹️ Stopping session recording...");

    this.mediaRecorders.forEach((recorder) => {
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
    });

    // Stop all streams
    this.streams.forEach((streamInfo) => {
      streamInfo.stream.getTracks().forEach((track) => track.stop());
    });

    return true;
  }

  async uploadRecordings() {
    console.log("☁️ Combining and uploading session recordings...");

    try {
      const results = [];

      // Process each camera type
      for (const [cameraType, chunks] of this.videoChunks.entries()) {
        if (chunks.length === 0) continue;

        // Determine the best mime type for this camera
        const mimeType = this.getBestMimeType(cameraType);

        // Combine all chunks for this camera into one video
        const combinedVideo = this.combineVideoChunks(cameraType, mimeType);

        if (!combinedVideo) continue;

        // Upload the combined video
        const uploadResult = await this.uploadCombinedVideo(
          combinedVideo,
          cameraType,
          mimeType
        );

        if (uploadResult) {
          results.push(uploadResult);
        }
      }

      if (results.length === 0) {
        console.warn("⚠️ No recordings were uploaded");
        return [];
      }

      console.log(
        `✅ All session recordings uploaded: ${results.length} videos`
      );
      return results;
    } catch (error) {
      console.error("❌ Failed to upload session recordings:", error);
      return [];
    }
  }

  async uploadCombinedVideo(videoBlob, cameraType, mimeType) {
    try {
      const formData = new FormData();

      // Determine file extension based on mimeType
      let extension = ".webm";
      if (mimeType && mimeType.includes("mp4")) {
        extension = ".mp4";
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `${this.sessionId}_${cameraType}_combined_${timestamp}${extension}`;

      formData.append("video", videoBlob, filename);
      formData.append("sessionId", this.sessionId);
      formData.append("cameraType", cameraType);
      formData.append("size", videoBlob.size.toString());
      formData.append("mimeType", mimeType);
      formData.append(
        "duration",
        (Date.now() - (this.startTime?.getTime() || 0)).toString()
      );

      console.log(
        `📤 Uploading combined ${cameraType} video: ${filename} (${videoBlob.size} bytes)`
      );

      const response = await fetch("/api/upload-session-recording", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Failed to upload ${cameraType} recording`);
      }

      const result = await response.json();

      console.log(
        `✅ Combined ${cameraType} video uploaded successfully to ${result.s3Location}`
      );

      return {
        cameraType: cameraType,
        s3Location: result.s3Location,
        filename: result.filename,
        size: videoBlob.size,
        mimeType: mimeType,
        uploadedAt: new Date(),
        duration: Date.now() - (this.startTime?.getTime() || Date.now()),
      };
    } catch (error) {
      console.error(`❌ Failed to upload combined ${cameraType} video:`, error);
      return null;
    }
  }

  cleanup() {
    this.stopRecording();
    this.recordedChunks = [];
    this.videoChunks.clear();
    this.mediaRecorders = [];
    this.streams = [];
  }
}

// Initialize the recording manager
window.videoRecordingManager = new VideoRecordingManager();

// iOS Compatibility and Debug Functions
window.iosDebugInfo = function () {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const videos = document.querySelectorAll("video");

  console.log("📱 iOS Debug Information:");
  console.log("- Device is iOS:", isIOS);
  console.log("- Safari version:", navigator.userAgent);
  console.log("- Video elements found:", videos.length);

  videos.forEach((video, index) => {
    console.log(`Video ${index + 1}:`, {
      id: video.id,
      hasPlaysinline: video.hasAttribute("playsinline"),
      isMuted: video.muted,
      readyState: video.readyState,
      srcObject: !!video.srcObject,
      style: video.style.display,
    });
  });

  if (window.videoRecordingManager) {
    console.log("Recording Manager:", {
      isRecording: window.videoRecordingManager.isRecording,
      streamsCount: window.videoRecordingManager.streams.length,
      sessionId: window.videoRecordingManager.sessionId,
    });
  }

  return {
    isIOS,
    videoCount: videos.length,
    recordingActive: window.videoRecordingManager?.isRecording || false,
  };
};

// Dynamic viewport height function for mobile browsers
function setDynamicViewportHeight() {
  let vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty("--vh", `${vh}px`);

  // Update on resize (for orientation changes)
  window.addEventListener("resize", () => {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty("--vh", `${vh}px`);
  });
}

// Add codec debugging function
window.checkCodecSupport = function () {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  console.log("🎥 MediaRecorder Codec Support Check:");
  console.log("- Device:", isIOS ? "iOS" : "Other");
  console.log("- User Agent:", navigator.userAgent);

  const codecsToTest = [
    'video/webm; codecs="vp9,opus"',
    'video/webm; codecs="vp8,opus"',
    'video/mp4; codecs="avc1.64001E"',
    'video/mp4; codecs="avc1.42E01E"',
    'video/mp4; codecs="hev1.1.6.L93.B0"', // H.265/HEVC
    "video/mp4",
    "video/webm",
    "",
  ];

  const supportResults = {};

  codecsToTest.forEach((codec) => {
    const isSupported = MediaRecorder.isTypeSupported(codec);
    supportResults[codec || "default"] = isSupported;
    console.log(
      `${isSupported ? "✅" : "❌"} ${codec || "default (browser choice)"}`
    );
  });

  // Test what the VideoRecordingManager would choose
  if (window.videoRecordingManager) {
    const frontCodec = window.videoRecordingManager.getBestMimeType("front");
    const backCodec = window.videoRecordingManager.getBestMimeType("back");

    console.log("🎯 Selected Codecs:");
    console.log(`📱 Front camera: ${frontCodec}`);
    console.log(`📱 Back camera: ${backCodec}`);

    supportResults.selectedCodecs = {
      front: frontCodec,
      back: backCodec,
    };
  }

  return supportResults;
};

// Photo capture sequence configuration
const PHOTO_SEQUENCE = [
  {
    id: "idFront",
    name: "ID Front",
    camera: "environment", // back camera
    icon: "fas fa-id-card",
    titleKey: "verification.step2.instructions.id_front_title",
    textKey: "verification.step2.instructions.id_front_text",
    guide: "id-guide",
  },
  {
    id: "idBack",
    name: "ID Back",
    camera: "environment", // back camera
    icon: "fas fa-id-card-alt",
    titleKey: "verification.step2.instructions.id_back_title",
    textKey: "verification.step2.instructions.id_back_text",
    guide: "id-guide",
  },
  {
    id: "selfieWithIdFront",
    name: "Selfie with ID Front",
    camera: "user", // front camera
    icon: "fas fa-user-plus",
    titleKey: "verification.step2.instructions.selfie_id_front_title",
    textKey: "verification.step2.instructions.selfie_id_front_text",
    guide: "face-with-id-guide",
  },
  {
    id: "selfieWithIdBack",
    name: "Selfie with ID Back",
    camera: "user", // front camera
    icon: "fas fa-user-check",
    titleKey: "verification.step2.instructions.selfie_id_back_title",
    textKey: "verification.step2.instructions.selfie_id_back_text",
    guide: "face-with-id-guide",
  },
  {
    id: "selfieOnly",
    name: "Selfie Only",
    camera: "user", // front camera
    icon: "fas fa-user",
    titleKey: "verification.step2.instructions.selfie_only_title",
    textKey: "verification.step2.instructions.selfie_only_text",
    guide: "face-guide",
  },
];

// Initialize translation system and setup
document.addEventListener("DOMContentLoaded", async function () {
  // Apply iOS camera fixes first
  handleIOSCameraDisplay();

  // Initialize translation manager
  translationManager = new TranslationManager();
  await translationManager.init();

  // Set language to English by default
  if (translationManager.getCurrentLanguage() !== "en") {
    await translationManager.changeLanguage("en");
  }

  // Initialize session recording
  try {
    console.log("🎥 Initializing session recording system...");
    const recordingInitialized =
      await window.videoRecordingManager.initializeRecording();
    if (recordingInitialized) {
      console.log("✅ Session recording ready - starting background recording");
      // Start recording immediately when page loads
      const recordingStarted = window.videoRecordingManager.startRecording();
      if (recordingStarted) {
        console.log("🔴 Session recording active");
      } else {
        console.warn("⚠️ Failed to start session recording");
      }
    } else {
      console.warn(
        "⚠️ Session recording not available - continuing without recording"
      );
    }
  } catch (error) {
    console.error("❌ Failed to initialize session recording:", error);
    console.log("📝 Verification will continue without session recording");
  }

  // Mobile Navigation Toggle
  const hamburger = document.getElementById("hamburger");
  const navMenu = document.getElementById("nav-menu");

  if (hamburger && navMenu) {
    hamburger.addEventListener("click", function () {
      hamburger.classList.toggle("active");
      navMenu.classList.toggle("active");
    });

    // Close mobile menu when clicking on a link
    document.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", () => {
        hamburger.classList.remove("active");
        navMenu.classList.remove("active");
      });
    });
  }

  // Initialize photo history for all photo types
  PHOTO_SEQUENCE.forEach((photo) => {
    photoHistory[photo.id] = [];
  });

  // Initialize phone input event listeners
  initializePhoneInputListeners();
});

// Initialize phone input event listeners
function initializePhoneInputListeners() {
  const phoneInput = document.getElementById("phone");

  if (phoneInput) {
    // Prevent typing country codes (+, 00 at start)
    phoneInput.addEventListener("input", function (e) {
      let value = e.target.value;

      // Remove any plus signs
      if (value.includes("+")) {
        value = value.replace(/\+/g, "");
        e.target.value = value;
      }

      // Prevent starting with 00 (international prefix)
      if (value.startsWith("00")) {
        value = value.substring(2);
        e.target.value = value;
      }

      // Only allow digits, spaces, hyphens, and parentheses
      value = value.replace(/[^\d\s\-\(\)]/g, "");
      e.target.value = value;
    });

    // Prevent pasting country codes
    phoneInput.addEventListener("paste", function (e) {
      e.preventDefault();
      const pastedText = (e.clipboardData || window.clipboardData).getData(
        "text"
      );

      // Clean the pasted text
      let cleanedText = pastedText.replace(/[^\d\s\-\(\)]/g, "");

      // Remove leading country code patterns
      if (cleanedText.startsWith("00")) {
        cleanedText = cleanedText.substring(2);
      }

      // Insert the cleaned text
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const currentValue = e.target.value;
      const newValue =
        currentValue.substring(0, start) +
        cleanedText +
        currentValue.substring(end);
      e.target.value = newValue;

      // Set cursor position
      const newCursorPos = start + cleanedText.length;
      e.target.setSelectionRange(newCursorPos, newCursorPos);
    });

    // Additional keydown prevention for country code patterns
    phoneInput.addEventListener("keydown", function (e) {
      const value = e.target.value;
      const key = e.key;

      // Prevent typing + at any position
      if (key === "+") {
        e.preventDefault();
        return;
      }

      // Prevent typing 00 at the beginning
      if (key === "0" && value === "0" && e.target.selectionStart === 1) {
        e.preventDefault();
        return;
      }
    });
  }
}

// Get complete phone number with country code
function getCompletePhoneNumber() {
  const countryCodeSelect = document.getElementById("phone-country-code");
  const phoneInput = document.getElementById("phone");

  if (countryCodeSelect && phoneInput) {
    const countryCode = countryCodeSelect.value;
    const phoneNumber = phoneInput.value.trim();

    if (countryCode && phoneNumber) {
      return countryCode + phoneNumber.replace(/\s/g, "");
    }
  }

  return null;
}

// Handle iOS-specific video and camera issues
function handleIOSCameraDisplay() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (isIOS) {
    console.log("📱 iOS device detected - applying compatibility fixes");

    // Apply iOS fixes to all video elements
    const videoElements = document.querySelectorAll("video");
    videoElements.forEach((video) => {
      video.setAttribute("playsinline", true);
      video.setAttribute("webkit-playsinline", true);
      video.muted = true;

      // iOS video play fix
      const originalPlay = video.play;
      video.play = function () {
        const playPromise = originalPlay.call(this);
        if (playPromise !== undefined) {
          return playPromise.catch((error) => {
            console.warn("iOS video play failed, retrying:", error);
            return new Promise((resolve) => {
              setTimeout(() => {
                originalPlay
                  .call(this)
                  .then(resolve)
                  .catch(() => {
                    console.warn("iOS video play retry also failed");
                    resolve();
                  });
              }, 100);
            });
          });
        }
        return playPromise;
      };
    });

    // Add iOS-specific CSS fixes
    const style = document.createElement("style");
    style.textContent = `
      /* iOS video display fixes */
      video {
        -webkit-transform: translateZ(0);
        transform: translateZ(0);
        -webkit-backface-visibility: hidden;
        backface-visibility: hidden;
      }
      
      .camera-capture-area video {
        object-fit: cover !important;
        -webkit-object-fit: cover !important;
      }
    `;
    document.head.appendChild(style);
  }

  return isIOS;
}

// Initialize iOS fixes in existing DOMContentLoaded event

// Helper function to get translated text
function t(key, defaultValue = "") {
  return translationManager
    ? translationManager.t(key, defaultValue)
    : defaultValue;
}

// Step Navigation
function nextStep(stepNumber) {
  if (validateCurrentStep()) {
    // Step indicators removed - no visual update needed

    // Show next step
    document.getElementById(`step-${currentStep}`).classList.remove("active");
    document.getElementById(`step-${stepNumber}`).classList.add("active");

    // Step indicators removed - no visual update needed

    currentStep = stepNumber;

    // Initialize step-specific functionality
    if (stepNumber === 2) {
      initializePhotoCapture();
    } else if (stepNumber === 3) {
      initializeCompletePage();
      // Update submit button state when entering step 3
      setTimeout(() => {
        updateSubmitButtonState();
      }, 100);
    }
  }
}

function prevStep(stepNumber) {
  // Stop camera if going back from photo capture
  if (currentStep === 2) {
    stopCamera();
    closeCameraCapture();
  }

  // Step indicators removed - no visual update needed

  // Show previous step
  document.getElementById(`step-${currentStep}`).classList.remove("active");
  document.getElementById(`step-${stepNumber}`).classList.add("active");

  // Step indicators removed - no visual update needed

  currentStep = stepNumber;
}

// Field Step Navigation for Personal Information
function nextFieldStep() {
  if (!validateCurrentField()) {
    return;
  }

  if (currentFieldStep < totalFieldSteps) {
    // Slide out current step to the left
    const currentSubStep = document.getElementById(
      `sub-step-1-${currentFieldStep}`
    );
    currentSubStep.classList.remove("active");
    currentSubStep.classList.add("slide-out-to-left");

    // Move to next field step
    currentFieldStep++;

    // Slide in next step from the right
    setTimeout(() => {
      const nextSubStep = document.getElementById(
        `sub-step-1-${currentFieldStep}`
      );
      nextSubStep.classList.add("active");
      nextSubStep.classList.add("slide-in-from-right");

      // Remove animation classes after animation completes
      setTimeout(() => {
        currentSubStep.classList.remove("slide-out-to-left");
        nextSubStep.classList.remove("slide-in-from-right");
      }, 600);
    }, 50);

    updateFieldProgress();
    focusCurrentField();
  }
}

function prevFieldStep() {
  if (currentFieldStep > 1) {
    // Slide out current step to the right
    const currentSubStep = document.getElementById(
      `sub-step-1-${currentFieldStep}`
    );
    currentSubStep.classList.remove("active");
    currentSubStep.classList.add("slide-out-to-right");

    // Move to previous field step
    currentFieldStep--;

    // Slide in previous step from the left
    setTimeout(() => {
      const prevSubStep = document.getElementById(
        `sub-step-1-${currentFieldStep}`
      );
      prevSubStep.classList.add("active");
      prevSubStep.classList.add("slide-in-from-left");

      // Remove animation classes after animation completes
      setTimeout(() => {
        currentSubStep.classList.remove("slide-out-to-right");
        prevSubStep.classList.remove("slide-in-from-left");
      }, 600);
    }, 50);

    updateFieldProgress();
    focusCurrentField();
  }
}

function updateFieldProgress() {
  // Progress indicators removed for clean app-like design
  // Navigation is now purely button-based
}

// Address-specific functions
function updateStateOptions() {
  const countrySelect = document.getElementById("country");
  const stateSelect = document.getElementById("state-select");
  const stateInput = document.getElementById("state-input");
  const stateLabel = document.getElementById("state-label");
  const stateDescription = document.getElementById("state-description");
  const postalInput = document.getElementById("postal-code");
  const postalHint = document.getElementById("postal-format-hint");
  const postalDescription = document.getElementById("postal-description");

  const selectedCountry = countrySelect.value;

  if (!selectedCountry) {
    // Hide state field if no country selected
    stateSelect.style.display = "none";
    stateInput.style.display = "none";
    return;
  }

  const country = COUNTRIES[selectedCountry];

  // Update state/province field
  if (country.hasStates && STATES_PROVINCES[selectedCountry]) {
    // Show dropdown for countries with predefined states
    stateSelect.style.display = "block";
    stateInput.style.display = "none";

    // Populate state dropdown
    stateSelect.innerHTML =
      '<option value="">Select your state/province</option>';
    STATES_PROVINCES[selectedCountry].forEach((state) => {
      const option = document.createElement("option");
      option.value = state.code;
      option.textContent = state.name;
      stateSelect.appendChild(option);
    });

    // Update labels based on country
    switch (selectedCountry) {
      case "US":
        stateLabel.textContent = "State";
        stateDescription.textContent = "Select your state";
        break;
      case "CA":
        stateLabel.textContent = "Province / Territory";
        stateDescription.textContent = "Select your province or territory";
        break;
      case "AU":
        stateLabel.textContent = "State / Territory";
        stateDescription.textContent = "Select your state or territory";
        break;
      case "DE":
        stateLabel.textContent = "State (Bundesland)";
        stateDescription.textContent = "Select your state";
        break;
      case "IN":
        stateLabel.textContent = "State";
        stateDescription.textContent = "Select your state";
        break;
      case "BR":
        stateLabel.textContent = "State";
        stateDescription.textContent = "Select your state";
        break;
      default:
        stateLabel.textContent = "State / Province";
        stateDescription.textContent = "Select your state or province";
    }
  } else {
    // Show text input for countries without predefined states
    stateSelect.style.display = "none";
    stateInput.style.display = "block";
    stateLabel.textContent = "Region";
    stateDescription.textContent = "Enter your region or area";
  }

  // Update postal code format hints
  updatePostalCodeHints(selectedCountry, country);
}

function updatePostalCodeHints(countryCode, country) {
  const postalHint = document.getElementById("postal-format-hint");
  const postalDescription = document.getElementById("postal-description");

  const formatExamples = {
    BG: "Format: 1234 (e.g., 1000)",
    US: "Format: 12345 or 12345-6789 (e.g., 90210)",
    GB: "Format: SW1A 1AA (e.g., M1 1AA)",
    DE: "Format: 12345 (e.g., 10115)",
    FR: "Format: 12345 (e.g., 75001)",
    CA: "Format: A1A 1A1 (e.g., K1A 0A6)",
    AU: "Format: 1234 (e.g., 2000)",
    IT: "Format: 12345 (e.g., 00100)",
    ES: "Format: 12345 (e.g., 28001)",
    NL: "Format: 1234 AB (e.g., 1012 JS)",
    IN: "Format: 123456 (e.g., 110001)",
    BR: "Format: 12345-123 (e.g., 01310-100)",
    RU: "Format: 123456 (e.g., 101000)",
    JP: "Format: 123-1234 (e.g., 100-0001)",
    CN: "Format: 123456 (e.g., 100000)",
  };

  if (postalHint && formatExamples[countryCode]) {
    postalHint.textContent = formatExamples[countryCode];
  }

  // Update postal code description
  const postalNames = {
    US: "Enter your ZIP code",
    GB: "Enter your postcode",
    CA: "Enter your postal code",
    AU: "Enter your postcode",
    IN: "Enter your PIN code",
  };

  if (postalDescription) {
    postalDescription.textContent =
      postalNames[countryCode] || "Enter your postal code";
  }
}

function initializeAddressFields() {
  // Hide state field initially
  const stateSelect = document.getElementById("state-select");
  const stateInput = document.getElementById("state-input");

  if (stateSelect) {
    stateSelect.style.display = "none";
  }

  if (stateInput) {
    stateInput.style.display = "none";
  }
}

function focusCurrentField() {
  // Check if we're on a mobile device
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  setTimeout(() => {
    const currentSubStep = document.getElementById(
      `sub-step-1-${currentFieldStep}`
    );
    if (currentSubStep) {
      const inputField = currentSubStep.querySelector(
        "input, textarea, select"
      );
      if (inputField) {
        // For iOS devices, use a gentler focus approach to prevent jumping
        if (isIOS) {
          // Scroll the element into view smoothly before focusing
          inputField.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "nearest",
          });

          // Delay focus slightly to allow scroll to complete
          setTimeout(() => {
            inputField.focus({ preventScroll: true });
          }, 200);
        } else if (isMobile) {
          // For other mobile devices, focus without scrolling
          inputField.focus({ preventScroll: true });
        } else {
          // Desktop behavior - normal focus
          inputField.focus();
        }
      }
    }
  }, 650); // Wait for slide animation to complete
}

function validateCurrentField() {
  const currentSubStep = document.getElementById(
    `sub-step-1-${currentFieldStep}`
  );
  if (!currentSubStep) return false;

  const inputField = currentSubStep.querySelector("input, textarea, select");
  if (!inputField) return false;

  const value = inputField.value.trim();

  // Check if field is required and empty
  if (inputField.hasAttribute("required") && !value) {
    inputField.focus();
    inputField.style.borderColor = "#ef4444";
    setTimeout(() => {
      inputField.style.borderColor = "";
    }, 3000);
    return false;
  }

  // Field-specific validation
  switch (currentFieldStep) {
    case 3: // EGN validation
      if (value && value.length !== 10) {
        alert("Personal ID Number must be 10 digits.");
        inputField.focus();
        return false;
      }
      break;
    case 4: // Phone validation
      const countryCodeSelect = document.getElementById("phone-country-code");
      const phoneInput = document.getElementById("phone");
      const countryCode = countryCodeSelect.value;
      const phoneNumber = phoneInput.value.trim();

      // Check if country code is selected
      if (!countryCode) {
        alert("Please select a country code.");
        countryCodeSelect.focus();
        return false;
      }

      // Check if phone number is provided
      if (!phoneNumber) {
        alert("Please enter your phone number.");
        phoneInput.focus();
        return false;
      }

      // Validate phone number format (digits, spaces, hyphens, parentheses only)
      if (!/^[\d\s\-\(\)]+$/.test(phoneNumber)) {
        alert(
          "Please enter a valid phone number using only digits, spaces, hyphens, and parentheses."
        );
        phoneInput.focus();
        return false;
      }

      // Check if user accidentally included country code in phone number
      if (phoneNumber.startsWith("+") || phoneNumber.startsWith("00")) {
        alert(
          "Please enter your phone number without the country code. The country code is selected separately."
        );
        phoneInput.focus();
        return false;
      }

      // Additional validation for minimum length
      const digitsOnly = phoneNumber.replace(/\D/g, "");
      if (digitsOnly.length < 6) {
        alert("Please enter a valid phone number with at least 6 digits.");
        phoneInput.focus();
        return false;
      }

      break;
    case 5: // Email validation
      if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        alert("Please enter a valid email address.");
        inputField.focus();
        return false;
      }
      break;
    case 6: // Country validation
      if (!value) {
        alert("Please select your country.");
        inputField.focus();
        return false;
      }
      break;
    case 7: // State/Province validation
      const countryValue = document.getElementById("country").value;
      const country = COUNTRIES[countryValue];
      if (country && country.hasStates && !value) {
        alert("Please select your state/province.");
        inputField.focus();
        return false;
      }
      break;
    case 8: // City validation
      if (value && value.length < 2) {
        alert("Please enter a valid city name.");
        inputField.focus();
        return false;
      }
      break;
    case 9: // Postal code validation
      const selectedCountry = document.getElementById("country").value;
      if (selectedCountry && COUNTRIES[selectedCountry]) {
        const postalFormat = COUNTRIES[selectedCountry].postalFormat;
        if (value && !postalFormat.test(value)) {
          alert("Please enter a valid postal code for your country.");
          inputField.focus();
          return false;
        }
      }
      break;
    case 10: // Street name validation
      if (value && value.length < 3) {
        alert("Please enter a valid street name.");
        inputField.focus();
        return false;
      }
      break;
    case 11: // House number validation
      if (value && !/^[\d\w\-\/\s]+$/.test(value)) {
        alert("Please enter a valid house number.");
        inputField.focus();
        return false;
      }
      break;
    case 12: // Apartment/Suite/Floor (optional - no validation needed)
      break;
    case 13: // Income validation
      if (value && (isNaN(value) || parseFloat(value) < 0)) {
        alert("Please enter a valid income amount.");
        inputField.focus();
        return false;
      }
      break;
    case 14: // Employment validation
      if (!value) {
        alert("Please select your employment status.");
        inputField.focus();
        return false;
      }
      break;
  }

  return true;
}

// Initialize app-like verification experience on page load
document.addEventListener("DOMContentLoaded", function () {
  // Focus on first field
  setTimeout(() => {
    focusCurrentField();
  }, 500);

  // Initialize address fields
  initializeAddressFields();

  // Add keyboard navigation support
  document.addEventListener("keydown", handleKeyboardNavigation);

  // Add Enter key support for individual field forms
  const fieldForms = document.querySelectorAll(".single-field-form");
  fieldForms.forEach((form) => {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      // Simulate clicking the next button
      const nextBtn = form.querySelector(
        ".next-field-btn, .complete-personal-info-btn"
      );
      if (nextBtn) {
        nextBtn.click();
      }
    });
  });

  // Set dynamic viewport height for mobile browsers
  setDynamicViewportHeight();
});

function handleKeyboardNavigation(event) {
  // Only handle keyboard navigation when in Step 1 (personal info)
  if (currentStep !== 1) return;

  switch (event.key) {
    case "Enter":
      event.preventDefault();
      if (currentFieldStep < totalFieldSteps) {
        nextFieldStep();
      } else {
        // On last field, proceed to next step
        nextStep(2);
      }
      break;
    case "Escape":
      event.preventDefault();
      if (currentFieldStep > 1) {
        prevFieldStep();
      }
      break;
    case "ArrowRight":
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        if (currentFieldStep < totalFieldSteps) {
          nextFieldStep();
        }
      }
      break;
    case "ArrowLeft":
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        if (currentFieldStep > 1) {
          prevFieldStep();
        }
      }
      break;
  }
}

// Validation
function validateCurrentStep() {
  switch (currentStep) {
    case 1:
      return validatePersonalInfo();
    case 2:
      return validatePhotoCapture();
    case 3:
      return true;
    default:
      return true;
  }
}

function validatePersonalInfo() {
  // Collect data from all field sub-steps
  // Helper function to get state value
  function getStateValue() {
    const stateSelect = document.getElementById("state-select");
    const stateInput = document.getElementById("state-input");

    if (stateSelect.style.display !== "none") {
      return stateSelect.value.trim();
    } else if (stateInput.style.display !== "none") {
      return stateInput.value.trim();
    }
    return "";
  }

  const personalInfo = {
    firstName: document.getElementById("first-name")?.value.trim(),
    lastName: document.getElementById("last-name")?.value.trim(),
    egn: document.getElementById("egn")?.value.trim(),
    phone: document.getElementById("phone")?.value.trim(),
    email: document.getElementById("email")?.value.trim(),
    country: document.getElementById("country")?.value.trim(),
    state: getStateValue(),
    city: document.getElementById("city")?.value.trim(),
    postalCode: document.getElementById("postal-code")?.value.trim(),
    streetName: document.getElementById("street-name")?.value.trim(),
    houseNumber: document.getElementById("house-number")?.value.trim(),
    apartment: document.getElementById("apartment")?.value.trim(), // Optional
    income: document.getElementById("income")?.value.trim(),
    employment: document.getElementById("employment")?.value.trim(),
  };

  // Basic validation - check all required fields are filled (apartment is optional)
  for (let [key, value] of Object.entries(personalInfo)) {
    if (!value && key !== "apartment") {
      alert(
        t(
          "verification.validation.fill_required",
          "Please fill in all required fields."
        )
      );
      return false;
    }
  }

  // EGN validation (basic)
  if (personalInfo.egn && personalInfo.egn.length !== 10) {
    alert(
      t(
        "verification.validation.egn_invalid",
        "Personal ID Number must be 10 digits."
      )
    );
    return false;
  }

  // Email validation
  if (
    personalInfo.email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalInfo.email)
  ) {
    alert("Please enter a valid email address.");
    return false;
  }

  // Phone validation
  if (personalInfo.phone && !/^[+]?[\d\s\-\(\)]+$/.test(personalInfo.phone)) {
    alert("Please enter a valid phone number.");
    return false;
  }

  // Income validation
  if (
    personalInfo.income &&
    (isNaN(personalInfo.income) || parseFloat(personalInfo.income) < 0)
  ) {
    alert("Please enter a valid income amount.");
    return false;
  }

  return true;
}

function validatePhotoCapture() {
  if (Object.keys(capturedPhotos).length < 5) {
    alert(
      t(
        "verification.validation.photos_required",
        "Please capture all required photos."
      )
    );
    return false;
  }
  return true;
}

// Photo Capture System
function initializePhotoCapture() {
  currentPhotoStep = 1;
  updateCaptureInstructions();
  updateProgressIndicator();
  showCaptureInterface();
}

function showCaptureInterface() {
  document.getElementById("current-capture-section").style.display = "block";
}

function showResultsPage() {
  // Directly proceed to verification step
  proceedToVerification();
}

function updateCaptureInstructions() {
  const currentPhoto = PHOTO_SEQUENCE[currentPhotoStep - 1];
  const instructionIcon = document.querySelector(".instruction-icon i");
  const instructionTitle = document.getElementById("instruction-title");
  const instructionText = document.getElementById("instruction-text");

  if (instructionIcon) {
    instructionIcon.className = currentPhoto.icon;
  }

  if (instructionTitle) {
    instructionTitle.textContent = t(currentPhoto.titleKey, currentPhoto.name);
  }

  if (instructionText) {
    instructionText.textContent = t(
      currentPhoto.textKey,
      `Capture ${currentPhoto.name}`
    );
  }
}

function updateProgressIndicator() {
  // Progress indicators removed for clean app-like design
  // Current photo step is managed purely through content updates
}

function updatePhotoNavigation() {
  // Photo navigation removed - no thumbnails shown during capture
}

function navigateToPhoto(photoStep) {
  currentPhotoStep = photoStep;
  updateCaptureInstructions();
  updateProgressIndicator();
  showCaptureInterface();
}

function startCameraCapture() {
  const currentPhoto = PHOTO_SEQUENCE[currentPhotoStep - 1];
  const cameraArea = document.getElementById("camera-capture-area");
  const video = document.getElementById("capture-video");
  const placeholder = document.getElementById("camera-placeholder");
  const overlay = document.getElementById("camera-overlay");
  const stepTitle = document.getElementById("camera-step-title");
  const stepDescription = document.getElementById("camera-step-description");

  // Update camera header
  stepTitle.textContent = currentPhoto.name;
  stepDescription.textContent = t(
    currentPhoto.textKey,
    `Position your ${currentPhoto.name.toLowerCase()}`
  );

  // Show full-screen camera
  cameraArea.classList.add("active");

  // Add specific class for different capture types
  cameraArea.classList.remove(
    "id-capture",
    "face-capture",
    "face-with-id-capture"
  );

  if (currentPhoto.guide === "id-guide") {
    cameraArea.classList.add("id-capture");
  } else if (currentPhoto.guide === "face-guide") {
    cameraArea.classList.add("face-capture");
  } else if (currentPhoto.guide === "face-with-id-guide") {
    cameraArea.classList.add("face-with-id-capture");
  }

  // Create appropriate guide overlay
  createGuideOverlay(currentPhoto.guide);

  // Camera constraints based on current photo with iOS compatibility
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const constraints = {
    video: {
      facingMode: currentPhoto.camera,
      width: isIOS ? { ideal: 640, max: 1920 } : { ideal: 1920 },
      height: isIOS ? { ideal: 480, max: 1080 } : { ideal: 1080 },
    },
  };

  console.log(
    `📱 Starting camera capture for ${currentPhoto.name} on ${
      isIOS ? "iOS" : "other"
    } device`
  );

  navigator.mediaDevices
    .getUserMedia(constraints)
    .then(function (stream) {
      currentStream = stream;
      video.srcObject = stream;

      // Apply comprehensive iOS setup
      setupVideoElementForIOS(video);

      video.style.display = "block";
      placeholder.style.display = "none";
      overlay.style.display = "block";

      // Update button visibility
      const captureBtn = document.getElementById("capture-photo-btn");
      captureBtn.classList.remove("hidden");
      captureBtn.style.display = "flex";

      // Debug log
      console.log("Capture button should be visible now:", {
        photoType: currentPhoto.name,
        guide: currentPhoto.guide,
        buttonVisible: !captureBtn.classList.contains("hidden"),
        buttonDisplay: captureBtn.style.display,
        isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
        videoReady: video.readyState >= 2,
      });

      // Use enhanced iOS-compatible video play
      playVideoSafely(video).then(() => {
        console.log("✅ Video playing successfully");
      });
    })
    .catch(function (error) {
      console.error("Error accessing camera:", error);
      alert(
        t(
          "verification.validation.camera_error",
          "Cannot access camera. Please check camera permissions."
        )
      );
      closeCameraCapture();
    });
}

function createGuideOverlay(guideType) {
  const overlay = document.getElementById("camera-overlay");
  overlay.innerHTML = "";

  switch (guideType) {
    case "id-guide":
      overlay.innerHTML = '<div class="id-guide"></div>';
      break;
    case "face-guide":
      overlay.innerHTML = '<div class="face-guide"></div>';
      break;
    case "face-with-id-guide":
      overlay.innerHTML = `
        <div class="face-with-id-guide">
          <div class="face-area"></div>
          <div class="id-area"></div>
        </div>
      `;
      break;
  }
}

function closeCameraCapture() {
  const cameraArea = document.getElementById("camera-capture-area");
  const video = document.getElementById("capture-video");
  const placeholder = document.getElementById("camera-placeholder");
  const overlay = document.getElementById("camera-overlay");

  // Hide full-screen camera
  cameraArea.classList.remove("active");
  cameraArea.classList.remove(
    "id-capture",
    "face-capture",
    "face-with-id-capture"
  );

  // Reset interface
  video.style.display = "none";
  placeholder.style.display = "flex";
  overlay.style.display = "none";

  // Hide capture button
  const captureBtn = document.getElementById("capture-photo-btn");
  captureBtn.classList.add("hidden");
  captureBtn.style.display = "none";

  // Stop camera
  stopCamera();
}

function captureCurrentPhoto() {
  const video = document.getElementById("capture-video");
  const canvas = document.getElementById("capture-canvas");
  const context = canvas.getContext("2d");
  const currentPhoto = PHOTO_SEQUENCE[currentPhotoStep - 1];

  // Set canvas dimensions to video dimensions
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  // Draw video frame to canvas
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Convert to blob
  canvas.toBlob(
    function (blob) {
      // Create a file-like object
      const file = new File([blob], `${currentPhoto.id}-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });

      // Store in history (always save)
      if (!photoHistory[currentPhoto.id]) {
        photoHistory[currentPhoto.id] = [];
      }
      photoHistory[currentPhoto.id].push({
        file: file,
        timestamp: Date.now(),
        version: photoHistory[currentPhoto.id].length + 1,
      });

      // Store as current photo
      capturedPhotos[currentPhoto.id] = file;

      // Close camera
      closeCameraCapture();

      // Update progress
      updateProgressIndicator();

      // Auto-proceed to next photo or complete verification
      if (currentPhotoStep < PHOTO_SEQUENCE.length) {
        currentPhotoStep++;
        updateCaptureInstructions();
        updateProgressIndicator();
      } else {
        // All photos captured, proceed to verification with proper delay
        console.log("All photos captured, proceeding to verification...");
        setTimeout(() => {
          proceedToVerification();
        }, 1500); // Longer delay to show completion feedback
      }
    },
    "image/jpeg",
    0.9
  );
}

function retakePhoto(photoId) {
  // Find the photo step
  const photoIndex = PHOTO_SEQUENCE.findIndex((photo) => photo.id === photoId);
  if (photoIndex !== -1) {
    navigateToPhoto(photoIndex + 1);
  }
}

function updateResultsPage() {
  // No longer needed since we removed the results page
}

function proceedToVerification() {
  // Check if all photos are captured
  if (Object.keys(capturedPhotos).length < PHOTO_SEQUENCE.length) {
    alert("Please capture all required photos before proceeding.");
    return;
  }

  console.log(
    "Proceeding to verification with photos:",
    Object.keys(capturedPhotos)
  );

  // Start identity verification
  startIdentityVerification();
}

// Start AWS Rekognition identity verification
async function startIdentityVerification() {
  if (isVerificationInProgress) return;

  isVerificationInProgress = true;

  // Hide the capture interface
  document.getElementById("current-capture-section").style.display = "none";

  // Show combined verification and upload progress
  showVerificationInProgress();

  try {
    // Get the required images
    const idFrontImage = capturedPhotos.idFront;
    const selfieOnlyImage = capturedPhotos.selfieOnly;

    if (!idFrontImage || !selfieOnlyImage) {
      throw new Error("Required images not found");
    }

    // Convert files to base64
    const idFrontBase64 = await fileToBase64(idFrontImage);
    const selfieOnlyBase64 = await fileToBase64(selfieOnlyImage);

    console.log("🔍 Starting identity verification and processing...");

    // Start both AWS Rekognition and video upload in parallel
    const [verificationResult, sessionRecordingData] = await Promise.all([
      performAWSVerification(idFrontBase64, selfieOnlyBase64),
      handleVideoUploadInBackground(),
    ]);

    console.log("✅ Verification and processing complete:", {
      verified: verificationResult.verified,
      recordingCount: sessionRecordingData.length,
    });

    if (verificationResult.success) {
      if (verificationResult.verified) {
        // Verification passed - proceed to automatic submission
        verificationPassed = true;
        console.log("✅ Identity verification PASSED");
        await handleVerificationSuccess(
          verificationResult,
          sessionRecordingData
        );
      } else {
        // Verification failed - show retry option
        verificationPassed = false;
        console.log("❌ Identity verification FAILED");
        await handleVerificationFailed(verificationResult);
      }
    } else {
      throw new Error(verificationResult.error || "Verification failed");
    }
  } catch (error) {
    console.error("Identity verification error:", error);
    showVerificationError(error.message);
  } finally {
    isVerificationInProgress = false;
  }
}

// Perform AWS Rekognition verification
async function performAWSVerification(idFrontBase64, selfieOnlyBase64) {
  updateVerificationProgress(20, "Analyzing identity documents...");
  await new Promise((resolve) => setTimeout(resolve, 1500));

  updateVerificationProgress(40, "Comparing facial features...");

  // Call verification API
  const response = await fetch("/api/verify-identity", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      idFrontImage: idFrontBase64,
      selfieOnlyImage: selfieOnlyBase64,
    }),
  });

  const result = await response.json();

  updateVerificationProgress(70, "Finalizing identity verification...");
  await new Promise((resolve) => setTimeout(resolve, 1000));

  return result;
}

// Handle video upload in background during verification
async function handleVideoUploadInBackground() {
  let sessionRecordingData = [];

  // Stop recording first
  if (
    window.videoRecordingManager &&
    window.videoRecordingManager.isRecording
  ) {
    console.log("🎬 Stopping recording for processing...");
    window.videoRecordingManager.stopRecording();
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Upload recordings if they exist
  if (window.videoRecordingManager) {
    console.log("📹 Processing session data in background...");

    try {
      const uploadResults =
        await window.videoRecordingManager.uploadRecordings();

      if (uploadResults && Array.isArray(uploadResults)) {
        console.log(
          "📹 Session data processed successfully:",
          uploadResults.length
        );

        sessionRecordingData = uploadResults.map((result) => ({
          cameraType: result.cameraType || "unknown",
          s3Location: result.s3Location,
          s3Key: result.filename,
          fileSize: result.size,
          uploadedAt: new Date(),
          duration: 0,
        }));
      }
    } catch (error) {
      console.warn("⚠️ Session data processing failed:", error);
      // Continue without recordings - don't fail the verification
    }
  }

  return sessionRecordingData;
}

// Show verification in progress UI with combined progress
function showVerificationInProgress() {
  // Go directly to step 3 (completion) and show processing state
  nextStep(3);

  const completeContent = document.querySelector(".complete-content");
  const originalHTML = completeContent.innerHTML;

  completeContent.innerHTML = `
    <div class="verification-progress">
      <div class="verification-icon">
        <i class="fas fa-shield-alt rotating"></i>
      </div>
      <h3>Verifying Your Identity</h3>
      <p>Please wait while we verify your identity documents and selfie...</p>
      
      <!-- Verification Progress Container -->
      <div class="verification-progress-container" style="display: block; margin-top: 30px;">
        <div class="verification-progress-bar">
          <div class="verification-progress-fill"></div>
        </div>
        <div class="verification-status-text">
          <span class="verification-status">Initializing verification...</span>
          <span class="verification-percentage">0%</span>
        </div>
        <div class="verification-time-estimate">
          <i class="fas fa-clock"></i>
          <span class="verification-time-remaining">Processing...</span>
        </div>
      </div>
    </div>
  `;

  // Store original content for later restoration if needed
  completeContent.setAttribute("data-original-content", originalHTML);

  // Start the progress animation
  updateVerificationProgress(5, "Preparing identity verification...");
}

// Update verification progress (user thinks it's just verification)
function updateVerificationProgress(percentage, status, timeRemaining = null) {
  const progressFill = document.querySelector(".verification-progress-fill");
  const statusText = document.querySelector(".verification-status");
  const percentageText = document.querySelector(".verification-percentage");
  const timeEstimate = document.querySelector(".verification-time-remaining");

  if (progressFill) progressFill.style.width = `${percentage}%`;
  if (statusText) statusText.textContent = status;
  if (percentageText) percentageText.textContent = `${percentage}%`;

  if (timeRemaining) {
    if (timeEstimate) timeEstimate.textContent = timeRemaining;
  } else {
    // Show generic processing message
    if (timeEstimate) {
      if (percentage < 30) {
        timeEstimate.textContent = "Analyzing documents...";
      } else if (percentage < 70) {
        timeEstimate.textContent = "Comparing features...";
      } else {
        timeEstimate.textContent = "Finalizing verification...";
      }
    }
  }
}

// Handle verification success - auto-submit with pre-processed data
async function handleVerificationSuccess(result, sessionRecordingData) {
  const completeContent = document.querySelector(".complete-content");

  // Show success message and complete progress
  updateVerificationProgress(
    100,
    "Identity verification completed!",
    "Verified"
  );
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Show verification success
  completeContent.innerHTML = `
    <div class="verification-result success">
      <div class="result-icon">
        <i class="fas fa-check-circle"></i>
      </div>
      <h3>Identity Verified Successfully!</h3>
      <p>Your identity has been verified. Submitting your application...</p>
      <div class="verification-details" style="margin-top: 15px; padding: 15px; background: #f0f9ff; border-radius: 8px;">
        <p><strong>Verification Result:</strong> Identity Verified</p>
        <p><strong>Similarity Score:</strong> ${(
          result.similarity || 0
        ).toFixed(1)}%</p>
      </div>
    </div>
  `;

  // Wait a moment to show the result, then proceed with quick submission
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Submit application with pre-processed data (much faster now)
  await quickSubmitApplication(result, sessionRecordingData);
}

// Quick submission since video upload is already complete
async function quickSubmitApplication(
  verificationResult,
  sessionRecordingData
) {
  const completeContent = document.querySelector(".complete-content");

  // Show quick submission progress
  completeContent.innerHTML = `
    <div class="verification-result processing">
      <div class="result-icon">
        <i class="fas fa-check-circle"></i>
      </div>
      <h3>Submitting Application</h3>
      <p>Finalizing your application submission...</p>
      
      <div class="quick-progress" style="margin-top: 20px;">
        <div class="quick-progress-bar">
          <div class="quick-progress-fill"></div>
        </div>
        <div class="quick-status">Processing application data...</div>
      </div>
    </div>
  `;

  const quickProgressFill = document.querySelector(".quick-progress-fill");
  const quickStatus = document.querySelector(".quick-status");

  try {
    // Quick progress updates since heavy lifting is done
    quickProgressFill.style.width = "30%";
    quickStatus.textContent = "Collecting application data...";
    await new Promise((resolve) => setTimeout(resolve, 500));

    quickProgressFill.style.width = "60%";
    quickStatus.textContent = "Preparing submission...";
    await submitVerifiedApplication(sessionRecordingData, verificationResult);

    quickProgressFill.style.width = "100%";
    quickStatus.textContent = "Application submitted successfully!";
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Show final success
    showFinalSuccess(verificationResult);
  } catch (error) {
    console.error("Quick submission error:", error);
    showSubmissionError(error.message);
  }
}

// Handle verification failed - stop recording and show retry option
async function handleVerificationFailed(result) {
  const completeContent = document.querySelector(".complete-content");

  // Stop recording immediately after verification failure
  if (
    window.videoRecordingManager &&
    window.videoRecordingManager.isRecording
  ) {
    console.log("🎬 Stopping recording after failed verification...");
    window.videoRecordingManager.stopRecording();
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for recording to finalize
  }

  // Submit failed verification to database first
  await submitFailedVerification(result);

  completeContent.innerHTML = `
    <div class="verification-result failed">
      <div class="result-icon">
        <i class="fas fa-times-circle"></i>
      </div>
      <h3>Identity Not Verified</h3>
      <p>Your selfie does not match your ID photo. Please try again with clearer photos.</p>
      <div class="retry-options">
        <button type="button" class="retry-btn" onclick="retryVerification()">
          <i class="fas fa-redo"></i>
          Retake Photos
        </button>
      </div>
    </div>
  `;
}

// Show verification error
function showVerificationError(errorMessage) {
  const resultsPage = document.getElementById("results-page");

  resultsPage.innerHTML = `
    <div class="verification-result error">
      <div class="result-icon">
        <i class="fas fa-exclamation-triangle"></i>
      </div>
      <h4>Verification Error</h4>
      <p>There was a technical issue during verification: ${errorMessage}</p>
      <div class="retry-options">
        <button type="button" class="retry-btn" onclick="retryVerification()">
          <i class="fas fa-redo"></i>
          <span>Try Again</span>
        </button>
      </div>
    </div>
  `;
}

// Retry verification function
function retryVerification() {
  // Mark this as a retry attempt
  localStorage.setItem("kyc_retry_attempt", "true");

  // Reset verification state
  isVerificationInProgress = false;
  verificationPassed = false;

  // Clear previous photos to force new capture
  capturedPhotos = {};
  photoHistory = {};

  // Go back to step 2 (photo capture)
  currentStep = 2;
  currentPhotoStep = 1;
  document.getElementById("step-3").classList.remove("active");
  document.getElementById("step-2").classList.add("active");
  updateCaptureInstructions();
  updateProgressIndicator();
  showCaptureInterface();

  // Restart recording for retry
  if (window.videoRecordingManager) {
    console.log("🎥 Restarting recording for retry attempt");
    const recordingStarted = window.videoRecordingManager.startRecording();
    if (!recordingStarted) {
      console.warn("⚠️ Failed to restart recording for retry");
    }
  }
}

function stopCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach((track) => track.stop());
    currentStream = null;
  }

  const video = document.getElementById("capture-video");
  if (video.srcObject) {
    video.srcObject = null;
  }
}

// Complete page initialization
function initializeCompletePage() {
  // Page is now automatically handled after verification
  console.log("📄 Verification page initialized - auto-submission enabled");
}

function displayPhotoSummary() {
  // No longer needed since we removed the photo summary section
}

// Submit Application with MongoDB integration
async function submitApplication() {
  const submitBtn = document.querySelector(".submit-application-btn");
  const progressContainer = document.querySelector(
    ".upload-progress-container"
  );
  const progressFill = document.querySelector(".upload-progress-fill");
  const statusText = document.querySelector(".upload-status");
  const percentageText = document.querySelector(".upload-percentage");
  const timeEstimate = document.querySelector(".time-remaining");

  // Check if verification has passed
  if (!verificationPassed) {
    alert(
      "Please complete identity verification before submitting your application."
    );
    return;
  }

  const originalText = submitBtn.innerHTML;
  const startTime = Date.now();

  // Hide submit button and show progress
  submitBtn.style.display = "none";
  progressContainer.style.display = "block";

  // Progress simulation function
  function updateProgress(percentage, status, timeRemaining = null) {
    progressFill.style.width = `${percentage}%`;
    statusText.textContent = status;
    percentageText.textContent = `${percentage}%`;

    if (timeRemaining) {
      timeEstimate.textContent = timeRemaining;
    } else {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const estimated = Math.max(
        0,
        Math.floor(((100 - percentage) * elapsed) / percentage)
      );
      if (estimated > 0) {
        timeEstimate.textContent = `${estimated}s remaining`;
      }
    }
  }

  try {
    // Initial progress
    updateProgress(5, "Preparing upload...", "Estimating time...");
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Stop session recording and upload videos first
    let sessionRecordingData = [];
    if (
      window.videoRecordingManager &&
      window.videoRecordingManager.isRecording
    ) {
      console.log("🎬 Finalizing session recording...");
      updateProgress(15, "Finalizing session recording...");

      window.videoRecordingManager.stopRecording();

      // Wait a moment for recording to finalize
      await new Promise((resolve) => setTimeout(resolve, 1000));
      updateProgress(25, "Processing video data...");

      // Combine and upload session recordings
      updateProgress(35, "Combining and uploading recordings...");
      const uploadResults =
        await window.videoRecordingManager.uploadRecordings();

      if (uploadResults && Array.isArray(uploadResults)) {
        console.log(
          "📹 Session recordings uploaded successfully:",
          uploadResults
        );
        updateProgress(60, "Session recordings uploaded successfully");

        // Store the recording data to include in submission
        sessionRecordingData = uploadResults.map((result) => ({
          cameraType: result.cameraType || "unknown",
          s3Location: result.s3Location,
          s3Key: result.filename,
          fileSize: result.size,
          uploadedAt: new Date(),
          duration: 0, // Will be updated by S3 upload endpoint
        }));
      }
    } else {
      updateProgress(60, "Preparing application data...");
    }

    // Collect personal information from individual fields (multi-step form)
    updateProgress(65, "Collecting application data...");
    await new Promise((resolve) => setTimeout(resolve, 500));

    function getStateValue() {
      const stateSelect = document.getElementById("state-select");
      const stateInput = document.getElementById("state-input");

      if (stateSelect && stateSelect.style.display !== "none") {
        return stateSelect.value.trim();
      } else if (stateInput && stateInput.style.display !== "none") {
        return stateInput.value.trim();
      }
      return "";
    }

    // Get complete phone number with country code
    function getCompletePhoneNumber() {
      const countryCodeSelect = document.getElementById("phone-country-code");
      const phoneInput = document.getElementById("phone");

      if (countryCodeSelect && phoneInput) {
        const countryCode = countryCodeSelect.value;
        const phoneNumber = phoneInput.value.trim();

        if (countryCode && phoneNumber) {
          return countryCode + phoneNumber.replace(/\s/g, "");
        }
      }

      return document.getElementById("phone")?.value.trim() || "";
    }

    const personalInfo = {
      firstName: document.getElementById("first-name")?.value.trim() || "",
      lastName: document.getElementById("last-name")?.value.trim() || "",
      egn: document.getElementById("egn")?.value.trim() || "",
      phone: getCompletePhoneNumber(),
      email: document.getElementById("email")?.value.trim() || "",
      income: document.getElementById("income")?.value.trim() || "",
      employment: document.getElementById("employment")?.value.trim() || "",
      // Combine address components into a single address field for server compatibility
      address: [
        document.getElementById("street-name")?.value.trim() || "",
        document.getElementById("house-number")?.value.trim() || "",
        document.getElementById("apartment")?.value.trim() || "",
        document.getElementById("city")?.value.trim() || "",
        getStateValue(),
        document.getElementById("postal-code")?.value.trim() || "",
        document.getElementById("country")?.value.trim() || "",
      ]
        .filter((part) => part)
        .join(", "),
      // Also store individual address components
      streetName: document.getElementById("street-name")?.value.trim() || "",
      houseNumber: document.getElementById("house-number")?.value.trim() || "",
      apartment: document.getElementById("apartment")?.value.trim() || "",
      city: document.getElementById("city")?.value.trim() || "",
      state: getStateValue(),
      postalCode: document.getElementById("postal-code")?.value.trim() || "",
      country: document.getElementById("country")?.value.trim() || "",
    };

    console.log("✅ Personal information collected:", personalInfo);

    // Collect photo data with proper metadata
    updateProgress(75, "Processing photos...");
    await new Promise((resolve) => setTimeout(resolve, 500));

    const photoData = {};
    for (const [photoType, file] of Object.entries(capturedPhotos)) {
      if (file) {
        try {
          const base64Data = await fileToBase64(file);
          photoData[photoType] = {
            data: base64Data,
            filename: file.name || `${photoType}.jpg`,
            size: file.size,
            type: file.type || "image/jpeg",
            capturedAt: new Date().toISOString(),
          };
        } catch (error) {
          console.warn(`Failed to process ${photoType}:`, error);
        }
      }
    }

    console.log(
      "✅ Photo data collected:",
      Object.keys(photoData).map((key) => ({
        type: key,
        size: photoData[key].size,
        filename: photoData[key].filename,
      }))
    );

    // Collect photo history data
    const historyData = {};
    for (const [photoType, versions] of Object.entries(photoHistory)) {
      if (Array.isArray(versions) && versions.length > 0) {
        historyData[photoType] = versions.map((file, index) => ({
          filename: file.name || `${photoType}_v${index + 1}.jpg`,
          size: file.size,
          type: file.type || "image/jpeg",
          capturedAt: new Date().toISOString(),
        }));
      }
    }

    // Create submission data
    const submissionData = {
      personalInfo: personalInfo,
      photos: photoData,
      photoHistory: historyData,
      submissionDate: new Date().toISOString(),
      sessionId: localStorage.getItem("kyc_session_id") || generateSessionId(),
      metadata: {
        userAgent: navigator.userAgent,
        screenResolution: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        sessionRecorded: window.videoRecordingManager
          ? window.videoRecordingManager.recordedChunks.length > 0
          : false,
        submittedAt: new Date().toISOString(),
        sessionRecordings: sessionRecordingData, // Include recording data directly
      },
    };

    console.log("📝 Submitting verification with session recordings:", {
      sessionId: submissionData.sessionId,
      recordingCount: sessionRecordingData.length,
      recordings: sessionRecordingData.map((r) => ({
        camera: r.cameraType,
        s3: r.s3Location,
      })),
    });

    // Submit to MongoDB
    updateProgress(85, "Submitting application...");
    await new Promise((resolve) => setTimeout(resolve, 500));

    const success = await submitToDatabase(submissionData);

    if (success) {
      console.log("✅ Verification submitted successfully");
      updateProgress(95, "Finalizing submission...");
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Debug: Check what was actually stored
      if (sessionRecordingData.length > 0) {
        try {
          const debugResponse = await fetch(
            `/api/debug/verification/${submissionData.sessionId}`
          );
          const debugData = await debugResponse.json();
          console.log("🔍 Debug - Stored verification data:", debugData);
        } catch (debugError) {
          console.warn("⚠️ Debug check failed:", debugError);
        }
      }

      // Cleanup recording resources
      if (window.videoRecordingManager) {
        window.videoRecordingManager.cleanup();
      }

      // Complete progress
      updateProgress(100, "Application submitted successfully!", "Complete");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Hide progress and show success
      progressContainer.style.display = "none";
      document.querySelector(".back-home-btn").style.display = "inline-flex";
    } else {
      throw new Error("Database submission failed");
    }
  } catch (error) {
    console.error("Submission error:", error);

    // Hide progress and show error
    progressContainer.style.display = "none";
    submitBtn.style.display = "inline-flex";
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;

    alert(
      t(
        "verification.validation.submission_error",
        "There was an error submitting your application. Please try again."
      )
    );
  }
}

// Helper function to convert file to base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}

// MongoDB submission function
async function submitToDatabase(data) {
  try {
    console.log("📤 Submitting verification data to database...");
    const response = await fetch("/api/submit-verification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      const result = await response.json();
      console.log("✅ Database submission successful:", result);
      return true;
    } else {
      const errorData = await response.text();
      console.error("❌ Database submission failed:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
      return false;
    }
  } catch (error) {
    console.error("❌ Network error during submission:", error);
    // Don't simulate success - let the error propagate properly
    return false;
  }
}

// Submit failed verification to database
async function submitFailedVerification(verificationResult) {
  try {
    console.log("📝 Submitting failed verification to database...");

    // Collect personal information
    const personalInfo = collectPersonalInfo();
    const photoData = await collectPhotoData();

    const isRetry = localStorage.getItem("kyc_retry_attempt") === "true";

    const failedVerificationData = {
      personalInfo: personalInfo,
      photos: photoData,
      verificationStatus: "failed",
      verificationResult: verificationResult,
      submissionDate: new Date().toISOString(),
      sessionId: localStorage.getItem("kyc_session_id") || generateSessionId(),
      metadata: {
        userAgent: navigator.userAgent,
        screenResolution: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        status: "verification_failed",
        submittedAt: new Date().toISOString(),
        failureReason: verificationResult.message || "Face verification failed",
        similarity: verificationResult.similarity || 0,
        confidence: verificationResult.confidence || 0,
        isRetry: isRetry,
      },
    };

    const success = await submitToDatabase(failedVerificationData);
    if (success) {
      console.log("✅ Failed verification submitted to database");
      // Don't clear retry flag yet - keep it for potential next retry
    }
  } catch (error) {
    console.error("❌ Error submitting failed verification:", error);
  }
}

// Submit verified application to database
async function submitVerifiedApplication(
  sessionRecordingData,
  verificationResult
) {
  const personalInfo = collectPersonalInfo();
  const photoData = await collectPhotoData();
  const historyData = collectPhotoHistory();

  const isRetry = localStorage.getItem("kyc_retry_attempt") === "true";

  const submissionData = {
    personalInfo: personalInfo,
    photos: photoData,
    photoHistory: historyData,
    verificationStatus: "passed",
    verificationResult: verificationResult,
    submissionDate: new Date().toISOString(),
    sessionId: localStorage.getItem("kyc_session_id") || generateSessionId(),
    metadata: {
      userAgent: navigator.userAgent,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      sessionRecorded: sessionRecordingData.length > 0,
      status: "completed",
      submittedAt: new Date().toISOString(),
      sessionRecordings: sessionRecordingData,
      similarity: verificationResult.similarity || 0,
      confidence: verificationResult.confidence || 0,
      isRetry: isRetry,
    },
  };

  console.log("📝 Submitting verified application:", {
    sessionId: submissionData.sessionId,
    recordingCount: sessionRecordingData.length,
    isRetry: isRetry,
  });

  const success = await submitToDatabase(submissionData);
  if (!success) {
    throw new Error("Database submission failed");
  }

  // Clear retry flag after successful submission
  localStorage.removeItem("kyc_retry_attempt");

  // Cleanup recording resources
  if (window.videoRecordingManager) {
    window.videoRecordingManager.cleanup();
  }
}

// Helper functions for data collection
function collectPersonalInfo() {
  function getStateValue() {
    const stateSelect = document.getElementById("state-select");
    const stateInput = document.getElementById("state-input");

    if (stateSelect && stateSelect.style.display !== "none") {
      return stateSelect.value.trim();
    } else if (stateInput && stateInput.style.display !== "none") {
      return stateInput.value.trim();
    }
    return "";
  }

  function getCompletePhoneNumber() {
    const countryCodeSelect = document.getElementById("phone-country-code");
    const phoneInput = document.getElementById("phone");

    if (countryCodeSelect && phoneInput) {
      const countryCode = countryCodeSelect.value;
      const phoneNumber = phoneInput.value.trim();

      if (countryCode && phoneNumber) {
        return countryCode + phoneNumber.replace(/\s/g, "");
      }
    }

    return document.getElementById("phone")?.value.trim() || "";
  }

  return {
    firstName: document.getElementById("first-name")?.value.trim() || "",
    lastName: document.getElementById("last-name")?.value.trim() || "",
    egn: document.getElementById("egn")?.value.trim() || "",
    phone: getCompletePhoneNumber(),
    email: document.getElementById("email")?.value.trim() || "",
    income: document.getElementById("income")?.value.trim() || "",
    employment: document.getElementById("employment")?.value.trim() || "",
    address: [
      document.getElementById("street-name")?.value.trim() || "",
      document.getElementById("house-number")?.value.trim() || "",
      document.getElementById("apartment")?.value.trim() || "",
      document.getElementById("city")?.value.trim() || "",
      getStateValue(),
      document.getElementById("postal-code")?.value.trim() || "",
      document.getElementById("country")?.value.trim() || "",
    ]
      .filter((part) => part)
      .join(", "),
    streetName: document.getElementById("street-name")?.value.trim() || "",
    houseNumber: document.getElementById("house-number")?.value.trim() || "",
    apartment: document.getElementById("apartment")?.value.trim() || "",
    city: document.getElementById("city")?.value.trim() || "",
    state: getStateValue(),
    postalCode: document.getElementById("postal-code")?.value.trim() || "",
    country: document.getElementById("country")?.value.trim() || "",
  };
}

async function collectPhotoData() {
  const photoData = {};

  for (const [photoType, file] of Object.entries(capturedPhotos)) {
    if (file) {
      try {
        const base64Data = await fileToBase64(file);
        photoData[photoType] = {
          data: base64Data,
          filename: file.name || `${photoType}.jpg`,
          size: file.size,
          type: file.type || "image/jpeg",
          capturedAt: new Date().toISOString(),
        };
      } catch (error) {
        console.warn(`Failed to process ${photoType}:`, error);
      }
    }
  }

  return photoData;
}

function collectPhotoHistory() {
  const historyData = {};

  for (const [photoType, versions] of Object.entries(photoHistory)) {
    if (Array.isArray(versions) && versions.length > 0) {
      historyData[photoType] = versions.map((file, index) => ({
        filename: file.name || `${photoType}_v${index + 1}.jpg`,
        size: file.size,
        type: file.type || "image/jpeg",
        capturedAt: new Date().toISOString(),
      }));
    }
  }

  return historyData;
}

// Show final success after submission (enhanced with verification details)
function showFinalSuccess(verificationResult) {
  const completeContent = document.querySelector(".complete-content");

  completeContent.innerHTML = `
    <div class="verification-result success final">
      <div class="result-icon">
            <i class="fas fa-check-circle"></i>
        </div>
      <h3 style="text-align: center;">Application Submitted Successfully!</h3>
      <p style="text-align: center;">Your identity verification has been completed and your application has been submitted.</p>
      
      <div class="verification-summary" style="margin-top: 25px; padding: 20px; background: #f8f9fa; border-radius: 12px; text-align: center;">
        <h4 style="margin-bottom: 15px; color: #28a745;">
          <i class="fas fa-shield-check"></i> Verification Summary
        </h4>
        
        <div class="summary-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
          <div class="summary-item">
            <strong>Status:</strong><br>
            <span style="color: #28a745;">✓ Identity Verified</span>
          </div>
          <div class="summary-item">
            <strong>Match Score:</strong><br>
            <span style="color: #28a745;">${(
              verificationResult.similarity || 0
            ).toFixed(1)}%</span>
          </div>
        </div>
        
        <div class="timeline-info" style="padding-top: 15px; border-top: 1px solid #dee2e6;">
          <p style="color: #666; margin: 0;">
            <i class="fas fa-clock"></i> 
            <strong>Response Time:</strong> You will receive a response within 15-30 minutes.
          </p>
        </div>
      </div>
      
      <div class="final-actions" style="margin-top: 25px; text-align: center;">
        <button type="button" class="back-home-btn" onclick="window.location.href='index.html'" 
                style="background: #007bff; color: white; border: none; padding: 12px 30px; border-radius: 8px; font-size: 16px; cursor: pointer; display: inline-flex; align-items: center; gap: 10px;">
          <i class="fas fa-home"></i>
          <span>Return to Home</span>
        </button>
      </div>
    </div>
  `;
}

// Show submission error
function showSubmissionError(errorMessage) {
  const completeContent = document.querySelector(".complete-content");

  completeContent.innerHTML = `
    <div class="verification-result error">
      <div class="result-icon">
        <i class="fas fa-exclamation-triangle"></i>
      </div>
      <h3>Submission Error</h3>
      <p>There was an error submitting your application: ${errorMessage}</p>
      <div class="retry-options">
        <button type="button" class="retry-btn" onclick="location.reload()">
          <i class="fas fa-redo"></i>
          Try Again
        </button>
      </div>
    </div>
  `;
}

function generateSessionId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Cleanup function to stop all camera streams
function stopAllStreams() {
  stopCamera();
}

// Handle page unload
window.addEventListener("beforeunload", function (event) {
  stopAllStreams();
  if (
    window.videoRecordingManager &&
    window.videoRecordingManager.isRecording
  ) {
    console.log("🔚 Page unloading - stopping session recording");
    window.videoRecordingManager.stopRecording();

    // Try to upload recordings before page closes (may not always work due to browser limitations)
    try {
      window.videoRecordingManager.uploadRecordings();
    } catch (error) {
      console.warn("⚠️ Could not upload recordings on page unload:", error);
    }
  }
});

// Handle page visibility change for mobile scenarios
document.addEventListener("visibilitychange", function () {
  if (document.hidden) {
    console.log("📱 Page hidden - keeping recording active");
  } else {
    console.log("📱 Page visible - recording continues");
  }
});

// Handle escape key to close camera
document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    const cameraArea = document.getElementById("camera-capture-area");
    if (cameraArea.classList.contains("active")) {
      closeCameraCapture();
    }
  }
});

// Comprehensive video element setup for iOS compatibility
function setupVideoElementForIOS(video) {
  if (!video) return;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (isIOS) {
    video.setAttribute("playsinline", true);
    video.setAttribute("webkit-playsinline", true);
    video.muted = true;

    // Add CSS for better iOS compatibility
    video.style.webkitTransform = "translateZ(0)";
    video.style.transform = "translateZ(0)";
    video.style.webkitBackfaceVisibility = "hidden";
    video.style.backfaceVisibility = "hidden";

    console.log(
      `📱 iOS video setup applied to: ${video.id || "unnamed video"}`
    );
  }
}

// Enhanced video play function for iOS compatibility
function playVideoSafely(video) {
  if (!video) return Promise.resolve();

  setupVideoElementForIOS(video);

  const playPromise = video.play();
  if (playPromise !== undefined) {
    return playPromise.catch((error) => {
      console.warn(
        `⚠️ Video play failed for ${
          video.id || "unnamed"
        }, trying iOS fallback:`,
        error
      );

      // iOS fallback - try again after a short delay
      return new Promise((resolve) => {
        setTimeout(() => {
          video
            .play()
            .then(resolve)
            .catch(() => {
              console.warn(
                `❌ iOS video play fallback failed for ${video.id || "unnamed"}`
              );
              resolve();
            });
        }, 100);
      });
    });
  }

  return Promise.resolve();
}

// Add comprehensive diagnostics function
window.runRecordingDiagnostics = async function () {
  console.log("🔬 Running Recording Diagnostics...");

  const results = {
    device: {
      isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    },
    mediaDevices: {
      supported: !!navigator.mediaDevices,
      getUserMediaSupported: !!navigator.mediaDevices?.getUserMedia,
    },
    codecSupport: {},
    cameraAccess: {},
    recordingTest: {},
  };

  // Test codec support
  console.log("📋 Testing codec support...");
  const codecsToTest = [
    'video/webm; codecs="vp9,opus"',
    'video/webm; codecs="vp8,opus"',
    'video/mp4; codecs="avc1.64001E"',
    'video/mp4; codecs="avc1.42E01E"',
    "video/mp4",
    "video/webm",
  ];

  codecsToTest.forEach((codec) => {
    const isSupported = MediaRecorder.isTypeSupported(codec);
    results.codecSupport[codec] = isSupported;
    console.log(`${isSupported ? "✅" : "❌"} ${codec}`);
  });

  // Test camera access
  console.log("📱 Testing camera access...");
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(
      (device) => device.kind === "videoinput"
    );
    results.cameraAccess.devicesFound = videoDevices.length;
    results.cameraAccess.devices = videoDevices.map((device) => ({
      deviceId: device.deviceId,
      label: device.label,
      kind: device.kind,
    }));
    console.log(`📹 Found ${videoDevices.length} video devices`);
  } catch (error) {
    results.cameraAccess.error = error.message;
    console.error("❌ Error enumerating devices:", error);
  }

  // Test front camera stream
  console.log("📱 Testing front camera...");
  try {
    const frontStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false,
    });

    const videoTrack = frontStream.getVideoTracks()[0];
    results.cameraAccess.frontCamera = {
      success: true,
      label: videoTrack.label,
      settings: videoTrack.getSettings ? videoTrack.getSettings() : null,
    };

    console.log("✅ Front camera access successful");

    // Test recording with front camera
    if (window.videoRecordingManager) {
      const mimeType = window.videoRecordingManager.getBestMimeType("front");
      results.recordingTest.frontCameraMimeType = mimeType;

      try {
        const mediaRecorder = new MediaRecorder(frontStream, { mimeType });
        results.recordingTest.frontCameraRecordingSupported = true;
        console.log("✅ Front camera recording supported with:", mimeType);
        mediaRecorder.stop();
      } catch (recordError) {
        results.recordingTest.frontCameraRecordingSupported = false;
        results.recordingTest.frontCameraRecordingError = recordError.message;
        console.error("❌ Front camera recording failed:", recordError);
      }
    }

    // Clean up
    frontStream.getTracks().forEach((track) => track.stop());
  } catch (error) {
    results.cameraAccess.frontCamera = {
      success: false,
      error: error.message,
    };
    console.error("❌ Front camera access failed:", error);
  }

  // Test back camera stream
  console.log("📱 Testing back camera...");
  try {
    const backStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });

    const videoTrack = backStream.getVideoTracks()[0];
    results.cameraAccess.backCamera = {
      success: true,
      label: videoTrack.label,
      settings: videoTrack.getSettings ? videoTrack.getSettings() : null,
    };

    console.log("✅ Back camera access successful");

    // Test recording with back camera
    if (window.videoRecordingManager) {
      const mimeType = window.videoRecordingManager.getBestMimeType("back");
      results.recordingTest.backCameraMimeType = mimeType;

      try {
        const mediaRecorder = new MediaRecorder(backStream, { mimeType });
        results.recordingTest.backCameraRecordingSupported = true;
        console.log("✅ Back camera recording supported with:", mimeType);
        mediaRecorder.stop();
      } catch (recordError) {
        results.recordingTest.backCameraRecordingSupported = false;
        results.recordingTest.backCameraRecordingError = recordError.message;
        console.error("❌ Back camera recording failed:", recordError);
      }
    }

    // Clean up
    backStream.getTracks().forEach((track) => track.stop());
  } catch (error) {
    results.cameraAccess.backCamera = {
      success: false,
      error: error.message,
    };
    console.error("❌ Back camera access failed:", error);
  }

  console.log("🔬 Diagnostics complete!");
  console.log("📊 Results:", results);

  return results;
};
