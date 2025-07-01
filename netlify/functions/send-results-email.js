const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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
        const { email, content, subject } = JSON.parse(event.body);

        if (!email || !content) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Email and content are required' })
            };
        }

        const msg = {
            to: email,
            from: process.env.SENDGRID_FROM_EMAIL || 'hatem.shaban@gmail.com',
            subject: subject || 'Your AI Results from StartupStack',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #6B46C1;">Your StartupStack AI Results</h2>
                    <p>Here are the results you generated with StartupStack:</p>
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; border-left: 4px solid #6B46C1;">
                        <pre style="white-space: pre-wrap; font-family: monospace;">${content}</pre>
                    </div>
                    <p style="margin-top: 30px;">
                        Need more help? Login to your <a href="${process.env.URL || 'https://startupstackai.netlify.app'}" style="color: #6B46C1; text-decoration: none;">StartupStack dashboard</a> for more AI tools.
                    </p>
                </div>
            `
        };

        await sgMail.send(msg);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: 'Results email sent successfully' })
        };
    } catch (error) {
        console.error('Error sending results email:', error);
        return {
            statusCode: error.code || 500,
            headers,
            body: JSON.stringify({ error: 'Failed to send results email' })
        };
    }
};
