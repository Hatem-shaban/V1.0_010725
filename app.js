// Supabase client setup
import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const supabaseUrl = 'https://ygnrdquwnafkbkxirtae.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnbnJkcXV3bmFma2JreGlydGFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgxNTY3MjMsImV4cCI6MjA2MzczMjcyM30.R1QNPExVxHJ8wQjvkuOxfPH0Gf1KR4HOafaP3flPWaI'
const supabase = createClient(supabaseUrl, supabaseKey)

// User management class
class UserManager {
    constructor(supabase) {
        this.supabase = supabase;
    }

    async signUp(email) {
        try {
            // Check if user exists
            const { data: existingUser } = await this.supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .single();

            if (existingUser) {
                return existingUser;
            }

            // Create new user
            const { data: newUser, error } = await this.supabase
                .from('users')
                .insert([{
                    email: email,
                    created_at: new Date().toISOString(),
                    subscription_status: 'pending'
                }])
                .select()
                .single();

            if (error) throw error;
            return newUser;

        } catch (error) {
            console.error('User signup error:', error);
            throw error;
        }
    }

    // Store user operation history in Supabase
    async storeOperationHistory(userId, operation, params, result) {
        try {
            if (!userId) {
                console.warn('No userId provided for operation history storage');
                return;
            }

            const { error } = await this.supabase
                .from('operation_history')
                .insert({
                    user_id: userId,
                    operation_type: operation,
                    input_params: params,
                    output_result: result,
                    created_at: new Date().toISOString()
                });

            if (error) {
                console.error('Error saving operation history:', error);
            }
        } catch (error) {
            console.error('Failed to store operation history:', error);
            // Non-blocking - we don't want to interrupt the main flow if storage fails
        }
    }
}

// AI Tool Functions
class StartupStackAI {
    constructor() {
        this.userManager = null;
    }

    setUserManager(userManager) {
        this.userManager = userManager;
    }

    async checkUsageLimits(userId, operation) {
        if (!userId) {
            console.log('No userId provided, skipping usage check');
            return; // Skip check if no user ID
        }
        
        console.log('Checking usage limits for user:', userId, 'operation:', operation);
        console.log('UserManager available:', !!this.userManager);
        
        try {
            // Use userManager's supabase instance if available, otherwise use global
            const supabaseClient = this.userManager?.supabase || supabase;
            console.log('Using supabase client:', !!supabaseClient);
            
            // Get user subscription status
            const { data: user, error: userError } = await supabaseClient
                .from('users')
                .select('subscription_status, created_at')
                .eq('id', userId)
                .single();

            if (userError || !user) {
                console.warn('Could not verify user subscription status:', userError);
                return; // Allow operation to continue
            }

            console.log('User subscription status:', user.subscription_status);

            // Only check limits for free trial users
            if (user.subscription_status === 'free_trial') {
                console.log('User is on free trial, checking daily limits...');
                
                // Get today's date in UTC and create proper date boundaries
                const now = new Date();
                // Create proper UTC date boundaries (not affected by local timezone)
                const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
                const tomorrowUTC = new Date(todayUTC);
                tomorrowUTC.setUTCDate(tomorrowUTC.getUTCDate() + 1);
                
                console.log('Checking usage limits for:', {
                    userId,
                    operation,
                    currentUTCDate: now.toISOString().split('T')[0],
                    localTimezoneOffset: now.getTimezoneOffset(),
                    todayStart: todayUTC.toISOString(),
                    tomorrowStart: tomorrowUTC.toISOString()
                });
                
                const { data: operations, error: opsError } = await supabaseClient
                    .from('operation_history')
                    .select('id, operation_type, created_at')
                    .eq('user_id', userId)
                    .eq('operation_type', operation)
                    .gte('created_at', todayUTC.toISOString())
                    .lt('created_at', tomorrowUTC.toISOString());

                if (opsError) {
                    console.warn('Could not check usage limits:', opsError);
                    return; // Allow operation to continue
                }

                const usageCount = operations ? operations.length : 0;
                console.log('Usage count for', operation, ':', usageCount, 'operations found:', operations);
                
                const FREE_TRIAL_LIMIT = 1; // One use per tool per day

                if (usageCount >= FREE_TRIAL_LIMIT) {
                    console.log('LIMIT EXCEEDED! Throwing error...');
                    throw new Error(`Free trial limit reached for this tool today. You can use each AI tool once per day. Upgrade to unlock unlimited usage!`);
                }
                
                console.log('Usage check passed, allowing operation to continue');
            } else {
                console.log('User is not on free trial, skipping usage check');
            }
        } catch (error) {
            if (error.message.includes('Free trial limit')) {
                throw error; // Re-throw usage limit errors
            }
            console.warn('Error checking usage limits:', error);
            // Don't block the operation for other errors
        }
    }

