// Verification Page JavaScript
let currentStep = 1;
let currentFieldStep = 1; // Current field step within personal information (1-14)
let totalFieldSteps = 14; // Total number of field steps
let currentPhotoStep = 1;
let capturedPhotos = {};
let photoHistory = {}; // Store all versions of photos including retakes
let photoUploadStatus = {}; // Track S3 upload status per photo
let currentStream = null;
let translationManager = null;
let isVerificationInProgress = false;
let verificationPassed = false;
let permissionsGranted = false; // Track if camera and microphone permissions are granted

// Direct mode: skip personal info step when ?mode=direct is present or /es-loans path is used
const isDirectMode = new URLSearchParams(window.location.search).get('mode') === 'direct'
  || window.location.pathname === '/es-loans';

// Real-time face quality analysis variables
let faceAnalysisIntervalId = null;
let isAnalyzingFace = false;
let isCaptureAllowed = false; // Track if capture button should be enabled
const FACE_ANALYSIS_INTERVAL_MS = 1500; // Analyze every 1.5 seconds

// Session timeout configuration (10 minutes = 600000 ms)
const SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const SESSION_WARNING_MS = 2 * 60 * 1000; // Show warning at 2 minutes remaining
let sessionStartTime = null;
let sessionTimeoutId = null;
let sessionWarningTimeoutId = null;
let sessionTimerIntervalId = null;
let sessionExpired = false;

// Start session timer when permissions are granted
function startSessionTimer() {
  sessionStartTime = Date.now();
  sessionExpired = false;

  console.log("⏱️ Session timer started - 10 minutes to complete verification");

  // Create and show the timer display
  createSessionTimerDisplay();

  // Update timer display every second
  sessionTimerIntervalId = setInterval(updateSessionTimerDisplay, 1000);

  // Set warning timeout (at 2 minutes remaining = 8 minutes after start)
  sessionWarningTimeoutId = setTimeout(() => {
    showSessionWarning();
  }, SESSION_TIMEOUT_MS - SESSION_WARNING_MS);

  // Set expiration timeout
  sessionTimeoutId = setTimeout(() => {
    handleSessionExpired();
  }, SESSION_TIMEOUT_MS);
}

// Create the session timer display element
function createSessionTimerDisplay() {
  // Remove existing timer if present
  const existingTimer = document.getElementById("session-timer");
  if (existingTimer) {
    existingTimer.remove();
  }

  const timerDiv = document.createElement("div");
  timerDiv.id = "session-timer";
  timerDiv.className = "session-timer";
  timerDiv.innerHTML = `
    <i class="fas fa-clock"></i>
    <span id="session-timer-text">10:00</span>
  `;

  // Insert at the top of the verification page
  const verificationPage = document.getElementById("verification-page");
  if (verificationPage) {
    verificationPage.insertBefore(timerDiv, verificationPage.firstChild);
  }
}

// Update the timer display
function updateSessionTimerDisplay() {
  if (!sessionStartTime || sessionExpired) return;

  const elapsed = Date.now() - sessionStartTime;
  const remaining = Math.max(0, SESSION_TIMEOUT_MS - elapsed);

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  const timerText = document.getElementById("session-timer-text");
  const timerDiv = document.getElementById("session-timer");

  if (timerText) {
    timerText.textContent = `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  // Add warning class when 2 minutes or less remaining
  if (timerDiv && remaining <= SESSION_WARNING_MS) {
    timerDiv.classList.add("warning");
  }

  // Add critical class when 1 minute or less remaining
  if (timerDiv && remaining <= 60000) {
    timerDiv.classList.add("critical");
  }
}

// Show warning when session is about to expire
function showSessionWarning() {
  console.log("⚠️ Session warning - 2 minutes remaining");

  const timerDiv = document.getElementById("session-timer");
  if (timerDiv) {
    timerDiv.classList.add("warning");
  }

  // Show a toast notification
  showToast(
    t("verification.session.warning_title", "Time Running Out!"),
    t(
      "verification.session.warning_message",
      "You have 2 minutes left to complete your verification."
    ),
    "warning"
  );
}

// Handle session expiration
function handleSessionExpired() {
  if (sessionExpired) return; // Prevent multiple triggers

  sessionExpired = true;
  console.log("❌ Session expired - stopping all processes");

  // Clear all timers
  clearSessionTimers();

  // Stop recording if active
  if (
    window.videoRecordingManager &&
    window.videoRecordingManager.isRecording
  ) {
    console.log("🎬 Stopping recording due to session expiry");
    window.videoRecordingManager.stopRecording();
    window.videoRecordingManager.cleanup();
  }

  // Stop any active camera stream
  if (currentStream) {
    currentStream.getTracks().forEach((track) => track.stop());
    currentStream = null;
  }

  // Show session expired modal
  showSessionExpiredModal();
}

// Show the session expired modal
function showSessionExpiredModal() {
  const modal = document.getElementById("session-expired-modal");
  if (modal) {
    modal.style.display = "flex";
  } else {
    // Create modal dynamically if it doesn't exist
    const modalHtml = `
      <div class="permission-modal" id="session-expired-modal" style="display: flex;">
        <div class="permission-modal-content session-expired-content">
          <div class="permission-icon session-expired-icon">
            <i class="fas fa-hourglass-end"></i>
          </div>
          <h2 data-translate="verification.session.expired_title">Session Expired</h2>
          <p data-translate="verification.session.expired_message">
            Your verification session has timed out for security reasons. Please start again to complete your verification.
          </p>
          <div class="session-expired-info">
            <i class="fas fa-info-circle"></i>
            <span data-translate="verification.session.expired_info">Sessions expire after 10 minutes of inactivity for your protection.</span>
          </div>
          <button class="grant-permission-btn" onclick="restartSession()">
            <i class="fas fa-redo"></i>
            <span data-translate="verification.session.try_again">Start Again</span>
          </button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML("beforeend", modalHtml);

    // Apply translations if available
    if (window.translationManager) {
      window.translationManager.updatePageLanguage();
    }
  }
}

// Restart the session
function restartSession() {
  console.log("🔄 Restarting session...");

  // Clear any stored session data
  localStorage.removeItem("kyc_session_id");
  localStorage.removeItem("kyc_retry_attempt");

  // Reload the page to start fresh
  window.location.reload();
}

// Clear all session timers
function clearSessionTimers() {
  if (sessionTimeoutId) {
    clearTimeout(sessionTimeoutId);
    sessionTimeoutId = null;
  }
  if (sessionWarningTimeoutId) {
    clearTimeout(sessionWarningTimeoutId);
    sessionWarningTimeoutId = null;
  }
  if (sessionTimerIntervalId) {
    clearInterval(sessionTimerIntervalId);
    sessionTimerIntervalId = null;
  }
}

// Stop session timer (called when verification is successfully completed)
function stopSessionTimer() {
  console.log("✅ Session timer stopped - verification completed");
  clearSessionTimers();

  // Hide the timer display
  const timerDiv = document.getElementById("session-timer");
  if (timerDiv) {
    timerDiv.style.display = "none";
  }
}

// Show toast notification
function showToast(title, message, type = "info") {
  // Remove existing toast if present
  const existingToast = document.querySelector(".session-toast");
  if (existingToast) {
    existingToast.remove();
  }

  const iconMap = {
    warning: "fa-exclamation-triangle",
    error: "fa-times-circle",
    success: "fa-check-circle",
    info: "fa-info-circle",
  };

  const toast = document.createElement("div");
  toast.className = `session-toast ${type}`;
  toast.innerHTML = `
    <i class="fas ${iconMap[type] || iconMap.info}"></i>
    <div class="toast-content">
      <strong>${title}</strong>
      <p>${message}</p>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">
      <i class="fas fa-times"></i>
    </button>
  `;

  document.body.appendChild(toast);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (toast.parentElement) {
      toast.classList.add("fade-out");
      setTimeout(() => toast.remove(), 300);
    }
  }, 5000);
}

