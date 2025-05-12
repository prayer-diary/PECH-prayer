// Authentication Module

// Variables
let currentUser = null;
let userProfile = null;
let lastTokenRefresh = Date.now();
const MIN_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes minimum between refreshes
let tokenRefreshInProgress = false;

// Initialize auth on load
document.addEventListener('DOMContentLoaded', initAuth);

// Check if we should refresh the token based on time elapsed
function shouldRefreshToken() {
    const timeSinceLastRefresh = Date.now() - lastTokenRefresh;
    return timeSinceLastRefresh > MIN_REFRESH_INTERVAL;
}

// Get session with throttling to prevent unnecessary refreshes
async function getSessionSafely() {
    if (tokenRefreshInProgress) {
        console.log('Token refresh already in progress, waiting...');
        // Wait for the current refresh to complete
        await new Promise(resolve => {
            const checkInterval = setInterval(() => {
                if (!tokenRefreshInProgress) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        });
        return supabase.auth.getSession();
    }
    
    // If we've refreshed recently, use cached data
    if (!shouldRefreshToken() && currentUser) {
        console.log('Using cached session - skipping unnecessary token refresh');
        return { data: { session: { user: currentUser } } };
    }
    
    try {
        tokenRefreshInProgress = true;
        const sessionResult = await supabase.auth.getSession();
        
        if (sessionResult?.data?.session) {
            lastTokenRefresh = Date.now();
            currentUser = sessionResult.data.session.user;
            window.authToken = sessionResult.data.session.access_token;
        }
        
        return sessionResult;
    } finally {
        tokenRefreshInProgress = false;
    }
}

// Init auth
async function initAuth() {
    try {
        console.log("Initializing authentication...");
        
        // Check if we should restore functionality
        if (window.restoreAuthFunctionality !== true) {
            // Before skipping auto-login, check if we're running as installed app
            if (typeof window.isInStandaloneMode === 'function' && window.isInStandaloneMode()) {
                console.log("Running in standalone mode, forcing auth functionality restoration");
                window.restoreAuthFunctionality = true;
            } else {
                // !IMPORTANT: Skip auto-login completely - we'll handle this elsewhere
                console.log("Auto-login disabled, waiting for installation to complete");
                return;
            }
        }
        
        console.log("Auth functionality enabled");
        // Reset the flag for future use
        window.restoreAuthFunctionality = false;
        
        // FIRST CHECK: Look for our custom reset password parameter
        const params = new URLSearchParams(window.location.search);
        const hasResetParam = params.has('reset_password');
        const hasTypeParam = params.get('type') === 'recovery';
        
        // If we have either reset parameter, this is a password reset flow
        if (hasResetParam || hasTypeParam) {
            console.log("Password reset flow detected via URL parameters");
            
            // Clean up the URL immediately (for security)
            const cleanUrl = window.location.protocol + '//' + window.location.host + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
            
            // Wait a small time to ensure Supabase has processed the auth change
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Check if we now have a session (from the recovery token)
            const { data: { session } } = await getSessionSafely();
            
            if (session) {
                console.log("Recovery session detected - forcing password reset");
                // Set currentUser so the password update will work
                currentUser = session.user;
                
                // Show the password reset form immediately
                setupAuthListeners(); // Set up listeners first
                openNewPasswordModal();
                return; // Important: Return early to prevent normal auth flow
            }
        }
        
        // If we reach here, this is a normal login flow (not password reset)
        // Normal session check
        const { data: { session }, error } = await getSessionSafely();
        
        if (session) {
            console.log("Normal session found, user is logged in");
            currentUser = session.user;
            
            // Store the access token in a global variable for reuse
            window.authToken = session.access_token;
            console.log("Access token stored for reuse in the app");
            
            // Normal login flow
            const profile = await fetchUserProfile();
            if (profile) {
                console.log("Profile loaded successfully:", profile.full_name);
            } else {
                console.warn("Could not load user profile after login");
            }
            showLoggedInState();
        } else {
            console.log("No session found, user is logged out");
            showLoggedOutState();
        }
        
        setupAuthListeners();
    } catch (error) {
        console.error("Error initializing authentication:", error);
        showLoggedOutState();
    }
}

// Setup auth event listeners
function setupAuthListeners() {
    // Track last navigation time for debouncing auth events
    let lastNavigationTime = 0;
    
    // Listen for navigation events to debounce auth events
    document.addEventListener('navigation-completed', () => {
        lastNavigationTime = Date.now();
        console.log("Navigation completed timestamp recorded:", lastNavigationTime);
    });
    
    // Auth state changes
    supabase.auth.onAuthStateChange(async (event, session) => {
        console.log("Auth state change detected:", event);
        
        // Set auth busy flag during processing
        isAuthBusy = true;
        
        try {
            // Prevent processing SIGNED_IN events right after navigation
            // This prevents the auth refresh that's causing database stalls
            const timeSinceNavigation = Date.now() - lastNavigationTime;
            if (event === 'SIGNED_IN' && timeSinceNavigation < 2000) {
                console.log("Ignoring SIGNED_IN event immediately after navigation");
                return;
            }
            
            if (event === 'SIGNED_IN') {
            // Check if we already have this user logged in
            if (currentUser && currentUser.id === session.user.id) {
                console.log("Duplicate SIGNED_IN event detected - skipping processing");
                return;
            }
            
            currentUser = session.user;
            // Update the stored token on sign in
            window.authToken = session.access_token;
            // Set last token refresh time
            lastTokenRefresh = Date.now();
            console.log("Access token updated on sign in");
            await fetchUserProfile();
            showLoggedInState();
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            userProfile = null;
            showLoggedOutState();
        } else if (event === 'TOKEN_REFRESHED') {
            // Only log and update if we should refresh
            if (shouldRefreshToken()) {
                lastTokenRefresh = Date.now();
                window.authToken = session.access_token;
                console.log("Access token updated on refresh");
            } else {
                console.log("Skipping unnecessary token refresh");
            }
        }
        } finally {
            // Always reset the busy flag when done
            isAuthBusy = false;
        }
    });
    
    // UI Event Listeners
    const loginBtn = document.getElementById('btn-login');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            openAuthModal('login');
        });
    }
    
    const signupBtn = document.getElementById('btn-signup');
    if (signupBtn) {
        signupBtn.addEventListener('click', () => {
            openAuthModal('signup');
        });
    }
    
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    document.getElementById('auth-switch').addEventListener('click', toggleAuthMode);
    
    document.getElementById('auth-form').addEventListener('submit', handleAuth);
    
    // Set up forgotten password event handler
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            openPasswordResetModal();
        });
    }
    
    // Set up password reset form submission
    const passwordResetForm = document.getElementById('password-reset-form');
    if (passwordResetForm) {
        passwordResetForm.addEventListener('submit', handlePasswordReset);
    }
    
    // Set up new password form submission
    const newPasswordForm = document.getElementById('new-password-form');
    if (newPasswordForm) {
        newPasswordForm.addEventListener('submit', handleNewPassword);
    }
    
    // Close modal button
    document.getElementById('auth-modal-close').addEventListener('click', () => {
        document.getElementById('auth-modal').classList.remove('is-active');
    });
}

