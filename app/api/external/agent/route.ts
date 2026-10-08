// @ts-nocheck
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';


// Initializes service client to handle external programmatic calls
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);


function validateAuthorization(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.replace('Bearer ', '').trim();
  // Validates standard Sentinel keys (matching format generated on Settings page)
  return token.startsWith('sk_sentinel_');
}


// 1. GET: Fetch fleet telemetry programmatically
export async function GET(req: Request) {
  if (!validateAuthorization(req)) {
    return NextResponse.json(
      { error: "Unauthorized. Provide a valid Bearer token (e.g., Authorization: Bearer sk_sentinel_live_...)" },
      { status: 401 }
    );
  }


  const { data, error } = await supabase
    .from('agents')
    .select('id, name, status, balance, created_at');


  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }


  return NextResponse.json({
    fleet_count: data?.length || 0,
    agents: data || [],
    timestamp: new Date().toISOString(),
  });
}


// 2. POST: Regulate agent state from an external webhook or pipeline
export async function POST(req: Request) {
  if (!validateAuthorization(req)) {
    return NextResponse.json(
      { error: "Unauthorized. Provide a valid Bearer token." },
      { status: 401 }
    );
  }


  try {
    const body = await req.json();
    const { agent_name, action, daily_budget } = body;


    if (!agent_name) {
      return NextResponse.json(
        { error: "Missing required parameter: agent_name" },
        { status: 400 }
      );
    }


    const updates: Record<string, any> = {};


    if (action === 'pause') {
      updates.status = 'paused';
    } else if (action === 'activate' || action === 'resume') {
      updates.status = 'active';
    }


    if (daily_budget !== undefined) {
      updates.daily_budget = daily_budget;
    }


    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Invalid action. Supported actions: 'pause', 'activate', 'resume'." },
        { status: 400 }
      );
    }


    const { data, error } = await supabase
      .from('agents')
      .update(updates)
      .ilike('name', `%${agent_name}%`)
      .select('id, name, status, balance')
      .single();


    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }


    return NextResponse.json({
      success: true,
      message: `Agent '${data.name}' status updated to ${data.status}.`,
      agent: data,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Malformed JSON payload" },
      { status: 400 }
    );
  }
}


