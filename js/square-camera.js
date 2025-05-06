// Square Camera Module
// This module provides a square camera interface for capturing profile photos

// Variables to manage camera state
let cameraStream = null;
let videoElement = null;
let currentFacingMode = "user"; // Start with front camera by default
let timerCountdown = null; // For timer countdown

// Function to initialize the camera module
function initSquareCamera() {
    console.log('Initializing square camera module');
    
    // Create the camera modal if it doesn't exist
    if (!document.getElementById('square-camera-modal')) {
        createCameraModal();
    }
    
    // Add the "Take Photo" button next to the existing "Change Picture" button
    addTakePhotoButton();
}

// Create the camera modal
function createCameraModal() {
    const cameraModalHtml = `
    <div class="modal fade" id="square-camera-modal" tabindex="-1" aria-labelledby="square-camera-modal-title" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content bg-dark text-white">
          <div class="modal-header">
            <h5 class="modal-title" id="square-camera-modal-title">Take Profile Picture</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body p-0">
            <div id="camera-container" class="position-relative">
              <video id="camera-video" autoplay playsinline class="w-100"></video>
              <div class="viewfinder position-absolute"></div>
            </div>
            <!-- Keep original canvas size of 300x300 as required -->
            <canvas id="camera-canvas" class="d-none" width="300" height="300"></canvas>
          </div>
          <div class="modal-footer">
            <div class="w-100 d-flex justify-content-between">
              <button type="button" class="btn btn-primary" data-bs-dismiss="modal">Cancel</button>
              <div class="d-flex">
                <button type="button" class="btn btn-outline-light me-2" id="timer-photo-btn" title="Timer (10 seconds)">
                  <i class="bi bi-stopwatch"></i>
                </button>
                <button type="button" class="btn btn-outline-light me-2" id="switch-camera-btn" title="Switch Camera">
                  <i class="bi bi-arrow-left-right"></i>
                </button>
                <button type="button" class="btn btn-primary" id="capture-photo-btn">
                  Capture
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    `;
    
    // Add the modal to the document
    document.body.insertAdjacentHTML('beforeend', cameraModalHtml);
    
    // Add CSS for the camera modal
    const style = document.createElement('style');
    style.textContent = `
    #camera-container {
      position: relative;
      width: 100%;
      overflow: hidden;
      background-color: #000;
      aspect-ratio: 300/300; /* Maintain the original aspect ratio */
    }
    
    #camera-video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .viewfinder {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 80%; /* Adjusted for 300:300 aspect ratio (300/300 * 80% = 80%) */
      height: 80%;
      transform: translate(-50%, -50%);
      border: 2px solid rgba(255, 255, 255, 0.8);
      box-sizing: border-box;
      pointer-events: none;
    }
    
    /* Responsive adjustments for camera modal */
    @media (max-width: 576px) {
      #square-camera-modal .modal-dialog {
        margin: 0.5rem;
        max-width: calc(100% - 1rem);
      }
    }
    
    /* Timer display styling */
    #timer-display {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background-color: rgba(0,0,0,0.5);
      color: white;
      font-size: 5rem;
      font-weight: bold;
      border-radius: 50%;
      width: 120px;
      height: 120px;
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10;
    }
    `;
    document.head.appendChild(style);
}

// Add the "Take Photo" button next to the existing "Change Picture" button
function addTakePhotoButton() {
    const changePhotoBtn = document.getElementById('select-profile-image');
    if (!changePhotoBtn) return;
    
    // Check if the button already exists
    if (document.getElementById('take-profile-photo')) return;
    
    // Create the Take Photo button
    const takePhotoBtn = document.createElement('button');
    takePhotoBtn.type = 'button';
    takePhotoBtn.className = 'btn btn-outline-primary ms-2';
    takePhotoBtn.id = 'take-profile-photo';
    takePhotoBtn.innerHTML = '<i class="bi bi-camera me-1"></i> Take Photo';
    
    // Insert it after the Change Picture button
    changePhotoBtn.insertAdjacentElement('afterend', takePhotoBtn);
    
    // Add event listener
    takePhotoBtn.addEventListener('click', openCameraModal);
}

