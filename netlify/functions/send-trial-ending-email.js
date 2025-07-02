const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

exports.handler = async (event, context) => {
    // Add CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers
        };
    }

    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
            headers,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    try {
        const { email, userName = 'Valued Customer' } = JSON.parse(event.body);

        await resend.emails.send({
            from: 'StartupStack <noreply@startupstackai.com>',
            to: email,
            subject: 'Your StartupStack Trial Ends Soon',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #6B46C1;">Your StartupStack Trial is Ending</h2>
                    <p>Hi ${userName},</p>
                    <p>Your StartupStack free trial ends in 3 days. Don't lose access to your AI tools!</p>
                    <p>Upgrade now to continue:</p>
                    <ul>
                        <li>All 8 AI-powered tools</li>
                        <li>Premium templates</li>
                        <li>Priority support</li>
                        <li>Advanced features</li>
                        <li>API access</li>
                    </ul>
                    <a href="${process.env.URL}/upgrade" 
                       style="display: inline-block; background: #6B46C1; color: white; padding: 12px 24px; 
                              text-decoration: none; border-radius: 6px; margin-top: 20px;">
                        Upgrade Now
                    </a>
                    <p style="margin-top: 30px;">
                        Need help? Reply to this email for support.
                    </p>
                </div>
            `
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: 'Trial ending email sent successfully' })
        };
    } catch (error) {
        console.error('Error sending trial ending email:', error);
        return {
            statusCode: error.code || 500,
            headers,
            body: JSON.stringify({ error: 'Failed to send trial ending email' })
        };
    }
};