// Request permissions when page loads
async function requestInitialPermissions() {
  const modal = document.getElementById("permission-modal");
  const statusDiv = document.getElementById("permission-status");
  const grantBtn = document.getElementById("grant-permission-btn");
  const verificationPage = document.getElementById("verification-page");

  // Show the modal and keep verification page disabled
  modal.style.display = "flex";
  verificationPage.classList.add("permissions-pending");

  // Handle grant button click
  grantBtn.onclick = async function () {
    try {
      // Update button to show requesting state
      grantBtn.disabled = true;
      grantBtn.innerHTML = `
        <i class="fas fa-spinner fa-spin"></i>
        <span>${t(
          "verification.permissions.requesting",
          "Requesting permissions..."
        )}</span>
      `;

      console.log("🔐 Requesting camera and microphone permissions...");

      // Request both camera and microphone permissions
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      // Permissions granted!
      console.log("✅ Camera and microphone permissions granted");
      permissionsGranted = true;

      // Stop the stream immediately - we just needed to get permissions
      stream.getTracks().forEach((track) => track.stop());

      // Update UI to show success
      grantBtn.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${t(
          "verification.permissions.granted_success",
          "Permissions Granted!"
        )}</span>
      `;
      grantBtn.classList.add("success");

      // Wait a moment for visual feedback
      setTimeout(() => {
        // Hide the modal
        modal.style.display = "none";

        // Enable the verification page
        verificationPage.classList.remove("permissions-pending");

        // Start the session timer (10 minutes to complete)
        startSessionTimer();

        // Initialize video recording after permissions are granted
        if (typeof initializeVideoRecording === "function") {
          initializeVideoRecording();
        }

        // Direct mode: skip Step 1 entirely, go straight to photo capture
        if (isDirectMode) {
          console.log("📸 Direct mode active - skipping personal info, going to photo capture");
          document.getElementById('step-1').classList.remove('active');
          document.getElementById('step-2').classList.add('active');
          currentStep = 2;
          const backBtn = document.querySelector('#step-2 .prev-btn');
          if (backBtn) {
            backBtn.style.display = 'none';
          }
          initializePhotoCapture();
          fireDirectModeStepEvent('permission_granted');
        }
      }, 1000);
    } catch (error) {
      console.error("❌ Permission denied or error:", error);
      permissionsGranted = false;

      // Update button to show error
      grantBtn.disabled = false;
      grantBtn.classList.add("error");

      // Show detailed error message based on error type
      let errorMessage;
      if (
        error.name === "NotAllowedError" ||
        error.name === "PermissionDeniedError"
      ) {
        errorMessage = t(
          "verification.validation.permissions_denied",
          "Camera and microphone access denied. Please grant permissions to continue with verification."
        );
        grantBtn.innerHTML = `
          <i class="fas fa-exclamation-triangle"></i>
          <span>${t(
            "verification.permissions.denied",
            "Permission Denied - Try Again"
          )}</span>
        `;
      } else if (
        error.name === "NotFoundError" ||
        error.name === "DevicesNotFoundError"
      ) {
        errorMessage = t(
          "verification.validation.no_camera",
          "No camera or microphone found. Please ensure your device has a camera and microphone."
        );
        grantBtn.innerHTML = `
          <i class="fas fa-exclamation-circle"></i>
          <span>${t(
            "verification.permissions.no_device",
            "No Camera/Microphone Found"
          )}</span>
        `;
      } else {
        errorMessage = t(
          "verification.validation.camera_error",
          "Cannot access camera and microphone. Please check your device settings."
        );
        grantBtn.innerHTML = `
          <i class="fas fa-times-circle"></i>
          <span>${t(
            "verification.permissions.error",
            "Error - Try Again"
          )}</span>
        `;
      }

      // Show error message in the status div
      statusDiv.innerHTML = `
        <div class="permission-error">
          <i class="fas fa-exclamation-triangle"></i>
          <p>${errorMessage}</p>
        </div>
        <button class="grant-permission-btn" id="grant-permission-btn">
          <i class="fas fa-redo"></i>
          <span>${t(
            "verification.permissions.retry",
            "Retry Permission Request"
          )}</span>
        </button>
      `;

      // Re-bind the click handler for retry
      document.getElementById("grant-permission-btn").onclick =
        grantBtn.onclick;
    }
  };
}

// Triple-tap capture variables
let tapCount = 0;
let tapTimer = null;
let tripleTapTimeout = 1000; // 1 second window for triple tap
let cameraAreaTouchHandler = null;

// Camera rotation variables removed - rotation functionality no longer needed

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

// Mapping from country codes to phone dial codes
const COUNTRY_TO_DIAL_CODE = {
  US: "+1",
  CA: "+1",
  GB: "+44",
  BG: "+359",
  DE: "+49",
  FR: "+33",
  IT: "+39",
  ES: "+34",
  NL: "+31",
  AU: "+61",
  AT: "+43",
  BE: "+32",
  HR: "+385",
  CZ: "+420",
  DK: "+45",
  EE: "+372",
  FI: "+358",
  GR: "+30",
  HU: "+36",
  IS: "+354",
  IE: "+353",
  LV: "+371",
  LT: "+370",
  LU: "+352",
  NO: "+47",
  PL: "+48",
  PT: "+351",
  RO: "+40",
  RU: "+7",
  RS: "+381",
  SK: "+421",
  SI: "+386",
  SE: "+46",
  CH: "+41",
  TR: "+90",
  AR: "+54",
  BR: "+55",
  CL: "+56",
  CO: "+57",
  MX: "+52",
  PE: "+51",
  VE: "+58",
  CN: "+86",
  IN: "+91",
  ID: "+62",
  JP: "+81",
  MY: "+60",
  PH: "+63",
  SG: "+65",
  KR: "+82",
  TH: "+66",
  VN: "+84",
  AE: "+971",
  SA: "+966",
  IL: "+972",
  IR: "+98",
  IQ: "+964",
  JO: "+962",
  KW: "+965",
  LB: "+961",
  OM: "+968",
  QA: "+974",
  EG: "+20",
  GH: "+233",
  KE: "+254",
  MA: "+212",
  NG: "+234",
  ZA: "+27",
  AF: "+93",
  DZ: "+213",
  BD: "+880",
  BH: "+973",
  BA: "+387",
  CY: "+357",
  ET: "+251",
  KZ: "+7",
  KG: "+996",
  LY: "+218",
  MK: "+389",
  ME: "+382",
  MM: "+95",
  NP: "+977",
  PK: "+92",
  PS: "+970",
  RW: "+250",
  LK: "+94",
  SD: "+249",
  SY: "+963",
  TJ: "+992",
  TZ: "+255",
  TM: "+993",
  TN: "+216",
  UG: "+256",
  UZ: "+998",
  XK: "+383",
};

/**
 * Auto-fill country fields based on detected geolocation
 * This function sets both the phone country code and the country dropdown
 */
function autoFillCountryFields(countryCode) {
  if (!countryCode) {
    console.log("No country code provided for auto-fill");
    return;
  }

  const upperCountryCode = countryCode.toUpperCase();
  console.log(`🌍 Auto-filling country fields with: ${upperCountryCode}`);

  // Auto-fill the phone country code dropdown
  const phoneCountryCodeSelect = document.getElementById("phone-country-code");
  if (phoneCountryCodeSelect) {
    // Find the option with matching data-country attribute
    const options = phoneCountryCodeSelect.querySelectorAll(
      "option[data-country]"
    );
    let found = false;

    for (const option of options) {
      if (option.getAttribute("data-country") === upperCountryCode) {
        phoneCountryCodeSelect.value = option.value;
        found = true;
        console.log(
          `📱 Phone country code set to: ${option.value} (${upperCountryCode})`
        );
        break;
      }
    }

    // If not found by data-country, try using the dial code mapping
    if (!found && COUNTRY_TO_DIAL_CODE[upperCountryCode]) {
      const dialCode = COUNTRY_TO_DIAL_CODE[upperCountryCode];
      // Find option with this dial code and matching country
      for (const option of options) {
        if (
          option.value === dialCode &&
          option.getAttribute("data-country") === upperCountryCode
        ) {
          phoneCountryCodeSelect.value = option.value;
          console.log(`📱 Phone country code set via dial code: ${dialCode}`);
          break;
        }
      }
    }
  }

  // Auto-fill the country dropdown
  const countrySelect = document.getElementById("country");
  if (countrySelect) {
    // Check if the country code exists as an option value
    const countryOption = countrySelect.querySelector(
      `option[value="${upperCountryCode}"]`
    );
    if (countryOption) {
      countrySelect.value = upperCountryCode;
      console.log(`🗺️ Country set to: ${upperCountryCode}`);

      // Trigger the state options update
      if (typeof updateStateOptions === "function") {
        updateStateOptions();
      }
    } else {
      console.log(
        `Country ${upperCountryCode} not found in country dropdown options`
      );
    }
  }
}

/**
 * Initialize country auto-fill based on geolocation detection
 * This should be called after geolocation detection is complete
 */
async function initializeCountryAutoFill() {
  try {
    let countryCode = null;

    // Check if GeolocationDetector is available
    if (window.GeolocationDetector) {
      const detector = new window.GeolocationDetector();
      countryCode = await detector.detectCountry();

      if (countryCode) {
        console.log(
          `🌐 Detected country from IP: ${countryCode.toUpperCase()}`
        );
      }
    }

    // Fallback: Use browser language to infer country if IP detection failed
    if (!countryCode) {
      countryCode = getCountryFromBrowserLanguage();
      if (countryCode) {
        console.log(
          `🌐 Inferred country from browser language: ${countryCode.toUpperCase()}`
        );
      }
    }

    if (countryCode) {
      autoFillCountryFields(countryCode);
      // Store the detected country for later use
      window.detectedCountryCode = countryCode.toUpperCase();
    } else {
      console.warn("Could not detect country from IP or browser language");
    }
  } catch (error) {
    console.warn("Failed to auto-fill country fields:", error);
  }
}

/**
 * Infer country code from browser language settings
 * This is used as a fallback when IP detection fails
 */
function getCountryFromBrowserLanguage() {
  const langToCountry = {
    'bg': 'bg',      // Bulgarian -> Bulgaria
    'en-us': 'us',   // English (US) -> United States
    'en-gb': 'gb',   // English (UK) -> United Kingdom
    'en-au': 'au',   // English (AU) -> Australia
    'en-ca': 'ca',   // English (CA) -> Canada
    'de': 'de',      // German -> Germany
    'de-at': 'at',   // German (Austria) -> Austria
    'de-ch': 'ch',   // German (Swiss) -> Switzerland
    'fr': 'fr',      // French -> France
    'fr-ca': 'ca',   // French (CA) -> Canada
    'fr-be': 'be',   // French (Belgium) -> Belgium
    'fr-ch': 'ch',   // French (Swiss) -> Switzerland
    'es': 'es',      // Spanish -> Spain
    'es-mx': 'mx',   // Spanish (Mexico) -> Mexico
    'es-ar': 'ar',   // Spanish (Argentina) -> Argentina
    'it': 'it',      // Italian -> Italy
    'pt': 'pt',      // Portuguese -> Portugal
    'pt-br': 'br',   // Portuguese (Brazil) -> Brazil
    'nl': 'nl',      // Dutch -> Netherlands
    'nl-be': 'be',   // Dutch (Belgium) -> Belgium
    'sv': 'se',      // Swedish -> Sweden
    'ru': 'ru',      // Russian -> Russia
    'pl': 'pl',      // Polish -> Poland
    'ro': 'ro',      // Romanian -> Romania
    'el': 'gr',      // Greek -> Greece
    'tr': 'tr',      // Turkish -> Turkey
    'ja': 'jp',      // Japanese -> Japan
    'zh': 'cn',      // Chinese -> China
    'ko': 'kr',      // Korean -> South Korea
  };

  // Check navigator.language first (e.g., "bg", "en-US", "de-DE")
  if (navigator.language) {
    const fullLang = navigator.language.toLowerCase();
    const shortLang = fullLang.split('-')[0];

    // Try full language code first (e.g., "en-us")
    if (langToCountry[fullLang]) {
      return langToCountry[fullLang];
    }
    // Try short language code (e.g., "en")
    if (langToCountry[shortLang]) {
      return langToCountry[shortLang];
    }
  }

  // Check navigator.languages array
  if (navigator.languages) {
    for (const lang of navigator.languages) {
      const fullLang = lang.toLowerCase();
      const shortLang = fullLang.split('-')[0];

      if (langToCountry[fullLang]) {
        return langToCountry[fullLang];
      }
      if (langToCountry[shortLang]) {
        return langToCountry[shortLang];
      }
    }
  }

  return null;
}

// Video Recording Manager Class for Session Recording
class VideoRecordingManager {
  constructor() {
    this.isRecording = false;
    this.isPaused = false;
    this.mediaRecorders = [];
    this.recordedChunks = [];
    this.videoChunks = new Map(); // Store chunks per camera type
    this.sessionId = null;
    this.startTime = null;
    this.streams = [];

    // Streaming upload state
    this.multipartUploads = new Map(); // Store multipart upload info per camera
    this.uploadedParts = new Map(); // Store uploaded parts per camera
    this.pendingChunks = new Map(); // Chunks waiting to be uploaded
    this.uploadIntervalId = null;
    this.UPLOAD_INTERVAL_MS = 5000; // Upload every 5 seconds
    this.MIN_PART_SIZE = 5 * 1024 * 1024; // 5MB minimum for S3 multipart (except last part)
    this.isStreamingUpload = true; // Enable streaming upload by default
  }

  async initializeRecording() {
    try {
      this.sessionId =
        localStorage.getItem("kyc_session_id") || this.generateSessionId();
      localStorage.setItem("kyc_session_id", this.sessionId);

      console.log("🎥 Initializing session recording...", this.sessionId);

      // Try to get camera streams
      // On iOS, we only capture the front camera to prevent resource exhaustion and freezing
      // simultaneous multi-camera recording is often not supported or unstable on mobile browsers
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

      const frontCameraStream = await this.getCameraStream("user");
      if (frontCameraStream) {
        this.streams.push({ type: "front", stream: frontCameraStream });
      }

      // Only attempt back camera recording on non-iOS devices
      if (!isIOS) {
        const backCameraStream = await this.getCameraStream("environment");
        if (backCameraStream) {
          this.streams.push({ type: "back", stream: backCameraStream });
        }
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
        // Keep front camera working exactly as it is (user said it's perfect)
        constraints = {
          video: {
            facingMode: { ideal: "user" }, // Force front camera
            // Remove resolution constraints to match what's working
          },
          audio: true,
        };
      } else if (isIOS) {
        // Regular iOS constraints for back camera - use same minimal approach as front camera
        constraints = {
          video: {
            facingMode: facingMode,
            // Remove resolution constraints to match working front camera
          },
          audio: true,
        };
      } else {
        // Non-iOS devices - use lower resolution for recording to free resources for photo capture
        constraints = {
          video: {
            facingMode: facingMode,
            width: { ideal: 640 },
            height: { ideal: 480 },
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
      const isAndroid = /Android/i.test(navigator.userAgent);

      if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        try {
          console.log("🔄 Trying iOS fallback constraints...");

          let fallbackConstraints;
          // Use minimal constraints for all iOS fallback scenarios
          fallbackConstraints = {
            video: { facingMode: facingMode },
            audio: true,
          };

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
      } else if (isAndroid) {
        try {
          console.log("🔄 Trying Android fallback constraints...");

          const fallbackConstraints = {
            video: { facingMode: facingMode },
            audio: true,
          };

          const fallbackStream = await navigator.mediaDevices.getUserMedia(
            fallbackConstraints
          );

          // Log fallback stream details
          const videoTracks = fallbackStream.getVideoTracks();
          if (videoTracks.length > 0) {
            const videoTrack = videoTracks[0];
            console.log(`🤖 ${facingMode} camera fallback track:`, {
              label: videoTrack.label,
              enabled: videoTrack.enabled,
              readyState: videoTrack.readyState,
            });
          }

          return fallbackStream;
        } catch (fallbackError) {
          console.warn("⚠️ Android fallback also failed:", fallbackError);
        }
      }

      return null;
    }
  }

  generateSessionId() {
    return "rec_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
  }

  async startRecording() {
    if (this.isRecording || this.streams.length === 0) {
      return false;
    }

    this.isRecording = true;
    this.startTime = new Date();
    this.videoChunks.clear();
    this.pendingChunks.clear();
    this.uploadedParts.clear();
    this.multipartUploads.clear();
    this.mediaRecorders = [];

    console.log("🔴 Starting session recording with streaming upload...");

    // Initialize multipart uploads for each camera
    if (this.isStreamingUpload) {
      await this.initializeMultipartUploads();
    }

    this.streams.forEach((streamInfo) => {
      try {
        const mimeType = this.getBestMimeType(streamInfo.type);
        console.log(`🎬 Using codec ${mimeType} for ${streamInfo.type} camera`);

        const recordingOptions = {
          mimeType: mimeType,
          videoBitsPerSecond: this.getOptimalBitrate(streamInfo.type),
          audioBitsPerSecond: 128000,
        };

        const mediaRecorder = new MediaRecorder(
          streamInfo.stream,
          recordingOptions
        );

        if (!this.videoChunks.has(streamInfo.type)) {
          this.videoChunks.set(streamInfo.type, []);
        }

        if (!this.pendingChunks.has(streamInfo.type)) {
          this.pendingChunks.set(streamInfo.type, []);
        }

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.videoChunks.get(streamInfo.type).push(event.data);
            // Also add to pending chunks for streaming upload
            if (this.isStreamingUpload) {
              this.pendingChunks.get(streamInfo.type).push(event.data);
            }
          }
        };

        mediaRecorder.onstop = () => {
          console.log(
            `📹 ${streamInfo.type} camera recording stopped, chunks collected.`
          );
        };

        mediaRecorder.onerror = (event) => {
          console.error(
            `❌ MediaRecorder error for ${streamInfo.type}:`,
            event.error
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
        this.tryFallbackRecording(streamInfo);
      }
    });

    // Start periodic upload of chunks
    if (this.isStreamingUpload) {
      this.startPeriodicUpload();
    }

    return true;
  }

  // Initialize multipart uploads for all cameras
  async initializeMultipartUploads() {
    console.log("🚀 Initializing multipart uploads for streaming...");

    for (const streamInfo of this.streams) {
      try {
        const mimeType = this.getBestMimeType(streamInfo.type);

        const response = await fetch("/api/initiate-multipart-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: this.sessionId,
            cameraType: streamInfo.type,
            mimeType: mimeType,
          }),
        });

        if (!response.ok) {
          throw new Error(
            `Failed to initiate multipart upload for ${streamInfo.type}`
          );
        }

        const result = await response.json();

        this.multipartUploads.set(streamInfo.type, {
          uploadId: result.uploadId,
          key: result.key,
          mimeType: mimeType,
        });

        this.uploadedParts.set(streamInfo.type, []);

        console.log(
          `✅ Multipart upload initiated for ${streamInfo.type}: ${result.uploadId}`
        );
      } catch (error) {
        console.error(
          `❌ Failed to initiate multipart upload for ${streamInfo.type}:`,
          error
        );
        // Fallback to non-streaming mode for this camera
        this.multipartUploads.delete(streamInfo.type);
      }
    }
  }

  // Start periodic upload of pending chunks
  startPeriodicUpload() {
    console.log(
      `⏰ Starting periodic upload every ${
        this.UPLOAD_INTERVAL_MS / 1000
      } seconds`
    );

    this.uploadIntervalId = setInterval(async () => {
      await this.uploadPendingChunks();
    }, this.UPLOAD_INTERVAL_MS);
  }

  // Upload pending chunks for all cameras
  // forceUpload=true uploads regardless of size (for final upload)
  async uploadPendingChunks(forceUpload = false) {
    for (const [cameraType, chunks] of this.pendingChunks.entries()) {
      if (chunks.length === 0) continue;

      const uploadInfo = this.multipartUploads.get(cameraType);
      if (!uploadInfo) continue;

      try {
        // Combine pending chunks into one blob
        const combinedBlob = new Blob(chunks, { type: uploadInfo.mimeType });

        // S3 requires minimum 5MB for parts except the last one
        // Only upload if we have >= 5MB OR this is the final upload
        if (combinedBlob.size < this.MIN_PART_SIZE && !forceUpload) {
          console.log(
            `⏳ Buffering ${cameraType} chunks (${(
              combinedBlob.size /
              1024 /
              1024
            ).toFixed(2)}MB < 5MB minimum)`
          );
          continue; // Keep accumulating chunks
        }

        // Clear pending chunks immediately to avoid double upload
        this.pendingChunks.set(cameraType, []);

        const partNumber =
          (this.uploadedParts.get(cameraType)?.length || 0) + 1;

        console.log(
          `📤 Uploading part ${partNumber} for ${cameraType} (${(
            combinedBlob.size /
            1024 /
            1024
          ).toFixed(2)}MB)`
        );

        const formData = new FormData();
        formData.append("chunk", combinedBlob, `part_${partNumber}.webm`);
        formData.append("uploadId", uploadInfo.uploadId);
        formData.append("key", uploadInfo.key);
        formData.append("partNumber", partNumber.toString());

        const response = await fetch("/api/upload-part", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Failed to upload part ${partNumber}`);
        }

        const result = await response.json();

        // Store the uploaded part info
        this.uploadedParts.get(cameraType).push({
          PartNumber: result.partNumber,
          ETag: result.eTag,
          Size: result.size,
        });

        console.log(`✅ Part ${partNumber} uploaded for ${cameraType}`);
      } catch (error) {
        console.error(`❌ Failed to upload chunk for ${cameraType}:`, error);
        // Put chunks back for retry on next interval (or final upload)
        const existingChunks = this.pendingChunks.get(cameraType) || [];
        this.pendingChunks.set(cameraType, [...chunks, ...existingChunks]);
      }
    }
  }

  getBestMimeType(cameraType) {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    // Prioritize H.264 for iOS, as it's more reliable, especially for front camera.
    const codecPreferences = {
      ios: {
        front: [
          'video/mp4; codecs="avc1.42E01E"', // H.264 Baseline (most compatible)
          'video/mp4; codecs="avc1.64001E"', // H.264 Main
          "video/mp4",
          'video/webm; codecs="vp8,opus"',
          "video/webm",
        ],
        back: [
          'video/mp4; codecs="avc1.64001E"', // H.264 Main
          'video/mp4; codecs="avc1.42E01E"', // H.264 Baseline
          'video/webm; codecs="vp9,opus"',
          "video/mp4",
          'video/webm; codecs="vp8,opus"',
          "video/webm",
        ],
      },
      other: [
        'video/webm; codecs="vp9,opus"',
        'video/webm; codecs="vp8,opus"',
        'video/mp4; codecs="avc1.64001E"',
        'video/mp4; codecs="avc1.42E01E"',
        "video/webm",
        "video/mp4",
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
      'video/webm; codecs="vp8,opus"', // VP8 is broadly supported
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

      if (!this.videoChunks.has(streamInfo.type)) {
        this.videoChunks.set(streamInfo.type, []);
      }

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.videoChunks.get(streamInfo.type).push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log(
          `📹 ${streamInfo.type} camera fallback recording stopped, chunks collected.`
        );
      };

      mediaRecorder.onerror = (event) => {
        console.error(
          `❌ Fallback MediaRecorder error for ${streamInfo.type}:`,
          event.error
        );
      };

      mediaRecorder.start(1000);
      this.mediaRecorders.push(mediaRecorder);

      console.log(
        `✅ Fallback recording started for ${streamInfo.type} camera with ${
          fallbackMimeType || "default codec"
        }`
      );
    } catch (fallbackError) {
      console.error(
        `❌ Fallback recording also failed for ${streamInfo.type} camera:`,
        fallbackError
      );
    }
  }

  getOptimalBitrate(cameraType) {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isMobile =
      /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

    const baseBitrates = {
      desktop: {
        front: 2000000, // 2.0 Mbps
        back: 3000000, // 3.0 Mbps
      },
      mobile: {
        front: 1000000, // 1.0 Mbps
        back: 1500000, // 1.5 Mbps
      },
      ios: {
        front: 1500000, // 1.5 Mbps for iOS front camera
        back: 2000000, // 2.0 Mbps for iOS back camera
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

    // Stop periodic upload
    if (this.uploadIntervalId) {
      clearInterval(this.uploadIntervalId);
      this.uploadIntervalId = null;
      console.log("⏰ Stopped periodic upload");
    }

    this.mediaRecorders.forEach((recorder) => {
      if (recorder.state === "recording") {
        recorder.stop();
      }
    });

    // A short delay to ensure ondataavailable is triggered before stopping tracks.
    setTimeout(() => {
      this.streams.forEach((streamInfo) => {
        streamInfo.stream.getTracks().forEach((track) => track.stop());
      });
      console.log("🔌 All camera tracks stopped.");
    }, 500);

    return true;
  }

  // Pause video recording by stopping video tracks completely to free camera for photos
  // Audio tracks remain active for continuous microphone recording
  pauseRecording() {
    if (!this.isRecording) {
      console.log("⚠️ Cannot pause - not recording");
      return false;
    }

    console.log("⏸️ Stopping video tracks to free camera for photo capture (audio continues)...");

    // Pause media recorders first
    this.mediaRecorders.forEach((recorder) => {
      if (recorder.state === "recording") {
        recorder.pause();
        console.log("⏸️ MediaRecorder paused");
      }
    });

    // Stop video tracks completely to release camera hardware
    // This allows the photo capture to get full camera quality
    this.streams.forEach((streamInfo) => {
      const videoTracks = streamInfo.stream.getVideoTracks();
      videoTracks.forEach((track) => {
        track.stop();
        console.log(`⏹️ Video track ${track.label} stopped to free camera`);
      });
    });

    this.isPaused = true;
    return true;
  }

  // Resume video recording after photo capture by getting new video streams
  async resumeRecording() {
    if (!this.isRecording || !this.isPaused) {
      console.log("⚠️ Cannot resume - not paused or not recording");
      return false;
    }

    console.log("▶️ Resuming video recording with new streams...");

    try {
      // Get new video streams for each camera that was previously active
      const newStreams = [];
      for (const streamInfo of this.streams) {
        const facingMode = streamInfo.type === "front" ? "user" : "environment";

        // Get the existing audio track
        const audioTracks = streamInfo.stream.getAudioTracks();

        try {
          // Get a new video stream
          const newVideoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: facingMode },
            audio: false // Don't get new audio, we'll reuse existing
          });

          const newVideoTrack = newVideoStream.getVideoTracks()[0];

          // Add new video track to existing stream
          if (newVideoTrack) {
            streamInfo.stream.addTrack(newVideoTrack);
            console.log(`▶️ New video track added for ${streamInfo.type} camera`);
          }

          newStreams.push(streamInfo);
        } catch (error) {
          console.warn(`⚠️ Could not resume ${streamInfo.type} camera:`, error);
        }
      }

      // Resume media recorders
      this.mediaRecorders.forEach((recorder) => {
        if (recorder.state === "paused") {
          recorder.resume();
          console.log("▶️ MediaRecorder resumed");
        }
      });

      this.isPaused = false;
      return true;
    } catch (error) {
      console.error("❌ Failed to resume recording:", error);
      this.isPaused = false;
      return false;
    }
  }

  async uploadRecordings() {
    console.log("☁️ Completing session recordings upload...");

    try {
      const results = [];

      // Check if we're using streaming upload
      if (this.isStreamingUpload && this.multipartUploads.size > 0) {
        // Complete multipart uploads
        results.push(...(await this.completeMultipartUploads()));
      } else {
        // Fallback: upload the full recording at once
        for (const [cameraType, chunks] of this.videoChunks.entries()) {
          if (chunks.length === 0) continue;

          const mimeType = this.getBestMimeType(cameraType);
          const combinedVideo = this.combineVideoChunks(cameraType, mimeType);

          if (!combinedVideo) continue;

          const uploadResult = await this.uploadCombinedVideo(
            combinedVideo,
            cameraType,
            mimeType
          );

          if (uploadResult) {
            results.push(uploadResult);
          }
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

  // Complete all multipart uploads
  async completeMultipartUploads() {
    console.log("🏁 Completing multipart uploads...");
    const results = [];

    // Wait a moment for any final chunks to be collected
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Force upload any remaining pending chunks (last part can be < 5MB)
    await this.uploadPendingChunks(true);

    for (const [cameraType, uploadInfo] of this.multipartUploads.entries()) {
      try {
        const parts = this.uploadedParts.get(cameraType) || [];
        const totalSize = parts.reduce((sum, p) => sum + (p.Size || 0), 0);

        // S3 Multipart requires:
        // - At least 1 part
        // - If only 1 part, it must be >= 5MB
        // - If multiple parts, all except last must be >= 5MB
        const needsFallback =
          parts.length === 0 ||
          (parts.length === 1 && totalSize < this.MIN_PART_SIZE);

        if (needsFallback) {
          console.warn(
            `⚠️ Multipart not viable for ${cameraType} (${
              parts.length
            } parts, ${(totalSize / 1024 / 1024).toFixed(
              2
            )}MB), using single upload`
          );

          // Abort the multipart upload
          try {
            await fetch("/api/abort-multipart-upload", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                uploadId: uploadInfo.uploadId,
                key: uploadInfo.key,
              }),
            });
          } catch (abortError) {
            console.warn("Failed to abort multipart upload:", abortError);
          }

          // Use single upload instead
          const chunks = this.videoChunks.get(cameraType);
          if (chunks && chunks.length > 0) {
            const mimeType = this.getBestMimeType(cameraType);
            const combinedVideo = this.combineVideoChunks(cameraType, mimeType);
            if (combinedVideo) {
              console.log(
                `📤 Single upload for ${cameraType} (${(
                  combinedVideo.size /
                  1024 /
                  1024
                ).toFixed(2)}MB)`
              );
              const uploadResult = await this.uploadCombinedVideo(
                combinedVideo,
                cameraType,
                mimeType
              );
              if (uploadResult) {
                results.push(uploadResult);
              }
            }
          }
          continue;
        }

        console.log(
          `🏁 Completing multipart upload for ${cameraType} with ${
            parts.length
          } parts (${(totalSize / 1024 / 1024).toFixed(2)}MB)`
        );

        const response = await fetch("/api/complete-multipart-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uploadId: uploadInfo.uploadId,
            key: uploadInfo.key,
            parts: parts,
            sessionId: this.sessionId,
            cameraType: cameraType,
            duration: Date.now() - (this.startTime?.getTime() || 0),
            mimeType: uploadInfo.mimeType,
          }),
        });

        if (!response.ok) {
          throw new Error(
            `Failed to complete multipart upload for ${cameraType}`
          );
        }

        const result = await response.json();

        console.log(
          `✅ Multipart upload completed for ${cameraType}: ${result.s3Location}`
        );

        results.push({
          cameraType: cameraType,
          s3Location: result.s3Location,
          filename: result.filename,
          size: result.size,
          partsCount: result.partsCount,
          streamingUpload: true,
        });
      } catch (error) {
        console.error(
          `❌ Failed to complete multipart upload for ${cameraType}:`,
          error
        );

        // Try to abort the failed upload
        try {
          await fetch("/api/abort-multipart-upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              uploadId: uploadInfo.uploadId,
              key: uploadInfo.key,
            }),
          });
        } catch (abortError) {
          console.warn("Failed to abort multipart upload:", abortError);
        }

        // Fallback: try to upload the full video
        console.log(`🔄 Falling back to full upload for ${cameraType}`);
        const chunks = this.videoChunks.get(cameraType);
        if (chunks && chunks.length > 0) {
          const mimeType = this.getBestMimeType(cameraType);
          const combinedVideo = this.combineVideoChunks(cameraType, mimeType);
          if (combinedVideo) {
            const uploadResult = await this.uploadCombinedVideo(
              combinedVideo,
              cameraType,
              mimeType
            );
            if (uploadResult) {
              results.push(uploadResult);
            }
          }
        }
      }
    }

    return results;
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
    this.pendingChunks.clear();
    this.mediaRecorders = [];
    this.streams = [];

    // Abort any pending multipart uploads
    this.abortPendingUploads();
  }

  // Abort all pending multipart uploads
  async abortPendingUploads() {
    for (const [cameraType, uploadInfo] of this.multipartUploads.entries()) {
      try {
        console.log(`🛑 Aborting multipart upload for ${cameraType}`);
        await fetch("/api/abort-multipart-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uploadId: uploadInfo.uploadId,
            key: uploadInfo.key,
          }),
        });
      } catch (error) {
        console.warn(`Failed to abort upload for ${cameraType}:`, error);
      }
    }
    this.multipartUploads.clear();
    this.uploadedParts.clear();
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
        width: 100vw !important;
        height: 100vh !important;
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
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

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

      // For iOS, ensure the next step is visible before showing
      if (isIOS) {
        nextSubStep.style.display = "block";
        nextSubStep.style.visibility = "visible";
      }

      nextSubStep.classList.add("active");
      nextSubStep.classList.add("slide-in-from-right");

      // Remove animation classes after animation completes
      setTimeout(() => {
        currentSubStep.classList.remove("slide-out-to-left");
        nextSubStep.classList.remove("slide-in-from-right");

        // For iOS, hide the previous step completely after animation
        if (isIOS) {
          currentSubStep.style.display = "none";
          currentSubStep.style.visibility = "hidden";
        }
      }, 600);
    }, 50);

    updateFieldProgress();
    focusCurrentField();
  }
}

