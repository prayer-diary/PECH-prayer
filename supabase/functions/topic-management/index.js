// Supabase Edge Function for Topic Management
// File: topic-management.js

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Serve handles HTTP requests
Deno.serve(async (req) => {
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
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // Parse the request body
    const { action, data, userId } = await req.json();

    // Validate required fields
    if (!action || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: action, userId' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // Initialize Supabase client with service role key for admin access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Validate the user session to ensure the request is legitimate
    const { data: authData, error: authError } = await supabase.auth.getUser(
      req.headers.get('Authorization')?.split('Bearer ')[1] || ''
    );
    
    if (authError || !authData.user || authData.user.id !== userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // Process the request based on the action
    let result;
    
    switch (action) {
      case 'saveTopic':
        result = await saveTopic(supabase, data, userId);
        break;
      
      case 'deleteTopic':
        result = await deleteTopic(supabase, data, userId);
        break;
        
      case 'assignTopicToDay':
        result = await assignTopicToDay(supabase, data, userId);
        break;
        
      case 'updateTopicMonths':
        result = await updateTopicMonths(supabase, data, userId);
        break;
        
      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { 
            status: 400, 
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
    }

    // Return the result
    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  } catch (err) {
    console.error('Server error:', err);
    return new Response(
      JSON.stringify({ error: `Server error: ${err.message}` }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
});

// Helper function to save or update a topic with optional image
async function saveTopic(supabase, data, userId) {
  try {
    const { topicId, topicTitle, topicText, imageBase64, fileName, existingImageUrl } = data;
    const isNewTopic = !topicId;
    
    // Prepare topic data
    const topicData = {
      topic_title: topicTitle,
      topic_text: topicText,
      // Keep the existing URL if no new image is provided
      topic_image_url: existingImageUrl || null  
    };
    
    // Process image if provided
    if (imageBase64 && fileName) {
      // Decode base64 image
      const base64Data = imageBase64.split(',')[1];
      const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      
      // Create sanitized file name
      const sanitizedFileName = `topic_${Date.now()}_${fileName.replace(/\s+/g, '_')}`;
      
      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('prayer-diary')
        .upload(`topic_images/${sanitizedFileName}`, binaryData, {
          contentType: getContentType(fileName),
          cacheControl: '3600',
          upsert: false
        });
        
      if (uploadError) throw uploadError;
      
      // Get the public URL with a 10-year expiry
      const tenYearsInSeconds = 60 * 60 * 24 * 365 * 10;
      const { data: urlData, error: urlError } = await supabase.storage
        .from('prayer-diary')
        .createSignedUrl(`topic_images/${sanitizedFileName}`, tenYearsInSeconds);
        
      if (urlError) throw urlError;
      
      if (!urlData || !urlData.signedUrl) {
        throw new Error('Failed to get signed URL');
      }
      
      // Update the topic data with the new image URL
      topicData.topic_image_url = urlData.signedUrl;
    }
    
    let result;
    
    if (isNewTopic) {
      // Create new topic
      topicData.created_by = userId;
      topicData.pray_day = 0; // Unassigned by default
      topicData.pray_months = 0; // All months by default
      
      result = await supabase
        .from('prayer_topics')
        .insert(topicData)
        .select();
    } else {
      // Update existing topic
      topicData.updated_at = new Date().toISOString();
      
      result = await supabase
        .from('prayer_topics')
        .update(topicData)
        .eq('id', topicId)
        .select();
    }
    
    if (result.error) throw result.error;
    
    return { 
      success: true, 
      data: result.data[0],
      message: isNewTopic ? 'Topic created successfully' : 'Topic updated successfully'
    };
  } catch (error) {
    console.error('Error in saveTopic:', error);
    return { success: false, error: error.message };
  }
}

// Helper function to delete a topic
async function deleteTopic(supabase, data, userId) {
  try {
    const { topicId } = data;
    
    // Get the topic to check if it has an image
    const { data: topic, error: getError } = await supabase
      .from('prayer_topics')
      .select('topic_image_url')
      .eq('id', topicId)
      .single();
      
    if (getError) throw getError;
    
    // Delete the topic from the database
    const { error: deleteError } = await supabase
      .from('prayer_topics')
      .delete()
      .eq('id', topicId);
      
    if (deleteError) throw deleteError;
    
    // If the topic had an image, try to delete it too
    // Note: This is best-effort and won't block the operation if it fails
    if (topic && topic.topic_image_url) {
      try {
        // Extract the file path from the URL
        const url = new URL(topic.topic_image_url);
        const pathParts = url.pathname.split('/');
        const bucketName = 'prayer-diary';
        const fileName = pathParts[pathParts.length - 1];
        
        if (fileName) {
          await supabase.storage
            .from(bucketName)
            .remove([`topic_images/${fileName}`]);
        }
      } catch (imageError) {
        console.warn('Could not delete image file, but topic was deleted:', imageError);
      }
    }
    
    return { success: true, message: 'Topic deleted successfully' };
  } catch (error) {
    console.error('Error in deleteTopic:', error);
    return { success: false, error: error.message };
  }
}

// Helper function to assign a topic to a day
async function assignTopicToDay(supabase, data, userId) {
  try {
    const { topicId, day } = data;
    
    if (isNaN(day) || day < 1 || day > 31) {
      return { success: false, error: 'Invalid day' };
    }
    
    const { error } = await supabase
      .from('prayer_topics')
      .update({ pray_day: day })
      .eq('id', topicId);
      
    if (error) throw error;
    
    return { success: true, message: `Topic assigned to day ${day}` };
  } catch (error) {
    console.error('Error in assignTopicToDay:', error);
    return { success: false, error: error.message };
  }
}

// Helper function to update topic months settings
async function updateTopicMonths(supabase, data, userId) {
  try {
    const { topicId, months } = data;
    
    if (![0, 1, 2].includes(months)) {
      return { success: false, error: 'Invalid months value' };
    }
    
    const { error } = await supabase
      .from('prayer_topics')
      .update({ pray_months: months })
      .eq('id', topicId);
      
    if (error) throw error;
    
    return { success: true, message: 'Month settings updated' };
  } catch (error) {
    console.error('Error in updateTopicMonths:', error);
    return { success: false, error: error.message };
  }
}

// Helper function to determine content type from filename
function getContentType(fileName) {
  const extension = fileName.split('.').pop().toLowerCase();
  
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}