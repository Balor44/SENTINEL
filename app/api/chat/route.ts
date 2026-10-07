import { groq } from '@ai-sdk/groq';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';


export const maxDuration = 30;


export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
    );


    const { data: { user } } = await supabase.auth.getUser();


    // 🔥 SPLIT ARCHITECTURE: Generate text on server, handle tools natively, return JSON.
    const result = await (generateText as any)({
      model: groq('openai/gpt-oss-20b'),
      messages,
      maxSteps: 5, // Server handles the tool loop internally
      system: "You are Sentinel Copilot, an elite AI financial commander. You regulate autonomous agents. Use your tools to fetch data and update policies. Be concise and authoritative.",
      tools: {
        getFleetStatus: (tool as any)({
          description: 'Get all agents, IDs, balances, and budgets.',
          parameters: z.object({}),
          execute: async (): Promise<any> => {
            if (!user?.id) return { error: "Unauthorized" };
            const { data } = await supabase.from('agents').select('id, name, status, balance, daily_budget, spent_today').eq('user_id', user.id);
            return data || [];
          },
        }),
        updateAgentPolicy: (tool as any)({
          description: 'Dynamically manage and regulate an agent. Pause/activate it or change its daily budget.',
          parameters: z.object({
            agent_id: z.string(),
            status: z.enum(['active', 'paused']).optional(),
            daily_budget: z.number().optional(),
          }),
          execute: async ({ agent_id, status, daily_budget }: any): Promise<any> => {
            if (!user?.id) return { error: "Unauthorized" };
            const updates: any = {};
            if (status !== undefined) updates.status = status;
            if (daily_budget !== undefined) updates.daily_budget = daily_budget;
            
            const { data, error } = await supabase.from('agents').update(updates).eq('id', agent_id).eq('user_id', user.id).select('name, status, daily_budget').single();
            if (error) return { error: error.message };
            return { success: true, updated: data };
          },
        })
      },
    });


    return NextResponse.json({ content: result.text });
  } catch (error: any) {
    console.error("AI Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


