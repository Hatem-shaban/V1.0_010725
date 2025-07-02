// Use newer OpenAI SDK version
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

// Create persistent connections
let supabase;
let openai;

// Initialize connections once
function initializeConnections() {
    if (!supabase) {
        supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
            {
                auth: {
                    persistSession: false
                },
                global: {
                    headers: {
                        'x-application': 'startupstack-ai'
                    }
                }
            }
        );
    }
    
    if (!openai && process.env.OPENAI_API_KEY) {
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            timeout: 30000,
            maxRetries: 2
        });
    }
}

exports.handler = async (event, context) => {
    // Set longer timeout for AI operations
    context.callbackWaitsForEmptyEventLoop = false;
    
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers };
    }

    try {
        if (event.httpMethod !== 'POST') {
            return {
                statusCode: 405,
                headers,
                body: JSON.stringify({ error: 'Method not allowed' })
            };
        }

        let requestBody;
        try {
            requestBody = JSON.parse(event.body || '{}');
        } catch (parseError) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid JSON in request body' })
            };
        }

        const { operation, params, userId } = requestBody;

        if (!operation) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Operation type is required' })
            };
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
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({
                        error: `Missing required parameters: ${missing.join(', ')} for operation ${operation}`
                    })
                };
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
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({
                        error: `Operation not supported: ${operation}`,
                        supportedOperations: [
                            'generateBusinessNames', 
                            'generateEmailTemplates', 
                            'generateLogo', 
                            'generatePitchDeck', 
                            'analyzeMarket',
                            'generateContentCalendar',
                            'generateLegalDocs',
                            'generateFinancials'
                        ]
                    })
                };
        }
        
        // Check for API key only when needed (not exposing it in logs)
        if (!process.env.OPENAI_API_KEY) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Server configuration error: API key not available' })
            };
        }
        
        // Initialize OpenAI client when needed
        initializeConnections();
        
        if (!openai) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Server configuration error: API key not available' })
            };
        }
        
        // Initialize Supabase with service role key to bypass RLS
        let supabase;
        try {
            const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
            supabase = createClient(
                process.env.SUPABASE_URL,
                serviceKey,
                {
                    auth: {
                        persistSession: false
                    }
                }
            );
        } catch (supabaseError) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Failed to initialize database connection' })
            };
        }
        
        // Using the new OpenAI SDK syntax
        let completion;
        try {
            // Set different parameters based on operation type
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

                        const { data: operations, error: opsError } = await supabase
                            .from('operation_history')
                            .select('id, operation_type, created_at')
                            .eq('user_id', userId)
                            .eq('operation_type', operation)
                            .gte('created_at', todayUTC.toISOString())
                            .lt('created_at', tomorrowUTC.toISOString());

                        if (!opsError && operations && operations.length >= 1) {
                            return {
                                statusCode: 200, // Return 200 to avoid console errors
                                headers,
                                body: JSON.stringify({
                                    error: 'Free trial limit reached for this tool today. You can use each AI tool once per day. Upgrade to unlock unlimited usage!',
                                    errorType: 'FREE_TRIAL_LIMIT',
                                    isLimit: true
                                })
                            };
                        }
                    }
                } catch (limitError) {
                    // Re-throw usage limit errors, but don't block for other database errors
                    if (limitError.message && limitError.message.includes('Free trial limit')) {
                        return {
                            statusCode: 200, // Return 200 to avoid console errors
                            headers,
                            body: JSON.stringify({ 
                                error: limitError.message,
                                errorType: 'FREE_TRIAL_LIMIT',
                                isLimit: true
                            })
                        };
                    }
                    // Silent fail for other database errors - continue with operation
                }
            }
            
            completion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo-0125", // Use faster model variant
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.7,
                max_tokens: 600 // Reduced for faster responses
            });
            
            // Validate completion response
            if (!completion || !completion.choices || completion.choices.length === 0) {
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ error: 'No response from AI service' })
                };
            }
            
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
                        // Silent fail for operation history storage
                    }
                } catch (storageError) {
                    // Non-blocking - don't let history storage failure affect the main operation
                    // Silent fail for operation history storage
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
            // Handle specific OpenAI errors gracefully
            if (openaiError.name === 'AbortError') {
                return {
                    statusCode: 408, // Request Timeout
                    headers,
                    body: JSON.stringify({ error: 'Request to AI service timed out. Please try again.' })
                };
            }
            
            if (openaiError.name === 'FetchError') {
                return {
                    statusCode: 503, // Service Unavailable
                    headers,
                    body: JSON.stringify({ error: 'Network error connecting to AI service. Please check your connection.' })
                };
            }
            
            // Generic OpenAI error
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: `AI service error: ${openaiError.message || 'Unknown error'}` })
            };
        }
    } catch (error) {
        // Final catch-all for any unhandled errors
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: error.message || 'Internal server error',
                details: 'An unexpected error occurred'
            })
        };
    }
};