    async callAIOperation(operation, params) {
        console.log('=== callAIOperation started ===');
        console.log('Operation:', operation);
        console.log('Params:', params);
        
        try {
            // Get user ID for tracking
            const userId = localStorage.getItem('userId');
            console.log('Retrieved userId from localStorage:', userId);
            
            // Usage limits are now enforced server-side for better security
            console.log('Proceeding with operation (server-side usage limits will apply)...');
            
            // Implement a simple retry mechanism
            let attempts = 0;
            const maxAttempts = 3;
            let response;
            let data;
            
            while (attempts < maxAttempts) {
                try {
                    response = await fetch('/.netlify/functions/ai-operations', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            operation,
                            params,
                            userId // Pass userId to serverless function
                        }),
                        // Add timeout to prevent hanging requests
                        signal: AbortSignal.timeout(15000) // 15 seconds timeout
                    });
                    
                    data = await response.json();
                    
                    if (response.ok && !data.error) {
                        // Success, break out of retry loop
                        break;
                    }
                    
                    // If we got a server error (5xx), retry
                    if (response.status >= 500) {
                        attempts++;
                        if (attempts < maxAttempts) {
                            // Wait with exponential backoff before retrying
                            await new Promise(r => setTimeout(r, 1000 * attempts));
                            continue;
                        }
                    }
                      // Check for specific server configuration errors
                    if (data.error && data.error.includes('Server configuration error')) {
                        console.error('API configuration issue detected. Please check Netlify environment variables.');
                        throw new Error('StartupStack is not configured properly. Please contact support.');
                    }
                    
                    // For client errors or after max retries, throw the error
                    throw new Error(data.error || `HTTP error! status: ${response.status}`);
                } catch (fetchError) {
                    // Network error or timeout
                    attempts++;
                    if (attempts < maxAttempts && (fetchError.name === 'AbortError' || !response)) {
                        // Wait before retrying
                        await new Promise(r => setTimeout(r, 1000 * attempts));
                        continue;
                    }
                    
                    // Provide more user-friendly error messages
                    if (fetchError.name === 'AbortError') {
                        throw new Error('The request timed out. Please try again.');
                    }
                    throw fetchError;
                }
            }
              // Final check for errors after retries
            if (!response.ok || data.error) {
                console.error(`API response error - Status: ${response.status}`, data);
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }
            
            // Check if result exists in the response
            if (!data.result) {
                console.error('API response missing result data:', data);
                throw new Error('Unexpected API response format: missing result data');
            }
              
            // Display results in UI if available
            this.displayResults(operation, data.result, params);
            
            // Operation history is now stored server-side in the ai-operations function
            
            return data.result;
        } catch (error) {
            console.error('AI operation error:', error);
            
            // More specific error handling for common issues
            if (error.message.includes('timeout') || error.name === 'AbortError') {
                throw new Error('The request to our AI service timed out. Please try again.');
            }
            
            if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
                throw new Error('Network error while connecting to our AI service. Please check your internet connection.');
            }
            
            if (error.message.includes('502') || error.message.includes('Bad Gateway')) {
                throw new Error('Our AI service is currently unavailable. This might be due to high traffic or maintenance. Please try again in a few minutes.');
            }
            
            throw new Error(`AI Operation failed: ${error.message}`);
        }
    }    // Update all AI tool methods to use callAIOperation with validation
    async generateBusinessNames(industry, keywords, additionalParams = {}) {
        if (!industry || !keywords) {
            throw new Error('Both industry and keywords are required for business name generation');
        }
        return this.callAIOperation('generateBusinessNames', { industry, keywords, ...additionalParams });
    }

    async generateLogo(style, industry, additionalParams = {}) {
        if (!style || !industry) {
            throw new Error('Both style and industry are required for logo generation');
        }
        return this.callAIOperation('generateLogo', { style, industry, ...additionalParams });
    }

    async generatePitchDeck(type, industry, additionalParams = {}) {
        if (!type || !industry) {
            throw new Error('Both type and industry are required for pitch deck generation');
        }
        return this.callAIOperation('generatePitchDeck', { type, industry, ...additionalParams });
    }

    async analyzeMarket(industry, region, additionalParams = {}) {
        if (!industry || !region) {
            throw new Error('Both industry and region are required for market analysis');
        }
        return this.callAIOperation('analyzeMarket', { industry, region, ...additionalParams });
    }    async generateContentCalendar(business, audience, additionalParams = {}) {
        if (!business || !audience) {
            throw new Error('Both business and audience are required for content calendar generation');
        }
        return this.callAIOperation('generateContentCalendar', { business, audience, ...additionalParams });
    }    async generateEmailTemplates(business, sequence, additionalParams = {}) {
        if (!business || !sequence) {
            throw new Error('Both business and sequence are required for email template generation');
        }
        
        // Extract purpose from additionalParams or use default
        const purpose = additionalParams.purpose || 'general';
        
        // Validate purpose
        if (!purpose) {
            throw new Error('Purpose is required for email template generation');
        }
        
        return this.callAIOperation('generateEmailTemplates', { business, sequence, purpose });
    }

    async generateLegalDocs(business, docType, additionalParams = {}) {
        if (!business || !docType) {
            throw new Error('Both business and docType are required for legal document generation');
        }
        return this.callAIOperation('generateLegalDocs', { business, docType, ...additionalParams });
    }

    async generateFinancials(business, timeframe, additionalParams = {}) {
        if (!business || !timeframe) {
            throw new Error('Both business and timeframe are required for financial projections');
        }
        return this.callAIOperation('generateFinancials', { business, timeframe, ...additionalParams });
    }    displayResults(operation, result, params) {
        // Check if we're on a page with the results modal
        const resultsModal = document.getElementById('aiResultsModal');
        if (!resultsModal) return; // Not on dashboard page
        
        // Format the operation name for display
        const formattedOperation = operation
            .replace(/([A-Z])/g, ' $1') // Add space before capital letters
            .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
            .replace(/([a-z])([A-Z])/g, '$1 $2'); // Add space between words
            
        // Hide loading indicator and show content
        const loadingIndicator = document.getElementById('loadingIndicator');
        const contentElement = document.getElementById('aiResultsContent');
        
        if (loadingIndicator) {
            loadingIndicator.classList.add('hidden');
        }
        
        if (contentElement) {
            contentElement.classList.remove('hidden');
        }
        
        // Set the modal title and content
        const titleElement = document.getElementById('aiResultsTitle');
        
        if (titleElement) {
            titleElement.textContent = formattedOperation + ' Results';
        }
          if (contentElement) {
            // Format the result with some styling
            let formattedResult = result;
              
            // Format results based on operation type
            try {
                // Special formatting for Logo Creator results
                if (operation === 'generateLogo') {
                    formattedResult = this.formatLogoResults(result);
                } else {
                    // Try to identify if the result is a list
                    const lines = result.split(/\r?\n/);
                    const hasNumberedItems = lines.some(line => /^\d+\./.test(line));
                    const hasBulletedItems = lines.some(line => /^[\*\-•]/.test(line.trim()));
                    
                    if (hasNumberedItems || hasBulletedItems) {
                        formattedResult = '';
                        let inListItem = false;
                        
                        for (let i = 0; i < lines.length; i++) {
                            const line = lines[i].trim();
                            
                            // Handle numbered list items
                            if (/^\d+\./.test(line)) {
                                formattedResult += '<div class="p-2 bg-gray-800 mb-2 rounded font-semibold">' + line + '</div>';
                                inListItem = true;
                            } 
                            // Handle bulleted list items
                            else if (/^[\*\-•]/.test(line)) {
                                formattedResult += '<div class="p-2 bg-gray-700 mb-2 rounded">' + line + '</div>';
                                inListItem = true;
                            } 
                            // Handle section headers (often in CAPS or with colons)
                            else if (/^[A-Z\s]{2,}:?$/.test(line) || /^[^:]+:$/.test(line)) {
                                formattedResult += '<h3 class="font-bold text-purple-400 mt-3 mb-2">' + line + '</h3>';
                                inListItem = false;
                            }
                            // Everything else
                            else {
                                if (line) {
                                    if (inListItem) {
                                        formattedResult += '<div class="pl-4 mb-2">' + line + '</div>';
                                    } else {
                                        formattedResult += '<p class="mb-2">' + line + '</p>';
                                    }
                                } else {
                                    formattedResult += '<br>';
                                    inListItem = false;
                                }
                            }
                        }                }
                }
            } catch (e) {
                console.error('Error formatting result:', e);
            }
            
            contentElement.innerHTML = formattedResult;
        }
        
        // Show the modal
        resultsModal.classList.remove('hidden');
    }
    
    // Format Logo Creator results with enhanced styling
    formatLogoResults(result) {
        // Parse the text to identify sections
        const lines = result.split(/\r?\n/);
        let formattedResult = '';
        
        // Find intro text (usually the first paragraph)
        let introFound = false;
        let currentSection = '';
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Skip empty lines
            if (!line) {
                if (currentSection) {
                    formattedResult += `<p class="mb-3">${currentSection}</p>`;
                    currentSection = '';
                }
                continue;
            }
            
            // Detect section headers like "Colors:", "Shapes:", "Typography:"
            if (/^([A-Z][a-z]+):$/.test(line)) {
                // If we have accumulated intro text, add it
                if (!introFound && currentSection) {
                    formattedResult += `<div class="mb-6 text-indigo-200 text-lg font-light leading-relaxed">${currentSection}</div>`;
                    introFound = true;
                    currentSection = '';
                } else if (currentSection) {
                    formattedResult += `<p class="mb-3">${currentSection}</p>`;
                    currentSection = '';
                }
                
                // Add the section header with icon
                let icon = 'palette';
                if (line.includes('Shape')) icon = 'shapes';
                if (line.includes('Typograph')) icon = 'font';
                
                formattedResult += `
                    <div class="logo-category flex items-center">
                        <i class="fas fa-${icon} mr-2 text-indigo-400"></i>
                        <span>${line}</span>
                    </div>`;
                continue;
            }
            
            // For content inside code-like blocks (design elements)
            if (line.startsWith('-')) {
                // If we have accumulated text, add it first
                if (currentSection) {
                    formattedResult += `<p class="mb-3">${currentSection}</p>`;
                    currentSection = '';
                }
                
                // Style design elements with a gradient
                formattedResult += `
                    <div class="p-3 rounded-lg mb-3 bg-gradient-to-r from-gray-800 to-gray-900 border-l-4 border-indigo-500 shadow-md">
                        ${line}
                    </div>`;
            } else {
                // Accumulate paragraph text
                if (currentSection) {
                    currentSection += ' ' + line;
                } else {
                    currentSection = line;
                }
            }
        }
        
        // Add any remaining text
        if (currentSection) {
            formattedResult += `<p class="mb-3">${currentSection}</p>`;
        }
        
        // Add a summary/conclusion section at the bottom
        if (lines.some(line => line.includes('Overall'))) {
            const overallIndex = lines.findIndex(line => line.includes('Overall'));
            let conclusion = '';
            
            // Gather the conclusion text
            for (let i = overallIndex; i < lines.length; i++) {
                if (lines[i].trim()) {
                    conclusion += lines[i] + ' ';
                }
            }
            
            if (conclusion) {
                formattedResult += `
                    <div class="mt-8 p-4 bg-gradient-to-r from-indigo-900 to-purple-900 rounded-lg border border-indigo-700">
                        <h3 class="font-bold text-lg mb-2 text-white">
                            <i class="fas fa-check-circle text-green-400 mr-2"></i>
                            Conclusion
                        </h3>
                        <p>${conclusion}</p>
                    </div>`;
            }
        }
        
        return formattedResult;
    }
}

// Initialize and export
async function initializeStartupStack() {
    try {
        // Create instances
        const aiTools = new StartupStackAI();
        const userManager = new UserManager(supabase);
        
        // Set up cross-references
        aiTools.setUserManager(userManager);
        
        const stack = {
            aiTools,
            userManager,
            supabase,
            initialized: true
        };

        window.StartupStack = stack;
        return stack;
    } catch (error) {
        console.error('Error initializing StartupStack:', error);
        throw error;
    }
}

// Export the initialization promise
export default initializeStartupStack();