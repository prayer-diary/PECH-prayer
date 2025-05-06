// Advanced Auth Diagnostic Tool for Supabase

/**
 * This function runs a series of tests to pinpoint auth issues:
 * 1. Tests basic auth health
 * 2. Tests actual sign-up with various options
 * 3. Tests trigger behavior directly
 */
async function runAuthDiagnostics() {
    const resultsDiv = document.createElement('div');
    resultsDiv.className = 'auth-diagnostic-results';
    resultsDiv.style.cssText = 'position:fixed; top:10px; right:10px; width:600px; max-height:90vh; overflow-y:auto; background:#fff; border:1px solid #ccc; padding:15px; z-index:9999; box-shadow:0 0 20px rgba(0,0,0,0.2); border-radius:5px;';
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.className = 'btn btn-sm btn-outline-secondary float-end';
    closeBtn.onclick = () => document.body.removeChild(resultsDiv);
    
    const heading = document.createElement('h5');
    heading.textContent = 'Supabase Auth Diagnostics';
    
    const results = document.createElement('div');
    results.className = 'results-content mt-3';
    
    resultsDiv.appendChild(closeBtn);
    resultsDiv.appendChild(heading);
    resultsDiv.appendChild(results);
    document.body.appendChild(resultsDiv);
    
    results.innerHTML = '<div class="alert alert-info">Running diagnostics...</div>';
    
    try {
        // PART 1: Basic connectivity tests
        await testBasicConnectivity(results);
        
        // PART 2: Auth signup tests with various options
        await testAuthSignup(results);
        
        // PART 3: Test database trigger
        await testDatabaseTrigger(results);
        
    } catch (err) {
        results.innerHTML += `<div class="alert alert-danger">Diagnostic process error: ${err.message}</div>`;
    }
}

async function testBasicConnectivity(results) {
    results.innerHTML += '<h5 class="mt-3">1. Basic Connectivity Tests</h5>';
    
    // Test 1.1: Supabase Config
    const configTest = document.createElement('div');
    configTest.className = 'alert alert-secondary mb-2';
    configTest.innerHTML = '<b>Supabase Configuration:</b><br>';
    configTest.innerHTML += `URL: ${SUPABASE_URL ? '✓ Set' : '❌ Missing'}<br>`;
    configTest.innerHTML += `API Key: ${SUPABASE_ANON_KEY ? '✓ Set' : '❌ Missing'}<br>`;
    
    // URL format check
    if (SUPABASE_URL) {
        if (SUPABASE_URL.trim() !== SUPABASE_URL) {
            configTest.innerHTML += `⚠️ URL has leading/trailing whitespace!<br>`;
        }
        if (!SUPABASE_URL.startsWith('https://')) {
            configTest.innerHTML += `⚠️ URL should start with https://<br>`;
        }
    }
    
    results.appendChild(configTest);
    
    // Test 1.2: Database Query
    try {
        const queryTest = document.createElement('div');
        const startTime = Date.now();
        const { count, error } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });
        const endTime = Date.now();
        
        if (error) {
            queryTest.className = 'alert alert-danger mb-2';
            queryTest.innerHTML = `<b>Database Query:</b> Failed<br>Error: ${error.message}<br>Code: ${error.code || 'n/a'}`;
        } else {
            queryTest.className = 'alert alert-success mb-2';
            queryTest.innerHTML = `<b>Database Query:</b> Success<br>Profiles: ${count || 0}<br>Response Time: ${endTime - startTime}ms`;
        }
        results.appendChild(queryTest);
    } catch (err) {
        const queryTest = document.createElement('div');
        queryTest.className = 'alert alert-danger mb-2';
        queryTest.innerHTML = `<b>Database Query:</b> Exception<br>${err.message}`;
        results.appendChild(queryTest);
    }
    
    // Test 1.3: Auth Service Health
    try {
        const authTest = document.createElement('div');
        const startTime = Date.now();
        const { data, error } = await supabase.auth.getSession();
        const endTime = Date.now();
        
        if (error) {
            authTest.className = 'alert alert-danger mb-2';
            authTest.innerHTML = `<b>Auth Service:</b> Failed<br>Error: ${error.message}`;
        } else {
            authTest.className = 'alert alert-success mb-2';
            authTest.innerHTML = `<b>Auth Service:</b> Responding<br>Session: ${data.session ? 'Active' : 'None'}<br>Response Time: ${endTime - startTime}ms`;
        }
        results.appendChild(authTest);
    } catch (err) {
        const authTest = document.createElement('div');
        authTest.className = 'alert alert-danger mb-2';
        authTest.innerHTML = `<b>Auth Service:</b> Exception<br>${err.message}`;
        results.appendChild(authTest);
    }
}