// Open auth modal for login or signup
function openAuthModal(mode) {
    try {
        // Check global blocking flag first
        if (window.blockLoginModal === true) {
            console.log('Login modal blocked by global flag');
            return;
        }
        
        // Check if we should delay login for installation
        if (sessionStorage.getItem('delayLoginForInstall') === 'true') {
            console.log('Delaying login modal for app installation');
            return;
        }
        
        // Check if we're trying to log in after a forced logout
        // If it's been less than 2 seconds since forced logout, reload the page
        const forcedLogoutFlag = sessionStorage.getItem('prayerDiaryForcedLogout');
        const logoutTime = parseInt(sessionStorage.getItem('prayerDiaryLogoutTime') || '0');
        const timeSinceLogout = Date.now() - logoutTime;
        
        if (forcedLogoutFlag === 'true' && timeSinceLogout < 2000) {
            console.log("Detected login attempt immediately after forced logout, reloading page...");
            sessionStorage.removeItem('prayerDiaryForcedLogout');
            sessionStorage.removeItem('prayerDiaryLogoutTime');
            
            // Show a message then reload
            //showToast('Please Wait', 'Refreshing the page for a clean login...', 'info');
            setTimeout(() => {
                window.location.reload();
            }, 1500);
            return;
        }
        
        // Clear the logout flag if it's been more than 2 seconds
        if (forcedLogoutFlag === 'true') {
            sessionStorage.removeItem('prayerDiaryForcedLogout');
            sessionStorage.removeItem('prayerDiaryLogoutTime');
        }
        
        // Get all necessary elements with null checks
        const modalElement = document.getElementById('auth-modal');
        if (!modalElement) {
            console.error("Auth modal element not found");
            return;
        }
        
        const modal = new bootstrap.Modal(modalElement);
        
        const title = document.getElementById('auth-modal-title');
        const submitBtn = document.getElementById('auth-submit');
        const switchText = document.getElementById('auth-switch-text');
        const signupFields = document.querySelectorAll('.signup-field');
        const loginFields = document.querySelectorAll('.login-field');
        const signupNameInput = document.getElementById('signup-name');
        const confirmPasswordInput = document.getElementById('auth-confirm-password');
        const authForm = document.getElementById('auth-form');
        const authError = document.getElementById('auth-error');
        const signupHelpText = document.querySelector('.signup-field .form-text');
        const passwordMatchMessage = document.querySelector('.password-match-message');
        
        // Reset form with null checks
        if (authForm) authForm.reset();
        if (authError) authError.classList.add('d-none');
        
        // Hide password match message
        if (passwordMatchMessage) {
            passwordMatchMessage.classList.add('d-none');
        }
        
        if (mode === 'login') {
            if (title) title.textContent = 'Log In';
            if (submitBtn) submitBtn.textContent = 'Log In';
            if (switchText) switchText.innerHTML = 'Don\'t have an account? <a href="#" id="auth-switch">Sign up</a>';
            
            // Show login fields, hide signup fields
            signupFields.forEach(field => field.classList.add('d-none'));
            loginFields.forEach(field => field.classList.remove('d-none'));
            
            // CRITICAL: Remove required attribute from hidden fields in login mode
            if (signupNameInput) signupNameInput.removeAttribute('required');
            if (confirmPasswordInput) confirmPasswordInput.removeAttribute('required');
            if (signupHelpText) signupHelpText.classList.add('d-none');
        } else {
            if (title) title.textContent = 'Sign Up';
            if (submitBtn) submitBtn.textContent = 'Sign Up';
            if (switchText) switchText.innerHTML = 'Already have an account? <a href="#" id="auth-switch">Log in</a>';
            
            // Hide login fields, show signup fields
            signupFields.forEach(field => field.classList.remove('d-none'));
            loginFields.forEach(field => field.classList.add('d-none'));
            
            // Add required attribute back for signup mode
            if (signupNameInput) signupNameInput.setAttribute('required', '');
            if (confirmPasswordInput) confirmPasswordInput.setAttribute('required', '');
            if (signupHelpText) signupHelpText.classList.remove('d-none');
            
            // Let validation function handle the button state
            // Do not disable by default as it prevents users from submitting even when all fields are filled
        }
        
        // Re-attach event listener for switch link - with null check
        const switchLink = document.getElementById('auth-switch');
        if (switchLink) {
            switchLink.removeEventListener('click', toggleAuthMode);
            switchLink.addEventListener('click', toggleAuthMode);
        }
        
        // Add input validation event listeners - with null check
        const formInputs = document.querySelectorAll('#auth-form input');
        formInputs.forEach(input => {
            if (input) {
                // Remove existing event listener first to prevent duplicates
                input.removeEventListener('input', validateAuthForm);
                input.addEventListener('input', validateAuthForm);
                console.log(`Added input validation listener to ${input.id || 'unknown input'}`);
            }
        });
        
        // Call validateAuthForm immediately and after a short delay
        // This helps ensure the form state is evaluated correctly
        validateAuthForm();
        setTimeout(validateAuthForm, 100);
        
        // Show the modal
        modal.show();
    } catch (error) {
        console.error("Error in openAuthModal:", error);
        // Fallback for critical error - reload the page
        showToast("Error", "There was a problem with the login form. The page will reload.", "error");
        setTimeout(() => {
            window.location.reload();
        }, 2000);
    }
}