// Function to open the camera modal
function openCameraModal() {
    // Initialize the modal
    const modal = new bootstrap.Modal(document.getElementById('square-camera-modal'));
    
    // Get elements
    videoElement = document.getElementById('camera-video');
    const captureBtn = document.getElementById('capture-photo-btn');
    const switchCameraBtn = document.getElementById('switch-camera-btn');
    
    // Setup camera when modal opens
    modal.show();
    startCamera();
    
    // Add event listeners
    captureBtn.addEventListener('click', capturePhoto);
    switchCameraBtn.addEventListener('click', switchCamera);
    const timerBtn = document.getElementById('timer-photo-btn');
    timerBtn.addEventListener('click', startTimerCapture);
    
    // Clean up when modal is closed
    document.getElementById('square-camera-modal').addEventListener('hidden.bs.modal', () => {
        stopCamera();
        cleanupTimer();
    });
}

// Start the camera
async function startCamera() {
    try {
        // Stop any existing stream first
        stopCamera();
        
        // Request permission to use camera
        // IMPROVED: Request higher resolution video but will still output to 300x300 canvas
        const constraints = {
            video: { 
                facingMode: { exact: currentFacingMode },
                width: { ideal: 1920 },   // Increased from 1280 to 1920
                height: { ideal: 1080 },  // Increased from 720 to 1080
                frameRate: { ideal: 30 }, // Added frame rate for smoother preview
                // Add these constraints for Android devices to get higher quality
                advanced: [
                    { zoom: 1 }, // Start with no zoom
                    { exposureMode: "auto" },
                    { focusMode: "continuous" } // For sharper images
                ]
            },
            audio: false
        };
        
        cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Connect camera to video element
        if (videoElement) {
            videoElement.srcObject = cameraStream;
            
            // IMPROVED: Wait for video to be ready before allowing capture
            videoElement.onloadedmetadata = () => {
                console.log(`Camera resolution: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
                // Enable capture button after video is loaded
                document.getElementById('capture-photo-btn').disabled = false;
            };
        }
    } catch (err) {
        console.error("Camera error:", err);
        
        // If we get an error with 'exact' constraint, try with 'ideal' which is more forgiving
        if (err.name === 'OverconstrainedError') {
            try {
                const fallbackConstraints = {
                    video: { 
                        facingMode: { ideal: currentFacingMode },
                        width: { ideal: 1280 },  // Fallback to slightly lower resolution
                        height: { ideal: 720 }
                    },
                    audio: false
                };
                
                cameraStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
                
                if (videoElement) {
                    videoElement.srcObject = cameraStream;
                    videoElement.onloadedmetadata = () => {
                        console.log(`Fallback camera resolution: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
                        document.getElementById('capture-photo-btn').disabled = false;
                    };
                }
                
                return; // Success with fallback
            } catch (fallbackErr) {
                console.error("Fallback camera error:", fallbackErr);
            }
        }
        
        showNotification('Error', 'Could not access camera. Please check permissions or try uploading a photo instead.', 'error');
    }
}

// Stop the camera
function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    
    if (videoElement) {
        videoElement.srcObject = null;
    }
}

