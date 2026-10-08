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
      // 🔥 Updated instructions force the bot to ask for details before executing
      instructions:
        "You are Sentinel Copilot, an elite AI financial commander. You regulate autonomous agents. Use your tools to fetch data, create, pause, modify, and delete agents, and manage policies. " +
        "CRITICAL RULE FOR CREATING AGENTS: When a user asks to create an agent, DO NOT create it immediately. FIRST, ask them for its specific policy details (e.g., daily budget, transaction limits, approval thresholds). Once they provide the limits, call createAgent, and then immediately call createPolicy using the new agent's ID to link them.",
      tools: {
        getFleetStatus: tool({
          description: 'Get all agents, statuses, and balances.',
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
        createAgent: tool({
          description: 'Create a brand new agent.',
          inputSchema: z.object({
            name: z.string().describe("The name of the new agent"),
            status: z.enum(['active', 'paused']).optional().default('active'),
          }),
          execute: async ({ name, status }) => {
            if (!user?.id) return { error: 'Unauthorized' };
            
            // 🔥 Generate the required ID natively to prevent the Supabase error
            const id = crypto.randomUUID();


            const { data, error } = await supabase
              .from('agents')
              .insert([{ id, name, status, user_id: user.id }])
              .select('id, name, status, balance')
              .single();


            if (error) return { error: error.message };
            return { success: true, agent: data };
          },
        }),
        updateAgentPolicy: tool({
          description: 'Dynamically manage and regulate an agent. Pause or activate it.',
          inputSchema: z.object({
            agent_name: z.string().describe("The name of the agent to update (e.g. 'Marketing')"),
            status: z.enum(['active', 'paused']).optional(),
          }),
          execute: async ({ agent_name, status }) => {
            if (!user?.id) return { error: 'Unauthorized' };
            const updates: any = {};
            if (status !== undefined) updates.status = status;


            const { data, error } = await supabase
              .from('agents')
              .update(updates)
              .ilike('name', `%${agent_name}%`)
              .eq('user_id', user.id)
              .select('name, status')
              .single();


            if (error) return { error: error.message };
            return { success: true, updated: data };
          },
        }),
        deleteAgent: tool({
          description: 'Delete an existing agent.',
          inputSchema: z.object({
            agent_name: z.string().describe("The name of the agent to delete"),
          }),
          execute: async ({ agent_name }) => {
            if (!user?.id) return { error: 'Unauthorized' };
            const { data, error } = await supabase
              .from('agents')
              .delete()
              .ilike('name', `%${agent_name}%`)
              .eq('user_id', user.id)
              .select('name')
              .single();


            if (error) return { error: error.message };
            return { success: true, deleted: data };
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


