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
        "You are Sentinel Copilot, an elite AI financial commander. You regulate autonomous agents. Use your tools to fetch data, update agents, and manage policies. If a user says 'pause agent X', use the updateAgentPolicy tool. If they ask to create a rule or policy, use createPolicy. If they want to execute, enable, or trigger a policy, use executePolicy.",
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
        createPolicy: tool({
          description: 'Create a new financial or operational policy.',
          inputSchema: z.object({
            name: z.string().describe("The name of the policy"),
            description: z.string().optional().describe("What the policy does"),
            agentId: z.string().optional().describe("The ID of the agent this applies to"),
            dailyBudget: z.number().optional(),
            dailyLimit: z.number().optional(),
            txLimit: z.number().optional(),
            approvalThreshold: z.number().optional(),
          }),
          execute: async (policyData) => {
            if (!user?.id) return { error: 'Unauthorized' };
            
            const { data, error } = await supabase
              .from('policies')
              .insert([{ 
                ...policyData, 
                user_id: user.id, 
                enabled: true, 
                active: true 
              }])
              .select()
              .single();


            if (error) return { error: error.message };
            return { success: true, policy: data };
          },
        }),
        executePolicy: tool({
          description: 'Execute, enable, or update an existing policy by name.',
          inputSchema: z.object({
            policy_name: z.string().describe("The name of the policy to execute or update"),
            enabled: z.boolean().optional(),
            active: z.boolean().optional(),
          }),
          execute: async ({ policy_name, enabled, active }) => {
            if (!user?.id) return { error: 'Unauthorized' };
            const updates: any = {};
            
            if (enabled !== undefined) updates.enabled = enabled;
            if (active !== undefined) updates.active = active;
            
            // If the user just says "execute policy X", we turn it on
            if (Object.keys(updates).length === 0) {
               updates.active = true;
               updates.enabled = true;
            }


            const { data, error } = await supabase
              .from('policies')
              .update(updates)
              .ilike('name', `%${policy_name}%`)
              .eq('user_id', user.id)
              .select()
              .single();


            if (error) return { error: error.message };
            return { success: true, updated: data };
          },
        })
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


