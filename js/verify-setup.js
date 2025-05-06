// Prayer Diary Setup Verification Tool
// This script helps verify if your setup is correct
// Run this in the browser console after updating config.js

async function verifyPrayerDiarySetup() {
    console.log("Prayer Diary Setup Verification Tool");
    console.log("=====================================");
    
    // Check if config variables are set
    console.log("\n1. Checking configuration variables...");
    if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
        console.error("❌ ERROR: Supabase configuration not set! Update js/config.js with your actual Supabase URL and anon key.");
        return;
    } else {
        console.log("✅ Supabase configuration appears to be set.");
    }
    
    // Check Supabase connection
    console.log("\n2. Testing Supabase connection...");
    try {
        const { data, error } = await supabase.from('profiles').select('count').limit(1);
        if (error) throw error;
        console.log("✅ Successfully connected to Supabase!");
    } catch (error) {
        console.error("❌ ERROR: Could not connect to Supabase:", error.message);
        console.log("   Check that your URL and anon key are correct and that the database is accessible.");
        return;
    }
    
    // Check if required tables exist
    console.log("\n3. Checking if required tables exist...");
    try {
        const tables = [
            'profiles',
            'prayer_calendar',
            'prayer_updates',
            'urgent_prayers',
            'notification_logs'
        ];
        
        let missingTables = [];
        
        for (const table of tables) {
            const { data, error } = await supabase.from(table).select('count').limit(1);
            if (error && error.code === '42P01') {  // PostgreSQL code for undefined_table
                missingTables.push(table);
            }
        }
        
        if (missingTables.length > 0) {
            console.error(`❌ ERROR: Missing tables: ${missingTables.join(', ')}`);
            console.log("   Make sure you've run the SQL schema in db/schema.sql.");
            return;
        } else {
            console.log("✅ All required tables exist.");
        }
    } catch (error) {
        console.error("❌ ERROR checking tables:", error.message);
        return;
    }
    
    // Check storage buckets
    console.log("\n4. Checking storage buckets...");
    try {
        const { data, error } = await supabase.storage.getBucket('prayer-diary');
        if (error) {
            console.error("❌ ERROR: 'prayer-diary' storage bucket does not exist or is not accessible.");
            console.log("   Create this bucket in your Supabase storage.");
            return;
        } else {
            console.log("✅ 'prayer-diary' storage bucket exists.");
        }
    } catch (error) {
        console.error("❌ ERROR checking storage buckets:", error.message);
        return;
    }
    
    // Check for admin user
    console.log("\n5. Checking for admin user...");
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_role', 'Administrator')
            .limit(1);
            
        if (error) throw error;
        
        if (!data || data.length === 0) {
            console.warn("⚠️ WARNING: No administrator user found.");
            console.log("   The app will try to create one when first accessed, or you can manually create one.");
        } else {
            console.log("✅ Administrator user exists.");
        }
    } catch (error) {
        console.error("❌ ERROR checking for admin user:", error.message);
        return;
    }
    
    // Check notification services
    console.log("\n6. Checking notification services...");
    console.log(`   Email notifications: ${EMAIL_ENABLED ? '✅ Enabled' : '⚠️ Disabled'}`);
    console.log(`   Twilio notifications: ${TWILIO_ENABLED ? '✅ Enabled' : '⚠️ Disabled'}`);
    console.log(`   Push notifications: ${PUSH_NOTIFICATION_ENABLED ? '✅ Enabled' : '⚠️ Disabled'}`);
    
    if (!EMAIL_ENABLED && !TWILIO_ENABLED && !PUSH_NOTIFICATION_ENABLED) {
        console.log("   ℹ️ All notification services are disabled. This is fine for initial setup.");
        console.log("      See the documentation for instructions on enabling notifications.");
    }
    
    // Final verdict
    console.log("\n7. Setup verification complete.");
    console.log("   ✅ Your Prayer Diary app appears to be properly configured!");
    console.log("   Try creating an account and logging in to fully test the functionality.");
    console.log("\nFor more information, refer to the documentation in the docs folder.");
}

// To run this verification:
// 1. Open your Prayer Diary app in a web browser
// 2. Open the browser's developer console (F12 or Ctrl+Shift+I or Cmd+Option+I)
// 3. Paste the function above into the console
// 4. Type verifyPrayerDiarySetup() and press Enter
// 5. Follow any instructions to fix issues
