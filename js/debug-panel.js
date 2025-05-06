// Mobile Debug Panel for Prayer Diary
// Activated by 5 two-finger taps anywhere on screen

(function() {
    // Only initialize in mobile environments or if explicitly enabled
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const debugForceEnable = localStorage.getItem('prayerDiaryDebugForceEnable') === 'true';
    
    if (!isMobile && !debugForceEnable) {
        console.log('Debug panel disabled: Not a mobile device. Set localStorage.prayerDiaryDebugForceEnable = true to enable on desktop.');
        return;
    }
    
    // State variables
    let logEntries = [];
    let maxLogEntries = 100;
    let tapCount = 0;
    let lastTapTime = 0;
    let debugPanelVisible = false;
    let updateTimer = null;
    let batchedLogs = [];
    let panelCreated = false;
    
    // Create and append the debug panel to the DOM, but only once
    function createDebugPanel() {
        if (panelCreated) return;
        
        const debugPanel = document.createElement('div');
        debugPanel.id = 'mobile-debug-panel';
        debugPanel.innerHTML = `
            <div class="debug-panel-header">
                <div class="debug-panel-title">Debug Console</div>
                <div class="debug-panel-controls">
                    <button id="debug-clear-btn" class="debug-btn">Clear</button>
                    <button id="debug-copy-btn" class="debug-btn">Copy</button>
                    <button id="debug-close-btn" class="debug-btn">Close</button>
                </div>
            </div>
            <div id="debug-log-container"></div>
        `;
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            #mobile-debug-panel {
                display: none;
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                background-color: rgba(0, 0, 0, 0.85);
                color: #fff;
                font-family: monospace;
                font-size: 12px;
                z-index: 10000;
                height: 40vh;
                overflow: hidden;
                border-top: 2px solid #483D8B;
                -webkit-overflow-scrolling: touch; /* Improve iOS scrolling */
            }
            
            .debug-panel-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px;
                background-color: #483D8B;
                position: sticky;
                top: 0;
                z-index: 10001;
            }
            
            .debug-panel-title {
                font-weight: bold;
            }
            
            .debug-btn {
                background: transparent;
                border: 1px solid #fff;
                color: #fff;
                padding: 2px 8px;
                margin-left: 4px;
                border-radius: 3px;
                font-size: 11px;
                min-width: 50px; /* Make buttons easier to tap on mobile */
                min-height: 30px;
            }
            
            #debug-log-container {
                padding: 8px;
                overflow-y: auto;
                height: calc(40vh - 40px);
                -webkit-overflow-scrolling: touch; /* Better iOS scrolling */
            }
            
            .log-entry {
                margin-bottom: 4px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                padding-bottom: 4px;
                word-break: break-all;
                white-space: pre-wrap;
            }
            
            .log-entry.log { color: #fff; }
            .log-entry.info { color: #4caf50; }
            .log-entry.warn { color: #ffc107; }
            .log-entry.error { color: #f44336; }
            .log-entry.debug { color: #03a9f4; }
        `;
        
        // Append to body
        document.body.appendChild(style);
        document.body.appendChild(debugPanel);
        
        // Add event listeners for buttons - use safer click events
        setTimeout(() => {
            const clearBtn = document.getElementById('debug-clear-btn');
            if (clearBtn) clearBtn.addEventListener('click', clearLogs, false);
            
            const copyBtn = document.getElementById('debug-copy-btn');
            if (copyBtn) copyBtn.addEventListener('click', copyLogs, false);
            
            const closeBtn = document.getElementById('debug-close-btn');
            if (closeBtn) closeBtn.addEventListener('click', hideDebugPanel, false);
        }, 100);
        
        panelCreated = true;
        
        // Add a debug message to confirm panel was created
        setTimeout(() => {
            console.log('Debug panel created successfully. Device: ' + 
                        (isIOS ? 'iOS' : 'Android/Other') + 
                        '. Tap with two fingers 5 times to activate.');
        }, 500);
    }
    
    // Use a different gesture approach for iOS
    function handleIOSTouchStart(event) {
        // Check if we have exactly 2 touch points
        if (event.touches.length === 2) {
            const currentTime = new Date().getTime();
            // Calculate time since last tap
            const timeDiff = currentTime - lastTapTime;
            
            // Only count as a tap if it's within a reasonable timeframe (800ms for iOS which can be slower)
            if (timeDiff < 800) {
                tapCount++;
                
                // Require 5 consecutive two-finger taps
                if (tapCount >= 5) {
                    tapCount = 0;
                    
                    // iOS Safari sometimes freezes with synchronous UI updates in event handlers
                    // Use setTimeout to defer the UI update to the next tick
                    setTimeout(() => {
                        toggleDebugPanel();
                    }, 10);
                }
            } else {
                // Reset counter for new sequence
                tapCount = 1;
            }
            
            lastTapTime = currentTime;
        }
    }
    
    // Standard gesture detector for Android and other devices
    function handleTouchStart(event) {
        if (event.touches.length === 2) {
            const currentTime = new Date().getTime();
            const timeDiff = currentTime - lastTapTime;
            
            if (timeDiff < 500) { // Detect taps that happen within 500ms
                tapCount++;
                
                if (tapCount >= 5) {
                    tapCount = 0;
                    toggleDebugPanel();
                }
            } else {
                tapCount = 1;
            }
            
            lastTapTime = currentTime;
        }
    }
    
    // Toggle debug panel visibility with deferred rendering
    function toggleDebugPanel() {
        if (!panelCreated) {
            createDebugPanel();
        }
        
        const panel = document.getElementById('mobile-debug-panel');
        if (!panel) return;
        
        if (!debugPanelVisible) {
            panel.style.display = 'block';
            // Defer the expensive updateLogDisplay operation
            setTimeout(() => {
                updateLogDisplay();
            }, 50);
        } else {
            panel.style.display = 'none';
        }
        
        debugPanelVisible = !debugPanelVisible;
    }
    
    // Hide debug panel
    function hideDebugPanel() {
        const panel = document.getElementById('mobile-debug-panel');
        if (panel) panel.style.display = 'none';
        debugPanelVisible = false;
    }
    
    // Clear logs with improved safety
    function clearLogs() {
        logEntries = [];
        // Use requestAnimationFrame for smoother UI updates
        requestAnimationFrame(() => {
            const container = document.getElementById('debug-log-container');
            if (container) container.innerHTML = '';
        });
    }
    
    // Copy logs to clipboard with improved iOS handling
    function copyLogs() {
        if (logEntries.length === 0) {
            appendToLog('No logs to copy', 'info');
            return;
        }
        
        const logText = logEntries.map(entry => `[${entry.type}] ${entry.message}`).join('\n');
        
        // For iOS, we'll use a different approach
        if (isIOS) {
            const textArea = document.createElement('textarea');
            textArea.value = logText;
            textArea.style.position = 'fixed';
            textArea.style.top = '0';
            textArea.style.left = '0';
            textArea.style.width = '100%';
            textArea.style.height = '50px';
            textArea.style.zIndex = '10002';
            
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                const successful = document.execCommand('copy');
                if (successful) {
                    appendToLog('Logs copied to clipboard - select and copy if not working', 'info');
                } else {
                    appendToLog('Please select text and copy manually', 'warn');
                }
            } catch (err) {
                appendToLog('Error copying: ' + err, 'error');
            }
            
            // Show a message to guide the user
            textArea.placeholder = "If automatic copy failed, select all text and copy manually, then tap outside this box";
            
            // Add listener to remove when tapped outside
            function removeTextarea(e) {
                if (e.target !== textArea) {
                    document.body.removeChild(textArea);
                    document.removeEventListener('touchstart', removeTextarea);
                    document.removeEventListener('mousedown', removeTextarea);
                }
            }
            
            document.addEventListener('touchstart', removeTextarea, { once: true });
            document.addEventListener('mousedown', removeTextarea, { once: true });
            
            // Safety timeout
            setTimeout(() => {
                if (document.body.contains(textArea)) {
                    document.body.removeChild(textArea);
                }
            }, 10000);
            
        } else {
            // Use modern clipboard API for non-iOS
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(logText)
                    .then(() => appendToLog('Logs copied to clipboard', 'info'))
                    .catch(err => appendToLog('Failed to copy: ' + err, 'error'));
            } else {
                // Fallback for other browsers
                const textarea = document.createElement('textarea');
                textarea.value = logText;
                textarea.style.position = 'fixed';
                textarea.style.opacity = 0;
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                
                try {
                    const successful = document.execCommand('copy');
                    if (successful) {
                        appendToLog('Logs copied to clipboard', 'info');
                    } else {
                        appendToLog('Failed to copy logs', 'error');
                    }
                } catch (err) {
                    appendToLog('Error during copy: ' + err, 'error');
                }
                
                document.body.removeChild(textarea);
            }
        }
    }
    
    // Batch log processing to improve performance
    function processBatchedLogs() {
        if (batchedLogs.length === 0) return;
        
        // Process all batched logs
        batchedLogs.forEach(logItem => {
            // Convert non-string messages to string representation
            let message = logItem.message;
            if (typeof message !== 'string') {
                try {
                    // Limit JSON stringification depth to prevent freezes
                    const maxDepth = 3;
                    message = JSON.stringify(message, (key, value) => {
                        if (typeof value === 'object' && value !== null) {
                            // Check the depth by counting parent references
                            let depth = 0;
                            let parent = this;
                            while (parent && depth < maxDepth) {
                                parent = Object.getPrototypeOf(parent);
                                depth++;
                            }
                            if (depth >= maxDepth) return '[Object]';
                        }
                        return value;
                    }, 2);
                } catch (err) {
                    message = String(message);
                }
            }
            
            // Truncate very long messages
            if (message.length > 1000) {
                message = message.substring(0, 1000) + '... [truncated]';
            }
            
            const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
            logEntries.push({ 
                message, 
                type: logItem.type, 
                timestamp 
            });
            
            // Limit the number of entries
            if (logEntries.length > maxLogEntries) {
                logEntries.shift();
            }
        });
        
        batchedLogs = [];
        
        // Update display if panel is visible
        if (debugPanelVisible) {
            updateLogDisplay();
        }
    }
    
    // Throttled log display update
    function updateLogDisplay() {
        // Cancel any pending updates
        if (updateTimer) {
            clearTimeout(updateTimer);
        }
        
        // Schedule the update
        updateTimer = setTimeout(() => {
            const container = document.getElementById('debug-log-container');
            if (!container) return;
            
            // Store scroll position to restore after update
            const wasAtBottom = container.scrollHeight - container.scrollTop === container.clientHeight;
            
            // Use document fragment for better performance
            const fragment = document.createDocumentFragment();
            
            // Get most recent logs first
            const recentLogs = [...logEntries].reverse().slice(0, 50); // Limit to 50 most recent
            
            recentLogs.forEach(entry => {
                const logElement = document.createElement('div');
                logElement.className = `log-entry ${entry.type}`;
                logElement.textContent = `[${entry.timestamp}] ${entry.message}`;
                fragment.appendChild(logElement);
            });
            
            // Clear and append in one operation
            container.innerHTML = '';
            container.appendChild(fragment);
            
            // Restore scroll position if needed
            if (wasAtBottom) {
                container.scrollTop = container.scrollHeight;
            }
            
            updateTimer = null;
        }, 100); // Delay to batch updates
    }
    
    // Simplified console override for better performance
    function overrideConsole() {
        const originalConsole = {
            log: console.log,
            info: console.info,
            warn: console.warn,
            error: console.error,
            debug: console.debug
        };
        
        // Throttled log processing
        function throttledAppendToLog(message, type) {
            batchedLogs.push({ message, type });
            
            // Process logs in batch
            if (batchedLogs.length === 1) {
                setTimeout(processBatchedLogs, 200);
            }
        }
        
        // Override each console method
        console.log = function() {
            originalConsole.log.apply(console, arguments);
            throttledAppendToLog(Array.from(arguments).join(' '), 'log');
        };
        
        console.info = function() {
            originalConsole.info.apply(console, arguments);
            throttledAppendToLog(Array.from(arguments).join(' '), 'info');
        };
        
        console.warn = function() {
            originalConsole.warn.apply(console, arguments);
            throttledAppendToLog(Array.from(arguments).join(' '), 'warn');
        };
        
        console.error = function() {
            originalConsole.error.apply(console, arguments);
            throttledAppendToLog(Array.from(arguments).join(' '), 'error');
        };
        
        console.debug = function() {
            originalConsole.debug.apply(console, arguments);
            throttledAppendToLog(Array.from(arguments).join(' '), 'debug');
        };
    }
    
    // Simplified direct log method that avoids calling console
    function appendToLog(message, type) {
        batchedLogs.push({ message, type });
        
        // Process immediately if small batch or defer if larger
        if (batchedLogs.length <= 3) {
            processBatchedLogs();
        } else if (batchedLogs.length === 4) {
            setTimeout(processBatchedLogs, 200);
        }
    }
    
    // Initialize the debug panel
    function initialize() {
        // Override console methods first
        overrideConsole();
        
        // Don't create the panel immediately - defer until needed
        // This improves initial performance
        
        // Choose the appropriate event handler based on device
        const touchHandler = isIOS ? handleIOSTouchStart : handleTouchStart;
        
        // Add touch event listener with passive flag to prevent scrolling issues
        document.addEventListener('touchstart', touchHandler, { passive: true });
        
        console.log('Mobile debug panel initialized - tap with two fingers 5 times to activate');
        console.log('Running on ' + (isIOS ? 'iOS' : 'Android/Other') + ' device');
    }
    
    // Wait for DOM to be fully loaded
    if (document.readyState === "loading") {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();