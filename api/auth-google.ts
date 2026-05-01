import prisma from '../src/lib/prisma';
import { OAuth2Client } from 'google-auth-library';
import { signToken } from '../src/lib/jwt';

const client = new OAuth2Client(
  process.env.VITE_GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'postmessage'
);

export default async function handler(req: any) {
  if (req.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }), headers: {} };
  }

  try {
    const { code } = JSON.parse(req.body || '{}');

    if (!code) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No authorization code provided' }), headers: {} };
    }

    // Exchange authorization code for tokens
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Verify ID Token to get user info
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: process.env.VITE_GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload || !payload.email) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid Google token payload' }), headers: {} };
    }

    const { email, sub: googleId, name } = payload;

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Auto-generate a username from email if new user
      const baseUsername = email.split('@')[0];
      let username = baseUsername;
      let counter = 1;
      while (await prisma.user.findUnique({ where: { username } })) {
        username = `${baseUsername}${counter}`;
        counter++;
      }

      user = await prisma.user.create({
        data: {
          email,
          username,
          googleId,
          name,
          isPhoneVerified: false,
        },
      });
    } else if (!user.googleId) {
      // Link Google account to existing email
      user = await prisma.user.update({
        where: { email },
        data: { googleId },
      });
    }

    const jwtToken = signToken({ id: user.id, email: user.email, role: user.role });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `token=${jwtToken}; HttpOnly; Path=/; Max-Age=604800; SameSite=Strict${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
      },
      body: JSON.stringify({ 
        user: { id: user.id, email: user.email, username: user.username, role: user.role } 
      }),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
}