function prevFieldStep() {
  if (currentFieldStep > 1) {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

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

      // For iOS, ensure the previous step is visible before showing
      if (isIOS) {
        prevSubStep.style.display = "block";
        prevSubStep.style.visibility = "visible";
      }

      prevSubStep.classList.add("active");
      prevSubStep.classList.add("slide-in-from-left");

      // Remove animation classes after animation completes
      setTimeout(() => {
        currentSubStep.classList.remove("slide-out-to-right");
        prevSubStep.classList.remove("slide-in-from-left");

        // For iOS, hide the next step completely after animation
        if (isIOS) {
          currentSubStep.style.display = "none";
          currentSubStep.style.visibility = "hidden";
        }
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
      // Prioritize input and textarea elements over select elements to prevent iOS confusion
      let inputField = currentSubStep.querySelector("input");
      if (!inputField) {
        inputField = currentSubStep.querySelector("textarea");
      }
      if (!inputField) {
        inputField = currentSubStep.querySelector("select");
      }

      if (inputField) {
        // Debug logging for iOS
        if (isIOS) {
          console.log(`📱 iOS Focus Debug - Step ${currentFieldStep}:`, {
            element: inputField.tagName,
            id: inputField.id,
            type: inputField.type || "select",
            fieldType: inputField.getAttribute("data-field-type"),
          });
        }

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

// iOS Safari Form Protection
function protectFormFieldsFromIOSSafari() {
  console.log("📱 Setting up iOS Safari form protection...");

  // Hide all sub-steps except the first one
  for (let i = 2; i <= 14; i++) {
    const subStep = document.getElementById(`sub-step-1-${i}`);
    if (subStep) {
      subStep.style.display = "none";
      subStep.style.visibility = "hidden";
    }
  }

  // Ensure only the first step is visible and active
  const firstStep = document.getElementById("sub-step-1-1");
  if (firstStep) {
    firstStep.style.display = "block";
    firstStep.style.visibility = "visible";
    firstStep.classList.add("active");
  }

  // Add event listener to prevent unwanted select field activation
  document.addEventListener(
    "focusin",
    function (event) {
      const target = event.target;
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

      if (isIOS && target.tagName === "SELECT") {
        const targetId = target.id;
        const currentStepElement = document.getElementById(
          `sub-step-1-${currentFieldStep}`
        );
        const targetInCurrentStep =
          currentStepElement && currentStepElement.contains(target);

        if (!targetInCurrentStep) {
          console.log(
            `📱 iOS: Preventing focus on select element '${targetId}' - not in current step ${currentFieldStep}`
          );
          event.preventDefault();
          event.stopPropagation();

          // Focus on the correct field instead
          const correctField =
            currentStepElement?.querySelector("input, textarea");
          if (correctField) {
            setTimeout(() => {
              correctField.focus();
            }, 10);
          }

          return false;
        }
      }
    },
    true
  );

  // Add click protection for iOS
  document.addEventListener(
    "click",
    function (event) {
      const target = event.target;
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

      if (isIOS && target.tagName === "SELECT") {
        const targetId = target.id;
        const currentStepElement = document.getElementById(
          `sub-step-1-${currentFieldStep}`
        );
        const targetInCurrentStep =
          currentStepElement && currentStepElement.contains(target);

        if (!targetInCurrentStep) {
          console.log(
            `📱 iOS: Preventing click on select element '${targetId}' - not in current step ${currentFieldStep}`
          );
          event.preventDefault();
          event.stopPropagation();
          return false;
        }
      }
    },
    true
  );

  console.log("📱 iOS Safari form protection active");
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
      if (value && value.length > 18) {
        alert("Personal ID Number must be up to 18 characters.");
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
    case 9: // Postal code - no validation
      // Postal code validation removed per user request
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
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  // For iOS devices, completely disable auto-focus to prevent Safari interference
  if (isIOS) {
    console.log(
      "📱 iOS detected: Disabling auto-focus to prevent Safari form interference"
    );

    // Ensure we're starting at the first field step
    if (currentFieldStep !== 1) {
      console.log(`📱 Resetting field step from ${currentFieldStep} to 1`);
      currentFieldStep = 1;
    }

    // Add iOS-specific form field protection
    protectFormFieldsFromIOSSafari();

    return; // Skip auto-focus entirely on iOS
  }

  // For non-iOS devices, keep the original behavior
  setTimeout(() => {
    // Ensure we're always starting at the first field step
    if (currentFieldStep !== 1) {
      console.log(`Resetting field step from ${currentFieldStep} to 1`);
      currentFieldStep = 1;
    }

    const activeElement = document.activeElement;
    const userAlreadyInteracting =
      activeElement &&
      (activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA" ||
        activeElement.tagName === "SELECT");

    if (userAlreadyInteracting) {
      console.log(
        "Skipping auto-focus as user is already interacting with form"
      );
      return;
    }

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
      return isDirectMode ? true : validatePersonalInfo();
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

  // EGN validation (removed per user request)
  // Personal ID Number validation removed

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
  // Prevent camera capture if verification is already in progress
  if (isVerificationInProgress) {
    console.log("Verification in progress, ignoring camera capture request");
    return;
  }

  // Check if permissions have been granted
  if (!permissionsGranted) {
    console.log("Permissions not granted yet, requesting permissions...");
    requestCameraPermissions();
    return;
  }

  // For iOS devices, add small delay to ensure proper cleanup between captures
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);

  if (isIOS) {
    console.log("📱 iOS device: Adding initialization delay");
    setTimeout(() => {
      initializeCameraCapture();
    }, 300); // 300ms delay for iOS
  } else if (isAndroid) {
    console.log("🤖 Android device: Adding initialization delay");
    setTimeout(() => {
      initializeCameraCapture();
    }, 200); // 200ms delay for Android to allow camera cleanup
  } else {
    initializeCameraCapture();
  }
}

// Request camera and microphone permissions
async function requestCameraPermissions() {
  const startBtn = document.getElementById("start-camera-btn");

  // Update button to show requesting state
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.innerHTML = `
      <i class="fas fa-spinner fa-spin"></i>
      <span data-translate="verification.step2.requesting_permissions">Requesting permissions...</span>
    `;
  }

  try {
    // Request both camera and microphone permissions
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    // Permissions granted!
    console.log("✅ Camera and microphone permissions granted");
    permissionsGranted = true;

    // Stop the stream immediately - we just needed to get permissions
    stream.getTracks().forEach((track) => track.stop());

    // Update button to show success and enable camera
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span data-translate="verification.step2.permissions_granted">Permissions Granted - Start Camera</span>
      `;

      // Add visual feedback
      startBtn.classList.add("permissions-granted");

      // Automatically proceed to camera capture after a short delay
      setTimeout(() => {
        if (startBtn) {
          startBtn.innerHTML = `
            <i class="fas fa-video"></i>
            <span data-translate="verification.step2.start_camera">Start Camera</span>
          `;
        }
        startCameraCapture();
      }, 1000);
    }
  } catch (error) {
    console.error("❌ Permission denied or error:", error);
    permissionsGranted = false;

    // Update button to show error
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        <span data-translate="verification.step2.permissions_denied">Permission Denied - Try Again</span>
      `;
      startBtn.classList.add("permissions-denied");
    }

    // Show detailed error message
    let errorMessage;
    if (
      error.name === "NotAllowedError" ||
      error.name === "PermissionDeniedError"
    ) {
      errorMessage = t(
        "verification.validation.permissions_denied",
        "Camera and microphone access denied. Please grant permissions in your browser settings to continue with verification."
      );
    } else if (
      error.name === "NotFoundError" ||
      error.name === "DevicesNotFoundError"
    ) {
      errorMessage = t(
        "verification.validation.no_camera",
        "No camera or microphone found. Please ensure your device has a camera and microphone."
      );
    } else {
      errorMessage = t(
        "verification.validation.camera_error",
        "Cannot access camera and microphone. Please check your device settings and try again."
      );
    }

    alert(errorMessage);

    // Reset button after showing error
    setTimeout(() => {
      if (startBtn) {
        startBtn.innerHTML = `
          <i class="fas fa-video"></i>
          <span data-translate="verification.step2.start_camera">Start Camera</span>
        `;
        startBtn.classList.remove("permissions-denied");
      }
    }, 3000);
  }
}

function initializeCameraCapture() {
  const currentPhoto = PHOTO_SEQUENCE[currentPhotoStep - 1];
  const cameraArea = document.getElementById("camera-capture-area");
  const video = document.getElementById("capture-video");
  const placeholder = document.getElementById("camera-placeholder");
  const overlay = document.getElementById("camera-overlay");
  const tapInstructionOverlay = document.getElementById(
    "tap-instruction-overlay"
  );

  // Pause video recording to improve photo quality (audio continues)
  if (window.videoRecordingManager && window.videoRecordingManager.isRecording) {
    window.videoRecordingManager.pauseRecording();
  }

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

  // Clear any existing video transforms to prevent zoom issues
  if (video) {
    video.style.webkitTransform = "translateZ(0)";
    video.style.transform = "translateZ(0)";
  }

  // Different constraints for front vs back ID to fix rotation issues
  let videoConstraints;

  if (isIOS && currentPhoto.guide === "id-guide") {
    // Use same minimal constraints as front camera that works perfectly
    videoConstraints = {
      facingMode: currentPhoto.camera,
      // Remove all resolution constraints - let iOS choose naturally like front camera
    };

    console.log(
      `📱 Using same minimal constraints as front camera for ${currentPhoto.name} - no zoom`
    );
  } else if (isIOS) {
    // High quality iOS constraints for photo capture
    videoConstraints = {
      facingMode: currentPhoto.camera,
      width: { ideal: 1920, min: 1280 },
      height: { ideal: 1080, min: 720 },
    };
  } else {
    // High quality constraints for Android/desktop for better photo capture
    const isAndroid = /Android/i.test(navigator.userAgent);

    if (isAndroid) {
      // High resolution Android constraints for photo capture
      videoConstraints = {
        facingMode: currentPhoto.camera,
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 },
      };
    } else {
      // Desktop constraints - highest quality
      videoConstraints = {
        facingMode: currentPhoto.camera,
        width: { ideal: 2560 },
        height: { ideal: 1440 },
      };
    }
  }

  const constraints = {
    video: videoConstraints,
  };

  console.log(
    `📱 Starting camera capture for ${currentPhoto.name} on ${
      isIOS ? "iOS" : "other"
    } device with constraints:`,
    constraints
  );

  navigator.mediaDevices
    .getUserMedia(constraints)
    .then(function (stream) {
      currentStream = stream;
      video.srcObject = stream;

      // Apply comprehensive iOS setup
      setupVideoElementForIOS(video);

      // Apply iOS-specific fixes for ID capture (without rotation)
      if (isIOS && currentPhoto.guide === "id-guide") {
        // Apply basic iOS setup without rotation artifacts
        video.style.webkitTransform = "translateZ(0)";
        video.style.transform = "translateZ(0)";

        // Ensure proper sizing for full viewport coverage
        video.style.width = "100vw";
        video.style.height = "100vh";
        video.style.objectFit = "cover";
        video.style.objectPosition = "center";

        // Apply iOS orientation fix class for additional CSS fixes
        video.classList.add("ios-orientation-fixed");

        console.log(
          "📱 Applied iOS ID capture fix without rotation for",
          currentPhoto.name
        );

        // Log actual video track settings for debugging
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack && videoTrack.getSettings) {
          const settings = videoTrack.getSettings();
          console.log("📱 Actual video track settings:", settings);
          console.log(
            `📱 Resolution: ${settings.width}x${settings.height}, FacingMode: ${settings.facingMode}`
          );
        }
      }

      video.style.display = "block";
      placeholder.style.display = "none";
      overlay.style.display = "block";

      // Show capture instruction overlay (static, no auto-hide)
      if (tapInstructionOverlay) {
        tapInstructionOverlay.style.display = "block";
      }

      // Rotation controls removed - no longer needed

      // Show capture button instead of triple-tap functionality
      showCaptureButton();

      // Debug log
      console.log("Triple-tap capture initialized:", {
        photoType: currentPhoto.name,
        guide: currentPhoto.guide,
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

      // Try fallback constraints for iOS ID capture (similar to video recording fallback)
      const isAndroid = /Android/i.test(navigator.userAgent);

      if (isIOS && currentPhoto.guide === "id-guide") {
        console.log("🔄 Trying iOS ID capture fallback constraints...");

        const fallbackConstraints = {
          video: {
            facingMode: currentPhoto.camera,
            // Use same minimal constraints as working front camera
          },
        };

        navigator.mediaDevices
          .getUserMedia(fallbackConstraints)
          .then(function (stream) {
            console.log("✅ iOS ID capture fallback successful");
            currentStream = stream;
            video.srcObject = stream;
            setupVideoElementForIOS(video);

            // Apply iOS-specific fixes
            video.style.webkitTransform = "translateZ(0)";
            video.style.transform = "translateZ(0)";

            // Apply iOS orientation fix class for additional CSS fixes
            video.classList.add("ios-orientation-fixed");

            // Log fallback success
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack && videoTrack.getSettings) {
              const settings = videoTrack.getSettings();
              console.log("📱 Fallback video track settings:", settings);
            }

            video.style.display = "block";
            placeholder.style.display = "none";
            overlay.style.display = "block";

            if (tapInstructionOverlay) {
              tapInstructionOverlay.style.display = "block";
            }

            initializeTripleTap();
            playVideoSafely(video);
          })
          .catch(function (fallbackError) {
            console.error(
              "❌ iOS ID capture fallback also failed:",
              fallbackError
            );
            alert(
              t(
                "verification.validation.camera_error",
                "Cannot access camera. Please check camera permissions."
              )
            );
            closeCameraCapture();
          });
      } else if (isAndroid) {
        console.log("🔄 Trying Android camera fallback constraints...");

        const fallbackConstraints = {
          video: {
            facingMode: currentPhoto.camera,
            // Minimal constraints for Android fallback
          },
        };

        navigator.mediaDevices
          .getUserMedia(fallbackConstraints)
          .then(function (stream) {
            console.log("✅ Android camera fallback successful");
            currentStream = stream;
            video.srcObject = stream;

            // Log fallback success
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack && videoTrack.getSettings) {
              const settings = videoTrack.getSettings();
              console.log(
                "🤖 Android fallback video track settings:",
                settings
              );
            }

            video.style.display = "block";
            placeholder.style.display = "none";
            overlay.style.display = "block";

            if (tapInstructionOverlay) {
              tapInstructionOverlay.style.display = "block";
            }

            initializeTripleTap();
            playVideoSafely(video);
          })
          .catch(function (fallbackError) {
            console.error(
              "❌ Android camera fallback also failed:",
              fallbackError
            );
            alert(
              t(
                "verification.validation.camera_error",
                "Cannot access camera. Please check camera permissions."
              )
            );
            closeCameraCapture();
          });
      } else {
        alert(
          t(
            "verification.validation.camera_error",
            "Cannot access camera. Please check camera permissions."
          )
        );
        closeCameraCapture();
      }
    });
}

function createGuideOverlay(guideType) {
  const overlay = document.getElementById("camera-overlay");
  overlay.innerHTML = "";

  switch (guideType) {
    case "id-guide":
      // ID card guide frame for front/back capture
      overlay.innerHTML = `
        <div class="id-card-guide">
          <div class="id-card-frame">
            <div class="corner top-left"></div>
            <div class="corner top-right"></div>
            <div class="corner bottom-left"></div>
            <div class="corner bottom-right"></div>
          </div>
        </div>
      `;
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

  // Stop face quality analysis
  stopFaceAnalysis();

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

  // Hide tap instruction overlay
  const tapInstructionOverlay = document.getElementById(
    "tap-instruction-overlay"
  );
  if (tapInstructionOverlay) {
    tapInstructionOverlay.style.display = "none";
  }

  // Hide face quality feedback
  const feedbackElement = document.getElementById("face-quality-feedback");
  if (feedbackElement) {
    feedbackElement.style.display = "none";
  }

  // Rotation controls removed - no longer needed

  // Remove iOS-specific classes
  if (video) {
    video.classList.remove("ios-orientation-fixed");
  }

  // Remove triple-tap listeners and reset state
  removeTripleTapListeners();

  // Stop camera
  stopCamera();

  // Resume video recording after photo capture (with delay for camera cleanup)
  // Only resume if we're still capturing photos (not during final verification)
  setTimeout(async () => {
    if (window.videoRecordingManager &&
        window.videoRecordingManager.isRecording &&
        window.videoRecordingManager.isPaused &&
        !isVerificationInProgress &&
        currentPhotoStep < PHOTO_SEQUENCE.length) {
      await window.videoRecordingManager.resumeRecording();
    }
  }, 500);
}

function captureCurrentPhoto() {
  // Prevent multiple captures during verification
  if (isVerificationInProgress) {
    console.log("Verification in progress, ignoring capture request");
    return;
  }

  // Prevent capture if quality is not acceptable
  if (!isCaptureAllowed) {
    console.log("Capture not allowed - quality not acceptable");
    return;
  }

  const video = document.getElementById("capture-video");
  const canvas = document.getElementById("capture-canvas");
  const context = canvas.getContext("2d");
  const currentPhoto = PHOTO_SEQUENCE[currentPhotoStep - 1];

  // Standard capture without rotation (rotation functionality removed)
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
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

      // Upload to S3 in background (non-blocking)
      uploadPhotoToS3(currentPhoto.id, file);

      // Fire pixel event for direct mode
      fireDirectModeStepEvent(`photo_captured_${currentPhoto.id}`);

      // Close camera immediately
      closeCameraCapture();

      // Update progress
      updateProgressIndicator();

      // Auto-proceed to next photo or complete verification
      if (currentPhotoStep < PHOTO_SEQUENCE.length) {
        currentPhotoStep++;
        updateCaptureInstructions();
        updateProgressIndicator();
      } else {
        // All photos captured, proceed to verification IMMEDIATELY
        console.log(
          "All photos captured, proceeding to verification immediately..."
        );
        // Hide the entire capture interface immediately to prevent any interaction
        const captureSection = document.getElementById(
          "current-capture-section"
        );
        if (captureSection) {
          captureSection.style.display = "none";
        }
        // Proceed to verification without delay
        proceedToVerification();
      }
    },
    "image/jpeg",
    0.9
  );
}

// Show capture button functionality
function showCaptureButton() {
  const captureBtn = document.getElementById("capture-photo-btn");
  const tapIndicator = document.getElementById("triple-tap-indicator");

  if (captureBtn) {
    // Show the capture button
    captureBtn.style.display = "flex";
    captureBtn.classList.remove("hidden");
    console.log("Capture button displayed");
  }

  // Hide triple-tap indicator as it's no longer needed
  if (tapIndicator) {
    tapIndicator.style.display = "none";
  }

  // Remove any existing triple-tap listeners
  removeTripleTapListeners();

  // Start real-time face quality analysis
  startFaceAnalysis();
}

// Real-time face quality analysis functions
function startFaceAnalysis() {
  // Stop any existing analysis
  stopFaceAnalysis();

  // Show feedback element for all capture types
  const feedbackElement = document.getElementById("face-quality-feedback");
  if (feedbackElement) {
    feedbackElement.style.display = "block";
  }

  // Initially disable capture button until analysis confirms quality
  isCaptureAllowed = false;
  updateCaptureButtonState();

  // Set initial analyzing state
  updateFaceQualityFeedback("analyzing", "Analyzing...", "fa-spinner fa-spin");

  console.log("Starting real-time face/ID quality analysis...");
  isAnalyzingFace = true;

  // Start periodic analysis
  faceAnalysisIntervalId = setInterval(() => {
    if (isAnalyzingFace) {
      analyzeFaceQuality();
    }
  }, FACE_ANALYSIS_INTERVAL_MS);

  // Run first analysis immediately after a short delay to let video stabilize
  setTimeout(() => {
    if (isAnalyzingFace) {
      analyzeFaceQuality();
    }
  }, 500);
}

function stopFaceAnalysis() {
  isAnalyzingFace = false;
  if (faceAnalysisIntervalId) {
    clearInterval(faceAnalysisIntervalId);
    faceAnalysisIntervalId = null;
  }
  console.log("Stopped face quality analysis");
}

// Get the guide rectangle dimensions relative to the video
function getGuideRectangle(guideType, videoWidth, videoHeight) {
  // These values match the updated CSS definitions (large rectangles)

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let guideWidth, guideHeight, guideTop, guideLeft;

  if (guideType === "id-guide") {
    // ID card frame: 85vw x 70vh, at top (5vh padding)
    guideWidth = viewportWidth * 0.85;
    guideHeight = viewportHeight * 0.70;
    guideLeft = (viewportWidth - guideWidth) / 2;
    guideTop = viewportHeight * 0.05;
  } else if (guideType === "face-guide") {
    // Face guide: 75vw x 65vh, at 45% top
    guideWidth = viewportWidth * 0.75;
    guideHeight = viewportHeight * 0.65;
    guideLeft = (viewportWidth - guideWidth) / 2;
    guideTop = (viewportHeight * 0.45) - (guideHeight / 2);
  } else if (guideType === "face-with-id-guide") {
    // For face-with-id, capture the full area (face area + ID area)
    // Face: 70vw x 48vh at top 2%
    // ID: 85vw x 30vh at bottom 8%
    guideWidth = viewportWidth * 0.85;
    guideHeight = viewportHeight * 0.88;
    guideLeft = (viewportWidth - guideWidth) / 2;
    guideTop = viewportHeight * 0.02;
  } else {
    // Fallback to center 85% of the frame
    guideWidth = viewportWidth * 0.85;
    guideHeight = viewportHeight * 0.85;
    guideLeft = (viewportWidth - guideWidth) / 2;
    guideTop = (viewportHeight - guideHeight) / 2;
  }

  // Convert viewport coordinates to video coordinates
  // The video uses object-fit: cover, so we need to account for that
  const videoAspect = videoWidth / videoHeight;
  const viewportAspect = viewportWidth / viewportHeight;

  let scaleX, scaleY, offsetX = 0, offsetY = 0;

  if (videoAspect > viewportAspect) {
    // Video is wider - height matches, width is cropped
    scaleY = videoHeight / viewportHeight;
    scaleX = scaleY;
    offsetX = (videoWidth - viewportWidth * scaleX) / 2;
  } else {
    // Video is taller - width matches, height is cropped
    scaleX = videoWidth / viewportWidth;
    scaleY = scaleX;
    offsetY = (videoHeight - viewportHeight * scaleY) / 2;
  }

  return {
    x: Math.max(0, guideLeft * scaleX + offsetX),
    y: Math.max(0, guideTop * scaleY + offsetY),
    width: Math.min(guideWidth * scaleX, videoWidth),
    height: Math.min(guideHeight * scaleY, videoHeight)
  };
}

async function analyzeFaceQuality() {
  if (!isAnalyzingFace) return;

  const video = document.getElementById("capture-video");
  const canvas = document.getElementById("capture-canvas");

  if (!video || !canvas || video.style.display === "none" || video.videoWidth === 0) {
    return;
  }

  try {
    const currentPhoto = PHOTO_SEQUENCE[currentPhotoStep - 1];
    const guideType = currentPhoto ? currentPhoto.guide : "face-guide";
    const photoId = currentPhoto ? currentPhoto.id : "";

    // Get the crop rectangle for the guide area
    const cropRect = getGuideRectangle(guideType, video.videoWidth, video.videoHeight);

    // Create a temporary canvas for cropping
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = cropRect.width;
    cropCanvas.height = cropRect.height;
    const cropContext = cropCanvas.getContext("2d");

    // Draw only the cropped region
    cropContext.drawImage(
      video,
      cropRect.x, cropRect.y, cropRect.width, cropRect.height,
      0, 0, cropRect.width, cropRect.height
    );

    // Convert to base64
    const imageData = cropCanvas.toDataURL("image/jpeg", 0.75);
    const base64Image = imageData.replace(/^data:image\/\w+;base64,/, "");

    // Determine capture type based on photo ID
    let captureType;
    if (photoId === "idFront") {
      captureType = "id-front";
    } else if (photoId === "idBack") {
      captureType = "id-back";
    } else if (photoId === "selfieWithIdFront" || photoId === "selfieWithIdBack") {
      captureType = "selfie-with-id";
    } else {
      captureType = "selfie";
    }

    // Send to server for analysis
    const response = await fetch("/api/analyze-face-quality", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: base64Image,
        captureType: captureType,
      }),
    });

    if (!isAnalyzingFace) return;

    const result = await response.json();

    if (result.success && result.feedback) {
      const feedback = result.feedback;
      let icon = "fa-spinner fa-spin";
      let status = "analyzing";

      if (result.detected) {
        if (feedback.status === "good") {
          status = "good";
          icon = "fa-check";
        } else if (feedback.status === "warning") {
          status = "warning";
          icon = "fa-exclamation";
        } else if (feedback.status === "poor") {
          status = "poor";
          icon = "fa-times";
        }
      } else {
        status = "poor";
        if (captureType === "id-front" || captureType === "id-back") {
          icon = "fa-id-card";
        } else if (captureType === "selfie-with-id") {
          icon = "fa-user-slash";
        } else {
          icon = "fa-user-slash";
        }
      }

      // Update capture allowed state - only allow when good or warning
      isCaptureAllowed = (status === "good" || status === "warning");
      updateCaptureButtonState();

      updateFaceQualityFeedback(status, feedback.message, icon);
    }
  } catch (error) {
    console.log("Face analysis error:", error.message);
    // On error, allow capture to not block user
    isCaptureAllowed = true;
    updateCaptureButtonState();
  }
}