// Toggle between login and signup
function toggleAuthMode() {
    try {
        const title = document.getElementById('auth-modal-title');
        if (!title) {
            console.error("Auth modal title element not found");
            return;
        }
        
        const isLogin = title.textContent === 'Log In';
        const signupNameInput = document.getElementById('signup-name');
        const confirmPasswordInput = document.getElementById('auth-confirm-password');
        const signupFields = document.querySelectorAll('.signup-field');
        const loginFields = document.querySelectorAll('.login-field');
        const signupHelpText = document.querySelector('.signup-field .form-text');
        const passwordMatchMessage = document.querySelector('.password-match-message');
        const submitBtn = document.getElementById('auth-submit');
        const switchTextElement = document.getElementById('auth-switch-text');
        
        if (isLogin) {
            // Switching to signup
            title.textContent = 'Sign Up';
            if (submitBtn) submitBtn.textContent = 'Sign Up';
            if (switchTextElement) switchTextElement.innerHTML = 'Already have an account? <a href="#" id="auth-switch">Log in</a>';
            
            // Show signup fields, hide login fields
            signupFields.forEach(field => field.classList.remove('d-none'));
            loginFields.forEach(field => field.classList.add('d-none'));
            
            // Make signup fields required
            if (signupNameInput) signupNameInput.setAttribute('required', '');
            if (confirmPasswordInput) confirmPasswordInput.setAttribute('required', '');
            if (signupHelpText) signupHelpText.classList.remove('d-none');
            
            // Reset password match message
            if (passwordMatchMessage) {
                passwordMatchMessage.classList.add('d-none');
            }
        } else {
            // Switching to login
            title.textContent = 'Log In';
            if (submitBtn) submitBtn.textContent = 'Log In';
            if (switchTextElement) switchTextElement.innerHTML = 'Don\'t have an account? <a href="#" id="auth-switch">Sign up</a>';
            
            // Show login fields, hide signup fields
            signupFields.forEach(field => field.classList.add('d-none'));
            loginFields.forEach(field => field.classList.remove('d-none'));
            
            // Remove required attribute from signup fields
            if (signupNameInput) signupNameInput.removeAttribute('required');
            if (confirmPasswordInput) confirmPasswordInput.removeAttribute('required');
            if (signupHelpText) signupHelpText.classList.add('d-none');
        }
        
        // Re-attach event listener for switch link
        const switchLink = document.getElementById('auth-switch');
        if (switchLink) {
        // Replace the event listener instead of just adding a new one
            switchLink.removeEventListener('click', toggleAuthMode);
        switchLink.addEventListener('click', toggleAuthMode);
    }
        
        // Re-validate the form
        validateAuthForm();
    } catch (error) {
        console.error("Error in toggleAuthMode:", error);
    }
}

// Validate the auth form
function validateAuthForm() {
    const submitBtn = document.getElementById('auth-submit');
    const authModalTitle = document.getElementById('auth-modal-title');
    
    if (!submitBtn || !authModalTitle) {
        console.error('Cannot find submit button or modal title element');
        return;
    }
    
    const isLogin = authModalTitle.textContent === 'Log In';
    
    const email = document.getElementById('auth-email')?.value.trim() || '';
    const password = document.getElementById('auth-password')?.value || '';
    
    // For debugging
    console.log(`Form validation: isLogin=${isLogin}, email=${email ? 'set' : 'empty'}, password=${password ? 'set' : 'empty'}`);
    
    if (isLogin) {
        // Login requires only email and password
        submitBtn.disabled = !(email && password);
        console.log(`Login button ${submitBtn.disabled ? 'disabled' : 'enabled'}`);
    } else {
        // Signup requires name, email, password, and matching password confirmation
        const signupNameInput = document.getElementById('signup-name');
        const confirmPasswordInput = document.getElementById('auth-confirm-password');
        const passwordMatchMessage = document.querySelector('.password-match-message');
        
        if (!signupNameInput || !confirmPasswordInput) {
            console.error('Signup form fields not found');
            return;
        }
        
        const fullName = signupNameInput.value.trim();
        const confirmPassword = confirmPasswordInput.value;
        
        // Debug log
        console.log(`Signup validation: name=${fullName ? 'set' : 'empty'}, confirmPassword=${confirmPassword ? 'set' : 'empty'}`);
        
        // Check if passwords match when both fields have values
        let passwordsMatch = true;
        if (password && confirmPassword) {
            passwordsMatch = password === confirmPassword;
            
            // Show/hide password match message
            if (passwordMatchMessage) {
                if (passwordsMatch) {
                    passwordMatchMessage.classList.add('d-none');
                } else {
                    passwordMatchMessage.classList.remove('d-none');
                }
            }
        } else {
            // If one or both password fields are empty, hide the mismatch message
            if (passwordMatchMessage) {
                passwordMatchMessage.classList.add('d-none');
            }
        }
        
        // Enable submit button only if all fields are filled and passwords match
        const shouldEnable = fullName && email && password && confirmPassword && passwordsMatch;
        submitBtn.disabled = !shouldEnable;
        console.log(`Signup button ${submitBtn.disabled ? 'disabled' : 'enabled'}: fullName=${!!fullName}, email=${!!email}, password=${!!password}, confirmPassword=${!!confirmPassword}, passwordsMatch=${passwordsMatch}`);
    }
}

// Flag to prevent login from getting stuck
let loginInProgress = false;

