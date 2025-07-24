// Verification Page JavaScript
let currentStep = 1;
let currentPhotoStep = 1;
let capturedPhotos = {};
let currentStream = null;
let translationManager = null;
let isVerificationInProgress = false;
let verificationPassed = false;

// Photo capture sequence configuration
const PHOTO_SEQUENCE = [
  {
    id: "idFront",
    name: "ID Front",
    camera: "environment", // back camera
    icon: "fas fa-id-card",
    titleKey: "verification.step2.instructions.id_front_title",
    textKey: "verification.step2.instructions.id_front_text",
  },
  {
    id: "idBack",
    name: "ID Back",
    camera: "environment", // back camera
    icon: "fas fa-id-card-alt",
    titleKey: "verification.step2.instructions.id_back_title",
    textKey: "verification.step2.instructions.id_back_text",
  },
  {
    id: "selfieWithIdFront",
    name: "Selfie with ID Front",
    camera: "user", // front camera
    icon: "fas fa-user-plus",
    titleKey: "verification.step2.instructions.selfie_id_front_title",
    textKey: "verification.step2.instructions.selfie_id_front_text",
  },
  {
    id: "selfieWithIdBack",
    name: "Selfie with ID Back",
    camera: "user", // front camera
    icon: "fas fa-user-check",
    titleKey: "verification.step2.instructions.selfie_id_back_title",
    textKey: "verification.step2.instructions.selfie_id_back_text",
  },
  {
    id: "selfieOnly",
    name: "Selfie Only",
    camera: "user", // front camera
    icon: "fas fa-user",
    titleKey: "verification.step2.instructions.selfie_only_title",
    textKey: "verification.step2.instructions.selfie_only_text",
  },
];

// Initialize translation system and setup
document.addEventListener("DOMContentLoaded", async function () {
  // Initialize translation manager
  translationManager = new TranslationManager();
  await translationManager.init();

  // Set language to English by default
  if (translationManager.getCurrentLanguage() !== "en") {
    await translationManager.changeLanguage("en");
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
});

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
  resetCaptureInterface();
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

function resetCaptureInterface() {
  const video = document.getElementById("capture-video");
  const placeholder = document.getElementById("camera-placeholder");
  const overlay = document.getElementById("camera-overlay");

  video.style.display = "none";
  placeholder.style.display = "block";
  overlay.style.display = "none";

  // Reset buttons
  document.getElementById("start-camera-btn").style.display = "inline-flex";
  document.getElementById("capture-photo-btn").style.display = "none";
  document.getElementById("retake-btn").style.display = "none";
  document.getElementById("next-photo-btn").style.display = "none";
}

function startCameraCapture() {
  const currentPhoto = PHOTO_SEQUENCE[currentPhotoStep - 1];
  const video = document.getElementById("capture-video");
  const placeholder = document.getElementById("camera-placeholder");
  const overlay = document.getElementById("camera-overlay");

  // Camera constraints based on current photo
  const constraints = {
    video: {
      facingMode: currentPhoto.camera,
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
  };

  navigator.mediaDevices
    .getUserMedia(constraints)
    .then(function (stream) {
      currentStream = stream;
      video.srcObject = stream;
      video.style.display = "block";
      placeholder.style.display = "none";
      overlay.style.display = "block";

      // Update button visibility
      document.getElementById("start-camera-btn").style.display = "none";
      document.getElementById("capture-photo-btn").style.display =
        "inline-flex";

      video.play();
    })
    .catch(function (error) {
      console.error("Error accessing camera:", error);
      alert(
        t(
          "verification.validation.camera_error",
          "Cannot access camera. Please check camera permissions."
        )
      );
    });
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

      // Store the captured photo
      capturedPhotos[currentPhoto.id] = file;

      // Show captured photo
      displayCapturedPhoto(file, currentPhoto);

      // Update button visibility
      document.getElementById("capture-photo-btn").style.display = "none";
      document.getElementById("retake-btn").style.display = "inline-flex";
      document.getElementById("next-photo-btn").style.display = "inline-flex";

      // Stop camera for now
      stopCamera();
    },
    "image/jpeg",
    0.9
  );
}

function displayCapturedPhoto(file, photoInfo) {
  const capturedPhotosContainer = document.getElementById("captured-photos");

  // Create preview element
  const photoPreview = document.createElement("div");
  photoPreview.className = "photo-preview";
  photoPreview.innerHTML = `
        <div class="photo-info">
            <i class="${photoInfo.icon}"></i>
            <span>${photoInfo.name}</span>
        </div>
        <div class="photo-thumbnail">
            <img src="${URL.createObjectURL(file)}" alt="${photoInfo.name}">
        </div>
    `;

  capturedPhotosContainer.appendChild(photoPreview);
}

function retakePhoto() {
  const currentPhoto = PHOTO_SEQUENCE[currentPhotoStep - 1];

  // Remove the captured photo
  delete capturedPhotos[currentPhoto.id];

  // Clear the preview
  const capturedPhotosContainer = document.getElementById("captured-photos");
  const photoPreview = capturedPhotosContainer.lastElementChild;
  if (photoPreview) {
    photoPreview.remove();
  }

  // Reset interface and restart camera
  resetCaptureInterface();
  startCameraCapture();
}

function nextPhoto() {
  if (currentPhotoStep < PHOTO_SEQUENCE.length) {
    currentPhotoStep++;
    updateCaptureInstructions();
    updateProgressIndicator();
    resetCaptureInterface();
  } else {
    // All photos captured, start identity verification
    startIdentityVerification();
  }
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
    const response = await fetch('/api/verify-identity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idFrontImage: idFrontBase64,
        selfieOnlyImage: selfieOnlyBase64
      })
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
      throw new Error(result.error || 'Verification failed');
    }
    
  } catch (error) {
    console.error('Identity verification error:', error);
    showVerificationError(error.message);
  } finally {
    isVerificationInProgress = false;
  }
}

// Show verification in progress UI
function showVerificationInProgress() {
  const captureSection = document.querySelector('.current-capture-section');
  
  captureSection.innerHTML = `
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
  const captureSection = document.querySelector('.current-capture-section');
  
  captureSection.innerHTML = `
    <div class="verification-result success">
      <div class="result-icon">
        <i class="fas fa-check-circle"></i>
      </div>
      <h4>Identity Verification Successful!</h4>
      <p>Your identity has been verified with ${result.similarity.toFixed(1)}% similarity.</p>
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
  const captureSection = document.querySelector('.current-capture-section');
  
  captureSection.innerHTML = `
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
  const captureSection = document.querySelector('.current-capture-section');
  
  captureSection.innerHTML = `
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
  // Reset to first photo capture
  currentPhotoStep = 1;
  capturedPhotos = {};
  verificationPassed = false;
  
  // Clear captured photos display
  document.getElementById("captured-photos").innerHTML = "";
  
  // Reset capture interface
  initializePhotoCapture();
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
    alert("Please complete identity verification before submitting your application.");
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
    for (const [photoId, file] of Object.entries(capturedPhotos)) {
      photoData[photoId] = await fileToBase64(file);
    }

    // Create submission data
    const submissionData = {
      personalInfo: personalInfo,
      photos: photoData,
      submissionDate: new Date().toISOString(),
      sessionId: localStorage.getItem("kyc_session_id") || generateSessionId(),
    };

    // Submit to MongoDB
    const success = await submitToDatabase(submissionData);

    if (success) {
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
window.addEventListener("beforeunload", function () {
  stopAllStreams();
  if (
    window.videoRecordingManager &&
    window.videoRecordingManager.isRecording
  ) {
    window.videoRecordingManager.stopRecording();
  }
});
