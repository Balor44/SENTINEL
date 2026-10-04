"use client";
import Link from "next/link"; 
import { ArrowLeft,Bot,Check,ChevronRight,ShieldCheck } from "lucide-react"; 
import { useState } from "react"; 
import { Button } from "@/components/ui";
import { id } from "@/lib/utils"; // <-- ADDED ID IMPORT


export default function NewAgentPage(){
  const [step,setStep]=useState(1);
  const [name,setName]=useState("");
  const [purpose,setPurpose]=useState("Research APIs and datasets");
  const [daily,setDaily]=useState("100");
  const [tx,setTx]=useState("10");
  const [approval,setApproval]=useState("25");
  const [recipient,setRecipient]=useState("");
  const [fund,setFund]=useState("100");
  const [created,setCreated]=useState(false);
  const [createdId,setCreatedId]=useState("");


  async function create(){
    const newAgentId = id("agent"); // <-- GENERATE ID ON THE CLIENT FIRST


    const r=await fetch("/api/setup",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        agent:{
          id: newAgentId, // <-- SEND THE ID TO THE BACKEND
          name,
          purpose,
          description:purpose,
          dailyBudget:Number(daily),
          transactionLimit:Number(tx),
          approvalThreshold:Number(approval),
          initialFunding:Number(fund),
          recipients:[recipient]
        }
      })
    });
    const d=await r.json();
    if(!r.ok)return alert(d.error||"Could not create agent");
    
    setCreatedId(newAgentId); // <-- ROUTE DIRECTLY TO THE DETERMINISTIC ID
    setCreated(true)
  }


  if(created)return <div className="mx-auto max-w-2xl"><div className="panel p-8 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400/10"><Check className="h-7 w-7 text-emerald-300"/></div><h1 className="mt-5 text-2xl font-semibold text-white">Controlled agent created</h1><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">The agent now has a financial identity, spending authority and policy in Sentinel.</p><div className="mt-6 flex justify-center gap-2"><Link href="/agents"><Button>Back to agents</Button></Link>{createdId&&<Link href={`/agents/${createdId}`}><Button variant="primary">Open agent</Button></Link>}</div></div></div>;
  
  return <div className="mx-auto max-w-3xl"><Link href="/agents" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4"/>Back to agents</Link><div className="panel overflow-hidden"><div className="border-b border-border p-6"><div className="eyebrow">Agents / New</div><h1 className="mt-2 text-2xl font-semibold text-white">Create a controlled agent</h1><div className="mt-5 flex items-center gap-2">{[1,2,3].map(n=><div key={n} className={`flex items-center gap-2 ${n<=step?"text-violet-300":"text-muted-foreground"}`}><span className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs ${n<=step?"border-primary bg-primary/10":"border-border"}`}>{n}</span>{n<3&&<ChevronRight className="h-3 w-3"/>}</div>)}</div></div><div className="p-6">{step===1&&<div><div className="flex items-center gap-3"><Bot className="h-5 w-5 text-violet-300"/><h2 className="font-medium text-white">Identity</h2></div><p className="mt-1 text-sm text-muted-foreground">Give the agent a name and purpose.</p><input className="input mt-6" value={name} onChange={e=>setName(e.target.value)} placeholder="ResearchBot"/><textarea className="input mt-4 min-h-24 py-3" value={purpose} onChange={e=>setPurpose(e.target.value)}/></div>}{step===2&&<div><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-violet-300"/><h2 className="font-medium text-white">Financial authority</h2></div><div className="mt-6 grid gap-4 sm:grid-cols-3"><Field label="Daily limit" value={daily} set={setDaily}/><Field label="Max transaction" value={tx} set={setTx}/><Field label="Approval above" value={approval} set={setApproval}/></div><label className="mt-5 block text-xs text-muted-foreground">Allowed recipient</label><input className="input mt-2" value={recipient} onChange={e=>setRecipient(e.target.value)}/></div>}{step===3&&<div><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-violet-300"/><h2 className="font-medium text-white">Initial funding</h2></div><input className="input mt-6" type="number" value={fund} onChange={e=>setFund(e.target.value)}/><p className="mt-2 text-xs text-muted-foreground">This allocation is recorded against the treasury. Every payment remains policy-controlled.</p></div>}<div className="mt-8 flex justify-end"><Button variant="primary" onClick={()=>step<3?setStep(step+1):create()}>{step<3?"Continue":"Create controlled agent"}<ChevronRight className="h-4 w-4"/></Button></div></div></div></div>
}


function Field({label,value,set}:{label:string;value:string;set:(v:string)=>void}){
  return <div><label className="text-xs text-muted-foreground">{label}</label><input className="input mt-2" type="number" value={value} onChange={e=>set(e.target.value)}/></div>
}


