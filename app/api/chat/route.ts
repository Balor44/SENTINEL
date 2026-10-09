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
        "CRITICAL RULE FOR CREATING AGENTS: When a user asks to create an agent, DO NOT create it immediately. FIRST, ask them for its specific policy details (daily budget, daily limit, transaction limit, approval threshold) AND its initial allocation amount in pathUSD. " +
        "CRITICAL RULE FOR POLICIES: NEVER use generic, dummy, or default values (like 100, 10, or 25). You MUST extract the EXACT numerical limits provided by the user. " +
        "Once they provide the limits and allocation, call createAgent with that initial allocation, and then immediately call createPolicy using the exact limits provided by the user and the new agent's ID.",
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
          description: 'Create a brand new agent with an initial funding allocation.',
          inputSchema: z.object({
            name: z.string().describe("The name of the new agent"),
            initial_allocation: z.number().describe("The initial amount to fund the agent in pathUSD"),
          }),
          execute: async ({ name, initial_allocation }) => {
            if (!user?.id) return { error: 'Unauthorized' };
            
            const id = crypto.randomUUID();


            // 🔥 We now save the initial_allocation to the balance while it waits in escrow
            const { data, error } = await supabase
              .from('agents')
              .insert([{ 
                id, 
                name, 
                balance: initial_allocation, 
                status: 'pending_escrow', 
                user_id: user.id 
              }])
              .select('id, name, status, balance')
              .single();


            if (error) return { error: error.message };
            
            return { 
              success: true, 
              agent: data,
              escrow_action_required: `Agent created locally with a pending balance of ${initial_allocation}. Instruct the user to navigate to their Sentinel dashboard to sign the Tempo transaction via their Web3 wallet to finalize funding.`
            };
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
          description: 'Create a new financial or operational policy. MUST use exact numbers provided by the user.',
          inputSchema: z.object({
            name: z.string().describe("The name of the policy"),
            description: z.string().optional().describe("What the policy does"),
            agentId: z.string().optional().describe("The ID of the agent this applies to"),
            // 🔥 Removed .optional() and added aggressive descriptions to force exact values
            dailyBudget: z.number().describe("The exact daily budget number requested by the user"),
            dailyLimit: z.number().describe("The exact daily limit number requested by the user"),
            txLimit: z.number().describe("The exact per-transaction limit requested by the user"),
            approvalThreshold: z.number().describe("The exact approval threshold requested by the user"),
          }),
          execute: async (policyData) => {
            if (!user?.id) return { error: 'Unauthorized' };
            
            const id = crypto.randomUUID();


            const { data, error } = await supabase
              .from('policies')
              .insert([{ 
                id, 
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


