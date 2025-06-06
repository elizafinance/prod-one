import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const secret = process.env.NEXTAUTH_SECRET;

async function getAgents(req: NextRequest) {
    try {
        const aioraApiUrl = process.env.NEXT_PUBLIC_AIORA_API_URL;
        if (!aioraApiUrl) {
            throw new Error("NEXT_PUBLIC_AIORA_API_URL is not set");
        }

        const response = await fetch(`${aioraApiUrl}agents`);
        if (!response.ok) {
            throw new Error(`Aiora API responded with status ${response.status}`);
        }
        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching agents:', error);
        return NextResponse.json({ message: 'Error fetching agents' }, { status: 500 });
    }
}

export { getAgents as GET };
