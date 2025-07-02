// Simple test for the AI operations function
const aiFunction = require('./netlify/functions/ai-operations');

async function testFunction() {
    const testEvent = {
        httpMethod: 'POST',
        body: JSON.stringify({
            operation: 'generateBusinessNames',
            params: {
                industry: 'Technology',
                business: 'AI Startup',
                keywords: 'innovation, artificial intelligence'
            },
            userId: 'test-user-id'
        })
    };

    try {
        console.log('Testing AI function...');
        const result = await aiFunction.handler(testEvent, {});
        console.log('Status:', result.statusCode);
        console.log('Body:', result.body);
    } catch (error) {
        console.error('Test error:', error);
    }
}

testFunction();