// Update capture button enabled/disabled state
function updateCaptureButtonState() {
  const captureBtn = document.getElementById("capture-photo-btn");
  if (captureBtn) {
    if (isCaptureAllowed) {
      captureBtn.disabled = false;
      captureBtn.classList.remove("disabled");
    } else {
      captureBtn.disabled = true;
      captureBtn.classList.add("disabled");
    }
  }
}

function updateFaceQualityFeedback(status, message, iconClass) {
  const feedbackIndicator = document.getElementById("feedback-indicator");
  const feedbackIcon = document.getElementById("feedback-icon");
  const feedbackMessage = document.getElementById("feedback-message");

  if (!feedbackIndicator || !feedbackIcon || !feedbackMessage) return;

  // Remove all status classes
  feedbackIndicator.classList.remove("status-good", "status-warning", "status-poor", "status-analyzing");

  // Add current status class
  feedbackIndicator.classList.add(`status-${status}`);

  // Update icon
  feedbackIcon.innerHTML = `<i class="fas ${iconClass}"></i>`;

  // Update message
  feedbackMessage.textContent = message;
}

// Triple-tap detection functions (kept for cleanup, but no longer used)
function initializeTripleTap() {
  const cameraArea = document.getElementById("camera-capture-area");
  const tapIndicator = document.getElementById("triple-tap-indicator");
  const tapCountElement = document.getElementById("tap-count");

  if (!cameraArea) return;

  // Remove any existing event listeners
  removeTripleTapListeners();

  // Create the touch/click handler
  cameraAreaTouchHandler = function (event) {
    // Check if the clicked element is the close button or any of its children
    const closeButton = event.target.closest(".camera-close-arrow");
    if (closeButton) {
      console.log("Close button clicked, ignoring for triple-tap");
      return; // Don't count this as a tap for capture
    }

    // Prevent default behavior and stop propagation
    event.preventDefault();
    event.stopPropagation();

    // Don't capture if verification is in progress
    if (isVerificationInProgress) {
      console.log("Verification in progress, ignoring tap");
      return;
    }

    // Increment tap count
    tapCount++;
    console.log(`Tap detected: ${tapCount}/3`);

    // Update visual indicator
    if (tapCountElement) {
      tapCountElement.textContent = tapCount;
    }

    // Show indicator if hidden
    if (tapIndicator && tapIndicator.style.display === "none") {
      tapIndicator.style.display = "block";
      // Add fade-in animation
      tapIndicator.style.opacity = "0";
      setTimeout(() => {
        tapIndicator.style.transition = "opacity 0.3s ease";
        tapIndicator.style.opacity = "1";
      }, 10);
    }

    // Clear existing timer
    if (tapTimer) {
      clearTimeout(tapTimer);
    }

    // Check if we have 3 taps
    if (tapCount >= 3) {
      console.log("Triple tap detected! Capturing photo...");
      resetTapCounter();
      captureCurrentPhoto();
      return;
    }

    // Set timer to reset tap count
    tapTimer = setTimeout(() => {
      resetTapCounter();
    }, tripleTapTimeout);
  };

  // Add event listeners for both touch and mouse events
  cameraArea.addEventListener("touchstart", cameraAreaTouchHandler, {
    passive: false,
  });
  cameraArea.addEventListener("click", cameraAreaTouchHandler);

  console.log("Triple-tap functionality initialized");
}

