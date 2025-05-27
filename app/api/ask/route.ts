import { NextResponse, NextRequest } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const openaiApiKey = process.env.OPENAI_API_KEY!;

let supabase: SupabaseClient;
if (supabaseUrl && supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
    console.error("Supabase URL or Anon Key is missing. Ensure SUPABASE_URL and SUPABASE_ANON_KEY are set in .env.local");
}

let openai: OpenAI;
if (openaiApiKey) {
    openai = new OpenAI({ apiKey: openaiApiKey });
} else {
    console.warn("OpenAI API Key is missing. AI functionalities will be limited. Ensure OPENAI_API_KEY is set in .env.local");
}

const EMBEDDING_MODEL = "text-embedding-3-small";
const COMPLETION_MODEL = "gpt-4.1-mini";
const MAX_TOKENS = 500;
const EMBEDDING_DIMENSION = 1536; // Matching model's output
const SIMILARITY_THRESHOLD = 0;
const MAX_RESULTS_PER_TABLE = 10;
const MAX_CONTEXT_LENGTH = 3000; // Max characters for combined context

// Define a more specific type for conversation history entries
interface ConversationMessage {
    role: "user" | "assistant";
    content: string;
}

interface QueryRequest {
    question: string;
    image_data?: string;
    conversation_history?: ConversationMessage[]; // Use specific type
}

interface RetrievedContext {
    source: string;
    content: string;
    post_id?: number;
}

// WARNING: In-memory store. Not suitable for production serverless environments.
// Consider Vercel KV, Supabase tables, or other persistent storage for session management.
const conversationHistories: Record<string, ConversationMessage[]> = {}; // Use specific type

async function generateEmbedding(text: string): Promise<number[] | null> {
    if (!openai) {
        console.error("OpenAI client not initialized for embedding generation.");
        return null;
    }
    try {
        const response = await openai.embeddings.create({
            model: EMBEDDING_MODEL,
            input: text.replace(/\\n/g, ' '), // OpenAI recommends replacing newlines
            dimensions: EMBEDDING_DIMENSION,
        });
        return response.data[0].embedding;
    } catch (error) {
        console.error('Error generating embedding:', error);
        return null;
    }
}

async function vectorSearch(queryEmbedding: number[], limitPerTable: number = MAX_RESULTS_PER_TABLE): Promise<RetrievedContext[]> {
    if (!supabase || !queryEmbedding) return [];
    let results: RetrievedContext[] = [];
    const rpcParams = {
        query_embedding: queryEmbedding,
        match_threshold: SIMILARITY_THRESHOLD,
        match_count: limitPerTable
    };

    try {
        const tableSearchTasks = [
            supabase.rpc("match_posts_embeddings", rpcParams).then(({ data, error }) => {
                if (error) console.error("Error matching posts:", error);
                return data?.map((post: any) => ({ source: `Reddit Post: ${post.title || 'Untitled'}`, content: post.text || '', post_id: post.id })) || [];
            }),
            supabase.rpc("match_comments_embeddings", rpcParams).then(({ data, error }) => {
                if (error) console.error("Error matching comments:", error);
                return data?.map((comment: any) => ({ source: `Comment on Post ${comment.post_id}`, content: comment.body || '', post_id: comment.post_id })) || [];
            }),
            supabase.rpc("match_attachments_embeddings", rpcParams).then(({ data, error }) => {
                if (error) console.error("Error matching attachments:", error);
                return data?.map((attachment: any) => ({ source: `Document from Post ${attachment.post_id}`, content: attachment.extracted_text || '', post_id: attachment.post_id })) || [];
            })
        ];
        const searchResults = await Promise.all(tableSearchTasks);
        results = searchResults.flat();
    } catch (error) {
        console.error('Error in vector search:', error);
    }
    return results;
}

async function getDatabaseStats(): Promise<Record<string, number>> {
    if (!supabase) return { posts: 0, comments: 0, attachments: 0 };
    const stats: Record<string, number> = { posts: 0, comments: 0, attachments: 0 };
    try {
        const [{ count: postsCount }, { count: commentsCount }, { count: attachmentsCount }] = await Promise.all([
            supabase.from('posts').select('id', { count: 'exact', head: true }),
            supabase.from('comments').select('post_id', { count: 'exact', head: true }),
            supabase.from('attachments').select('post_id', { count: 'exact', head: true })
        ]);
        stats.posts = postsCount || 0;
        stats.comments = commentsCount || 0;
        stats.attachments = attachmentsCount || 0;
    } catch (error) {
        console.error('Error getting database stats:', error);
    }
    return stats;
}