// Handle login/signup form submission
async function handleAuth(e) {
    e.preventDefault();
    
    // If login already in progress, reset the state
    if (loginInProgress) {
        console.log("Detecting a stuck login attempt, resetting state...");
        resetLoginState();
        // Show an error message
        const errorElem = document.getElementById('auth-error');
        errorElem.querySelector('p').textContent = "Previous login attempt didn't complete. Please try again.";
        errorElem.classList.remove('d-none');
        return;
    }
    
    loginInProgress = true;
    
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const isLogin = document.getElementById('auth-modal-title').textContent === 'Log In';
    
    // Show loading state
    const submitBtn = document.getElementById('auth-submit');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Loading...';
    submitBtn.disabled = true;
    
    // Set timeout to prevent hanging login attempts
    const loginTimeout = setTimeout(() => {
        console.warn("Login attempt timed out after 10 seconds");
        resetLoginState();
        
        // Show error message
        const errorElem = document.getElementById('auth-error');
        errorElem.classList.remove('d-none');
        errorElem.querySelector('p').textContent = "Login request timed out. Please try again or refresh the page.";
        
        // Reset the button
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }, 10000); // 10 second timeout
    
    try {
        if (isLogin) {
            console.log("Processing login request for:", email);
            
            // Add a timeout to the login request
            const loginWithTimeout = Promise.race([
                supabase.auth.signInWithPassword({
                    email,
                    password
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Login API timeout')), 8000)
                )
            ]);
            
            // Attempt login with timeout
            const { data, error } = await loginWithTimeout;
            
            if (error) throw error;
            
            // If successful, clear the timeout
            clearTimeout(loginTimeout);
            
            // Set last token refresh time
            lastTokenRefresh = Date.now();
            
            // Close modal on success
            const modal = bootstrap.Modal.getInstance(document.getElementById('auth-modal'));
            if (modal) modal.hide();
            
            // Reset login flag
            loginInProgress = false;
            
        } else {
            // Signup
            const fullName = document.getElementById('signup-name').value;
            const confirmPassword = document.getElementById('auth-confirm-password').value;
            
            // Verify passwords match before proceeding
            if (password !== confirmPassword) {
                throw new Error('Passwords do not match. Please try again.');
            }
            
            // Add debug log to see what we're sending
            console.log('Attempting to sign up user:', email);
            
            // Simplified signup flow - direct and linear process
            let data, error;
            
            try {
                // Step 1: Create the authentication account with metadata
                const simpleSignup = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName
                        }
                    }
                });
                
                data = simpleSignup.data;
                error = simpleSignup.error;
                
                console.log('Signup response:', {
                    error: error ? {
                        message: error.message,
                        code: error.code,
                        status: error.status
                    } : null,
                    userId: data?.user?.id
                });
                
                // Step 2: If auth account created successfully, immediately create the profile
                if (!error && data?.user?.id) {
                    console.log('User created, now creating profile directly');
                    
                    // We'll rely on the database trigger to create the profile
                    // But we'll check to make sure it worked
                    console.log('User created, verifying profile creation...');
                    
                    // Wait a moment for the trigger to execute
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // Verify profile was created by the trigger
                    const { data: checkData, error: checkError } = await supabase
                        .from('profiles')
                        .select('id')
                        .eq('id', data.user.id)
                        .single();
                        
                    if (checkError || !checkData) {
                        console.error('Profile not created by trigger:', checkError);
                        throw new Error('Profile creation failed. Please contact support.');
                    } else {
                        console.log('Successfully verified profile creation');
                    }
                }
            } catch (signupError) {
                console.error('Error during signup process:', signupError);
                error = signupError;
            }
            
            if (error) throw error;
            
            // Close modal on success
            const modal = bootstrap.Modal.getInstance(document.getElementById('auth-modal'));
            modal.hide();
            
            // Notify admins about the new user registration
            await notifyAdminsAboutNewUser(fullName, email);
            
            // Show registration complete screen
            showRegistrationCompleteScreen();
        }
    } catch (error) {
        // Enhanced error logging for debugging
        console.error('Auth error:', error);
        console.log('Full error object:', {
            message: error.message,
            code: error.code,
            status: error.status,
            details: error.details,
            hint: error.hint,
            stack: error.stack
        });
        
        const errorElem = document.getElementById('auth-error');
        
        // Show technical error details during debugging
        let errorMessage = `${error.message} (${error.code || 'no code'})`;
        if (error.details) {
            errorMessage += `\nDetails: ${JSON.stringify(error.details)}`;
        }
        if (error.hint) {
            errorMessage += `\nHint: ${error.hint}`;
        }
        
        errorElem.querySelector('p').textContent = errorMessage;
        errorElem.style.whiteSpace = 'pre-line'; // Preserve line breaks
        errorElem.classList.remove('d-none');
    } finally {
        // Clear the timeout if it hasn't fired yet
        clearTimeout(loginTimeout);
        
        // Restore button state
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        
        // Reset flag after a delay to prevent race conditions
        setTimeout(() => {
            loginInProgress = false;
        }, 500);
    }
}

// Helper function to reset login state
function resetLoginState() {
    loginInProgress = false;
    
    // Clean up any potential lingering state
    try {
        // Force reset internal Supabase state
        supabase.auth.signOut({ scope: 'local' })
            .catch(e => console.warn("Error during state reset:", e));
        
        // Clear and reset form fields
        const authForm = document.getElementById('auth-form');
        if (authForm) authForm.reset();
        
        // Reset login button
        const submitBtn = document.getElementById('auth-submit');
        if (submitBtn) {
            submitBtn.textContent = 'Log In';
            submitBtn.disabled = false;
        }
    } catch (error) {
        console.error("Error resetting login state:", error);
    }
}

// Flag to prevent multiple simultaneous logout attempts
let logoutInProgress = false;

