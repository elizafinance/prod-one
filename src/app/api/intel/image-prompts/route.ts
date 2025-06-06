import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ message: 'Address is required' }, { status: 400 });
  }

  try {
    // Forward the request to the external service
    const response = await fetch(
      `https://parallax-analytics.onrender.com/aiora/image-prompts?address=${address}`
    );
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching image prompts:', error);
    return NextResponse.json({ message: 'Error fetching image prompts' }, { status: 500 });
  }
} 