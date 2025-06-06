import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get('path');
  const body = await req.json();
  
  if (!path) {
    return NextResponse.json({ message: 'Path is required' }, { status: 400 });
  }

  try {
    const aioraApiUrl = process.env.NEXT_PUBLIC_AIORA_API_URL;
    if (!aioraApiUrl) {
      throw new Error("NEXT_PUBLIC_AIORA_API_URL is not set");
    }

    const aioraResponse = await fetch(`${aioraApiUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!aioraResponse.ok) {
        const errorBody = await aioraResponse.text();
        console.error(`Aiora API Error: ${aioraResponse.status}`, errorBody);
        return NextResponse.json({ message: `Aiora API responded with status ${aioraResponse.status}`}, { status: aioraResponse.status });
    }

    const contentType = aioraResponse.headers.get('content-type');
    
    if (contentType?.includes('image/')) {
      const imageBuffer = await aioraResponse.arrayBuffer();
      const headers = new Headers();
      headers.set('Content-Type', contentType);
      return new NextResponse(imageBuffer, { status: 200, headers });
    }

    const data = await aioraResponse.json();
    return NextResponse.json(data, { status: aioraResponse.status });

  } catch (error) {
    console.error('Aiora proxy error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 