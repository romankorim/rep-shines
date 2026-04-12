import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ai-chat")({
  component: AiChatPage,
});

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

function AiChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Msg = { role: "user", content: text };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ messages: allMessages }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Request failed" }));
        toast.error(err.error || `Error ${resp.status}`);
        setIsLoading(false);
        return;
      }

      if (!resp.body) {
        toast.error("No response stream");
        setIsLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) =>
                    i === prev.length - 1 ? { ...m, content: assistantContent } : m
                  );
                }
                return [...prev, { role: "assistant", content: assistantContent }];
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to send message");
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-7rem)] sm:h-[calc(100vh-8rem)]">
        <h1 className="text-lg font-semibold mb-3">AI chat</h1>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto border border-border bg-muted/30 p-3 sm:p-4 space-y-4"
        >
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2">
              <Bot className="h-10 w-10 opacity-40" />
              <p>Ask anything about your deals, reps, or comp plans</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center bg-primary text-primary-foreground mt-0.5">
                  <Bot className="h-4 w-4" />
                </div>
              )}
              <div
                className={`max-w-[85%] sm:max-w-[75%] px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none
                    [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_table]:my-3
                    [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold
                    [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2
                    [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2
                    [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2
                    [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1
                    [&_p]:my-2 [&_p]:leading-relaxed
                    [&_ul]:my-2 [&_ul]:pl-5 [&_ul]:list-disc
                    [&_ol]:my-2 [&_ol]:pl-5 [&_ol]:list-decimal
                    [&_li]:my-1
                    [&_strong]:font-semibold
                    [&_blockquote]:border-l-4 [&_blockquote]:border-primary/30 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:my-2
                    [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs [&_code]:font-mono
                    [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:overflow-x-auto [&_pre]:my-3 [&_pre]:text-xs
                    [&_hr]:my-4 [&_hr]:border-border
                  ">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
              {msg.role === "user" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center bg-secondary text-secondary-foreground mt-0.5">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center bg-primary text-primary-foreground">
                <Bot className="h-4 w-4" />
              </div>
              <div className="px-3 py-2 bg-card border border-border">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex gap-2 mt-3">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Ask about deals, reps, commissions..."
            disabled={isLoading}
            className="flex-1 min-h-[44px]"
          />
          <Button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="min-h-[44px] min-w-[44px]"
            size="icon"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
