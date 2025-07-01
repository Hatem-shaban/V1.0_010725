const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers };
    }

    try {
        // Validate environment variables inside the handler
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
            throw new Error('Missing Supabase configuration');
        }

        if (!process.env.LEMONSQUEEZY_API_KEY) {
            throw new Error('Missing LemonSqueezy API key - please set LEMONSQUEEZY_API_KEY in Netlify environment');
        }

        if (!process.env.LEMONSQUEEZY_STORE_ID) {
            throw new Error('Missing LemonSqueezy Store ID - please set LEMONSQUEEZY_STORE_ID in Netlify environment');
        }

        // Initialize Supabase with service role key to bypass RLS
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
            {
                auth: {
                    persistSession: false
                }
            }
        );

        if (event.httpMethod !== 'POST') {
            throw new Error('Method not allowed');
        }

        // Log environment variables status (without exposing actual values)
        console.log('Environment check:', {
            hasSupabaseUrl: !!process.env.SUPABASE_URL,
            hasSupabaseAnonKey: !!process.env.SUPABASE_ANON_KEY,
            hasLemonSqueezyApiKey: !!process.env.LEMONSQUEEZY_API_KEY,
            hasLemonSqueezyStoreId: !!process.env.LEMONSQUEEZY_STORE_ID,
            storeIdValue: process.env.LEMONSQUEEZY_STORE_ID // Safe to log the store ID
        });

        const { customerEmail, userId, variantId } = JSON.parse(event.body);

        if (!customerEmail || !userId) {
            throw new Error('Missing required fields');
        }

        // Verify user exists with retry logic for new users
        let existingUser, userError;
        const maxUserRetries = 3;
        
        for (let userRetry = 0; userRetry < maxUserRetries; userRetry++) {
            const result = await supabase
                .from('users')
                .select('id, email, subscription_status')
                .eq('id', userId)
                .eq('email', customerEmail)
                .maybeSingle();
            
            existingUser = result.data;
            userError = result.error;
            
            if (existingUser) {
                console.log(`User found on attempt ${userRetry + 1}`);
                break;
            }
            
            if (userRetry < maxUserRetries - 1) {
                console.log(`User not found on attempt ${userRetry + 1}, retrying in ${(userRetry + 1) * 500}ms...`);
                await new Promise(resolve => setTimeout(resolve, (userRetry + 1) * 500));
            }
        }

        if (userError || !existingUser) {
            console.error('User verification error after retries:', userError || 'User not found');
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'User not found - please try again in a moment' })
            };
        }

        // Determine plan type based on the variant ID
        let planType;
        switch(variantId) {
            case '877610':
                planType = 'lifetime';
                break;
            case '877609':
                planType = 'starter';
                break;
            case '877605':
                planType = 'pro';
                break;
            default:
                planType = 'subscription'; // Fallback
        }

        // Create LemonSqueezy checkout with minimal, correct structure
        const checkoutData = {
            data: {
                type: 'checkouts',
                attributes: {
                    checkout_data: {
                        email: customerEmail,
                        custom: {
                            user_id: userId
                        }
                    }
                },
                relationships: {
                    store: {
                        data: {
                            type: 'stores',
                            id: process.env.LEMONSQUEEZY_STORE_ID
                        }
                    },
                    variant: {
                        data: {
                            type: 'variants',
                            id: variantId
                        }
                    }
                }
            }
        };

        console.log('Making LemonSqueezy API call with variant:', variantId);
        console.log('Store ID:', process.env.LEMONSQUEEZY_STORE_ID);

        const response = await axios.post('https://api.lemonsqueezy.com/v1/checkouts', checkoutData, {
            headers: {
                'Accept': 'application/vnd.api+json',
                'Content-Type': 'application/vnd.api+json',
                'Authorization': `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`
            }
        });

        console.log('LemonSqueezy API response status:', response.status);
        console.log('LemonSqueezy API response data:', JSON.stringify(response.data, null, 2));

        const checkout = response.data.data;

        // Update user status with retry logic
        let retryCount = 0;
        const maxRetries = 3;
        let updateError;

        while (retryCount < maxRetries) {
            const { error } = await supabase
                .from('users')
                .update({
                    subscription_status: 'pending_activation',
                    lemonsqueezy_checkout_id: checkout.id,
                    updated_at: new Date().toISOString(),
                    plan_type: planType
                })
                .eq('id', userId);

            if (!error) {
                updateError = null;
                break;
            }

            updateError = error;
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }

        if (updateError) {
            console.error('Error updating user status after retries:', updateError);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                checkout_url: checkout.attributes.url,
                checkout_id: checkout.id,
                userId: userId,
                success: true
            })
        };

    } catch (error) {
        console.error('Create LemonSqueezy checkout error:', error);
        
        // Handle different types of errors
        let errorMessage = error.message;
        let statusCode = 500;
        
        if (error.response) {
            // LemonSqueezy API error
            statusCode = error.response.status;
            errorMessage = error.response.data?.errors?.[0]?.detail || error.response.data?.message || error.message;
        } else if (error.message.includes('Missing')) {
            // Configuration error
            statusCode = 500;
            errorMessage = 'Server configuration error';
        }
        
        return {
            statusCode,
            headers,
            body: JSON.stringify({ 
                error: errorMessage,
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            })
        };
    }
};