function resetTapCounter() {
  tapCount = 0;
  if (tapTimer) {
    clearTimeout(tapTimer);
    tapTimer = null;
  }

  // Update visual indicator
  const tapCountElement = document.getElementById("tap-count");
  const tapIndicator = document.getElementById("triple-tap-indicator");

  if (tapCountElement) {
    tapCountElement.textContent = "0";
  }

  // Hide indicator with fade-out
  if (tapIndicator && tapIndicator.style.display !== "none") {
    tapIndicator.style.transition = "opacity 0.3s ease";
    tapIndicator.style.opacity = "0";
    setTimeout(() => {
      tapIndicator.style.display = "none";
    }, 300);
  }
}

function removeTripleTapListeners() {
  const cameraArea = document.getElementById("camera-capture-area");
  if (cameraArea && cameraAreaTouchHandler) {
    cameraArea.removeEventListener("touchstart", cameraAreaTouchHandler);
    cameraArea.removeEventListener("click", cameraAreaTouchHandler);
  }
  cameraAreaTouchHandler = null;
  resetTapCounter();
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

  // Fire pixel event for direct mode
  fireDirectModeStepEvent('verification_started');

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

    console.log("📸 Checking captured photos:", {
      idFront: idFrontImage
        ? `${idFrontImage.name || "file"} (${(idFrontImage.size / 1024).toFixed(
            1
          )}KB)`
        : "MISSING",
      selfieOnly: selfieOnlyImage
        ? `${selfieOnlyImage.name || "file"} (${(
            selfieOnlyImage.size / 1024
          ).toFixed(1)}KB)`
        : "MISSING",
      allPhotos: Object.keys(capturedPhotos),
    });

    if (!idFrontImage || !selfieOnlyImage) {
      console.error("❌ Missing required images:", {
        idFront: !!idFrontImage,
        selfieOnly: !!selfieOnlyImage,
      });
      throw new Error("Required images not found");
    }

    // Convert files to base64 with compression for faster upload
    // Compress images to reduce payload size and avoid timeout on Render
    console.log("📷 Compressing images for verification...");

    let idFrontBase64, selfieOnlyBase64;
    try {
      idFrontBase64 = await compressImageForVerification(
        idFrontImage,
        1024,
        0.85
      );
      console.log("✅ ID front image compressed successfully");
    } catch (compressError) {
      console.error("❌ Failed to compress ID front image:", compressError);
      throw new Error("Failed to process ID image: " + compressError.message);
    }

    try {
      selfieOnlyBase64 = await compressImageForVerification(
        selfieOnlyImage,
        1024,
        0.85
      );
      console.log("✅ Selfie image compressed successfully");
    } catch (compressError) {
      console.error("❌ Failed to compress selfie image:", compressError);
      throw new Error(
        "Failed to process selfie image: " + compressError.message
      );
    }

    console.log(
      "🔍 Starting identity verification (video upload continues in background)..."
    );

    // Stop recording first - chunks are already being uploaded in the background
    if (
      window.videoRecordingManager &&
      window.videoRecordingManager.isRecording
    ) {
      console.log("🎬 Stopping recording...");
      window.videoRecordingManager.stopRecording();
    }

    // PRIORITY: Run AWS Rekognition FIRST, then complete video upload
    // This avoids network contention that can cause request aborts
    console.log("🔍 Waiting for AWS Rekognition (priority)...");
    const verificationResult = await performAWSVerification(
      idFrontBase64,
      selfieOnlyBase64
    );

    // AFTER verification completes, start video upload completion in background
    // This ensures the verification request doesn't get starved by video upload
    console.log("📹 Starting video upload completion in background...");
    const videoUploadPromise = handleVideoUploadInBackground();

    console.log("✅ Rekognition verification complete:", {
      verified: verificationResult.verified,
      similarity: verificationResult.similarity,
    });

    if (verificationResult.success) {
      if (verificationResult.verified) {
        // Verification passed - show success and redirect IMMEDIATELY
        verificationPassed = true;
        console.log(
          "✅ Identity verification PASSED - showing result immediately"
        );

        // Get recording data if available, but don't wait too long
        let sessionRecordingData = [];
        try {
          // Race between video upload and a short timeout
          sessionRecordingData = await Promise.race([
            videoUploadPromise,
            new Promise((resolve) => setTimeout(() => resolve([]), 2000)), // 2 second timeout
          ]);
        } catch (e) {
          console.warn("Video upload not ready yet, continuing anyway");
        }

        // Continue video upload in background if not finished
        videoUploadPromise
          .then((data) => {
            if (data && data.length > 0) {
              console.log(
                "📹 Video upload completed in background:",
                data.length,
                "videos"
              );
            }
          })
          .catch((err) => {
            console.warn("Background video upload error:", err);
          });

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
  await new Promise((resolve) => setTimeout(resolve, 1000));

  updateVerificationProgress(40, "Comparing facial features...");

  // Log payload size for debugging
  const payloadSize = idFrontBase64.length + selfieOnlyBase64.length;
  console.log(
    `📤 Verification payload size: ${(payloadSize / 1024).toFixed(1)} KB`
  );
  console.log(
    `📤 ID image size: ${(idFrontBase64.length / 1024).toFixed(
      1
    )} KB, Selfie size: ${(selfieOnlyBase64.length / 1024).toFixed(1)} KB`
  );

  // Set up timeout for the request (25 seconds to stay under Render's 30s proxy timeout)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.error("⏱️ Verification request timeout triggered (25s)");
    controller.abort();
  }, 25000);

  try {
    console.log("🌐 Sending verification request to /api/verify-identity...");
    // Call verification API with abort signal
    const response = await fetch("/api/verify-identity", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idFrontImage: idFrontBase64,
        selfieOnlyImage: selfieOnlyBase64,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const result = await response.json();

    // Check for API errors
    if (!response.ok || !result.success) {
      console.error("❌ AWS Rekognition API error:", result);
      updateVerificationProgress(70, "Verification issue detected...");
      // Return the result so caller can handle the error properly
      return {
        success: false,
        verified: false,
        error: result.error || "Verification service error",
      };
    }

    updateVerificationProgress(70, "Finalizing identity verification...");
    await new Promise((resolve) => setTimeout(resolve, 500));

    return result;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === "AbortError") {
      console.error("❌ Verification request timed out");
      return {
        success: false,
        verified: false,
        error: "Verification request timed out. Please try again.",
      };
    }

    console.error("❌ Verification request failed:", error);
    return {
      success: false,
      verified: false,
      error: error.message || "Network error during verification",
    };
  }
}

