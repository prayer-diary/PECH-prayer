// Topic Camera Module
// This module integrates the square camera functionality with the topic edit modal

// Variables to track state
let topicCameraInitialized = false;

// Initialize the camera functionality for the topic edit modal
function initTopicCamera() {
    // Only initialize once
    if (topicCameraInitialized) return;
    
    console.log('Initializing topic camera functionality');
    
    // Ensure the square camera modal is available
    if (typeof initSquareCamera === 'function') {
        initSquareCamera();
    } else {
        console.error('Square camera module not loaded');
        return;
    }
    
    // Set up the "Take Photo" button event handler
    document.getElementById('take-topic-photo').addEventListener('click', openTopicCameraModal);
    
    // Indicate initialization complete
    topicCameraInitialized = true;
}

// Open the camera modal specifically for topic photos
function openTopicCameraModal() {
    // Update the modal title to indicate this is for a topic
    const modalTitle = document.getElementById('square-camera-modal-title');
    if (modalTitle) {
        modalTitle.textContent = 'Take Topic Picture';
    }
    
    // Show the camera modal
    const modal = new bootstrap.Modal(document.getElementById('square-camera-modal'));
    
    // Get elements
    videoElement = document.getElementById('camera-video');
    const captureBtn = document.getElementById('capture-photo-btn');
    const switchCameraBtn = document.getElementById('switch-camera-btn');
    
    // Setup camera when modal opens
    modal.show();
    startCamera();
    
    // Remove any existing event listeners to prevent duplicates
    const newCaptureBtn = captureBtn.cloneNode(true);
    const newSwitchCameraBtn = switchCameraBtn.cloneNode(true);
    
    captureBtn.parentNode.replaceChild(newCaptureBtn, captureBtn);
    switchCameraBtn.parentNode.replaceChild(newSwitchCameraBtn, switchCameraBtn);
    
    // Add new event listeners specifically for topic photos
    newCaptureBtn.addEventListener('click', captureTopicPhoto);
    newSwitchCameraBtn.addEventListener('click', switchCamera);
    
    // Set up timer button
    const timerBtn = document.getElementById('timer-photo-btn');
    const newTimerBtn = timerBtn.cloneNode(true);
    timerBtn.parentNode.replaceChild(newTimerBtn, timerBtn);
    newTimerBtn.addEventListener('click', startTopicTimerCapture);
    
    // Clean up when modal is closed
    document.getElementById('square-camera-modal').addEventListener('hidden.bs.modal', () => {
        stopCamera();
        cleanupTimer();
    });
}

// Capture a photo specifically for topics
function captureTopicPhoto() {
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
    console.log(`Capturing topic photo from video (${videoWidth}x${videoHeight}), cropping square of size ${size}`);
    
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
    canvas.toBlob(async (blob) => {
        // Log the image size for debugging
        console.log(`Captured topic image size: ${Math.round(blob.size / 1024)} KB`);
        
        // Close the modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('square-camera-modal'));
        modal.hide();
        
        // Update the topic image preview
        const previewElem = document.getElementById('topic-image-preview');
        
        if (previewElem) {
            previewElem.src = URL.createObjectURL(blob);
        }
        
        // Create a File object from the blob to simulate a file input
        const fileName = `topic-${Date.now()}.jpg`;
        const file = new File([blob], fileName, { type: 'image/jpeg' });
        
        // Create a FileList-like object
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        
        // Set the file input's files property to our new FileList
        const fileInput = document.getElementById('topic-image');
        if (fileInput) {
            fileInput.files = dataTransfer.files;
            
            // Trigger the change event to ensure proper handling
            const changeEvent = new Event('change', { bubbles: true });
            fileInput.dispatchEvent(changeEvent);
        }
        
        // Force validation to update save button state
        if (typeof validateTopicForm === 'function') {
            validateTopicForm();
        }
    }, 'image/jpeg', 1.0); // 100% quality JPEG
}

// Start timer for delayed topic photo capture
function startTopicTimerCapture() {
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
            captureTopicPhoto();
        }
    }, 1000);
}

// Update the standard topic modal opening function to initialize camera
const originalOpenAddTopicModal = openAddTopicModal;
openAddTopicModal = function() {
    // Call the original function
    originalOpenAddTopicModal();
    
    // Initialize the camera if needed
    initTopicCamera();
};

// Update the edit topic modal opening function to initialize camera
const originalOpenEditTopicModal = openEditTopicModal;
openEditTopicModal = function(topicId) {
    // Call the original function
    originalOpenEditTopicModal(topicId);
    
    // Initialize the camera if needed
    initTopicCamera();
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Initialize when the topics tab is activated
    const topicsTab = document.getElementById('other-tab');
    if (topicsTab) {
        topicsTab.addEventListener('shown.bs.tab', function() {
            // Delay initialization to ensure the modal is ready
            setTimeout(initTopicCamera, 500);
        });
    }
});