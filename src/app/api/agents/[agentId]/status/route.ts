import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, UserDocument } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// GET /api/agents/:id/status
export async function GET(req: NextRequest, { params }: { params: { agentId: string } }) {
  const { agentId } = params;
  if (!agentId) {
    return NextResponse.json({ error: 'agentId param missing' }, { status: 400 });
  }

  try {
    const { db } = await connectToDatabase();
    const users = db.collection<UserDocument>('users');

    // For MVP, agentId is unique per user. Find by agentId field.
    const user = await users.findOne({ agentId });
    if (!user) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    let status = user.agentStatus || 'UNKNOWN';
    let url = user.agentUrl;

    // Optional live Fleek status
    const fleekKey = process.env.FLEEK_GRAPHQL_API_KEY;
    if (fleekKey && user.agentId) {
      try {
        const query = `query Site($id: String!) { site(id: $id) { id deployment { status url } } }`;
        const res = await fetch('https://api.fleek.co/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${fleekKey}`,
          },
          body: JSON.stringify({ query, variables: { id: user.agentId } }),
        });
        const json = await res.json();
        const deployment = json.data?.site?.deployment;
        if (deployment) {
          status = deployment.status?.toUpperCase() ?? status;
          if (deployment.url) url = deployment.url;
        }
      } catch (fleekErr:any) {
        console.error('[Agent Status] Fleek query failed', fleekErr);
      }
    }

    const resp = {
      agentId,
      status,
      deployedAt: user.agentDeployedAt,
      url,
      riskTolerance: (user as any).agentRiskTolerance ?? null,
    };

    return NextResponse.json(resp);
  } catch (err:any) {
    console.error('[Agent Status API] Error', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
} 