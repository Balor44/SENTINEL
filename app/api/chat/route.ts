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
  const userId = user?.id;


  const result = streamText({
    model: groq('llama-3.3-70b-versatile'),
    messages,
    system: "You are Sentinel Copilot, an elite AI financial commander. You do not just observe; you regulate and manage autonomous agents. You can analyze spend and execute policy changes. If a user asks you to pause an agent, reduce a budget, or change a threshold, you must do it using the updateAgentPolicy tool. (If they only give you a name, use getFleetStatus first to find the agent's ID, then update it). Be concise and authoritative.",
    tools: {
      getFleetStatus: tool({
        description: 'Get the list of all active and paused autonomous agents, including their exact IDs, balances, and daily budgets.',
        parameters: z.object({}),
        // @ts-expect-error - Bypass AI SDK Zod strict inference bug
        execute: async () => {
          if (!userId) return { error: "Unauthorized" };
          const { data } = await supabase.from('agents').select('id, name, status, balance, daily_budget, approval_threshold, spent_today').eq('user_id', userId);
          return data || [];
        },
      }),
      getRecentTransactions: tool({
        description: 'Get the most recent payment transactions executed by the agents.',
        parameters: z.object({ limit: z.number().default(5) }),
        // @ts-expect-error - Bypass AI SDK Zod strict inference bug
        execute: async ({ limit }) => {
          if (!userId) return { error: "Unauthorized" };
          const { data } = await supabase
            .from('transactions')
            .select('amount, status, recipient, agent_name, created_at, decision_reason')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);
          return data || [];
        },
      }),
      getTreasuryBalance: tool({
        description: 'Get the overall global treasury balance.',
        parameters: z.object({}),
        // @ts-expect-error - Bypass AI SDK Zod strict inference bug
        execute: async () => {
          if (!userId) return { error: "Unauthorized" };
          const { data } = await supabase.from('app_state').select('treasury').eq('user_id', userId).single();
          return data?.treasury || { balance: 0 };
        },
      }),
      updateAgentPolicy: tool({
        description: 'Dynamically manage and regulate an agent. Change its daily budget, approval threshold, or instantly pause/activate it.',
        parameters: z.object({
          agent_id: z.string().describe('The strict UUID of the agent to update. Fetch this via getFleetStatus if unknown.'),
          daily_budget: z.number().optional(),
          approval_threshold: z.number().optional(),
          status: z.enum(['active', 'paused']).optional(),
        }),
        // @ts-expect-error - Bypass AI SDK Zod strict inference bug
        execute: async ({ agent_id, daily_budget, approval_threshold, status }) => {
          if (!userId) return { error: "Unauthorized" };
          
          const updates: any = {};
          if (daily_budget !== undefined) updates.daily_budget = daily_budget;
          if (approval_threshold !== undefined) updates.approval_threshold = approval_threshold;
          if (status !== undefined) updates.status = status;


          const { data, error } = await supabase
            .from('agents')
            .update(updates)
            .eq('id', agent_id)
            .eq('user_id', userId)
            .select('name, daily_budget, approval_threshold, status')
            .single();
            
          if (error) return { error: error.message };
          return { success: true, action_taken: data };
        },
      })
    },
  });


  return (result as any).toDataStreamResponse 
    ? (result as any).toDataStreamResponse() 
    : (result as any).toTextStreamResponse();
}


