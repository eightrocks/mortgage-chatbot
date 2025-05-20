import { NextRequest, NextResponse } from 'next/server';
import formidable, { File } from 'formidable'; // Using formidable for robust file parsing
import fs from 'fs/promises';

// Note: The config export for disabling bodyParser is not needed in App Router.
// Formidable will handle the multipart/form-data stream directly.

interface ImageUploadResponse {
    success: boolean;
    image_data?: string; // base64 encoded image
    message: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<ImageUploadResponse>> {
    // formidable expects the raw request object. NextRequest should be compatible.
    const form = formidable({});

    try {
        const [fields, files] = await form.parse(request as any); // form.parse can take a Web Request
        
        const fileArray = files.file; // Assuming the client sends the file under the key 'file'
        
        if (!fileArray || !Array.isArray(fileArray) || fileArray.length === 0) {
            return NextResponse.json({ success: false, message: 'No file uploaded.' }, { status: 400 });
        }

        const uploadedFile: File = fileArray[0];

        if (!uploadedFile.mimetype || !['image/png', 'image/jpeg', 'image/jpg'].includes(uploadedFile.mimetype.toLowerCase())) {
            // Clean up if an invalid file was uploaded and saved temporarily by formidable
            if (uploadedFile.filepath) {
                await fs.unlink(uploadedFile.filepath).catch(console.error); 
            }
            return NextResponse.json(
                { success: false, message: `File type not supported. Allowed types: .png, .jpg, .jpeg. Received: ${uploadedFile.mimetype}` }, 
                { status: 400 }
            );
        }

        if (!uploadedFile.filepath) {
             return NextResponse.json({ success: false, message: 'File path not available after upload.' }, { status: 500 });
        }

        const fileContent = await fs.readFile(uploadedFile.filepath);
        const base64Encoded = fileContent.toString('base64');
        const dataUrl = `data:${uploadedFile.mimetype};base64,${base64Encoded}`;

        await fs.unlink(uploadedFile.filepath); // Clean up the temporary file

        return NextResponse.json({
            success: true,
            image_data: dataUrl,
            message: 'Image processed successfully'
        }, { status: 200 });

    } catch (error: any) {
        console.error('Error processing uploaded image:', error);
        // Ensure no file paths or sensitive info from error object are leaked.
        const message = error.message || 'Unknown error processing image';
        return NextResponse.json({
            success: false,
            message: `Error processing image: ${message}`
        }, { status: 500 });
    }
} 