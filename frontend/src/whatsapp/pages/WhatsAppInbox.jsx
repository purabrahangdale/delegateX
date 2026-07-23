import { useEffect, useState, useRef } from "react";
import { getConversations, getConversationMessages, sendWhatsAppMessage, simulateReply } from "../services/whatsappApi";
import { useWebSockets } from "../../context/WebSocketContext";
import { FiSearch, FiSend, FiUser, FiCheck, FiClock, FiMessageCircle, FiChevronLeft, FiSmile, FiPhone } from "react-icons/fi";

// Message status indicator component
function MessageStatus({ status }) {
    if (status === "queued") return <FiClock size={11} className="text-slate-400" />;
    if (status === "sent") return <FiCheck size={11} className="text-slate-400" />;
    if (status === "delivered") return (
        <span className="flex -space-x-1.5"><FiCheck size={11} className="text-slate-400" /><FiCheck size={11} className="text-slate-400" /></span>
    );
    if (status === "read") return (
        <span className="flex -space-x-1.5"><FiCheck size={11} className="text-blue-500" /><FiCheck size={11} className="text-blue-500" /></span>
    );
    if (status === "failed") return <span className="text-[9px] text-rose-500 font-bold">Failed</span>;
    return null;
}

function WhatsAppInbox() {
    const [conversations, setConversations] = useState([]);
    const [selectedConv, setSelectedConv] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [filter, setFilter] = useState("all");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [showMobileChat, setShowMobileChat] = useState(false);
    const [simName, setSimName] = useState("");
    const [simPhone, setSimPhone] = useState("");
    const [simContent, setSimContent] = useState("");
    const [showSimModal, setShowSimModal] = useState(false);
    const chatEndRef = useRef(null);
    const { whatsappSocket } = useWebSockets();

    const fetchConversations = async () => {
        try {
            const data = await getConversations();
            setConversations(data);
        } catch (err) {
            console.error("Failed to load conversations", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchMessages = async (convId) => {
        try {
            const msgs = await getConversationMessages(convId);
            setMessages(msgs);
        } catch (err) {
            console.error("Failed to load messages", err);
        }
    };

    useEffect(() => { fetchConversations(); }, []);

    useEffect(() => {
        if (selectedConv) fetchMessages(selectedConv.conversation_id);
    }, [selectedConv]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Real-time WebSocket updates
    useEffect(() => {
        if (!whatsappSocket) return;
        const handleEvent = (data) => {
            if (data.event === "new_message") {
                const msg = data.data;
                // Update messages if in current conversation
                if (selectedConv && msg.conversation_id === selectedConv.conversation_id) {
                    setMessages(prev => {
                        if (prev.find(m => m._id === msg._id)) return prev;
                        return [...prev, msg];
                    });
                }
                fetchConversations();
            }
            if (data.event === "message_status_updated") {
                const { message_id, status } = data.data;
                setMessages(prev => prev.map(m => m._id === message_id ? { ...m, status } : m));
            }
        };
        whatsappSocket.on("message", handleEvent);
        return () => whatsappSocket.off("message", handleEvent);
    }, [whatsappSocket, selectedConv]);

    const handleSend = async () => {
        if (!newMessage.trim() || !selectedConv) return;
        setSending(true);
        try {
            await sendWhatsAppMessage({
                recipient_phone: selectedConv.recipient_phone,
                recipient_name: selectedConv.recipient,
                content: newMessage,
            });
            setNewMessage("");
        } catch (err) {
            console.error("Send error:", err);
        } finally {
            setSending(false);
        }
    };

    const handleSimulateReply = async () => {
        if (!simContent.trim()) return;
        try {
            await simulateReply({
                sender_phone: simPhone || selectedConv?.recipient_phone || "+91-0000000000",
                sender_name: simName || selectedConv?.recipient || "Customer",
                content: simContent,
            });
            setSimContent("");
            setSimName("");
            setSimPhone("");
            setShowSimModal(false);
        } catch (err) {
            console.error("Simulate reply error:", err);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const filteredConversations = conversations.filter(conv => {
        const matchesSearch = conv.recipient?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            conv.recipient_phone?.includes(searchQuery);
        return matchesSearch;
    });

    const formatTime = (isoStr) => {
        if (!isoStr) return "";
        try {
            const d = new Date(isoStr);
            return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        } catch { return ""; }
    };

    const formatDate = (isoStr) => {
        if (!isoStr) return "";
        try {
            const d = new Date(isoStr);
            const today = new Date();
            if (d.toDateString() === today.toDateString()) return "Today";
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
            return d.toLocaleDateString();
        } catch { return ""; }
    };

    // Group messages by date
    const groupedMessages = messages.reduce((groups, msg) => {
        const dateKey = msg.created_at ? msg.created_at.split("T")[0] : "unknown";
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(msg);
        return groups;
    }, {});

    if (loading) {
        return (
            <div className="space-y-4 animate-pulse mt-2">
                <div className="h-8 w-48 bg-slate-200 rounded-xl"></div>
                <div className="h-[calc(100vh-14rem)] bg-slate-100 border border-slate-200 rounded-2xl"></div>
            </div>
        );
    }

    return (
        <div className="mt-2">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-tr from-green-500 to-emerald-600 text-white text-sm shadow-lg shadow-green-500/20">
                        <FiMessageCircle size={16} />
                    </span>
                    WhatsApp Inbox
                </h1>
                <p className="text-slate-500 text-xs mt-1">View and manage all WhatsApp automation conversations.</p>
            </div>

            {/* Main Inbox Container */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-[0_2px_8px_rgba(15,23,42,0.01)] overflow-hidden" style={{ height: "calc(100vh - 14rem)" }}>
                <div className="flex h-full">

                    {/* Left Panel — Conversation List */}
                    <div className={`${showMobileChat ? "hidden md:flex" : "flex"} w-full md:w-80 lg:w-96 flex-col border-r border-slate-100`}>
                        {/* Search & Actions */}
                        <div className="p-3 border-b border-slate-100 space-y-2">
                            <div className="relative">
                                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                <input
                                    type="text"
                                    placeholder="Search conversations..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-300 transition"
                                />
                            </div>
                            <button
                                onClick={() => setShowSimModal(true)}
                                className="w-full text-[10px] font-bold text-green-600 bg-green-50 hover:bg-green-100 py-2 rounded-lg transition cursor-pointer border border-green-100"
                            >
                                + Simulate Incoming Message
                            </button>
                        </div>

                        {/* Conversations */}
                        <div className="flex-1 overflow-y-auto">
                            {filteredConversations.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center p-6">
                                    <FiMessageCircle size={32} className="text-slate-200 mb-3" />
                                    <p className="text-xs text-slate-400">No conversations yet.</p>
                                    <p className="text-[10px] text-slate-300 mt-1">Create a CRM lead to trigger a welcome message.</p>
                                </div>
                            ) : (
                                filteredConversations.map((conv) => (
                                    <button
                                        key={conv.conversation_id}
                                        onClick={() => { setSelectedConv(conv); setShowMobileChat(true); }}
                                        className={`w-full flex items-start gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors text-left cursor-pointer border-b border-slate-50 ${selectedConv?.conversation_id === conv.conversation_id ? "bg-green-50/50 border-l-2 border-l-green-500" : ""}`}
                                    >
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-green-400 to-emerald-500 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm">
                                            {(conv.recipient || "?")[0]?.toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-baseline">
                                                <span className="text-xs font-semibold text-slate-800 truncate">{conv.recipient || "Unknown"}</span>
                                                <span className="text-[9px] text-slate-400 font-medium shrink-0 ml-2">{formatTime(conv.updated_at)}</span>
                                            </div>
                                            <p className="text-[10px] text-slate-400 truncate mt-0.5">{conv.last_message?.content?.substring(0, 50) || "..."}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[9px] text-slate-300 font-mono">{conv.recipient_phone}</span>
                                                {conv.unread_count > 0 && (
                                                    <span className="w-4 h-4 bg-green-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">{conv.unread_count}</span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Right Panel — Chat Window */}
                    <div className={`${showMobileChat ? "flex" : "hidden md:flex"} flex-1 flex-col`}>
                        {selectedConv ? (
                            <>
                                {/* Chat Header */}
                                <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                                    <button onClick={() => setShowMobileChat(false)} className="md:hidden p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                                        <FiChevronLeft size={18} />
                                    </button>
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-green-400 to-emerald-500 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                                        {(selectedConv.recipient || "?")[0]?.toUpperCase()}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-slate-800">{selectedConv.recipient}</p>
                                        <p className="text-[10px] text-slate-400 font-mono">{selectedConv.recipient_phone}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] bg-green-50 text-green-600 px-2 py-0.5 rounded-md font-bold border border-green-100">Simulation</span>
                                    </div>
                                </div>

                                {/* Messages Area */}
                                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e2e8f0' fill-opacity='0.2'%3E%3Ccircle cx='7' cy='7' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}>
                                    {Object.entries(groupedMessages).map(([dateKey, msgs]) => (
                                        <div key={dateKey}>
                                            {/* Date Divider */}
                                            <div className="flex items-center justify-center my-3">
                                                <span className="text-[9px] bg-white text-slate-400 px-3 py-1 rounded-lg shadow-sm border border-slate-100 font-semibold">
                                                    {formatDate(msgs[0]?.created_at)}
                                                </span>
                                            </div>
                                            {msgs.map((msg) => (
                                                <div key={msg._id} className={`flex mb-1.5 ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                                                    <div className={`max-w-[75%] px-3 py-2 rounded-2xl shadow-sm ${msg.direction === "outbound"
                                                        ? "bg-emerald-100 text-slate-800 rounded-br-md"
                                                        : "bg-white text-slate-800 rounded-bl-md border border-slate-100"
                                                        }`}>
                                                        {msg.direction === "inbound" && (
                                                            <p className="text-[9px] font-bold text-green-600 mb-0.5">{msg.sender}</p>
                                                        )}
                                                        <p className="text-[11px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                                        <div className="flex items-center justify-end gap-1 mt-1">
                                                            <span className="text-[8px] text-slate-400">{formatTime(msg.created_at)}</span>
                                                            {msg.direction === "outbound" && <MessageStatus status={msg.status} />}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                    <div ref={chatEndRef} />
                                </div>

                                {/* Message Input */}
                                <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                                    <div className="flex items-end gap-2">
                                        <div className="flex-1 relative">
                                            <textarea
                                                value={newMessage}
                                                onChange={(e) => setNewMessage(e.target.value)}
                                                onKeyDown={handleKeyPress}
                                                placeholder="Type a message..."
                                                rows={1}
                                                className="w-full px-4 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-300 transition resize-none"
                                            />
                                        </div>
                                        <button
                                            onClick={handleSend}
                                            disabled={!newMessage.trim() || sending}
                                            className="p-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-all duration-200 disabled:opacity-50 cursor-pointer shadow-sm shadow-green-500/20"
                                        >
                                            <FiSend size={16} />
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-green-100 to-emerald-100 flex items-center justify-center mb-4">
                                    <FiMessageCircle size={32} className="text-green-400" />
                                </div>
                                <h3 className="text-sm font-bold text-slate-700 font-display">DelegateX WhatsApp</h3>
                                <p className="text-xs text-slate-400 mt-1 max-w-xs">Select a conversation to view messages or create a CRM lead to trigger an automated welcome message.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Simulate Incoming Message Modal */}
            {showSimModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowSimModal(false)}></div>
                    <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-200 animate-slide-up">
                        <h3 className="text-sm font-bold text-slate-900 font-display mb-4">Simulate Incoming Message</h3>
                        <div className="space-y-3">
                            <input
                                type="text"
                                placeholder="Sender Name"
                                value={simName}
                                onChange={(e) => setSimName(e.target.value)}
                                className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20"
                            />
                            <input
                                type="text"
                                placeholder="Sender Phone (e.g. +91-9876543210)"
                                value={simPhone}
                                onChange={(e) => setSimPhone(e.target.value)}
                                className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20"
                            />
                            <textarea
                                placeholder="Message content..."
                                value={simContent}
                                onChange={(e) => setSimContent(e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 resize-none"
                            />
                        </div>
                        <div className="flex gap-3 mt-4">
                            <button onClick={() => setShowSimModal(false)} className="flex-1 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition cursor-pointer">Cancel</button>
                            <button onClick={handleSimulateReply} className="flex-1 py-2.5 text-xs font-semibold text-white bg-green-500 rounded-xl hover:bg-green-600 transition cursor-pointer shadow-sm shadow-green-500/20">Send</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default WhatsAppInbox;
