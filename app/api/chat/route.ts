import { groq } from '@ai-sdk/groq';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';


export const maxDuration = 30;


export async function POST(req: Request) {
  const { messages } = await req.json();
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );


  const { data: { user } } = await supabase.auth.getUser();


  const result = (streamText as any)({
    model: groq('openai/gpt-oss-20b'),
    messages,
    maxSteps: 5,
    system: "You are Sentinel Copilot, an elite AI financial commander. You regulate autonomous agents. Use your tools to fetch data and update policies. If a user says 'pause agent X', use the updateAgentPolicy tool.",
    tools: {
      getFleetStatus: (tool as any)({
        description: 'Get all agents, balances, and budgets.',
        parameters: z.object({}),
        execute: async () => {
          if (!user?.id) return { error: "Unauthorized" };
          const { data } = await supabase.from('agents').select('name, status, balance').eq('user_id', user.id);
          return data || [];
        },
      }),
      updateAgentPolicy: (tool as any)({
        description: 'Dynamically manage and regulate an agent. Pause/activate it or change its daily budget.',
        parameters: z.object({
          agent_name: z.string().describe("The name of the agent to update (e.g. 'Marketing')"),
          status: z.enum(['active', 'paused']).optional(),
          daily_budget: z.number().optional(),
        }),
        execute: async ({ agent_name, status, daily_budget }: any) => {
          if (!user?.id) return { error: "Unauthorized" };
          const updates: any = {};
          if (status !== undefined) updates.status = status;
          if (daily_budget !== undefined) updates.daily_budget = daily_budget;
          
          const { data, error } = await supabase
            .from('agents')
            .update(updates)
            .ilike('name', `%${agent_name}%`)
            .eq('user_id', user.id)
            .select('name, status, daily_budget')
            .single();
            
          if (error) return { error: error.message };
          return { success: true, updated: data };
        },
      })
    },
  });


  return (result as any).toDataStreamResponse();
}


