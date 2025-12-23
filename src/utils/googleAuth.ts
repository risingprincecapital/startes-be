import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export interface GoogleUserInfo {
    email: string;
    name: string;
    picture: string;
    googleId: string;
    emailVerified: boolean;
}

export async function verifyGoogleToken(token: string): Promise<GoogleUserInfo> {
    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();

        if (!payload) {
            throw new Error('Invalid token payload');
        }

        return {
            email: payload.email!,
            name: payload.name!,
            picture: payload.picture!,
            googleId: payload.sub,
            emailVerified: payload.email_verified || false,
        };
    } catch (error) {
        throw new Error('Failed to verify Google token');
    }
}
