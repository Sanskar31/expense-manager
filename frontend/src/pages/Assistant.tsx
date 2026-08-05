import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { useTheme } from '../contexts/ThemeContext';
import { request } from '../services/api';
import toast from 'react-hot-toast';

type Message = {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  chartData?: any[];
};

export default function Assistant() {
  const { theme } = useTheme();
  const [input, setInput] = useState('');
  const [model, setModel] = useState<'gemini-3.6-flash' | 'gemini-3.1-pro-preview'>('gemini-3.6-flash');
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'ai',
      text: 'Hi there! I am your AI Financial Assistant. Ask me anything about your spending habits, trends, or specific transactions. For example, "How much did I spend on office food last month?"'
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: input
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await request('/ai/query', {
        method: 'POST',
        body: JSON.stringify({ message: userMessage.text, model })
      });

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: response.text || 'I could not process your request.',
        chartData: response.chartData,
      };
      
      setMessages(prev => [...prev, aiResponse]);
    } catch (err: any) {
      if (err.message === "Rate limit exceeded") {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: `**Whoops! Rate Limit Hit 🚦**\n\nThe ${model.includes('pro') ? 'Pro' : 'Flash'} model is receiving too many requests right now. (The free tier limits Pro to 2 requests per minute).\n\nPlease wait a few seconds before asking again, or switch to the Flash model for faster limits!`
        }]);
      } else {
        toast.error("Failed to connect to AI Assistant");
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: 'Sorry, I am having trouble connecting to my brain right now. Please try again later.'
        }]);
      }
    } finally {
      setIsTyping(false);
    }
  };

  const renderMessageContent = (msg: Message) => {
    return (
      <div className="space-y-4 w-full">
        <div className="text-[15px] leading-relaxed">
          <ReactMarkdown
            components={{
              h1: ({node, ...props}) => <h1 className="text-xl font-bold mt-4 mb-2 text-zinc-900 dark:text-white" {...props} />,
              h2: ({node, ...props}) => <h2 className="text-lg font-bold mt-4 mb-2 text-zinc-900 dark:text-white" {...props} />,
              h3: ({node, ...props}) => <h3 className="text-base font-bold mt-4 mb-2 text-zinc-900 dark:text-white" {...props} />,
              p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
              ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-2 space-y-1" {...props} />,
              ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-2 space-y-1" {...props} />,
              li: ({node, ...props}) => <li {...props} />,
              strong: ({node, ...props}) => <strong className="font-semibold text-zinc-900 dark:text-white" {...props} />,
            }}
          >
            {msg.text}
          </ReactMarkdown>
        </div>
        
        {msg.chartData && (
          <div className="mt-4 bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800 shadow-sm w-full h-[250px] sm:h-[300px]">
             <ResponsiveContainer width="100%" height="100%">
              <BarChart data={msg.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 12 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 12 }}
                  tickFormatter={(val) => `₹${val}`}
                />
                <Tooltip 
                  cursor={{ fill: theme === 'dark' ? '#1e293b' : '#f1f5f9' }}
                  contentStyle={{ backgroundColor: theme === 'dark' ? '#18181b' : '#fff', borderRadius: '8px', border: `1px solid ${theme === 'dark' ? '#27272a' : '#e4e4e7'}` }}
                  formatter={(value: any) => [`₹${value.toLocaleString()}`, 'Amount']}
                  labelStyle={{ color: theme === 'dark' ? '#a1a1aa' : '#52525b', fontWeight: 600, marginBottom: '4px' }}
                  itemStyle={{ color: theme === 'dark' ? '#e4e4e7' : '#18181b' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {msg.chartData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={theme === 'dark' ? '#60a5fa' : '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50/50 dark:bg-zinc-950/50 relative">
      {/* Header */}
      <div className="px-6 py-5 border-b border-zinc-200/50 dark:border-zinc-800/50 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xl z-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 ring-2 ring-white/50 dark:ring-zinc-900/50">
            <Sparkles className="text-white w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">PocketLog AI</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">Powered by Gemini</p>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8">
        <div className="space-y-8 pb-40">
          {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 sm:gap-5 max-w-[95%] sm:max-w-[85%] ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}>
            <div className="flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center mt-1 hidden sm:flex shadow-sm">
              {msg.sender === 'user' ? (
                <div className="w-full h-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-800 rounded-2xl flex items-center justify-center ring-1 ring-black/5 dark:ring-white/10">
                  <User className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
                </div>
              ) : (
                <div className="w-full h-full bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center ring-1 ring-blue-500/20 dark:ring-blue-500/30">
                  <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
              )}
            </div>
            
            <div className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} w-full`}>
              <div 
                className={`w-full px-6 py-5 shadow-sm text-[15px] leading-relaxed transition-all duration-300 hover:shadow-md ${
                  msg.sender === 'user' 
                    ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-3xl rounded-tr-md shadow-blue-500/25' 
                    : 'bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border border-zinc-200/60 dark:border-zinc-800/60 rounded-3xl rounded-tl-md shadow-black/5'
                }`}
              >
                {renderMessageContent(msg)}
              </div>
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="flex gap-4 max-w-[80%] mr-auto animate-fade-in">
            <div className="flex-shrink-0 w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-2xl sm:flex items-center justify-center mt-1 hidden ring-1 ring-blue-500/20 dark:ring-blue-500/30">
              <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-pulse" />
            </div>
            <div className="flex flex-col items-start">
              <div className="px-6 py-4 bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-3xl rounded-tl-md shadow-sm shadow-black/5 flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 font-medium">Crunching your numbers...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-4" />
        </div>
      </div>

      {/* Floating Input Area */}
      <div className="absolute bottom-0 left-0 w-full p-4 sm:p-6 bg-gradient-to-t from-zinc-50 via-zinc-50/80 to-transparent dark:from-zinc-950 dark:via-zinc-950/80 pointer-events-none">
        <div className="max-w-4xl mx-auto pointer-events-auto">
          <form onSubmit={handleSend} className="relative flex items-end">
            {/* Model Selector Custom Dropdown */}
            <div className="absolute left-2 bottom-[14px] z-20 flex items-center">
              <button
                type="button"
                onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                className="flex items-center gap-1.5 bg-zinc-100/50 hover:bg-zinc-200/80 dark:bg-zinc-800/50 dark:hover:bg-zinc-700/80 text-[11px] font-bold rounded-full py-1.5 pl-3 pr-2 focus:outline-none transition-all backdrop-blur-md border border-zinc-200/50 dark:border-zinc-700/50 shadow-sm"
              >
                {model === 'gemini-3.6-flash' ? (
                  <span className="text-blue-600 dark:text-blue-400">⚡ Flash</span>
                ) : (
                  <span className="text-purple-600 dark:text-purple-400">🧠 Pro</span>
                )}
                <svg className={`w-3 h-3 text-zinc-400 transition-transform ${isModelMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
              </button>

              {isModelMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsModelMenuOpen(false)} />
                  <div className="absolute bottom-full left-0 mb-3 w-[140px] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl border border-zinc-200/60 dark:border-zinc-700/60 rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/40 overflow-hidden flex flex-col p-1.5 z-20 animate-in fade-in slide-in-from-bottom-2">
                    <button
                      type="button"
                      onClick={() => { setModel('gemini-3.6-flash'); setIsModelMenuOpen(false); }}
                      className={`text-left px-3 py-2.5 text-[13px] font-semibold rounded-xl transition-all flex items-center gap-2 ${model === 'gemini-3.6-flash' ? 'bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                    >
                      ⚡ Flash <span className="text-[10px] font-medium opacity-60">(Fast)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setModel('gemini-3.1-pro-preview'); setIsModelMenuOpen(false); }}
                      className={`text-left px-3 py-2.5 text-[13px] font-semibold rounded-xl transition-all flex items-center gap-2 mt-0.5 ${model === 'gemini-3.1-pro-preview' ? 'bg-purple-50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                    >
                      🧠 Pro <span className="text-[10px] font-medium opacity-60">(Smart)</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            <textarea
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e as any);
                }
              }}
              rows={1}
              placeholder="Ask anything..."
              className="w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200/60 dark:border-zinc-700/60 rounded-[28px] pl-[115px] pr-16 py-4 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] transition-all placeholder:text-zinc-400 font-medium resize-none max-h-32 overflow-y-auto scrollbar-hide"
              style={{ minHeight: '56px' }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="absolute right-2 bottom-2 p-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-200 disabled:dark:bg-zinc-800 text-white disabled:text-zinc-400 rounded-full transition-all flex items-center justify-center shadow-md shadow-blue-600/30 disabled:shadow-none hover:scale-105 active:scale-95"
            >
              <Send className="w-5 h-5 ml-0.5" />
            </button>
          </form>
          <p className="text-center text-xs text-zinc-400 mt-3 font-medium tracking-wide">
            PocketLog AI can make mistakes. Verify important financial data.
          </p>
        </div>
      </div>
    </div>
  );
}
