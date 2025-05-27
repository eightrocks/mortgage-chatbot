import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import mammoth from 'mammoth';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const question = formData.get('question') as string || 'What is this document about?';

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        if (file.type === 'application/pdf') {
            // Handle PDFs with the responses API
            const uploadedFile = await openai.files.create({
                file: file,
                purpose: "user_data"
            });

            const response = await openai.responses.create({
                model: "gpt-4.1-mini",
                input: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "input_file",
                                file_id: uploadedFile.id,
                            },
                            {
                                type: "input_text",
                                text: question,
                            },
                        ],
                    },
                ],
            });

            // Clean up
            await openai.files.del(uploadedFile.id);

            return NextResponse.json({
                answer: response.output_text,
                documentContent: response.output_text
            });

        } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                   file.type === 'application/msword') {
            // For DOCX/DOC, extract text and use chat completion
            const buffer = Buffer.from(await file.arrayBuffer());
            const result = await mammoth.extractRawText({ buffer });
            const documentText = result.value;

            // Send the extracted text and question to chat completion
            const chatResponse = await openai.chat.completions.create({
                model: "gpt-4-turbo-preview",
                messages: [
                    {
                        role: "system",
                        content: "You are RateMate, an AI mortgage assistant. Analyze the provided document content and answer the user's question."
                    },
                    {
                        role: "user",
                        content: `Here is the document content:\n\n${documentText}\n\nQuestion: ${question}`
                    }
                ],
                temperature: 0.7,
                max_tokens: 1000
            });

            return NextResponse.json({
                answer: chatResponse.choices[0].message.content,
                documentContent: documentText
            });

        } else {
            return NextResponse.json({ 
                error: 'Unsupported file type. Please upload a PDF or DOCX file.' 
            }, { status: 400 });
        }

    } catch (error: any) {
        console.error('Error processing document:', error);
        return NextResponse.json(
            { error: error.message || 'Error processing document' },
            { status: 500 }
        );
    }
}

export const config = {
    api: {
        bodyParser: false,
    },
}; 