// Capture a photo
function capturePhoto() {
    if (!videoElement || !cameraStream) {
        console.error("Camera not initialized");
        return;
    }
    
    const canvas = document.getElementById('camera-canvas');
    const ctx = canvas.getContext('2d');
    
    // IMPROVED: Better canvas rendering settings
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Get the video dimensions
    const videoWidth = videoElement.videoWidth;
    const videoHeight = videoElement.videoHeight;
    
    // Calculate the square size (use the smaller dimension)
    const size = Math.min(videoWidth, videoHeight);
    
    // Log dimensions for debugging
    console.log(`Capturing photo from video (${videoWidth}x${videoHeight}), cropping square of size ${size}`);
    
    // Clear the canvas before drawing
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Create a temporary canvas for high-quality processing before downsampling
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = size;
    tempCanvas.height = size;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.imageSmoothingEnabled = true;
    tempCtx.imageSmoothingQuality = 'high';
    
    // First, draw the cropped image to temp canvas at full resolution
    tempCtx.drawImage(
        videoElement,
        (videoWidth - size) / 2,  // Start X point for cropping
        (videoHeight - size) / 2, // Start Y point for cropping
        size, size,               // Width and height of the cropped region
        0, 0,                     // Place at 0,0 on canvas
        size, size                // Keep at original size for high quality
    );
    
    // Now downsample from the temp canvas to the final canvas
    // This two-step process results in better quality downsampling
    ctx.drawImage(
        tempCanvas,
        0, 0, size, size,          // Source: full temp canvas
        0, 0, canvas.width, canvas.height  // Destination: final 300x300 canvas
    );
    
    // Convert to blob with max quality
    // IMPROVED: Keep 100% quality JPEG even with smaller dimensions
    canvas.toBlob(async (blob) => {
        // Log the image size for debugging
        console.log(`Captured image size: ${Math.round(blob.size / 1024)} KB`);
        
        // Close the modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('square-camera-modal'));
        modal.hide();
        
        // Update the profile image preview
        const previewElem = document.getElementById('profile-image-preview');
        const secondPreviewElem = document.getElementById('preview-profile-image');
        
        if (previewElem) {
            previewElem.src = URL.createObjectURL(blob);
        }
        
        if (secondPreviewElem) {
            secondPreviewElem.src = URL.createObjectURL(blob);
        }
        
        // Store the blob for later upload when the profile form is submitted
        window.capturedProfileImage = blob;
        
        // Create a File object from the blob to simulate a file input
        const fileName = `profile-${getUserId()}-${Date.now()}.jpg`;
        const file = new File([blob], fileName, { type: 'image/jpeg' });
        
        // Create a FileList-like object
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        
        // Set the file input's files property to our new FileList
        const fileInput = document.getElementById('profile-image');
        if (fileInput) {
            fileInput.files = dataTransfer.files;
            
            // Trigger the change event to ensure the handleProfileImageChange function is called
            const changeEvent = new Event('change', { bubbles: true });
            fileInput.dispatchEvent(changeEvent);
        }
    }, 'image/jpeg', 1.0); // IMPROVED: 100% quality JPEG
}

// Switch between front and rear cameras
function switchCamera() {
    // Toggle the facing mode
    currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
    
    // Show a toast to indicate the change
    //showToast('Camera', 'Switching to ' + (currentFacingMode === "user" ? 'front' : 'rear') + ' camera...', 'info');
    
    // Restart the camera with the new facing mode
    startCamera();
}

// Start timer for delayed photo capture
function startTimerCapture() {
    // Prevent multiple timers
    if (timerCountdown !== null) {
        clearInterval(timerCountdown);
        timerCountdown = null;
        document.getElementById('timer-display')?.remove();
        return;
    }
    
    // Create timer display if it doesn't exist
    let timerDisplay = document.createElement('div');
    timerDisplay.id = 'timer-display';
    
    // Add to container
    const container = document.getElementById('camera-container');
    container.appendChild(timerDisplay);
    
    // Set countdown
    let count = 10;
    timerDisplay.textContent = count;
    
    // Update countdown every second
    timerCountdown = setInterval(() => {
        count--;
        timerDisplay.textContent = count;
        
        if (count <= 0) {
            // Time's up - take photo
            clearInterval(timerCountdown);
            timerCountdown = null;
            timerDisplay.remove();
            capturePhoto();
        }
    }, 1000);
}

// Clean up timer if modal is closed during countdown
function cleanupTimer() {
    if (timerCountdown !== null) {
        clearInterval(timerCountdown);
        timerCountdown = null;
        document.getElementById('timer-display')?.remove();
    }
}

// Initialize camera when the document is loaded
document.addEventListener('DOMContentLoaded', function() {
    // We'll call initSquareCamera from profile.js when the profile view is loaded
});