// Logout function with enhanced error handling and force-logout capability
async function logout() {
    // Prevent multiple calls
    if (logoutInProgress) {
        console.log("Logout already in progress, ignoring duplicate call");
        return;
    }
    
    logoutInProgress = true;
    console.log("Attempting to logout user...");
    
    // Show a loading toast to indicate logout is in progress
    const logoutToastId = showToast('Logging Out', 'Please wait...', 'info');
    
    // Set a timeout to force completion if the API calls hang
    const logoutTimeout = setTimeout(() => {
        console.warn("Logout operation timed out - forcing completion");
        completeLogout();
    }, 5000); // 5 second timeout
    
    try {
        // First create a promise that will timeout
        const signOutWithTimeout = Promise.race([
            supabase.auth.signOut(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Logout API timeout')), 3000)
            )
        ]);
        
        // Attempt the signout with timeout
        console.log("Trying standard signOut method with timeout...");
        const { error } = await signOutWithTimeout;
        
        if (error) {
            console.warn("Standard signOut had an error:", error.message);
            throw error;
        }
        
        console.log("Standard signOut successful");
        completeLogout();
    } catch (error) {
        console.error("Error during standard logout:", error);
        
        try {
            // Second attempt with timeout
            console.log("Trying alternative signOut method...");
            await Promise.race([
                supabase.auth.signOut({ scope: 'global' }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Alternative logout timeout')), 3000)
                )
            ]);
            console.log("Alternative signOut completed");
            completeLogout();
        } catch (secondError) {
            console.error("Error during alternative logout:", secondError);
            
            // Force client-side logout regardless of server response
            console.log("Forcing client-side logout...");
            completeLogout();
        }
    }
    
    // Helper function to complete the logout process
    function completeLogout() {
        // Clear the timeout if it hasn't fired yet
        clearTimeout(logoutTimeout);
        
        if (!logoutInProgress) return; // Avoid duplicate execution
        
        // Set a flag in sessionStorage to indicate logout just happened
        // This will be checked on next login attempt
        try {
            sessionStorage.setItem('prayerDiaryForcedLogout', 'true');
            sessionStorage.setItem('prayerDiaryLogoutTime', Date.now().toString());
        } catch (e) {
            console.warn("Couldn't set logout flag:", e);
        }
        
        try {
            // Always reset the local state regardless of API success
            console.log("Resetting local state...");
            currentUser = null;
            userProfile = null;
            
            // More aggressive token clearing approach
            try {
                // Clear all tokens with various browser storage prefixes
                const tokenPrefixes = ['supabase.auth.token', 'sb-', 'supa'];
                
                // Look for all items that might contain auth tokens
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key) {
                        // Clear any key that starts with known Supabase prefixes
                        for (const prefix of tokenPrefixes) {
                            if (key.startsWith(prefix)) {
                                console.log(`Clearing localStorage item: ${key}`);
                                localStorage.removeItem(key);
                            }
                        }
                    }
                }
                
                // Do the same for sessionStorage
                for (let i = 0; i < sessionStorage.length; i++) {
                    const key = sessionStorage.key(i);
                    if (key) {
                        for (const prefix of tokenPrefixes) {
                            if (key.startsWith(prefix)) {
                                console.log(`Clearing sessionStorage item: ${key}`);
                                sessionStorage.removeItem(key);
                            }
                        }
                    }
                }
                
                // Directly try specific token names
                localStorage.removeItem('supabase.auth.token');
                localStorage.removeItem('supabase.auth.expires_at');
                sessionStorage.removeItem('supabase.auth.token');
                
                // Clear cookies that might contain auth info
                document.cookie.split(';').forEach(cookie => {
                    const [name] = cookie.trim().split('=');
                    for (const prefix of tokenPrefixes) {
                        if (name && name.startsWith(prefix)) {
                            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
                        }
                    }
                });
            } catch (storageError) {
                console.warn("Error clearing auth storage:", storageError);
            }
            
            // Update UI to logged out state
            showLoggedOutState();
            
            // Clear any app-specific state
            clearLocalAppState();
            
            // Dismiss the loading toast
            dismissToast(logoutToastId);
            
            // Show success message
            //showToast('Logged Out', 'You have been successfully logged out', 'success', 3000);
            
            console.log("Logout procedure completed");
            
            // Reset the flag after a small delay to prevent any race conditions
            setTimeout(() => {
                logoutInProgress = false;
            }, 500);
        } catch (finalError) {
            console.error("Critical error during logout cleanup:", finalError);
            
            // Show error toast
            dismissToast(logoutToastId);
            showToast('Logout Error', 'There was a problem logging out. Please refresh the page.', 'error');
            
            // Reset the flag
            logoutInProgress = false;
            
            // Last resort - offer page reload
            if (confirm("Logout encountered an error. Reload the page?")) {
                window.location.reload();
            }
        }
    }
}

// Helper function to clear any local state
function clearLocalAppState() {
    // Clear any cached data
    if (window.sessionStorage) {
        // Clear specific session storage items related to the app
        // Don't clear everything as it might affect other apps
        sessionStorage.removeItem('prayerDiaryLastView');
        sessionStorage.removeItem('prayerDiaryLastUpdate');
        // Add any other items that should be cleared
    }
    
    // Reset any global app state variables (if any)
    // Example: currentView = null;
}

