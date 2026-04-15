
// API endpoint for banner image upload to local storage
import { uploadBannerImage } from '../src/lib/fileStorage';
import prisma from '../src/lib/prisma';

interface APIEvent {
  httpMethod: string;
  headers: { [key: string]: string };
  body: string | null;
  isBase64Encoded: boolean;
}

interface APIResponse {
  statusCode: number;
  headers: { [key: string]: string };
  body: string;
}

// Parse multipart form data
function parseMultipart(body: string, boundary: string): { file?: { name: string; type: string; data: Buffer }; fields: Record<string, string> } {
  const result: { file?: { name: string; type: string; data: Buffer }; fields: Record<string, string> } = { fields: {} };
  const parts = body.split(`--${boundary}`);
  
  for (const part of parts) {
    if (part.includes('Content-Disposition')) {
      const headerEnd = part.indexOf('\r\n\r\n');
      if (headerEnd === -1) continue;
      
      const headers = part.slice(0, headerEnd);
      const content = part.slice(headerEnd + 4);
      
      const nameMatch = headers.match(/name="([^"]+)"/);
      const filenameMatch = headers.match(/filename="([^"]+)"/);
      const contentTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);
      
      if (nameMatch) {
        if (filenameMatch) {
          // This is a file
          // Remove trailing boundary markers and whitespace
          let fileContent = content;
          const boundaryIndex = fileContent.lastIndexOf('\r\n--');
          if (boundaryIndex !== -1) {
            fileContent = fileContent.slice(0, boundaryIndex);
          }
          
          result.file = {
            name: filenameMatch[1],
            type: contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream',
            data: Buffer.from(fileContent, 'binary'),
          };
        } else {
          // This is a regular field
          let fieldContent = content.trim();
          // Remove trailing boundary
          const boundaryIndex = fieldContent.indexOf('\r\n--');
          if (boundaryIndex !== -1) {
            fieldContent = fieldContent.slice(0, boundaryIndex);
          }
          result.fields[nameMatch[1]] = fieldContent.trim();
        }
      }
    }
  }
  
  return result;
}

export default async function handler(event: APIEvent): Promise<APIResponse> {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
    
    if (!contentType.includes('multipart/form-data')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Content-Type must be multipart/form-data' }),
      };
    }

    const boundary = contentType.split('boundary=')[1];
    if (!boundary) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing boundary in Content-Type' }),
      };
    }

    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing request body' }),
      };
    }

    const body = event.isBase64Encoded 
      ? Buffer.from(event.body, 'base64').toString('binary')
      : event.body;

    const { file, fields } = parseMultipart(body, boundary);

    if (!file) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No file uploaded' }),
      };
    }

    const eventId = fields.eventId;
    if (!eventId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'eventId is required' }),
      };
    }

    // Upload to local filesystem
    const result = await uploadBannerImage(eventId, file.data, file.name);

    // Also save to database
    const alt = fields.alt || file.name;
    const order = parseInt(fields.order || '0', 10);
    
    const banner = await prisma.banner.create({
      data: {
        eventId,
        imageUrl: result.url,
        alt,
        order,
        isActive: true,
      },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ...result,
        banner,
      }),
    };
  } catch (error: any) {
    console.error('Banner upload error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
}
