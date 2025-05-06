// Supabase Edge Function for updating profiles and handling image uploads
// This function handles both profile data updates and optional image uploads
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
// Serve handles HTTP requests
Deno.serve(async (req)=>{
  // Enable CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }
  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({
        error: 'Method not allowed'
      }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    // Parse the request body
    const { profileData, imageData, userId, oldImageUrl// Optional URL of old image to delete
     } = await req.json();
    // Validate required fields
    if (!profileData || !userId) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: profileData, userId'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    // Initialize Supabase client with service role key for admin access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    // Track the final image URL (either existing or new)
    let finalImageUrl = profileData.profile_image_url || null;
    // Only process image if imageData is provided
    if (imageData) {
      console.log(`Processing image upload for user ${userId}`);
      try {
        // Decode base64 image data
        // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
        let base64Data = imageData;
        if (base64Data.includes(';base64,')) {
          base64Data = base64Data.split(';base64,')[1];
        }
        // Convert base64 to binary
        const binary = atob(base64Data);
        const array = new Uint8Array(binary.length);
        for(let i = 0; i < binary.length; i++){
          array[i] = binary.charCodeAt(i);
        }
        // Create file path with timestamp to ensure uniqueness
        const fileName = `${userId}_${Date.now()}.jpg`;
        const filePath = `profiles/${fileName}`;
        const bucketName = 'prayer-diary';
        // Upload the file to storage
        const { data, error } = await supabase.storage.from(bucketName).upload(filePath, array, {
          contentType: 'image/jpeg',
          upsert: true
        });
        if (error) {
          console.error('Image upload error:', error);
          throw new Error(`Image upload failed: ${error.message}`);
        }
        // Calculate expiry time: 20 years in seconds (approximate)
        const TWENTY_YEARS_IN_SECONDS = 60 * 60 * 24 * 365 * 20; // 631,152,000 seconds
        // Generate the signed URL with a very long expiry
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage.from(bucketName).createSignedUrl(filePath, TWENTY_YEARS_IN_SECONDS);
        if (signedUrlError) {
          console.error('Error generating signed URL:', signedUrlError);
          throw new Error(`Signed URL generation failed: ${signedUrlError.message}`);
        }
        // Use the signed URL instead of a public URL
        finalImageUrl = `${signedUrlData.signedUrl}`;
        console.log(`New image uploaded, signed URL created with 20-year expiry`);
        console.log(finalImageUrl);
        // Delete old image if provided and different from the new one
        if (oldImageUrl && oldImageUrl !== finalImageUrl) {
          try {
            // Extract the path from the URL - need to handle signed URLs differently
            const oldFilePath = extractFilenameFromURL(oldImageUrl);
            if (oldFilePath) {
              const { error: deleteError } = await supabase.storage.from(bucketName).remove([
                oldFilePath
              ]);
              if (deleteError) {
                console.warn(`Could not delete old image: ${deleteError.message}`);
              } else {
                console.log(`Old image deleted: ${oldFilePath}`);
              }
            }
          } catch (deleteError) {
            console.warn('Error during old image cleanup:', deleteError);
          // Continue despite deletion error
          }
        }
      } catch (imageError) {
        console.error('Image processing error:', imageError);
      // Don't fail the whole operation, just log and continue with profile update
      // The profile will be updated without changing the image
      }
    }
    // Update the profile with the final image URL (new or existing)
    const updatedProfileData = {
      ...profileData,
      profile_image_url: finalImageUrl,
      updated_at: new Date().toISOString()
    };
    console.log(`Updating profile for user ${userId}`);
    // Update the profile in the database
    const { data: profile, error: profileError } = await supabase.from('profiles').update(updatedProfileData).eq('id', userId).select().single();
    if (profileError) {
      console.error('Profile update error:', profileError);
      return new Response(JSON.stringify({
        error: `Profile update failed: ${profileError.message}`
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    // Return success response with the updated profile
    return new Response(JSON.stringify({
      success: true,
      profile: profile,
      imageUrl: finalImageUrl
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err) {
    console.error('Server error:', err);
    return new Response(JSON.stringify({
      error: `Server error: ${err.message}`
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
});
// Helper function to extract filename from URL 
// Updated to handle both public URLs and signed URLs
function extractFilenameFromURL(url) {
  if (!url) return null;
  try {
    // Extract the path component from public URL
    const publicMatches = url.match(/\/storage\/v1\/object\/public\/prayer-diary\/([^?]+)/);
    if (publicMatches && publicMatches[1]) {
      return publicMatches[1]; // This is the path relative to the bucket
    }
    // Extract from signed URL
    const signedMatches = url.match(/\/storage\/v1\/object\/sign\/prayer-diary\/([^?]+)/);
    if (signedMatches && signedMatches[1]) {
      return signedMatches[1];
    }
    // Handle another format of signed URL that might be encountered
    const otherSignedMatches = url.match(/\/storage\/v1\/object\/prayer-diary\/([^?]+)/);
    if (otherSignedMatches && otherSignedMatches[1]) {
      return otherSignedMatches[1];
    }
    console.warn("Could not extract filename from URL:", url);
    return null;
  } catch (error) {
    console.error('Error extracting filename from URL:', error);
    return null;
  }
}