// Fetch current user's profile with retry mechanism
async function fetchUserProfile() {
    try {
        if (!currentUser) return null;
        
        // Check if we already have a profile cached
        if (userProfile && userProfile.id === currentUser.id) {
            console.log('Using cached user profile data');
            return userProfile;
        }
        
        // Wait for any token refresh to complete first
        if (tokenRefreshInProgress) {
            console.log('Token refresh in progress, waiting before fetching profile...');
            await new Promise(resolve => {
                const checkInterval = setInterval(() => {
                    if (!tokenRefreshInProgress) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
            });
        }
        
        // First attempt to get the profile
        let { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();
            
        // If we get a "no rows returned" error, the profile might not be created yet
        if (error && error.code === 'PGRST116') {
            console.log('Profile not found on first attempt, waiting and retrying...');
            
            // Wait a moment and try again
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Check if profile exists now
            const { data: checkData, error: checkError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', currentUser.id)
                .single();
                
            if (checkError) {
                console.error('Profile still not found after retry:', checkError);
                return null;
            } else {
                // Use the data from the retry
                data = checkData;
            }
        } else if (error) {
            // Handle other types of errors
            console.error('Error fetching profile:', error);
            return null;
        }
        
        userProfile = data;
        return data;
    } catch (error) {
        console.error('Error fetching user profile:', error);
        return null;
    }
}

// Update user interface for logged in state
function showLoggedInState() {
    // Check if user profile exists and is approved
    if (!userProfile) {
        console.error("No user profile found after login");
        showNotification('Error', 'Could not load your user profile. Please contact support.');
        logout();
        return;
    }
    
    // Dispatch a custom event to notify other components about login state change
    document.dispatchEvent(new CustomEvent('login-state-changed', { detail: { loggedIn: true }}));
    
    // Check approval status first
    if (userProfile.approval_state !== 'Approved') {
        // User is logged in but not approved - show pending screen and prevent navigation
        document.querySelectorAll('.logged-out').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.logged-in').forEach(el => el.classList.add('hidden'));
        
        // Show landing view for status message
        document.getElementById('landing-view').classList.remove('d-none');
        document.getElementById('app-views').classList.add('d-none');
        
        // Disable all navigation buttons
        document.querySelectorAll('.nav-link, .navbar-brand').forEach(link => {
            link.classList.add('disabled');
            link.style.pointerEvents = 'none';
        });
        
        const statusMessage = document.getElementById('auth-status-message');
        statusMessage.innerHTML = `
            <div class="alert alert-warning mt-5">
                <h4 class="alert-heading">Account Pending Approval</h4>
                <p>Your account is pending approval by an administrator. You'll receive an email when your account is approved.</p>
                <p>Please close this window and check your email for the approval notification.</p>
                <hr>
                <div class="text-center">
                    <button id="pending-logout-btn" class="btn btn-primary" type="button">Close Session</button>
                </div>
            </div>
        `;
        
        // Add logout button event listener
        document.getElementById('pending-logout-btn').addEventListener('click', () => {
            logout();
        });
        
        return;
    }
    
    // User is approved - show normal UI
    document.querySelectorAll('.logged-out').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.logged-in').forEach(el => el.classList.remove('hidden'));
    
    // Apply user preferences if available
    if (window.applyUserPreferences) {
        window.applyUserPreferences();
    }
    
    // Show/hide admin links based on user role
    if (userProfile.user_role === 'Administrator') {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
    } else {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
    }
    
    // Show/hide Edit menu and its items based on editor permissions
    const hasAnyEditorPermission = 
        userProfile.prayer_calendar_editor || 
        userProfile.prayer_update_editor || 
        userProfile.urgent_prayer_editor;
    
    // Show/hide the entire Edit dropdown menu
    if (hasAnyEditorPermission || userProfile.user_role === 'Administrator') {
        document.querySelectorAll('.editor-only').forEach(el => el.classList.remove('hidden'));
    } else {
        document.querySelectorAll('.editor-only').forEach(el => el.classList.add('hidden'));
    }
    
    // Show/hide individual editor items based on specific permissions
    // Calendar editor
    if (userProfile.prayer_calendar_editor || userProfile.user_role === 'Administrator') {
        document.querySelectorAll('.calendar-editor-only').forEach(el => el.classList.remove('hidden'));
    } else {
        document.querySelectorAll('.calendar-editor-only').forEach(el => el.classList.add('hidden'));
    }
    
    // Update editor
    if (userProfile.prayer_update_editor || userProfile.user_role === 'Administrator') {
        document.querySelectorAll('.update-editor-only').forEach(el => el.classList.remove('hidden'));
    } else {
        document.querySelectorAll('.update-editor-only').forEach(el => el.classList.add('hidden'));
    }
    
    // Urgent prayer editor
    if (userProfile.urgent_prayer_editor || userProfile.user_role === 'Administrator') {
        document.querySelectorAll('.urgent-editor-only').forEach(el => el.classList.remove('hidden'));
    } else {
        document.querySelectorAll('.urgent-editor-only').forEach(el => el.classList.add('hidden'));
    }
    
    // Enable all navigation buttons
    document.querySelectorAll('.nav-link, .navbar-brand').forEach(link => {
        link.classList.remove('disabled');
        link.style.pointerEvents = '';
    });
    
    document.getElementById('landing-view').classList.add('d-none');
    document.getElementById('app-views').classList.remove('d-none');
    
    // If profile is not set yet, take user directly to profile page
    if (userProfile.profile_set === false) {
        showView('profile-view');
        // Explicitly call loadUserProfile to populate the form fields
        loadUserProfile();
        showNotification('Welcome', 'Please complete your profile information before using the Prayer Diary.');
    } else {
        // Load initial view (prayer calendar)
        showView('calendar-view');
        loadPrayerCalendar();
    }
}

// Registration complete screen
function showRegistrationCompleteScreen() {
    document.querySelectorAll('.logged-out').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.logged-in').forEach(el => el.classList.add('hidden'));
    
    // Show landing view for status message
    document.getElementById('landing-view').classList.remove('d-none');
    document.getElementById('app-views').classList.add('d-none');
    
    // Disable all navigation buttons
    document.querySelectorAll('.nav-link, .navbar-brand').forEach(link => {
        link.classList.add('disabled');
        link.style.pointerEvents = 'none';
    });
    
    // Show registration complete message
    const statusMessage = document.getElementById('auth-status-message');
    statusMessage.innerHTML = `
        <div class="alert alert-success mt-5">
            <h4 class="alert-heading">Registration Complete!</h4>
            <p>Your account has been created and is pending approval by an administrator.</p>
            <p>You'll receive an email when your account is approved.</p>
            <hr>
            <p class="mb-0">Please close this window and reopen the app after receiving approval.</p>
            <div class="text-center mt-3">
                <button id="close-session-btn" class="btn btn-primary" type="button">Close Session</button>
            </div>
        </div>
    `;
    
    // Add close session button event listener with improved handling
    // Wait for DOM to be ready
    setTimeout(() => {
        const closeBtn = document.getElementById('close-session-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', async () => {
                // Disable button to prevent multiple clicks
                closeBtn.disabled = true;
                closeBtn.textContent = 'Closing session...';
                
                // Call logout
                await logout();
                
                // Show success message
                statusMessage.innerHTML = `
                    <div class="alert alert-info">
                        <p>Your session has been closed. You may now close this window.</p>
                        <p>Please check your email for approval notification before logging in again.</p>
                        <div class="text-center mt-3">
                            <button onclick="window.location.reload()" class="btn btn-secondary">Refresh Page</button>
                        </div>
                    </div>
                `;
            });
            console.log("Close session button event listener attached");
        } else {
            console.error("Could not find close-session-btn element");
        }
    }, 100);
}

// Update user interface for logged out state
function showLoggedOutState() {
    document.querySelectorAll('.logged-out').forEach(el => el.classList.add('hidden')); // Keep logged-out elements hidden
    document.querySelectorAll('.logged-in').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
    
    // Dispatch a custom event to notify other components about login state change
    document.dispatchEvent(new CustomEvent('login-state-changed', { detail: { loggedIn: false }}));
    
    document.getElementById('landing-view').classList.add('d-none'); // Keep landing-view hidden
    document.getElementById('app-views').classList.add('d-none');
    
    // Re-enable navigation buttons
    document.querySelectorAll('.nav-link, .navbar-brand').forEach(link => {
        link.classList.remove('disabled');
        link.style.pointerEvents = '';
    });
    
    // Only show the auth modal - no welcome screen
    setTimeout(() => {
        openAuthModal('login');
    }, 100);
}

// Create super admin
async function createSuperAdmin() {
    try {
        // Check if admin user exists
        const { data: existingAdmin, error: checkError } = await supabase
            .from('profiles')
            .select('id')
            .eq('user_role', 'Administrator')
            .limit(1);
            
        if (checkError) throw checkError;
        
        // If admin exists, don't create a new one
        if (existingAdmin && existingAdmin.length > 0) {
            console.log('Administrator already exists, skipping super admin creation');
            return;
        }
        
        // First create the user
        const { data, error } = await supabase.auth.signUp({
            email: 'prayerdiary@pech.co.uk',
            password: 'obfuscate',
            options: {
                data: {
                    full_name: 'Super Admin'
                },
                // Use the GitHub Pages URL for testing
                emailRedirectTo: 'https://prayer.pech.co.uk'
            }
        });
        
        if (error) throw error;
        
        console.log('Created super admin user');
        
        // The trigger will automatically create a profile,
        // but we need to update it as admin
        if (data && data.user) {
            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    user_role: 'Administrator',
                    approval_state: 'Approved',
                    prayer_calendar_editor: true,
                    prayer_update_editor: true,
                    urgent_prayer_editor: true,
                    full_name: 'Super Admin',  // Explicitly set the name
                    email: 'prayerdiary@pech.co.uk',  // Explicitly set the email
                    approval_admin: true  // Give super admin approval rights
                })
                .eq('id', data.user.id);
                
            if (updateError) throw updateError;
            
            console.log('Updated super admin profile');
        }
    } catch (error) {
        console.error('Error creating super admin:', error);
    }
}

// Notify admin about new user registration
async function notifyAdminsAboutNewUser(userName, userEmail) {
    if (!EMAIL_ENABLED) {
        console.log('Email notifications are disabled. Would have sent admin notification for new user:', userName);
        return false;
    }
    
    try {
        console.log('Attempting to find admin with approval rights...');
        
        // Fetch the first administrator with approval_admin flag set to TRUE
        const { data: admins, error: queryError } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('user_role', 'Administrator')
            .eq('approval_state', 'Approved')
            .eq('approval_admin', true);
            
        if (queryError) {
            console.error('Database query error:', queryError.message);
            return false;
        }
        
        // Check if we found any admins
        if (!admins || admins.length === 0) {
            console.log('No admin with approval_admin rights found to notify');
            return false;
        }
        
        // Get the first admin from the results
        const admin = admins[0];
        
        if (!admin.email) {
            console.log('Admin found but no email address available');
            return false;
        }
        
        console.log(`Found admin to notify about new user registration: ${admin.full_name} (${admin.email})`);
        
        // Create email content for admin notification
        const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #483D8B;">New User Registration</h2>
                <p>A new user has registered for Prayer Diary and is awaiting your approval:</p>
                
                <div style="background-color: #f5f5f5; border-left: 4px solid #483D8B; padding: 15px; margin: 15px 0;">
                    <p><strong>Name:</strong> ${userName}</p>
                    <p><strong>Email:</strong> ${userEmail}</p>
                    <p><strong>Status:</strong> Pending Approval</p>
                </div>
                
                <p>Please log in to the admin panel to review and approve this user.</p>
                
                <div style="margin: 25px 0;">
                    <a href="${window.location.origin}" 
                    style="background-color: #483D8B; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                        Go to Admin Panel
                    </a>
                </div>
                
                <hr style="border: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 12px; color: #666;">
                    This is an automated notification from Prayer Diary. Please do not reply to this email.
                </p>
            </div>
        `;
        
        console.log(`Attempting to send email to ${admin.email}...`);
        
        // Send the email using the Edge Function mechanism
        try {
            // Modified to not use notification logging
            const result = await sendEmail({
                to: admin.email,
                subject: `Prayer Diary: New User Registration - ${userName}`,
                html: htmlContent
                // userId and contentType params removed to avoid notification logging
            });
            
            if (result && result.success) {
                console.log(`Successfully sent notification email to approval admin: ${admin.full_name}`);
                return true;
            } else {
                const errorMsg = result && result.error ? result.error : 'Unknown email error';
                console.error(`Failed to send notification email: ${errorMsg}`);
                return false;
            }
        } catch (emailError) {
            console.error('Email sending error:', emailError.message || emailError);
            return false;
        }
    } catch (error) {
        // Improved error logging with more details
        console.error('Error in notifyAdminsAboutNewUser:', error.message || error);
        if (error.stack) console.error(error.stack);
        return false;
    }
}

// Open the password reset modal
function openPasswordResetModal() {
    // Close the auth modal first
    const authModal = bootstrap.Modal.getInstance(document.getElementById('auth-modal'));
    if (authModal) {
        authModal.hide();
    }
    
    // Reset the form and hide any previous messages
    document.getElementById('password-reset-form').reset();
    document.getElementById('password-reset-error').classList.add('d-none');
    document.getElementById('password-reset-success').classList.add('d-none');
    
    // Show the password reset modal
    const modal = new bootstrap.Modal(document.getElementById('password-reset-modal'));
    modal.show();
}

// Handle password reset form submission
async function handlePasswordReset(e) {
    e.preventDefault();
    
    const email = document.getElementById('reset-email').value.trim();
    const submitBtn = document.getElementById('reset-submit');
    const originalText = submitBtn.textContent;
    const errorElement = document.getElementById('password-reset-error');
    const successElement = document.getElementById('password-reset-success');
    
    // Hide previous messages
    errorElement.classList.add('d-none');
    successElement.classList.add('d-none');
    
    // Show loading state
    submitBtn.textContent = 'Sending...';
    submitBtn.disabled = true;
    
    try {
        // Use the Supabase resetPasswordForEmail function with a special reset page indicator
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            //redirectTo: window.location.origin + window.location.pathname + '?reset_password=true'
			redirectTo: 'https://prayer.pech.co.uk?reset_password=true'
        });
        
        if (error) throw error;
        
        // Show success message
        successElement.querySelector('p').textContent = 
            'Password reset link sent! Please check your email inbox and follow the instructions to reset your password.';
        successElement.classList.remove('d-none');
        
        // Hide the form
        document.getElementById('password-reset-form').classList.add('d-none');
        
        // Log the success (for debugging)
        console.log('Password reset email sent successfully to:', email);
        
    } catch (error) {
        // Show error message
        console.error('Error sending password reset email:', error);
        errorElement.querySelector('p').textContent = 
            `Failed to send reset email: ${error.message || 'Unknown error'}`;
        errorElement.classList.remove('d-none');
    } finally {
        // Restore button state
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

// Open the new password modal
function openNewPasswordModal() {
    // First, ensure the landing view is visible
    document.getElementById('landing-view').classList.remove('d-none');
    document.getElementById('app-views').classList.add('d-none');
    
    // Show an alert in the landing view to explain what's happening
    const statusMessage = document.getElementById('auth-status-message');
    if (statusMessage) {
        statusMessage.innerHTML = `
            <div class="alert alert-info mt-5">
                <h4 class="alert-heading">Password Reset Required</h4>
                <p>You've clicked a password reset link. Please set a new password to continue.</p>
            </div>
        `;
    }
    
    // Reset the form and hide any previous messages
    document.getElementById('new-password-form').reset();
    document.getElementById('new-password-error').classList.add('d-none');
    document.getElementById('new-password-success').classList.add('d-none');
    
    // Add event listeners for password validation
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-new-password');
    const passwordMatchMessage = document.querySelector('.password-match-message-reset');
    const submitBtn = document.getElementById('new-password-submit');
    
    // Set up form submission handler
    document.getElementById('new-password-form').removeEventListener('submit', handleNewPassword);
    document.getElementById('new-password-form').addEventListener('submit', handleNewPassword);
    
    // Set up password matching validation
    const validatePasswords = () => {
        const password = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        
        if (password && confirmPassword) {
            const passwordsMatch = password === confirmPassword;
            
            if (passwordsMatch) {
                passwordMatchMessage.classList.add('d-none');
                submitBtn.disabled = false;
            } else {
                passwordMatchMessage.classList.remove('d-none');
                submitBtn.disabled = true;
            }
        } else {
            // If either field is empty, hide the message
            passwordMatchMessage.classList.add('d-none');
            submitBtn.disabled = !(password && confirmPassword);
        }
    };
    
    newPasswordInput.addEventListener('input', validatePasswords);
    confirmPasswordInput.addEventListener('input', validatePasswords);
    
    // Force the modal to show and make it not dismissible
    const modalElement = document.getElementById('new-password-modal');
    modalElement.setAttribute('data-bs-backdrop', 'static');
    modalElement.setAttribute('data-bs-keyboard', 'false');
    
    // Remove the close button
    const closeButton = modalElement.querySelector('.btn-close');
    if (closeButton) {
        closeButton.style.display = 'none';
    }
    
    // Show the modal with high z-index to ensure it's on top
    const modal = new bootstrap.Modal(modalElement);
    modalElement.style.zIndex = '1060'; // Higher than the default 1050
    modal.show();
    
    // Log for debugging
    console.log("Password reset modal opened and displayed");
}

// Handle new password form submission
async function handleNewPassword(e) {
    e.preventDefault();
    
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-new-password').value;
    const submitBtn = document.getElementById('new-password-submit');
    const originalText = submitBtn.textContent;
    const errorElement = document.getElementById('new-password-error');
    const successElement = document.getElementById('new-password-success');
    
    // Hide previous messages
    errorElement.classList.add('d-none');
    successElement.classList.add('d-none');
    
    // Verify passwords match
    if (newPassword !== confirmPassword) {
        errorElement.querySelector('p').textContent = 'Passwords do not match. Please try again.';
        errorElement.classList.remove('d-none');
        return;
    }
    
    // Show loading state
    submitBtn.textContent = 'Updating...';
    submitBtn.disabled = true;
    
    try {
        // Use Supabase function to update the password
        const { error } = await supabase.auth.updateUser({
            password: newPassword
        });
        
        if (error) throw error;
        
        // Show success message
        successElement.querySelector('p').textContent = 
            'Your password has been successfully updated! You will now be redirected to the application.';
        successElement.classList.remove('d-none');
        
        // Hide the form
        document.getElementById('new-password-form').classList.add('d-none');
        
        // After successful password update, force sign out and reload
        setTimeout(async () => {
            try {
                // Sign out the user to clear the recovery session
                await supabase.auth.signOut({ scope: 'global' });
                
                // Close the new password modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('new-password-modal'));
                if (modal) {
                    modal.hide();
                }
                
                // Show success message directly in landing view
                const statusMessage = document.getElementById('auth-status-message');
                if (statusMessage) {
                    statusMessage.innerHTML = `
                        <div class="alert alert-success">
                            <h4 class="alert-heading">Password Updated Successfully!</h4>
                            <p>Your password has been updated. You can now log in with your new password.</p>
                            <div class="mt-3">
                                <button id="post-reset-login-btn" class="btn btn-primary">Log In Now</button>
                            </div>
                        </div>
                    `;
                    
                    // Add click handler for the button after adding it to DOM
                    setTimeout(() => {
                        const loginBtn = document.getElementById('post-reset-login-btn');
                        if (loginBtn) {
                            loginBtn.addEventListener('click', () => {
                                // Simple login button that just reloads the page - safer than trying to open the modal
                                console.log("Post-reset login button clicked, reloading page...");
                                window.location.reload();
                            });
                        }
                    }, 50);
                } else {
                    // If we can't find the status message element, just reload the page
                    console.log("Status message element not found, reloading page directly");
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                }
            } catch (signOutError) {
                console.error('Error signing out after password reset:', signOutError);
                // If sign out fails, just reload the page
                window.location.reload();
            }
        }, 3000);
        
    } catch (error) {
        // Show error message
        console.error('Error updating password:', error);
        errorElement.querySelector('p').textContent = 
            `Failed to update password: ${error.message || 'Unknown error'}`;
        errorElement.classList.remove('d-none');
    } finally {
        // Restore button state
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

// Helper functions
function getUserId() {
    return currentUser ? currentUser.id : null;
}

function isLoggedIn() {
    return !!currentUser;
}

function isAdmin() {
    return userProfile && userProfile.user_role === 'Administrator';
}

function isApproved() {
    return userProfile && userProfile.approval_state === 'Approved';
}

// Critical function to help other modules wait for auth to be stable
// before performing database operations
let isAuthBusy = false;

async function waitForAuthStability() {
    // If auth is currently busy processing events, wait
    if (isAuthBusy || tokenRefreshInProgress) {
        console.log('Auth is busy, waiting before database operation...');
        await new Promise(resolve => {
            const checkInterval = setInterval(() => {
                if (!isAuthBusy && !tokenRefreshInProgress) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        });
    }
    
    // Force a quick session check but use the cached session if available
    await getSessionSafely();
    return true;
}

// Make this function available globally
window.waitForAuthStability = waitForAuthStability;

function hasPermission(permission) {
    if (!userProfile) return false;
    
    // Admins have all permissions
    if (userProfile.user_role === 'Administrator') return true;
    
    // Check specific permission
    switch(permission) {
        case 'prayer_calendar_editor':
            return userProfile.prayer_calendar_editor;
        case 'prayer_update_editor':
            return userProfile.prayer_update_editor;
        case 'urgent_prayer_editor':
            return userProfile.urgent_prayer_editor;
        default:
            return false;
    }
}