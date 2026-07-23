import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { 
    FiMessageSquare, 
    FiX, 
    FiSend, 
    FiTrash2, 
    FiCopy, 
    FiCheck, 
    FiPaperclip, 
    FiUpload, 
    FiCpu, 
    FiCornerDownLeft 
} from "react-icons/fi";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function AIChatbot() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState(null);
    const [uploadStatus, setUploadStatus] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    
    const userEmail = localStorage.getItem("userEmail") || "admin@delegatex.com";
    // Map default admin email to Administrator role, otherwise look up dynamically or default to Developer
    const userRole = userEmail === "admin@delegatex.com" ? "Administrator" : "Developer";

    // Load messages from session storage
    useEffect(() => {
        const stored = sessionStorage.getItem("chatbot_history");
        if (stored) {
            try {
                setMessages(JSON.parse(stored));
            } catch (e) {
                console.error("Failed to parse chat history", e);
            }
        } else {
            // Default welcome message
            setMessages([
                {
                    sender: "ai",
                    text: "Hello! I am your **DelegateX AI Assistant**. I can help you with active projects, task delegations, employee workloads, CRM leads, and general company policies. What would you like to know today?",
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }
            ]);
        }
    }, []);

    // Persist messages
    useEffect(() => {
        if (messages.length > 0) {
            sessionStorage.setItem("chatbot_history", JSON.stringify(messages));
        }
    }, [messages]);

    // Auto scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isOpen]);

    const handleSend = async (textToSend) => {
        const queryText = textToSend || input;
        if (!queryText.trim()) return;

        if (!textToSend) setInput("");

        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Append user message
        const newMessages = [
            ...messages,
            { sender: "user", text: queryText, timestamp }
        ];
        setMessages(newMessages);
        setIsLoading(true);

        try {
            const res = await axios.post(
                `${API_BASE}/api/chatbot/query`,
                { query: queryText },
                {
                    headers: {
                        "X-User-Email": userEmail,
                        "X-User-Role": userRole
                    }
                }
            );
            
            setMessages(prev => [
                ...prev,
                {
                    sender: "ai",
                    text: res.data.answer || "Sorry, I couldn't generate a response.",
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }
            ]);
        } catch (error) {
            console.error("Chatbot query error:", error);
            setMessages(prev => [
                ...prev,
                {
                    sender: "ai",
                    text: "⚠️ **Connection Error**: Unable to reach the AI assistant. Please make sure the backend is running.",
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = (text, index) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const handleClear = async () => {
        if (window.confirm("Are you sure you want to clear this conversation history?")) {
            setMessages([
                {
                    sender: "ai",
                    text: "Conversation cleared. How can I help you now?",
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }
            ]);
            sessionStorage.removeItem("chatbot_history");
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        setUploadStatus("Uploading & indexing...");
        
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await axios.post(`${API_BASE}/api/chatbot/upload-document`, formData, {
                headers: {
                    "Content-Type": "multipart/form-data"
                }
            });
            setUploadStatus("Successfully indexed!");
            
            // Add system notification in chat
            setMessages(prev => [
                ...prev,
                {
                    sender: "ai",
                    text: `📎 **Document Indexed**: Added \`${file.name}\` successfully to my knowledge base. You can now ask questions about it!`,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }
            ]);
        } catch (err) {
            console.error("Upload failed", err);
            setUploadStatus("Upload failed.");
            alert(err.response?.data?.detail || "Failed to index file.");
        } finally {
            setIsUploading(false);
            setTimeout(() => setUploadStatus(""), 4000);
        }
    };

    const suggestions = [
        "Show today's CRM summary",
        "Show converted leads",
        "Who is working on Project Alpha?",
        "Show overdue delegations",
        "Explain our leave policy",
        "What is the delegation approval process?"
    ];

    const renderMarkdown = (text) => {
        if (!text) return "";
        
        // Split by code blocks
        const parts = text.split(/(```[\s\S]*?```)/g);
        
        return parts.map((part, index) => {
            if (part.startsWith("```")) {
                const match = part.match(/```(\w*)\n([\s\S]*?)```/);
                const lang = match ? match[1] : "";
                const code = match ? match[2] : part.slice(3, -3);
                return (
                    <pre key={index} className="bg-slate-950 text-slate-100 p-3 rounded-xl my-2 overflow-x-auto text-[11px] font-mono relative group border border-slate-800">
                        <button 
                            onClick={() => navigator.clipboard.writeText(code)} 
                            className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 bg-slate-850 text-slate-400 p-1 rounded hover:text-slate-200 transition"
                            title="Copy code"
                        >
                            <FiCopy size={12} />
                        </button>
                        <code>{code}</code>
                    </pre>
                );
            }
            
            let html = part;
            
            // Replace Headers
            html = html.replace(/^### (.*$)/gim, '<h4 class="text-xs font-bold mt-3 mb-1 text-slate-900 font-display">$1</h4>');
            html = html.replace(/^## (.*$)/gim, '<h3 class="text-sm font-bold mt-4 mb-1.5 text-slate-950 font-display">$1</h3>');
            html = html.replace(/^# (.*$)/gim, '<h2 class="text-base font-bold mt-4 mb-2 text-slate-950 font-display">$1</h2>');
            
            // Replace Bullet Points
            html = html.replace(/^\s*-\s+(.*$)/gim, '<li class="ml-4 list-disc text-slate-700">$1</li>');
            html = html.replace(/^\s*\*\s+(.*$)/gim, '<li class="ml-4 list-disc text-slate-700">$1</li>');
            
            // Bold text
            html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900">$1</strong>');
            
            // Inline Code
            html = html.replace(/`(.*?)`/g, '<code class="bg-indigo-50 border border-indigo-100 px-1 py-0.5 rounded font-mono text-[10px] text-indigo-600 font-bold">$1</code>');
            
            const lines = html.split('\n').map((line, idx) => {
                if (line.trim().startsWith('<li') || line.trim().startsWith('<h')) {
                    return line;
                }
                return line ? `<p class="mb-1 leading-relaxed text-slate-700">${line}</p>` : '';
            }).join('');

            return <div key={index} dangerouslySetInnerHTML={{ __html: lines }} className="space-y-0.5" />;
        });
    };

    return (
        <>
            {/* FLOATING ACTION BUTTON */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed bottom-6 right-6 h-14 w-14 rounded-full flex items-center justify-center text-white shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 z-50 cursor-pointer ${
                    isOpen 
                    ? "bg-slate-900 hover:bg-slate-950" 
                    : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/25 animate-bounce-slow"
                }`}
                title={isOpen ? "Close AI Assistant" : "Open AI Assistant"}
            >
                {isOpen ? <FiX size={22} /> : <FiMessageSquare size={22} />}
            </button>

            {/* CHAT WINDOW INTERFACE */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 w-[92vw] sm:w-[400px] h-[75vh] max-h-[640px] rounded-2xl shadow-2xl bg-white border border-slate-200/80 flex flex-col overflow-hidden z-50 animate-slide-up glass-modal">
                    
                    {/* HEADER */}
                    <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-4 text-white flex items-center justify-between border-b border-slate-900">
                        <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-lg bg-indigo-600/20 flex items-center justify-center border border-indigo-500/35 text-indigo-400">
                                <FiCpu className="animate-pulse" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold tracking-tight font-display">DelegateX AI Assistant</h3>
                                <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                                    <span>Active • Hybrid RAG Engine</span>
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={handleClear}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800/40 transition cursor-pointer"
                                title="Clear conversation"
                            >
                                <FiTrash2 size={15} />
                            </button>
                            <button 
                                onClick={() => setIsOpen(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/40 transition cursor-pointer"
                            >
                                <FiX size={15} />
                            </button>
                        </div>
                    </div>

                    {/* MESSAGES BODY */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.map((msg, index) => (
                            <div 
                                key={index} 
                                className={`flex flex-col max-w-[85%] ${
                                    msg.sender === "user" ? "ml-auto items-end" : "mr-auto items-start"
                                }`}
                            >
                                <div className={`px-4 py-2.5 rounded-2xl text-xs relative group font-sans ${
                                    msg.sender === "user" 
                                    ? "bg-indigo-600 text-white rounded-tr-none shadow-md" 
                                    : "bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200"
                                }`}>
                                    {msg.sender === "ai" ? (
                                        renderMarkdown(msg.text)
                                    ) : (
                                        <p className="leading-relaxed whitespace-pre-wrap font-medium">{msg.text}</p>
                                    )}

                                    {/* Copy Response Button for AI */}
                                    {msg.sender === "ai" && (
                                        <button 
                                            onClick={() => handleCopy(msg.text, index)}
                                            className="absolute -right-7 bottom-1 p-1 rounded bg-white border border-slate-200 text-slate-400 hover:text-slate-700 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                                            title="Copy answer"
                                        >
                                            {copiedIndex === index ? <FiCheck size={10} className="text-emerald-500" /> : <FiCopy size={10} />}
                                        </button>
                                    )}
                                </div>
                                <span className="text-[9px] text-slate-400 mt-1 px-1 font-medium">{msg.timestamp}</span>
                            </div>
                        ))}

                        {/* Loader Skeletons */}
                        {isLoading && (
                            <div className="mr-auto items-start max-w-[85%] flex flex-col space-y-1">
                                <div className="bg-slate-100 border border-slate-200 px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-1.5">
                                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                </div>
                                <span className="text-[8px] text-slate-400 px-1 font-semibold">AI is analyzing context...</span>
                            </div>
                        )}
                        
                        <div ref={messagesEndRef} />
                    </div>

                    {/* SUGGESTION CHIPS */}
                    {messages.length <= 1 && !isLoading && (
                        <div className="p-3 bg-slate-50/50 border-t border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 font-display">Suggested Prompts</p>
                            <div className="flex flex-wrap gap-1.5 max-h-[85px] overflow-y-auto pr-1">
                                {suggestions.map((s, idx) => (
                                    <button 
                                        key={idx}
                                        onClick={() => handleSend(s)}
                                        className="text-[10px] text-indigo-700 bg-indigo-50/60 hover:bg-indigo-50 hover:scale-[1.02] border border-indigo-100 rounded-full px-2.5 py-1 text-left font-medium transition cursor-pointer"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* UPLOAD STATUS FOOTER BAR */}
                    {uploadStatus && (
                        <div className="bg-indigo-50 border-t border-indigo-100 text-[10px] text-indigo-800 font-bold px-4 py-1 text-center animate-pulse">
                            {uploadStatus}
                        </div>
                    )}

                    {/* INPUT FORM */}
                    <div className="p-3 border-t border-slate-100 bg-white flex items-center gap-2">
                        {/* File Upload Attachment Button */}
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition cursor-pointer border border-slate-100"
                            title="Index document (PDF/Docx/TXT/MD)"
                            disabled={isUploading}
                        >
                            <FiPaperclip size={16} />
                        </button>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileUpload} 
                            accept=".pdf,.docx,.doc,.txt,.md,.markdown" 
                            className="hidden" 
                        />
                        
                        <form 
                            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                            className="flex-1 flex bg-slate-50 border border-slate-200 rounded-xl overflow-hidden focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition"
                        >
                            <input 
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ask about tasks, active projects, leads..."
                                className="flex-1 px-3 py-2 text-xs bg-transparent outline-none text-slate-800 placeholder-slate-400"
                                disabled={isLoading}
                            />
                            <button 
                                type="submit"
                                className="px-3 text-indigo-600 hover:text-indigo-800 transition disabled:text-slate-350 cursor-pointer"
                                disabled={!input.trim() || isLoading}
                            >
                                <FiSend size={14} />
                            </button>
                        </form>
                    </div>

                </div>
            )}
        </>
    );
}

export default AIChatbot;
