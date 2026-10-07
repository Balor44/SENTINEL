// @ts-nocheck
import { groq } from '@ai-sdk/groq';
import { streamText, tool, convertToModelMessages, isStepCount } from 'ai';
import { z } from 'zod';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const result = streamText({
      model: groq('openai/gpt-oss-20b'),
      messages: await convertToModelMessages(messages),
      stopWhen: isStepCount(5),
      instructions:
        "You are Sentinel Copilot, an elite AI financial commander. You regulate autonomous agents. Use your tools to fetch data and update policies. If a user says 'pause agent X', use the updateAgentPolicy tool.",
      tools: {
        getFleetStatus: tool({
          description: 'Get all agents, balances, and budgets.',
          inputSchema: z.object({}),
          execute: async () => {
            if (!user?.id) return { error: 'Unauthorized' };
            const { data } = await supabase
              .from('agents')
              .select('name, status, balance')
              .eq('user_id', user.id);
            return data || [];
          },
        }),
        updateAgentPolicy: tool({
          description:
            'Dynamically manage and regulate an agent. Pause/activate it or change its daily budget.',
          inputSchema: z.object({
            agent_name: z.string().describe("The name of the agent to update (e.g. 'Marketing')"),
            status: z.enum(['active', 'paused']).optional(),
            daily_budget: z.number().optional(),
          }),
          execute: async ({ agent_name, status, daily_budget }) => {
            if (!user?.id) return { error: 'Unauthorized' };
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
        }),
      },
      onError: ({ error }) => {
        console.error('streamText error:', error);
      },
    });

    return result.toUIMessageStreamResponse({
      onError: (error) => {
        console.error('Stream response error:', error);
        return error instanceof Error ? error.message : 'Something went wrong';
      },
    });
  } catch (err) {
    console.error('Chat route error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
