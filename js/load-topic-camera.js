// Script loader for topic-camera.js
document.addEventListener('DOMContentLoaded', function() {
    // Check if square-camera.js is already loaded
    const isSquareCameraLoaded = Array.from(document.querySelectorAll('script')).some(script => 
        script.src && script.src.includes('square-camera.js'));
    
    // Load square-camera.js if not already loaded
    if (!isSquareCameraLoaded) {
        const squareCameraScript = document.createElement('script');
        squareCameraScript.src = 'js/square-camera.js';
        document.body.appendChild(squareCameraScript);
        
        console.log('Dynamically loaded square-camera.js');
    }
    
    // Load topic-camera.js 
    const topicCameraScript = document.createElement('script');
    topicCameraScript.src = 'js/topic-camera.js';
    document.body.appendChild(topicCameraScript);
    
    console.log('Dynamically loaded topic-camera.js');
});