async function testAuthSignup(results) {
    results.innerHTML += '<h5 class="mt-3">2. Auth Signup Tests</h5>';
    
    // Generate test data
    const timestamp = Date.now();
    const rand = Math.random().toString(36).substring(2, 8);
    const baseEmail = `test-${timestamp}-${rand}`;
    
    // Test 2.1: Minimal signup
    const test1 = document.createElement('div');
    test1.className = 'alert alert-secondary mb-2';
    test1.innerHTML = '<b>Test 1: Minimal Signup</b><br>';
    test1.innerHTML += `Email: ${baseEmail}-1@example.com<br>`;
    results.appendChild(test1);
    
    try {
        const { data, error } = await supabase.auth.signUp({
            email: `${baseEmail}-1@example.com`,
            password: 'Test123!@#'
        });
        
        if (error) {
            test1.className = 'alert alert-danger mb-2';
            test1.innerHTML += `Result: Failed<br>Error: ${error.message}<br>Code: ${error.code || 'n/a'}<br>Status: ${error.status}`;
            if (error.status === 500) {
                test1.innerHTML += `<br><b>Analysis:</b> 500 error indicates a server-side issue in Supabase or a database trigger error`;
            }
        } else {
            test1.className = 'alert alert-success mb-2';
            test1.innerHTML += `Result: Success<br>User ID: ${data?.user?.id || 'n/a'}`;
        }
    } catch (err) {
        test1.className = 'alert alert-danger mb-2';
        test1.innerHTML += `Result: Exception<br>${err.message}`;
    }
    
    // Test 2.2: Signup with metadata
    const test2 = document.createElement('div');
    test2.className = 'alert alert-secondary mb-2';
    test2.innerHTML = '<b>Test 2: Signup with Metadata</b><br>';
    test2.innerHTML += `Email: ${baseEmail}-2@example.com<br>`;
    results.appendChild(test2);
    
    try {
        const { data, error } = await supabase.auth.signUp({
            email: `${baseEmail}-2@example.com`,
            password: 'Test123!@#',
            options: {
                data: {
                    full_name: 'Test User'
                }
            }
        });
        
        if (error) {
            test2.className = 'alert alert-danger mb-2';
            test2.innerHTML += `Result: Failed<br>Error: ${error.message}<br>Code: ${error.code || 'n/a'}<br>Status: ${error.status}`;
            
            // Compare with first test to isolate metadata issue
            if (test1.className.includes('success') && test2.className.includes('danger')) {
                test2.innerHTML += `<br><b>Analysis:</b> Metadata appears to be causing the issue`;
            }
        } else {
            test2.className = 'alert alert-success mb-2';
            test2.innerHTML += `Result: Success<br>User ID: ${data?.user?.id || 'n/a'}`;
        }
    } catch (err) {
        test2.className = 'alert alert-danger mb-2';
        test2.innerHTML += `Result: Exception<br>${err.message}`;
    }
    
    // Test 2.3: Signup with metadata and redirect
    const test3 = document.createElement('div');
    test3.className = 'alert alert-secondary mb-2';
    test3.innerHTML = '<b>Test 3: Signup with Metadata & Redirect</b><br>';
    test3.innerHTML += `Email: ${baseEmail}-3@example.com<br>`;
    results.appendChild(test3);
    
    try {
        const { data, error } = await supabase.auth.signUp({
            email: `${baseEmail}-3@example.com`,
            password: 'Test123!@#',
            options: {
                data: {
                    full_name: 'Test User'
                },
                emailRedirectTo: window.location.origin
            }
        });
        
        if (error) {
            test3.className = 'alert alert-danger mb-2';
            test3.innerHTML += `Result: Failed<br>Error: ${error.message}<br>Code: ${error.code || 'n/a'}<br>Status: ${error.status}`;
            
            // Compare with second test to isolate redirect issue
            if (test2.className.includes('success') && test3.className.includes('danger')) {
                test3.innerHTML += `<br><b>Analysis:</b> EmailRedirectTo appears to be causing the issue`;
            }
        } else {
            test3.className = 'alert alert-success mb-2';
            test3.innerHTML += `Result: Success<br>User ID: ${data?.user?.id || 'n/a'}`;
        }
    } catch (err) {
        test3.className = 'alert alert-danger mb-2';
        test3.innerHTML += `Result: Exception<br>${err.message}`;
    }
}