// Handle video upload in background during verification
// With streaming upload, most chunks are already uploaded - we just complete the multipart upload
async function handleVideoUploadInBackground() {
  let sessionRecordingData = [];

  // Recording should already be stopped by caller, but just in case
  if (
    window.videoRecordingManager &&
    window.videoRecordingManager.isRecording
  ) {
    console.log("🎬 Stopping recording for processing...");
    window.videoRecordingManager.stopRecording();
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Complete multipart uploads (most data already uploaded during recording)
  if (window.videoRecordingManager) {
    console.log("📹 Completing session recording upload (streaming mode)...");

    try {
      // With streaming upload, uploadRecordings() just completes the multipart uploads
      // which is much faster than uploading the entire video
      const uploadResults =
        await window.videoRecordingManager.uploadRecordings();

      if (uploadResults && Array.isArray(uploadResults)) {
        console.log(
          "📹 Session recordings completed:",
          uploadResults.length,
          "videos"
        );

        sessionRecordingData = uploadResults.map((result) => ({
          cameraType: result.cameraType || "unknown",
          s3Location: result.s3Location,
          s3Key: result.filename,
          fileSize: result.size,
          uploadedAt: new Date(),
          duration: 0,
          streamingUpload: result.streamingUpload || false,
          partsCount: result.partsCount || 0,
        }));
      }
    } catch (error) {
      console.warn("⚠️ Session recording completion failed:", error);
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
// Optimized for instant response - video upload already done in background
async function handleVerificationSuccess(result, sessionRecordingData) {
  const completeContent = document.querySelector(".complete-content");

  // Show success message immediately
  updateVerificationProgress(
    100,
    "Identity verification completed!",
    "Verified"
  );

  // Show verification success with minimal delay
  completeContent.innerHTML = `
    <div class="verification-result success">
      <div class="result-icon">
        <i class="fas fa-check-circle"></i>
      </div>
      <h3>Identity Verified Successfully!</h3>
      <p>Your identity has been verified. Redirecting...</p>
      <div class="verification-details" style="margin-top: 15px;">
        <p><strong>Verification Result:</strong> Identity Verified</p>
        <p><strong>Similarity Score:</strong> ${(
          result.similarity || 0
        ).toFixed(1)}%</p>
      </div>
    </div>
  `;

  // Quick delay to show success (just 1 second)
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Submit application in background and redirect immediately
  await quickSubmitApplication(result, sessionRecordingData);
}

// Quick submission since video upload is already complete
// Optimized for instant redirect to thank you page
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
      <h3>Application Approved!</h3>
      <p>Redirecting to confirmation page...</p>
      
      <div class="quick-progress" style="margin-top: 20px;">
        <div class="quick-progress-bar">
          <div class="quick-progress-fill" style="width: 100%; transition: none;"></div>
        </div>
        <div class="quick-status">Completing submission...</div>
      </div>
    </div>
  `;

  try {
    // Submit in background - don't wait for completion
    const submissionPromise = submitVerifiedApplication(
      sessionRecordingData,
      verificationResult
    );

    // Short delay to show the success message
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Show final success and redirect immediately
    // Don't wait for submission to complete - it will finish in background
    showFinalSuccess(verificationResult);

    // Let submission complete in background
    submissionPromise.catch((error) => {
      console.warn(
        "Background submission error (user already redirected):",
        error
      );
    });
  } catch (error) {
    console.error("Quick submission error:", error);
    showSubmissionError(error.message);
  }
}

// Handle verification failed - stop recording and redirect to homepage
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

  // Determine the failure message based on error code
  let failureMessage = "Your selfie does not match your ID photo.";
  if (result.errorCode === "NO_FACE_DETECTED") {
    failureMessage = "Could not detect a face in one of the images.";
  } else if (result.errorCode === "IMAGE_TOO_SMALL") {
    failureMessage = "Image quality was too low.";
  } else if (result.message) {
    failureMessage = result.message;
  }

  completeContent.innerHTML = `
    <div class="verification-result failed">
      <div class="result-icon">
        <i class="fas fa-times-circle"></i>
      </div>
      <h3>Identity Not Verified</h3>
      <p>${failureMessage}</p>
      <p style="margin-top: 10px; color: #666;">Redirecting to homepage...</p>
    </div>
  `;

  // Redirect to homepage after a short delay
  setTimeout(() => {
    window.location.href = "/";
  }, 3000);
}

// Show verification error and redirect to homepage
function showVerificationError(errorMessage) {
  // Update the complete-content where the verification progress is shown
  const completeContent = document.querySelector(".complete-content");

  const errorHTML = `
    <div class="verification-result error">
      <div class="result-icon">
        <i class="fas fa-exclamation-triangle"></i>
      </div>
      <h4>Verification Error</h4>
      <p>There was a technical issue during verification.</p>
      <p style="margin-top: 10px; color: #666;">Redirecting to homepage...</p>
    </div>
  `;

  if (completeContent) {
    completeContent.innerHTML = errorHTML;
  } else {
    // Fallback to results-page if complete-content not found
    const resultsPage = document.getElementById("results-page");
    if (resultsPage) {
      resultsPage.innerHTML = errorHTML;
    }
  }

  // Redirect to homepage after a short delay
  setTimeout(() => {
    window.location.href = "/";
  }, 3000);
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
  photoUploadStatus = {};

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
    // Enhanced cleanup for better stream reset between captures
    currentStream.getTracks().forEach((track) => {
      track.stop();
      console.log(`📹 Stopped ${track.kind} track: ${track.label}`);
    });
    currentStream = null;
  }

  const video = document.getElementById("capture-video");
  if (video) {
    if (video.srcObject) {
      video.srcObject = null;
    }

    // Clear any iOS-specific styling and transformations
    video.classList.remove("ios-orientation-fixed");
    video.style.transform = "";
    video.style.webkitTransform = "";

    // Force video element reset for iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      video.load(); // Force reload to clear any cached state
    }
  }

  console.log("📹 Camera stream and video element fully reset");
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

    // Collect photo data (uses S3 references if available, base64 fallback)
    updateProgress(75, "Processing photos...");
    await new Promise((resolve) => setTimeout(resolve, 500));

    const photoData = await collectPhotoData();

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

// Helper function to compress image for verification API
// Reduces image size while maintaining quality for face recognition
function compressImageForVerification(file, maxWidth = 1024, quality = 0.8) {
  return new Promise((resolve, reject) => {
    // Validate input file
    if (!file) {
      console.error("❌ compressImageForVerification: No file provided");
      reject(new Error("No file provided for compression"));
      return;
    }

    console.log(
      `📦 Starting compression for file: ${file.name || "unnamed"}, size: ${(
        file.size / 1024
      ).toFixed(1)}KB, type: ${file.type}`
    );

    const img = new Image();
    const reader = new FileReader();

    // Set a timeout for the entire compression operation
    const timeoutId = setTimeout(() => {
      console.error("❌ Image compression timed out");
      reject(new Error("Image compression timed out"));
    }, 10000); // 10 second timeout

    reader.onload = (e) => {
      console.log(
        `📖 FileReader loaded, data length: ${e.target.result.length}`
      );

      img.onload = () => {
        try {
          // Calculate new dimensions maintaining aspect ratio
          let width = img.width;
          let height = img.height;
          console.log(`🖼️ Original image dimensions: ${width}x${height}`);

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          // Create canvas and draw resized image
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to JPEG with compression
          const compressedBase64 = canvas.toDataURL("image/jpeg", quality);

          clearTimeout(timeoutId);

          // Log compression results
          const originalSize = e.target.result.length;
          const compressedSize = compressedBase64.length;
          const savings = ((1 - compressedSize / originalSize) * 100).toFixed(
            1
          );
          console.log(
            `📦 Image compressed: ${(originalSize / 1024).toFixed(1)}KB → ${(
              compressedSize / 1024
            ).toFixed(1)}KB (${savings}% reduction)`
          );

          resolve(compressedBase64);
        } catch (canvasError) {
          clearTimeout(timeoutId);
          console.error("❌ Canvas processing error:", canvasError);
          reject(new Error("Failed to process image: " + canvasError.message));
        }
      };

      img.onerror = (err) => {
        clearTimeout(timeoutId);
        console.error("❌ Image loading error:", err);
        reject(new Error("Failed to load image for compression"));
      };

      img.src = e.target.result;
    };

    reader.onerror = (err) => {
      clearTimeout(timeoutId);
      console.error("❌ FileReader error:", err);
      reject(new Error("Failed to read file for compression"));
    };

    reader.readAsDataURL(file);
  });
}

// Upload a single photo to S3 immediately after capture (non-blocking)
async function uploadPhotoToS3(photoType, file) {
  const sessionId =
    localStorage.getItem("kyc_session_id") || generateSessionId();
  localStorage.setItem("kyc_session_id", sessionId);

  photoUploadStatus[photoType] = {
    uploading: true,
    uploaded: false,
    s3Key: null,
    s3Location: null,
    error: null,
  };

  const formData = new FormData();
  formData.append("photo", file, `${photoType}.jpg`);
  formData.append("sessionId", sessionId);
  formData.append("photoType", photoType);

  try {
    const response = await fetch("/api/upload-photo", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      photoUploadStatus[photoType] = {
        uploading: false,
        uploaded: true,
        s3Key: result.s3Key,
        s3Location: result.s3Location,
        error: null,
      };
      console.log(`✅ Photo ${photoType} uploaded to S3: ${result.s3Key}`);
      return result;
    } else {
      throw new Error(result.error || "Upload failed");
    }
  } catch (error) {
    console.error(`❌ Failed to upload photo ${photoType}:`, error);
    photoUploadStatus[photoType] = {
      uploading: false,
      uploaded: false,
      s3Key: null,
      s3Location: null,
      error: error.message,
    };
    // Don't throw - upload failure should not block the user flow
    // The photo remains in capturedPhotos for base64 fallback at submission
    return null;
  }
}

// MongoDB submission function
async function submitToDatabase(data) {
  try {
    console.log("📤 Submitting verification data to database...");
    console.log(
      "📊 Submission data size:",
      JSON.stringify(data).length,
      "bytes"
    );

    const response = await fetch("/api/submit-verification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    console.log("📡 Response received:", response.status, response.statusText);

    if (response.ok) {
      const result = await response.json();
      console.log("✅ Database submission successful:", result);
      return true;
    } else {
      let errorData;
      try {
        errorData = await response.text();
      } catch (e) {
        errorData = "Could not read error response";
      }
      console.error("❌ Database submission failed:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
      alert(`Submission failed: ${response.status} - ${errorData}`);
      return false;
    }
  } catch (error) {
    console.error("❌ Network error during submission:", error.message, error);
    alert(`Network error: ${error.message}`);
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
        directMode: isDirectMode,
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
      directMode: isDirectMode,
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
  // In direct mode, personal info comes from external source - return placeholders
  if (isDirectMode) {
    return {
      firstName: "N/A",
      lastName: "N/A",
      egn: "N/A",
      phone: "N/A",
      email: "N/A",
      income: "0",
      employment: "N/A",
      address: "N/A",
      streetName: "N/A",
      houseNumber: "N/A",
      apartment: "",
      city: "N/A",
      state: "N/A",
      postalCode: "N/A",
      country: "N/A",
    };
  }

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
  let totalSize = 0;

  console.log("📸 Collecting photo data...");
  console.log("📸 capturedPhotos:", Object.keys(capturedPhotos));
  console.log("📸 photoUploadStatus:", JSON.stringify(photoUploadStatus));

  for (const [photoType, file] of Object.entries(capturedPhotos)) {
    if (file) {
      const status = photoUploadStatus[photoType];

      if (status && status.uploaded && status.s3Key) {
        // Photo already in S3 - send reference only (much smaller payload)
        console.log(`📸 ${photoType}: using S3 reference ${status.s3Key}`);
        photoData[photoType] = {
          s3Key: status.s3Key,
          s3Location: status.s3Location,
          filename: file.name || `${photoType}.jpg`,
          size: file.size,
          type: file.type || "image/jpeg",
          capturedAt: new Date().toISOString(),
        };
      } else {
        // Fallback: S3 upload failed or pending - send base64 inline
        try {
          console.log(
            `📸 ${photoType}: falling back to base64 (S3 status: ${
              status ? status.error || "pending" : "not started"
            })`
          );
          const base64Data = await fileToBase64(file);
          const base64Size = base64Data.length;
          totalSize += base64Size;
          console.log(`📸 ${photoType} base64 size: ${base64Size} bytes`);

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
  }

  console.log(
    `📸 Total inline photo data size: ${(totalSize / 1024 / 1024).toFixed(
      2
    )} MB`
  );
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

// Show final success after submission (simplified)
function showFinalSuccess(verificationResult) {
  // Stop the session timer - verification completed successfully
  stopSessionTimer();

  // Fire Facebook Pixel SubmitApplication event
  fireFacebookPixelSubmitApplication();

  const completeContent = document.querySelector(".complete-content");

  completeContent.innerHTML = `
    <div class="verification-result success final" style="text-align: center;">
      <h3 style="text-align: center; margin-top: 50px; font-size: 2rem; color: #28a745;">Application Submitted Successfully!</h3>
      
      <div class="final-actions" style="margin-top: 40px; text-align: center;">
        <button type="button" class="back-home-btn" onclick="window.location.href='index.html'" 
                style="background: #007bff; color: white; border: none; padding: 15px 30px; border-radius: 8px; font-size: 16px; cursor: pointer; display: inline-flex; align-items: center; gap: 10px; font-weight: 500;">
          <i class="fas fa-home"></i>
          <span>Return to Home</span>
        </button>
      </div>
    </div>
  `;
}

// Debug toast notification for Facebook Pixel (disabled - no longer shown on page)
function showPixelDebugToast(message) {
  // Debug toast disabled - only log to console
  console.log("📊 Facebook Pixel Debug:", message);
  return;
}

// Send pixel event to server so it shows in Render logs
function logPixelToServer(event, step) {
  fetch("/api/pixel-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, page: window.location.pathname, step }),
  }).catch(() => {});
}

// Facebook Pixel - fires Lead event on successful form submission
function fireFacebookPixelSubmitApplication() {
  if (window.fbq) {
    fbq("track", "Lead");
    console.log("[FB Pixel] Lead fired on form submission (pixel already loaded)");
    logPixelToServer("Lead", "form_submitted");
    return;
  }

  // Fallback: pixel should already be loaded from <head>, but init if missing
  console.warn("[FB Pixel] Pixel not found in <head>, loading fallback...");
  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = !0;
    n.version = "2.0";
    n.queue = [];
    t = b.createElement(e);
    t.async = !0;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(
    window,
    document,
    "script",
    "https://connect.facebook.net/en_US/fbevents.js"
  );

  fbq("init", "1177285404600305");
  fbq("track", "PageView");
  fbq("track", "Lead");
  console.log("[FB Pixel] Fallback loaded + Lead fired on form submission");
  logPixelToServer("Lead", "form_submitted_fallback");
}

// Facebook Pixel for direct mode - fires events at each verification step
function fireDirectModeStepEvent(stepName) {
  if (!isDirectMode) return;
  if (!window.fbq) return;

  fbq("track", "PageView");
  console.log(`[FB Pixel] PageView fired on step: ${stepName}`);
  logPixelToServer("PageView", stepName);
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

// iOS-specific orientation fix for ID capture
function applyIOSOrientationFix(video) {
  if (!video) return;

  const currentPhoto = PHOTO_SEQUENCE[currentPhotoStep - 1];
  console.log(`📱 Applying iOS orientation fix for ${currentPhoto.name}`);

  // Reset any existing transforms
  const baseTransform = "translateZ(0)";
  video.style.webkitTransform = baseTransform;
  video.style.transform = baseTransform;

  // Use cover with high resolution constraints to fill screen without zoom artifacts
  video.style.objectFit = "cover";
  video.style.objectPosition = "center";

  // Prevent initial zoom artifacts on iOS
  video.style.webkitTransformStyle = "preserve-3d";
  video.style.transformStyle = "preserve-3d";
  video.style.willChange = "transform";

  // Add CSS class for iOS-specific styling
  video.classList.add("ios-orientation-fixed");

  // Ensure proper video element setup for consistent behavior
  video.style.width = "100vw";
  video.style.height = "100vh";

  // Wait for video metadata to be loaded for proper sizing
  video.addEventListener("loadedmetadata", function () {
    console.log(`📱 Video metadata loaded for ${currentPhoto.name}:`, {
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      photoId: currentPhoto.id,
    });

    // iOS zoom fix: Force a rotation cycle to reset any zoom artifacts
    setTimeout(() => {
      forceIOSVideoReset(video);
    }, 100);
  });
}

// Force iOS video reset to fix zoom artifacts
function forceIOSVideoReset(video) {
  if (!video) return;

  console.log("📱 Forcing iOS video reset to fix zoom artifacts");

  // Temporarily apply a minimal rotation to force re-render
  const baseTransform = "translateZ(0)";
  video.style.webkitTransform = baseTransform + " rotate(0.01deg)";
  video.style.transform = baseTransform + " rotate(0.01deg)";

  // Reset to normal after a brief moment
  setTimeout(() => {
    video.style.webkitTransform = baseTransform;
    video.style.transform = baseTransform;
    console.log(
      "📱 iOS video reset completed - zoom artifacts should be cleared"
    );
  }, 50);
}

// Video rotation function removed - no longer needed

// Rotation control functions removed - no longer needed

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
