// Use newer OpenAI SDK version
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

// OpenAI client initialization using environment variable
// The API key is securely stored in Netlify environment variables
const openai = new OpenAI({
    // apiKey will automatically use process.env.OPENAI_API_KEY if not specified
    timeout: 30000, // 30 seconds timeout
    maxRetries: 3   // Automatic retries on certain errors
});

// Initialize Supabase with service role key to bypass RLS
// Use service role key for server operations that need to bypass RLS policies
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(
    process.env.SUPABASE_URL,
    serviceKey,
    {
        auth: {
            persistSession: false
        }
    }
);

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers };
    }

    try {        if (event.httpMethod !== 'POST') {
            throw new Error('Method not allowed');
        }

        const { operation, params, userId } = JSON.parse(event.body);

        if (!operation) {
            throw new Error('Operation type is required');
        }        // Validate required parameters for each operation
        const requiredParams = {
            generateBusinessNames: ['industry', 'keywords'],
            generateEmailTemplates: ['purpose', 'business', 'sequence'],
            generateLogo: ['style', 'industry'],
            generatePitchDeck: ['type', 'industry'],
            analyzeMarket: ['industry', 'region'],
            generateContentCalendar: ['business', 'audience'],
            generateLegalDocs: ['business', 'docType'],
            generateFinancials: ['business', 'timeframe']
        };
        
        // Add the keywordsMore parameter to params if provided
        
        // Check if required parameters are provided
        if (requiredParams[operation]) {
            const missing = requiredParams[operation].filter(param => !params || params[param] === undefined);
            if (missing.length > 0) {
                throw new Error(`Missing required parameters: ${missing.join(', ')} for operation ${operation}`);
            }
        }

        let systemPrompt;
        let userPrompt;        switch (operation) {
            case 'generateBusinessNames':
                systemPrompt = "You are a creative business naming expert.";
                userPrompt = `Generate 5 creative and unique business names for a ${params.industry} startup. Consider these keywords: ${params.keywords}. ${params.keywordsMore ? 'Additional keywords/concepts to consider: ' + params.keywordsMore : ''} ${params.additionalContext ? 'Additional context: ' + params.additionalContext : ''} Format the response as a numbered list.`;
                break;
            case 'generateEmailTemplates':
                systemPrompt = "You are a professional email writing expert.";
                if (params.purpose) {
                    userPrompt = `Write a professional email template for ${params.purpose}. ${params.keywordsMore ? 'Additional specifications: ' + params.keywordsMore : ''} ${params.additionalContext ? 'Additional context: ' + params.additionalContext : ''} Include subject line and body.`;
                } else {
                    userPrompt = `Write a professional email ${params.sequence} for ${params.business}. ${params.keywordsMore ? 'Additional specifications: ' + params.keywordsMore : ''} ${params.additionalContext ? 'Additional context: ' + params.additionalContext : ''} Include subject line and body.`;
                }
                break;
            case 'generateLogo':
                systemPrompt = "You are a logo design expert.";
                userPrompt = `Describe a professional logo design concept for a ${params.industry} company with a ${params.style} style. ${params.keywordsMore ? 'Additional design elements to consider: ' + params.keywordsMore : ''} ${params.additionalContext ? 'Additional context: ' + params.additionalContext : ''} Include colors, shapes, and typography recommendations.`;
                break;
            case 'generatePitchDeck':
                systemPrompt = "You are a pitch deck creation expert.";
                userPrompt = `Outline a compelling ${params.type} pitch deck structure for a ${params.industry} startup. ${params.keywordsMore ? 'Additional specifications: ' + params.keywordsMore : ''} ${params.additionalContext ? 'Additional context: ' + params.additionalContext : ''} Include key sections and content recommendations.`;
                break;
            case 'analyzeMarket':
                systemPrompt = "You are a market analysis expert.";
                userPrompt = `Provide a brief market analysis for the ${params.industry} industry in the ${params.region} region. ${params.keywordsMore ? 'Additional factors to consider: ' + params.keywordsMore : ''} ${params.additionalContext ? 'Additional context: ' + params.additionalContext : ''} Include key trends, opportunities, and challenges.`;
                break;
            case 'generateContentCalendar':
                systemPrompt = "You are a content marketing expert.";
                userPrompt = `Create a 30-day content calendar for ${params.business} targeting ${params.audience}. ${params.keywordsMore ? 'Additional content ideas: ' + params.keywordsMore : ''} ${params.additionalContext ? 'Additional context: ' + params.additionalContext : ''} Include content types, topics, and posting frequency.`;
                break;
            case 'generateLegalDocs':
                systemPrompt = "You are a legal document expert.";
                userPrompt = `Provide a template for a ${params.docType} for ${params.business}. ${params.keywordsMore ? 'Additional clauses/sections to include: ' + params.keywordsMore : ''} ${params.additionalContext ? 'Additional context: ' + params.additionalContext : ''} Include key sections and standard language.`;
                break;
            case 'generateFinancials':
                systemPrompt = "You are a financial forecasting expert.";
                userPrompt = `Create a financial projection for ${params.business} over the next ${params.timeframe}. ${params.keywordsMore ? 'Additional financial factors to consider: ' + params.keywordsMore : ''} ${params.additionalContext ? 'Additional context: ' + params.additionalContext : ''} Include revenue streams, expenses, and growth assumptions.`;
                break;
            default:
                console.error(`Unknown operation type: ${operation}`);
                throw new Error('Invalid operation type');
        }// Check for API key only when needed (not exposing it in logs)
        if (!process.env.OPENAI_API_KEY) {
            console.error('OpenAI API key missing from environment variables');
            throw new Error('Server configuration error: API key not available');
        }
        
        // Using the new OpenAI SDK syntax
        let completion;
        try {            // Set different parameters based on operation type
            const operationSettings = {
                generateBusinessNames: { temperature: 0.9, max_tokens: 300 },   // More creative
                generateEmailTemplates: { temperature: 0.5, max_tokens: 600 },  // More structured
                generateLogo: { temperature: 0.7, max_tokens: 500 },           // Balanced
                generatePitchDeck: { temperature: 0.6, max_tokens: 800 },      // More detailed
                analyzeMarket: { temperature: 0.3, max_tokens: 700 },          // More factual
                generateContentCalendar: { temperature: 0.6, max_tokens: 800 }, // Structured but creative
                generateLegalDocs: { temperature: 0.3, max_tokens: 1000 },      // Very structured
                generateFinancials: { temperature: 0.4, max_tokens: 800 }       // Precise with some flexibility
            };
            
            // Get settings for this operation or use defaults
            const settings = operationSettings[operation] || { temperature: 0.7, max_tokens: 500 };
            
            // Check usage limits for free trial users (server-side enforcement)
            if (userId) {
                try {
                    // Get user data to check subscription status
                    const { data: user, error: userError } = await supabase
                        .from('users')
                        .select('subscription_status')
                        .eq('id', userId)
                        .single();

                    if (!userError && user && user.subscription_status === 'free_trial') {
                        // User is on free trial, check daily limits
                        const now = new Date();
                        const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
                        const tomorrowUTC = new Date(todayUTC);
                        tomorrowUTC.setUTCDate(tomorrowUTC.getUTCDate() + 1);

                        console.log('Server-side usage check for free trial user:', userId, 'operation:', operation);
                        console.log('Date range:', todayUTC.toISOString(), 'to', tomorrowUTC.toISOString());

                        const { data: operations, error: opsError } = await supabase
                            .from('operation_history')
                            .select('id, operation_type, created_at')
                            .eq('user_id', userId)
                            .eq('operation_type', operation)
                            .gte('created_at', todayUTC.toISOString())
                            .lt('created_at', tomorrowUTC.toISOString());

                        if (!opsError && operations && operations.length >= 1) {
                            console.log('Server-side: LIMIT EXCEEDED for', operation, '- found', operations.length, 'operations today');
                            throw new Error('Free trial limit reached for this tool today. You can use each AI tool once per day. Upgrade to unlock unlimited usage!');
                        }

                        console.log('Server-side: Usage check passed for', operation, '- found', operations ? operations.length : 0, 'operations today');
                    }
                } catch (limitError) {
                    // Re-throw usage limit errors, but don't block for other database errors
                    if (limitError.message.includes('Free trial limit')) {
                        throw limitError;
                    }
                    console.warn('Server-side usage check failed (non-blocking):', limitError);
                }
            }
            
            completion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: settings.temperature,
                max_tokens: settings.max_tokens
            });
            
            // Extract the result from completion
            const result = completion.choices[0].message.content;
            
            // Store operation history in Supabase if userId is provided
            if (userId) {
                try {
                    const { error } = await supabase
                        .from('operation_history')
                        .insert({
                            user_id: userId,
                            operation_type: operation,
                            input_params: params,
                            output_result: result,
                            created_at: new Date().toISOString()
                        });
                    
                    if (error) {
                        console.error('Error saving operation history from serverless function:', error);
                    }
                } catch (storageError) {
                    // Non-blocking - don't let history storage failure affect the main operation
                    console.error('Failed to store operation history from serverless:', storageError);
                }
            }
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    result: result
                })
            };
        } catch (openaiError) {
            // Log error without exposing sensitive data
            console.error('OpenAI API Error type:', openaiError.constructor.name);
            console.error('OpenAI API Error status:', openaiError.status);
            console.error('OpenAI API Error name:', openaiError.name);
            
            // More detailed error logging for timeouts and network issues
            if (openaiError.name === 'AbortError') {
                console.error('OpenAI request timed out');
                throw new Error('Request to AI service timed out. Please try again.');
            }
            
            if (openaiError.name === 'FetchError') {
                console.error('Network error connecting to OpenAI');
                throw new Error('Network error connecting to AI service. Please check your connection.');
            }
            
            // Don't log the full error object as it might contain the API key
            throw new Error(`OpenAI API Error: ${openaiError.message || 'Unknown error'}`);
        }if (!completion || !completion.choices || completion.choices.length === 0) {
            console.error('Invalid or empty response from OpenAI API');
            throw new Error('No response from OpenAI API');
        }
        
        // Variable to track content saving status
        const result = completion.choices[0].message.content.trim();
        
        // Prepare the response JSON
        const responseBody = {
            result: result,
            // Add metadata for debugging
            _meta: {
                operation: operation
            }
        };
        
        try {
            // Explicitly stringify the response to catch any JSON serialization errors
            const responseJson = JSON.stringify(responseBody);
            
            return {
                statusCode: 200,
                headers,
                body: responseJson
            };
        } catch (jsonError) {
            console.error('Error serializing response to JSON:', jsonError);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    error: 'Error formatting response',
                    details: 'The server encountered an error while formatting the response'
                })
            };
        }
    } catch (error) {
        console.error('Error in AI operation:', error);
        
        // Provide a more specific error code and message for invalid operations
        if (error.message === 'Invalid operation type') {
            return {
                statusCode: 400, // Bad request is more appropriate for invalid operations
                headers,
                body: JSON.stringify({
                    error: `Operation not supported: ${JSON.parse(event.body).operation}`,
                    supportedOperations: [
                      'generateBusinessNames', 
                      'generateEmailTemplates', 
                      'generateLogo', 
                      'generatePitchDeck', 
                      'analyzeMarket',
                      'generateContentCalendar',
                      'generateLegalDocs',
                      'generateFinancials'
                    ],
                    details: 'Please check the operation type passed to the API'
                })
            };
        }
        
        return {
            statusCode: error.response?.status || 500,
            headers,
            body: JSON.stringify({
                error: error.message || 'Internal server error',
                details: error.response?.data || null
            })
        };
    }
};