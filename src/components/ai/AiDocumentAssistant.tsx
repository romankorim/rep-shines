import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, Send, Loader2, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

interface AiDocumentAssistantProps {
  document: any;
}

const quickQuestions = [
  "Analyzuj tento doklad",
  "Navrhni predkontáciu",
  "Sú tu nejaké problémy?",
  "Aká je správna DPH sadzba?",
];

export function AiDocumentAssistant({ document: doc }: AiDocumentAssistantProps) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Reset when document changes
  useEffect(() => {
    setMessages([]);
    setInput("");
  }, [doc?.id]);

  const documentContext = doc ? {
    file_name: doc.file_name,
    document_type: doc.document_type,
    supplier_name: doc.supplier_name,
    supplier_ico: doc.supplier_ico,
    supplier_dic: doc.supplier_dic,
    supplier_ic_dph: doc.supplier_ic_dph,
    document_number: doc.document_number,
    variable_symbol: doc.variable_symbol,
    issue_date: doc.issue_date,
    due_date: doc.due_date,
    delivery_date: doc.delivery_date,
    total_amount: doc.total_amount,
    currency: doc.currency,
    tax_base: doc.tax_base,
    vat_amount: doc.vat_amount,
    vat_rate: doc.vat_rate,
    vat_breakdown: doc.vat_breakdown,
    expense_category: doc.expense_category,
    status: doc.status,
    ai_confidence: doc.ai_confidence,
  } : null;

  const streamChat = useCallback(async (allMessages: Msg[]) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Nie ste prihlásený. Obnovte stránku a skúste to znova.");
    }

    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ messages: allMessages, documentContext }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: "Chyba AI" }));
      throw new Error(err.error || "Chyba AI");
    }
    if (!resp.body) throw new Error("No stream");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let assistantSoFar = "";

    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      const content = assistantSoFar;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content } : m);
        }
        return [...prev, { role: "assistant", content }];
      });
    };

    let streamDone = false;
    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });
      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") { streamDone = true; break; }
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) upsert(content);
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }
  }, [documentContext]);

  const send = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || isLoading) return;
    const userMsg: Msg = { role: "user", content: msg };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setIsLoading(true);
    try {
      await streamChat(updated);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "assistant", content: `❌ ${e.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-primary/5">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold">AI Asistent</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {messages.length === 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-[11px] text-muted-foreground text-center">Opýtaj sa AI na tento doklad:</p>
            <div className="grid gap-1">
              {quickQuestions.map(q => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  disabled={isLoading}
                  className="text-left text-[11px] px-2.5 py-1.5 border border-border hover:bg-muted transition-colors text-muted-foreground disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex gap-1.5", msg.role === "user" ? "justify-end" : "justify-start")}>
            {msg.role === "assistant" && <Bot className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />}
            <div className={cn(
              "max-w-[90%] px-2.5 py-1.5 text-[11px]",
              msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
            )}>
              {msg.role === "assistant" ? (
                <div className="prose prose-xs prose-neutral dark:prose-invert max-w-none [&_p]:my-0.5 [&_ul]:my-0.5 [&_li]:my-0">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : msg.content}
            </div>
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-1.5">
            <Bot className="h-4 w-4 text-primary mt-0.5" />
            <div className="bg-muted px-2.5 py-1.5">
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border p-2">
        <div className="flex gap-1.5">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Opýtaj sa..."
            className="flex-1 border border-input bg-transparent px-2.5 py-1.5 text-[11px] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <Button size="sm" onClick={() => send()} disabled={!input.trim() || isLoading} className="h-auto px-2">
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