async function getAiResponse(
    userQuestion: string,
    context: RetrievedContext[],
    imageData?: string,
    conversationHistory?: ConversationMessage[] // Use specific type
): Promise<string> {
    if (!openai) {
        return "OpenAI client not initialized. Cannot generate AI response.";
    }

    const dbStats = await getDatabaseStats();
    const statsString = `Posts: ${dbStats.posts}, Comments: ${dbStats.comments}, Attachments: ${dbStats.attachments}`;

    const systemPromptContent =
      `You are RateMate, an AI Assistant. Provide concise, helpful answers about mortgage topics.
Users may ask questions about mortgage rates, loan types, refinancing, and other related subjects.
If an image is provided, consider its content in your response if relevant.
Be friendly and professional.
Relevant context from database: ${statsString}`;

    let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPromptContent },
    ];

    if (conversationHistory) {
        // Ensure that the history being concatenated is compatible.
        // Our ConversationMessage type is compatible with user/assistant messages for OpenAI.
        const historyMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = conversationHistory
            .slice(-10) // Take last 10 messages
            .map(msg => ({ role: msg.role, content: msg.content })); // Map to the expected structure, roles are already fine.
        messages = messages.concat(historyMessages);
    }

    if (context.length > 0) {
        let contextText = context.map(item => `SOURCE: ${item.source}\\n${item.content}`).join('\\n\\n');
        if (contextText.length > MAX_CONTEXT_LENGTH) {
            contextText = contextText.substring(0, MAX_CONTEXT_LENGTH) + "...";
        }
        messages.push({ role: "system", content: `Relevant information from r/firsttimehomebuyer:\\n\\n${contextText}` });
    }

    const userMessageContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [{ type: "text", text: userQuestion }];
    if (imageData) { // imageData is expected to be a data URL (e.g., "data:image/png;base64,...", "data:image/jpeg;base64,...")
        userMessageContent.push({ type: "image_url", image_url: { url: imageData, detail: "auto" } });
    }
    messages.push({ role: "user", content: userMessageContent });

    try {
        const completion = await openai.chat.completions.create({
            model: COMPLETION_MODEL,
            messages: messages,
            max_tokens: MAX_TOKENS,
            temperature: 0.7,
        });
        return completion.choices[0].message.content?.trim() || "No response content.";
    } catch (error: any) {
        console.error('OpenAI API error:', error);
        const errorMessage = error.response?.data?.error?.message || error.message || 'Unknown error';
        return `I'm having trouble connecting to the AI service: ${errorMessage.substring(0, 150)}. Please try again later.`;
    }
}

export async function POST(request: NextRequest) {
    try {
        const { question, image_data, conversation_history: clientConversationHistory }: QueryRequest = await request.json();

        const sessionIdCookie = request.cookies.get('session_id');
        const sessionId = sessionIdCookie?.value || crypto.randomUUID();

        // Allow empty question if image_data is present
        if ((!question || question.trim() === "") && !image_data) {
            return NextResponse.json({ detail: "Question cannot be empty if no image is provided" }, { status: 400 });
        }

        let currentConversation = clientConversationHistory || conversationHistories[sessionId] || [];
        currentConversation.push({ role: "user", content: question });

        const queryEmbedding = await generateEmbedding(question);

        if (!queryEmbedding) {
            console.error("Failed to generate embedding for the question.");
            return NextResponse.json({ detail: "Failed to process question due to embedding error." }, { status: 500 });
        }

        const context = await vectorSearch(queryEmbedding);
        const answer = await getAiResponse(question, context, image_data, currentConversation);

        currentConversation.push({ role: "assistant", content: answer });
        conversationHistories[sessionId] = currentConversation.slice(-20); // Keep limited history

        const response = NextResponse.json({ answer });
        if (!sessionIdCookie?.value) { // Set cookie only if it wasn't already present or to refresh it
            response.cookies.set('session_id', sessionId, {
                httpOnly: true,
                path: '/',
                sameSite: 'lax', // Consider 'strict' if applicable
                maxAge: 60 * 60 * 24 * 7, // 7 days
                secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
            });
        }
        return response;

    } catch (error: any) {
        console.error('[API ASK HANDLER ERROR]', error);
        // Avoid sending detailed internal errors to the client in production
        const message = process.env.NODE_ENV === 'production' ? "An internal server error occurred." : error.message;
        return NextResponse.json({ detail: message || "An unexpected error occurred." }, { status: 500 });
    }
}

// Optional: Add a GET handler for health check or other purposes
// export async function GET(request: NextRequest) {
//   return NextResponse.json({ message: "Ask API is healthy" });
// } 