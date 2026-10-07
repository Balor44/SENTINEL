// @ts-nocheck
"use client";


import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { Bot, X, MessageSquare, Send, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui";


export function AICopilot() {
  const [isOpen, setIsOpen] = useState(false);
  // 🔥 Native input state guarantees you can always type
  const [localInput, setLocalInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);


  const chatState = useChat({
    api: '/api/chat',
    maxSteps: 5,
  }) as any;


  // Safe variable extraction to prevent React crashes
  const safeMessages = Array.isArray(chatState.messages) ? chatState.messages : [];
  const isLoading = Boolean(chatState.isLoading);
  const error = chatState.error;
  const append = chatState.append;


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [safeMessages, isOpen]);


  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localInput.trim()) return;


    const msg = localInput;
    setLocalInput(""); // Instantly clear the box so you can keep typing
    
    if (append) {
      await append({ role: "user", content: msg });
    }
  };


  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 transition-transform hover:scale-105 hover:bg-emerald-500 z-50"
      >
        <MessageSquare className="h-6 w-6" />
      </button>
    );
  }


  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[550px] w-[350px] flex-col overflow-hidden rounded-2xl border border-border bg-black/95 shadow-2xl backdrop-blur-xl sm:w-[400px]">
      <div className="flex items-center justify-between border-b border-border/50 bg-white/5 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Sentinel Copilot</div>
            <div className="flex items-center gap-1 text-[10px] text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              System Online
            </div>
          </div>
        </div>
        <Button variant="ghost" className="h-8 w-8 p-0" onClick={() => setIsOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>


      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {safeMessages.length === 0 && !error && (
          <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground">
            <Bot className="mb-3 h-10 w-10 opacity-20" />
            <p className="font-medium text-white">I am linked to your Sentinel ledger.</p>
            <p className="mt-2 text-xs">Try asking:</p>
            <ul className="mt-2 space-y-1 text-xs italic">
              <li>"What agents do I have active?"</li>
              <li>"Pause the Marketing agent."</li>
            </ul>
          </div>
        )}
        
        {safeMessages.map((m: any) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
              className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                m.role === 'user' 
                  ? 'bg-emerald-600 text-white rounded-br-sm' 
                  : 'bg-white/10 text-gray-200 rounded-bl-sm border border-white/5'
              }`}
            >
              {m.content}
              {Array.isArray(m.toolInvocations) && m.toolInvocations.map((tool: any) => (
                <div key={tool.toolCallId} className="mt-3 flex items-center gap-2 text-[10px] text-emerald-300 bg-emerald-500/10 p-2 rounded border border-emerald-500/20 font-mono">
                  <Loader2 className="h-3 w-3 animate-spin" /> Executing {tool.toolName}...
                </div>
              ))}
            </div>
          </div>
        ))}
        
        {isLoading && safeMessages[safeMessages.length - 1]?.role === "user" && (
           <div className="flex justify-start">
             <div className="bg-white/5 text-gray-400 rounded-xl rounded-bl-sm px-4 py-3 text-sm flex items-center gap-2">
               <Loader2 className="h-4 w-4 animate-spin text-emerald-500" /> Analyzing...
             </div>
           </div>
        )}


        {error && (
          <div className="flex justify-start">
             <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl rounded-bl-sm px-4 py-3 text-xs flex flex-col gap-1">
               <div className="flex items-center gap-2 font-bold"><AlertCircle className="h-4 w-4" /> Connection Error</div>
               <div>{error.message || "Failed to reach the AI server."}</div>
             </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>


      <form onSubmit={handleSend} className="border-t border-border/50 bg-black/80 p-3">
        <div className="relative flex items-center">
          <input
            value={localInput}
            onChange={(e) => setLocalInput(e.target.value)}
            placeholder="Command your fleet..."
            className="w-full rounded-xl border border-border bg-white/5 py-3 pl-4 pr-12 text-sm text-white placeholder:text-muted-foreground focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
          />
          <button 
            type="submit" 
            disabled={isLoading || !localInput.trim()}
            className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}