async function testDatabaseTrigger(results) {
    results.innerHTML += '<h5 class="mt-3">3. Database Trigger Test</h5>';
    
    // Test 3.1: Direct Profile Insert
    const test1 = document.createElement('div');
    test1.className = 'alert alert-secondary mb-2';
    test1.innerHTML = '<b>Test: Direct Profile Insert</b><br>';
    
    // Create fake UUID
    const fakeUuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
    
    test1.innerHTML += `Testing with fake UUID: ${fakeUuid}<br>`;
    results.appendChild(test1);
    
    try {
        const { data, error } = await supabase
            .from('profiles')
            .insert({
                id: fakeUuid,
                full_name: 'Test User',
                user_role: 'User',
                approval_state: 'Pending',
                profile_set: false,
                prayer_update_notification_method: 'email',
                urgent_prayer_notification_method: 'email',
                gdpr_accepted: false
            });
        
        if (error) {
            test1.className = 'alert alert-danger mb-2';
            test1.innerHTML += `Result: Failed<br>Error: ${error.message}<br>Code: ${error.code || 'n/a'}<br>Status: ${error.status}`;
            
            if (error.message.includes('foreign key constraint')) {
                test1.innerHTML += `<br><b>Analysis:</b> The error confirms foreign key constraints are working. This is expected for this test.`;
            } else {
                test1.innerHTML += `<br><b>Analysis:</b> Unexpected error type. There might be an issue with the profiles table structure.`;
            }
        } else {
            test1.className = 'alert alert-warning mb-2';
            test1.innerHTML += `Result: Success (Unexpected!)<br>Direct insert without a real auth user worked, which suggests foreign key constraints might be disabled.`;
        }
    } catch (err) {
        test1.className = 'alert alert-danger mb-2';
        test1.innerHTML += `Result: Exception<br>${err.message}`;
    }
    
    // Overall analysis summary
    const summary = document.createElement('div');
    summary.className = 'alert alert-info mt-3';
    summary.innerHTML = '<h5>Analysis Summary</h5>';
    
    // Collect results from all tests
    const allTests = results.querySelectorAll('.alert');
    const dbConnectivity = Array.from(allTests).find(el => el.innerHTML.includes('Database Query:'));
    const authService = Array.from(allTests).find(el => el.innerHTML.includes('Auth Service:'));
    const minimalSignup = Array.from(allTests).find(el => el.innerHTML.includes('Test 1: Minimal Signup'));
    
    if (dbConnectivity?.className.includes('success') && minimalSignup?.className.includes('danger')) {
        summary.innerHTML += `<p>The database connection is working correctly, but user signup is failing with 500 errors.</p>`;
        
        if (authService?.className.includes('success')) {
            summary.innerHTML += `<p>Given that both database and auth service are responding, but signup fails with a 500 error, the most likely causes are:</p>
            <ol>
                <li><b>Database Trigger Error:</b> The 'handle_new_user' trigger function might be failing</li>
                <li><b>Schema Mismatch:</b> The profiles table structure in your database doesn't match what the trigger expects</li>
                <li><b>Permissions Issue:</b> RLS policies might be preventing the trigger from creating profiles</li>
            </ol>
            
            <p><b>Recommended Action:</b></p>
            <ol>
                <li>Log into Supabase and check the SQL Editor</li>
                <li>Run: <code>SELECT routine_definition FROM information_schema.routines WHERE routine_name = 'handle_new_user';</code></li>
                <li>Compare the trigger function with your schema.sql file</li>
                <li>Make sure all required columns are included in both places</li>
            </ol>`;
        } else {
            summary.innerHTML += `<p>The auth service appears to be having issues. This might be a temporary Supabase problem or configuration error.</p>`;
        }
    }
    
    results.appendChild(summary);
}

// Add a button to run diagnostics
function addDiagnosticButton() {
    const btn = document.createElement('button');
    btn.textContent = 'Run Auth Diagnostics';
    btn.className = 'btn btn-warning position-fixed';
    btn.style.cssText = 'bottom:20px; right:20px; z-index:9999;';
    btn.onclick = runAuthDiagnostics;
    document.body.appendChild(btn);
}

// Add button when page loads
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    addDiagnosticButton();
} else {
    document.addEventListener('DOMContentLoaded', addDiagnosticButton);
}
