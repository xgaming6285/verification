// Verification Page JavaScript
let currentStep = 1;
let currentPhotoStep = 1;
let capturedPhotos = {};
let photoHistory = {}; // Store all versions of photos including retakes
let currentStream = null;
let translationManager = null;
let isVerificationInProgress = false;
let verificationPassed = false;

// Video Recording Manager Class for Session Recording
class VideoRecordingManager {
  constructor() {
    this.isRecording = false;
    this.mediaRecorders = [];
    this.recordedChunks = [];
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

      const constraints = {
        video: {
          facingMode: facingMode,
          width: isIOS ? { ideal: 640, max: 1280 } : { ideal: 1280 },
          height: isIOS ? { ideal: 480, max: 720 } : { ideal: 720 },
        },
        audio: true, // Include audio for better verification
      };

      console.log(
        `📱 Getting ${facingMode} camera stream for ${
          isIOS ? "iOS" : "other"
        } device`
      );
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      console.warn(`⚠️ Could not access ${facingMode} camera:`, error);

      // iOS fallback with simpler constraints
      if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        try {
          console.log("🔄 Trying iOS fallback constraints...");
          const fallbackConstraints = {
            video: { facingMode: facingMode },
            audio: true,
          };
          return await navigator.mediaDevices.getUserMedia(fallbackConstraints);
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
        const mediaRecorder = new MediaRecorder(streamInfo.stream, {
          mimeType: "video/webm;codecs=vp9,opus",
        });

        const chunks = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: "video/webm" });
          this.recordedChunks.push({
            type: streamInfo.type,
            blob: blob,
            size: blob.size,
            duration: Date.now() - this.startTime.getTime(),
          });
          console.log(
            `📹 ${streamInfo.type} camera recording stopped:`,
            blob.size,
            "bytes"
          );
        };

        mediaRecorder.start(1000); // Record in 1-second chunks
        this.mediaRecorders.push(mediaRecorder);

        console.log(`🎬 Started recording from ${streamInfo.type} camera`);
      } catch (error) {
        console.error(
          `❌ Failed to start recording from ${streamInfo.type} camera:`,
          error
        );
      }
    });

    return true;
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
    if (this.recordedChunks.length === 0) {
      console.warn("⚠️ No recordings to upload");
      return [];
    }

    console.log("☁️ Uploading session recordings to S3...");

    try {
      const uploadPromises = this.recordedChunks.map(
        async (recording, index) => {
          const formData = new FormData();
          const filename = `${this.sessionId}_${
            recording.type
          }_${Date.now()}.webm`;

          formData.append("video", recording.blob, filename);
          formData.append("sessionId", this.sessionId);
          formData.append("cameraType", recording.type);
          formData.append("duration", recording.duration);
          formData.append("size", recording.size);

          const response = await fetch("/api/upload-session-recording", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`Failed to upload ${recording.type} recording`);
          }

          const result = await response.json();

          // Return enhanced result with recording metadata
          return {
            ...result,
            cameraType: recording.type,
            duration: recording.duration,
            originalSize: recording.size,
          };
        }
      );

      const results = await Promise.all(uploadPromises);
      console.log("✅ All session recordings uploaded successfully:", results);
      return results;
    } catch (error) {
      console.error("❌ Failed to upload session recordings:", error);
      return [];
    }
  }

  cleanup() {
    this.stopRecording();
    this.recordedChunks = [];
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
});

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
    // Mark current step as completed
    const currentStepItem = document.querySelector(
      `.step-item[data-step="${currentStep}"]`
    );
    if (currentStepItem) {
      currentStepItem.classList.remove("active");
      currentStepItem.classList.add("completed");
    }

    // Show next step
    document.getElementById(`step-${currentStep}`).classList.remove("active");
    document.getElementById(`step-${stepNumber}`).classList.add("active");

    // Update step indicator
    const nextStepItem = document.querySelector(
      `.step-item[data-step="${stepNumber}"]`
    );
    if (nextStepItem) {
      nextStepItem.classList.add("active");
    }

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

  // Mark current step as inactive
  const currentStepItem = document.querySelector(
    `.step-item[data-step="${currentStep}"]`
  );
  if (currentStepItem) {
    currentStepItem.classList.remove("active");
  }

  // Show previous step
  document.getElementById(`step-${currentStep}`).classList.remove("active");
  document.getElementById(`step-${stepNumber}`).classList.add("active");

  // Update step indicator
  const prevStepItem = document.querySelector(
    `.step-item[data-step="${stepNumber}"]`
  );
  if (prevStepItem) {
    prevStepItem.classList.remove("completed");
    prevStepItem.classList.add("active");
  }

  currentStep = stepNumber;
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
  const form = document.getElementById("personal-info-form");
  const formData = new FormData(form);

  // Basic validation
  for (let [key, value] of formData.entries()) {
    if (!value.trim()) {
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
  const egn = formData.get("egn");
  if (egn && egn.length !== 10) {
    alert(
      t(
        "verification.validation.egn_invalid",
        "Personal ID Number must be 10 digits."
      )
    );
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
  updatePhotoNavigation();
  showCaptureInterface();
}

function showCaptureInterface() {
  document.getElementById("current-capture-section").style.display = "block";
  document.getElementById("results-page").style.display = "none";
}

function showResultsPage() {
  document.getElementById("current-capture-section").style.display = "none";
  document.getElementById("results-page").style.display = "block";
  updateResultsPage();
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
  const progressSteps = document.querySelectorAll(".progress-step");
  progressSteps.forEach((step, index) => {
    step.classList.remove("active", "completed");
    if (index + 1 < currentPhotoStep) {
      step.classList.add("completed");
    } else if (index + 1 === currentPhotoStep) {
      step.classList.add("active");
    }
  });
}

function updatePhotoNavigation() {
  const photoNavigation = document.getElementById("photo-navigation");
  const navPhotos = document.getElementById("nav-photos");

  // Show navigation if any photos have been captured
  if (Object.keys(capturedPhotos).length > 0) {
    photoNavigation.style.display = "block";

    navPhotos.innerHTML = "";
    PHOTO_SEQUENCE.forEach((photo, index) => {
      const navItem = document.createElement("div");
      navItem.className = "nav-photo-item";
      if (index + 1 === currentPhotoStep) navItem.classList.add("current");
      if (capturedPhotos[photo.id]) navItem.classList.add("completed");

      navItem.onclick = () => navigateToPhoto(index + 1);

      const thumbnail = document.createElement("div");
      thumbnail.className = "nav-photo-thumbnail";

      if (capturedPhotos[photo.id]) {
        const img = document.createElement("img");
        img.src = URL.createObjectURL(capturedPhotos[photo.id]);
        thumbnail.appendChild(img);
      } else {
        const placeholder = document.createElement("div");
        placeholder.className = "nav-photo-placeholder";
        placeholder.textContent = index + 1;
        thumbnail.appendChild(placeholder);
      }

      const label = document.createElement("div");
      label.className = "nav-photo-label";
      label.textContent = photo.name;

      navItem.appendChild(thumbnail);
      navItem.appendChild(label);
      navPhotos.appendChild(navItem);
    });
  } else {
    photoNavigation.style.display = "none";
  }
}

function navigateToPhoto(photoStep) {
  currentPhotoStep = photoStep;
  updateCaptureInstructions();
  updateProgressIndicator();
  updatePhotoNavigation();
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

      // Update navigation
      updatePhotoNavigation();
      updateProgressIndicator();

      // Auto-proceed to next photo or show results
      if (currentPhotoStep < PHOTO_SEQUENCE.length) {
        currentPhotoStep++;
        updateCaptureInstructions();
        updateProgressIndicator();
        updatePhotoNavigation();
      } else {
        // All photos captured, show results page
        showResultsPage();
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
  const resultsGrid = document.getElementById("results-grid");
  resultsGrid.innerHTML = "";

  PHOTO_SEQUENCE.forEach((photo) => {
    if (capturedPhotos[photo.id]) {
      const resultItem = document.createElement("div");
      resultItem.className = "result-photo-item";

      const history = photoHistory[photo.id] || [];
      const currentVersion = history.length;

      resultItem.innerHTML = `
        <div class="result-photo-header">
          <div class="result-photo-info">
            <i class="${photo.icon}"></i>
            <span>${photo.name}</span>
          </div>
          ${
            currentVersion > 1
              ? `<div class="history-indicator">v${currentVersion}</div>`
              : ""
          }
        </div>
        <div class="result-photo-thumbnail">
          <img src="${URL.createObjectURL(capturedPhotos[photo.id])}" alt="${
        photo.name
      }">
        </div>
        <button class="retake-photo-btn" onclick="retakePhoto('${photo.id}')">
          <i class="fas fa-redo"></i>
          Retake
        </button>
      `;

      resultsGrid.appendChild(resultItem);
    }
  });
}

function proceedToVerification() {
  // Check if all photos are captured
  if (Object.keys(capturedPhotos).length < PHOTO_SEQUENCE.length) {
    alert("Please capture all required photos before proceeding.");
    return;
  }

  // Start identity verification
  startIdentityVerification();
}

// Start AWS Rekognition identity verification
async function startIdentityVerification() {
  if (isVerificationInProgress) return;

  isVerificationInProgress = true;

  // Show verification in progress
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

    if (result.success) {
      if (result.verified) {
        // Verification passed
        verificationPassed = true;
        showVerificationSuccess(result);
      } else {
        // Verification failed
        verificationPassed = false;
        showVerificationFailed(result);
      }
    } else {
      throw new Error(result.error || "Verification failed");
    }
  } catch (error) {
    console.error("Identity verification error:", error);
    showVerificationError(error.message);
  } finally {
    isVerificationInProgress = false;
  }
}

// Show verification in progress UI
function showVerificationInProgress() {
  const resultsPage = document.getElementById("results-page");

  resultsPage.innerHTML = `
    <div class="verification-progress">
      <div class="verification-icon">
        <i class="fas fa-shield-check"></i>
      </div>
      <h4>Verifying Your Identity</h4>
      <p>Please wait while we verify your identity using AWS Rekognition...</p>
      <div class="loading-spinner">
        <i class="fas fa-spinner fa-spin"></i>
      </div>
      <div class="verification-steps">
        <div class="verification-step-item">
          <i class="fas fa-eye"></i>
          <span>Analyzing facial features</span>
        </div>
        <div class="verification-step-item">
          <i class="fas fa-search"></i>
          <span>Comparing with ID photo</span>
        </div>
        <div class="verification-step-item">
          <i class="fas fa-check"></i>
          <span>Validating identity match</span>
        </div>
      </div>
    </div>
  `;
}

// Show verification success
function showVerificationSuccess(result) {
  const resultsPage = document.getElementById("results-page");

  resultsPage.innerHTML = `
    <div class="verification-result success">
      <div class="result-icon">
        <i class="fas fa-check-circle"></i>
      </div>
      <h4>Identity Verification Successful!</h4>
      <p>Your identity has been verified with ${result.similarity.toFixed(
        1
      )}% similarity.</p>
      <div class="verification-details">
        <div class="detail-item">
          <span class="label">Similarity:</span>
          <span class="value">${result.similarity.toFixed(1)}%</span>
        </div>
        <div class="detail-item">
          <span class="label">Confidence:</span>
          <span class="value">${result.confidence.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  `;

  // Show continue button
  document.getElementById("continue-to-complete").style.display = "inline-flex";

  // Update verification status
  verificationPassed = true;
}

// Show verification failed
function showVerificationFailed(result) {
  const resultsPage = document.getElementById("results-page");

  resultsPage.innerHTML = `
    <div class="verification-result failed">
      <div class="result-icon">
        <i class="fas fa-times-circle"></i>
      </div>
      <h4>Identity Verification Failed</h4>
      <p>We were unable to verify your identity. The photos may not match or the quality might be insufficient.</p>
      <div class="retry-options">
        <button type="button" class="retry-btn" onclick="retryVerification()">
          <i class="fas fa-redo"></i>
          <span>Retake Photos</span>
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
  // Go back to results page
  showResultsPage();
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
  displayPhotoSummary();
  updateSubmitButtonState();
}

// Update submit button state based on verification
function updateSubmitButtonState() {
  const submitBtn = document.querySelector(".submit-application-btn");

  if (!verificationPassed) {
    submitBtn.disabled = true;
    submitBtn.classList.add("disabled");
    submitBtn.innerHTML = `
      <i class="fas fa-lock"></i>
      <span>Identity Verification Required</span>
    `;
  } else {
    submitBtn.disabled = false;
    submitBtn.classList.remove("disabled");
    submitBtn.innerHTML = `
      <span data-translate="verification.step3.submit">Submit Application</span>
      <i class="fas fa-paper-plane"></i>
    `;
  }
}

function displayPhotoSummary() {
  const photoSummary = document.getElementById("photo-summary");
  photoSummary.innerHTML = "";

  PHOTO_SEQUENCE.forEach((photo, index) => {
    const capturedPhoto = capturedPhotos[photo.id];
    if (capturedPhoto) {
      const summaryItem = document.createElement("div");
      summaryItem.className = "summary-photo-item";
      summaryItem.innerHTML = `
                <div class="summary-photo-thumbnail">
                    <img src="${URL.createObjectURL(capturedPhoto)}" alt="${
        photo.name
      }">
                </div>
                <div class="summary-photo-info">
                    <i class="${photo.icon}"></i>
                    <span>${photo.name}</span>
                </div>
            `;
      photoSummary.appendChild(summaryItem);
    }
  });
}

// Submit Application with MongoDB integration
async function submitApplication() {
  const submitBtn = document.querySelector(".submit-application-btn");

  // Check if verification has passed
  if (!verificationPassed) {
    alert(
      "Please complete identity verification before submitting your application."
    );
    return;
  }

  const originalText = submitBtn.innerHTML;

  // Show loading state
  submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${t(
    "verification.uploading",
    "Submitting..."
  )}`;
  submitBtn.disabled = true;

  try {
    // Stop session recording and upload videos first
    let sessionRecordingData = [];
    if (
      window.videoRecordingManager &&
      window.videoRecordingManager.isRecording
    ) {
      console.log("🎬 Finalizing session recording...");
      submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Finalizing session recording...`;

      window.videoRecordingManager.stopRecording();

      // Wait a moment for recording to finalize
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Upload session recordings to S3
      submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Uploading session recording...`;
      const uploadResults =
        await window.videoRecordingManager.uploadRecordings();

      if (uploadResults && Array.isArray(uploadResults)) {
        console.log(
          "📹 Session recordings uploaded successfully:",
          uploadResults
        );
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
    }

    // Update button for application submission
    submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${t(
      "verification.uploading",
      "Submitting application..."
    )}`;

    // Collect personal information
    const formData = new FormData(
      document.getElementById("personal-info-form")
    );
    const personalInfo = {};
    for (let [key, value] of formData.entries()) {
      personalInfo[key] = value;
    }

    // Prepare photos for upload (convert to base64)
    const photoData = {};
    const historyData = {};

    for (const [photoId, file] of Object.entries(capturedPhotos)) {
      photoData[photoId] = await fileToBase64(file);
    }

    // Include photo history
    for (const [photoId, history] of Object.entries(photoHistory)) {
      if (history.length > 0) {
        historyData[photoId] = await Promise.all(
          history.map(async (item) => ({
            data: await fileToBase64(item.file),
            timestamp: item.timestamp,
            version: item.version,
          }))
        );
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
    const success = await submitToDatabase(submissionData);

    if (success) {
      console.log("✅ Verification submitted successfully");

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

      // Hide submit button and show back to home button
      submitBtn.style.display = "none";
      document.querySelector(".back-home-btn").style.display = "inline-flex";

      // Show success message
      showSuccessMessage();
    } else {
      throw new Error("Database submission failed");
    }
  } catch (error) {
    console.error("Submission error:", error);
    alert(
      t(
        "verification.validation.submission_error",
        "There was an error submitting your application. Please try again."
      )
    );

    // Reset button
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
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
    const response = await fetch("/api/submit-verification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      return true;
    } else {
      console.error("Database submission failed:", response.statusText);
      return false;
    }
  } catch (error) {
    console.error("Network error during submission:", error);

    // For development/demo purposes, simulate successful submission
    console.log("Simulating successful submission with data:", data);

    // Store data locally for demo
    localStorage.setItem(
      "verification_data",
      JSON.stringify({
        personalInfo: data.personalInfo,
        photoCount: Object.keys(data.photos).length,
        historyCount: Object.values(data.photoHistory).reduce(
          (total, history) => total + history.length,
          0
        ),
        submissionDate: data.submissionDate,
      })
    );

    return true;
  }
}

function showSuccessMessage() {
  // Update the page content to show success state
  const completeContent = document.querySelector(".complete-content");
  const successMessage = document.createElement("div");
  successMessage.className = "success-banner";
  successMessage.innerHTML = `
        <div class="success-icon-large">
            <i class="fas fa-check-circle"></i>
        </div>
        <h2>${t(
          "verification.step3.success_title",
          "Application Submitted Successfully!"
        )}</h2>
        <p>${t(
          "verification.step3.success_message",
          "Thank you for your trust! You will receive a response within 15-30 minutes."
        )}</p>
    `;

  completeContent.insertBefore(successMessage, completeContent.firstChild);
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
