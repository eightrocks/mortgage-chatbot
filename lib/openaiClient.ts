import OpenAI from 'openai';

const openaiApiKey = process.env.OPENAI_API_KEY;

if (!openaiApiKey) {
    console.warn("OpenAI API Key is missing. AI functionalities may be limited. Ensure OPENAI_API_KEY is set in your environment variables.");
}

// Initialize OpenAI client only if the key exists
// Functions using this client will need to handle the case where it might not be initialized.
export const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null; 