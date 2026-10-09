import { useEffect, useState, useRef } from "react";
import WhatsAppHeader from "../components/WhatsAppHeader";
import { getConversations, getConversationMessages, sendWhatsAppMessage, simulateReply, logChatAccess, getWhatsAppDashboardStats, isEventForActiveNumber } from "../services/whatsappApi";
import { useNumberSwitchGuard } from "../context/WhatsAppNumberContext";

import { useWebSockets } from "../../context/WebSocketContext";
import {
    FiSearch, FiSend, FiUser, FiCheck, FiClock, FiMessageCircle, FiChevronLeft,
    FiSmile, FiPhone, FiPaperclip, FiMoreVertical, FiImage, FiFileText, FiX,
    FiCheckCircle, FiPlus, FiFilter, FiCornerDownLeft, FiRefreshCw, FiDownload,
    FiAlertCircle
} from "react-icons/fi";

// Real message status indicator component (Sending, Sent, Delivered, Read, Failed)
function MessageStatus({ status }) {
    if (status === "sending" || status === "queued") return (
        <span className="flex items-center gap-0.5 text-slate-400" title="Sending to WhatsApp...">
            <FiClock size={11} className="animate-spin text-emerald-500" />
        </span>
    );
    if (status === "accepted") return (
        <span className="flex items-center text-slate-300" title="Accepted by Meta Cloud API — waiting for delivery confirmation">
            <FiClock size={11} />
        </span>
    );
    if (status === "sent") return <FiCheck size={11} className="text-slate-400" title="Sent by WhatsApp (confirmed by webhook)" />;
    if (status === "delivered") return (
        <span className="flex -space-x-1.5" title="Delivered to recipient">
            <FiCheck size={11} className="text-slate-400" /><FiCheck size={11} className="text-slate-400" />
        </span>
    );
    if (status === "read") return (
        <span className="flex -space-x-1.5" title="Read by recipient">
            <FiCheck size={11} className="text-blue-500" /><FiCheck size={11} className="text-blue-500" />
        </span>
    );
    if (status === "failed") return (
        <span className="text-[9px] text-rose-500 font-bold bg-rose-50 border border-rose-200 px-1 py-0.2 rounded" title="Failed to deliver">
            Failed
        </span>
    );
    return null;
}

const EMOJIS = ["😊", "👋", "✅", "🚀", "💬", "📌", "👍", "❤️", "📍", "🎉"];

// Dummy phone and name filters to ensure only real chats are displayed
const DUMMY_PHONES = new Set([
    "+91 98765 43210", "+91 98765 43211", "+91 98765 43212", "+91 98765 43213", "+91 98765 43214",
    "+91-9876543210", "+91-9876543211", "+91-9876543212", "+91-9876543213", "+91-9876543214",
    "+91 98765 43215", "+91 98765 43216", "+91 98765 43217", "+91 98765 43218", "+91 98765 43219",
    "9876543210", "9876543211", "9876543212", "9876543213", "9876543214",
    "+91-0000000000", "0000000000", "1234"
]);

const DUMMY_NAMES = new Set([
    "Rahul Sharma", "Priya Patel", "Amit Verma", "Sneha Gupta", "Rohit Singh", "Customer"
]);

const isDummyConversation = (c) => {
    if (!c) return true;
    const phone = (c.recipient_phone || "").trim();
    const cleanPhone = phone.replace(/\D/g, "");
    const name = (c.recipient || "").trim();
    if (DUMMY_NAMES.has(name) && ["9876543210", "9876543211", "9876543212", "9876543213", "9876543214"].includes(cleanPhone)) return true;
    if (DUMMY_PHONES.has(phone) || DUMMY_PHONES.has(cleanPhone)) return true;
    if (c.source === "simulation" || c.mode === "simulation") return true;
    if (c.last_message?.source === "simulation" || c.last_message?.mode === "simulation") return true;
    return false;
};

function WhatsAppInbox() {
    const [conversations, setConversations] = useState([]);
    const [selectedConv, setSelectedConv] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [filterTab, setFilterTab] = useState("all");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [showMobileChat, setShowMobileChat] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    
    // Real WhatsApp Provider & New Chat States
    const [providerInfo, setProviderInfo] = useState(null);
    const [sendError, setSendError] = useState(null);
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [newChatPhone, setNewChatPhone] = useState("");
    const [newChatName, setNewChatName] = useState("");
    const [newChatMessage, setNewChatMessage] = useState("");
    const [creatingChat, setCreatingChat] = useState(false);

    // Enhanced Simulate Modal State
    const [simName, setSimName] = useState("");
    const [simPhone, setSimPhone] = useState("");
    const [simContent, setSimContent] = useState("");
    const [simReplyTime, setSimReplyTime] = useState("Just Now");
    const [showSimModal, setShowSimModal] = useState(false);
    const [simulating, setSimulating] = useState(false);

    const chatEndRef = useRef(null);
    const { whatsappSocket } = useWebSockets();

    // Helper: Mark conversation as READ persistently
    const markConversationAsRead = (convId) => {
        setConversations(prev => prev.map(c => {
            if (c.conversation_id === convId && (c.unread_count > 0 || c.unread_count === undefined)) {
                return { ...c, unread_count: 0 };
            }
            return c;
        }));
    };

    const handleSelectConversation = (conv) => {
        if (!conv) return;
        setSelectedConv(conv);
        setShowMobileChat(true);
        // Automatically mark as read & remove green unread badge immediately
        markConversationAsRead(conv.conversation_id);
        fetchMessages(conv);
    };

    const normalizePhone = (phone) => (phone || "").replace(/\D/g, "");

    const fetchConversations = async () => {
        try {
            const apiData = await getConversations();
            
            // Only keep real, valid conversations from the database
            let realList = (Array.isArray(apiData) ? apiData : []).filter(c => !isDummyConversation(c));

            // Ensure conversations with inbound messages are marked has_reply = true
            realList = realList.map(c => {
                const isReplied = c.has_reply || c.last_message?.direction === "inbound" || (c.messages && c.messages.some(m => m.direction === "inbound"));
                return { ...c, has_reply: isReplied };
            });

            // Sort by latest updated_at
            realList.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
            setConversations(realList);

            // Select active conversation
            setSelectedConv(prevSelected => {
                if (prevSelected) {
                    const match = realList.find(c => c.conversation_id === prevSelected.conversation_id);
                    if (match) return match;
                }
                if (realList.length > 0) {
                    const first = realList[0];
                    markConversationAsRead(first.conversation_id);
                    fetchMessages(first);
                    return first;
                }
                return null;
            });
        } catch (err) {
            console.error("Failed to load conversations", err);
            setConversations([]);
            setSelectedConv(null);
            setMessages([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchMessages = async (conv) => {
        if (!conv) {
            setMessages([]);
            return;
        }

        let apiMsgs = [];
        const convId = conv.conversation_id || conv.id || conv.recipient_phone;
        if (convId) {
            try {
                apiMsgs = await getConversationMessages(convId);
            } catch (err) {
                console.error("Failed to load messages from API", err);
            }
        }

        // Keep strictly real messages, excluding any dummy or simulated data
        const realMsgs = (Array.isArray(apiMsgs) ? apiMsgs : []).filter(m => 
            m.source !== "simulation" && 
            m.mode !== "simulation" &&
            !DUMMY_NAMES.has(m.sender) &&
            !DUMMY_PHONES.has(m.sender_phone)
        );

        if (realMsgs.length > 0) {
            setMessages(realMsgs);
        } else if (conv.messages && conv.messages.length > 0) {
            const validConvMsgs = conv.messages.filter(m => m.source !== "simulation" && m.mode !== "simulation");
            setMessages(validConvMsgs);
        } else if (conv.last_message && conv.last_message.source !== "simulation" && conv.last_message.mode !== "simulation") {
            setMessages([conv.last_message]);
        } else {
            setMessages([]);
        }
    };

    useEffect(() => {
        fetchConversations();
        getWhatsAppDashboardStats().then(stats => {
            if (stats?.provider) {
                setProviderInfo(stats.provider);
            }
        }).catch(e => console.warn("Provider fetch error:", e));
    }, []);

    useEffect(() => {
        if (selectedConv) {
            fetchMessages(selectedConv);
            const convId = selectedConv.conversation_id || selectedConv.id || selectedConv.recipient_phone;
            if (convId) {
                logChatAccess(convId, {
                    contact_phone: selectedConv.recipient_phone,
                    contact_name: selectedConv.recipient
                });
            }
        }
    }, [selectedConv]);


    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // WebSocket real-time updates & new message/reply logic
    useEffect(() => {
        if (!whatsappSocket) return;
        const handleEvent = (data) => {
            // Events of other business numbers never enter this number's inbox.
            if (!isEventForActiveNumber(data?.data)) return;
            if (data.event === "new_message") {
                const msg = data.data;
                if (!msg) return;
                if (msg.source === "simulation" || msg.mode === "simulation") return;
                const senderP = (msg.sender_phone || "").trim();
                const recP = (msg.recipient_phone || "").trim();
                if (DUMMY_PHONES.has(senderP) || DUMMY_PHONES.has(recP)) return;
                if (DUMMY_NAMES.has(msg.sender) || DUMMY_NAMES.has(msg.recipient)) return;

                const isReply = msg.direction === "inbound";
                const rawPhone = isReply ? (msg.sender_phone || msg.recipient_phone) : (msg.recipient_phone || msg.sender_phone);
                const msgPhone = normalizePhone(rawPhone);
                const activePhone = selectedConv ? normalizePhone(selectedConv.recipient_phone) : "";

                const isCurrentActive = selectedConv && (
                    msg.conversation_id === selectedConv.conversation_id ||
                    (msgPhone && activePhone && msgPhone === activePhone)
                );

                if (isCurrentActive) {
                    setMessages(prev => {
                        if (prev.find(m => m._id === msg._id)) return prev;
                        return [...prev, msg];
                    });
                }

                // Instantly update conversations list, unread badge & move to top
                setConversations(prev => {
                    const matchIdx = prev.findIndex(c => 
                        c.conversation_id === msg.conversation_id ||
                        (msgPhone && normalizePhone(c.recipient_phone) === msgPhone)
                    );
                    if (matchIdx !== -1) {
                        const updated = [...prev];
                        const target = updated[matchIdx];
                        const newUnread = isReply ? (isCurrentActive ? 0 : (target.unread_count || 0) + 1) : target.unread_count;
                        
                        updated[matchIdx] = {
                            ...target,
                            last_message: msg,
                            updated_at: msg.created_at || new Date().toISOString(),
                            unread_count: newUnread,
                            has_reply: isReply ? true : target.has_reply,
                        };
                        updated.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
                        return updated;
                    } else {
                        // Create brand new conversation entry
                        const targetName = isReply ? (msg.sender_name || msg.sender) : (msg.recipient_name || msg.recipient);
                        const cleanName = (targetName && targetName !== "DelegateX") ? targetName : "Customer";
                        const targetPhone = isReply ? msg.sender_phone : msg.recipient_phone;

                        const newC = {
                            conversation_id: msg.conversation_id || `conv-${Date.now()}`,
                            recipient: cleanName,
                            recipient_phone: targetPhone || "",
                            unread_count: isReply && !isCurrentActive ? 1 : 0,
                            has_reply: isReply,
                            updated_at: msg.created_at || new Date().toISOString(),
                            last_message: msg,
                            messages: [msg]
                        };
                        return [newC, ...prev];
                    }
                });
            }
            if (data.event === "message_status_updated") {
                const { message_id, status } = data.data;
                setMessages(prev => prev.map(m => (m._id === message_id || m.wamid === message_id || m.metadata?.wamid === message_id) ? { ...m, status } : m));
            }
        };
        whatsappSocket.on("message", handleEvent);
        return () => whatsappSocket.off("message", handleEvent);
    }, [whatsappSocket, selectedConv]);

    useNumberSwitchGuard(!!newMessage.trim() || !!newChatMessage.trim(), "You have an unsent WhatsApp message.");

    const handleSend = async () => {
        if (!newMessage.trim() || !selectedConv || sending) return;
        const text = newMessage.trim();
        const recipientPhone = selectedConv.recipient_phone;
        const recipientName = selectedConv.recipient || "Contact";

        setSending(true);
        setSendError(null);

        // Optimistic UI state with sending status (clock indicator)
        const tempId = `temp-${Date.now()}`;
        const tempMsg = {
            _id: tempId,
            direction: "outbound",
            sender: "DelegateX",
            content: text,
            status: "sending",
            created_at: new Date().toISOString()
        };

        setMessages(prev => [...prev, tempMsg]);
        setNewMessage("");

        try {
            const res = await sendWhatsAppMessage({
                to: recipientPhone,
                recipient_phone: recipientPhone,
                recipient_name: recipientName,
                message: text,
                content: text,
            });

            const realMsg = res.data || res;
            const realId = realMsg._id || res.message_id || tempId;
            const realStatus = realMsg.status || "sent";

            // Update optimistic message with real message response from backend & Meta Cloud API
            setMessages(prev => prev.map(m => m._id === tempId ? {
                ...tempMsg,
                ...realMsg,
                _id: realId,
                status: realStatus,
                wamid: realMsg.wamid || res.message_id,
            } : m));

            // Refresh conversations so list shows latest outbound message
            fetchConversations();
        } catch (err) {
            const errMsg = err.response?.data?.detail || err.message || "Failed to send message via WhatsApp Cloud API";
            console.error("[WhatsApp Send Error]", errMsg);
            // Mark optimistic message as failed
            setMessages(prev => prev.map(m => m._id === tempId ? {
                ...tempMsg,
                status: "failed",
                error: errMsg
            } : m));
            setSendError(errMsg);
        } finally {
            setSending(false);
            setShowEmojiPicker(false);
        }
    };

    const handleStartNewChat = async (e) => {
        e?.preventDefault();
        const rawPhone = newChatPhone.trim();
        if (!rawPhone) return;
        setCreatingChat(true);

        const cleanPhone = rawPhone.replace(/\D/g, "");
        const formattedPhone = cleanPhone.length === 10 ? `+91 ${cleanPhone}` : rawPhone.startsWith("+") ? rawPhone : `+${cleanPhone}`;
        const name = newChatName.trim() || `WhatsApp Contact (${formattedPhone})`;
        const convId = `conv-${Date.now()}`;

        const newConv = {
            conversation_id: convId,
            recipient: name,
            recipient_phone: formattedPhone,
            unread_count: 0,
            has_reply: false,
            updated_at: new Date().toISOString(),
            messages: [],
        };

        if (newChatMessage.trim()) {
            const firstMsgText = newChatMessage.trim();
            try {
                const res = await sendWhatsAppMessage({
                    to: formattedPhone,
                    recipient_phone: formattedPhone,
                    recipient_name: name,
                    message: firstMsgText,
                    content: firstMsgText,
                });
                const realMsg = res.data || res;
                newConv.last_message = {
                    ...realMsg,
                    direction: "outbound",
                    sender: "DelegateX",
                    content: firstMsgText,
                    status: realMsg.status || "sent",
                    created_at: new Date().toISOString()
                };
                newConv.messages = [newConv.last_message];
            } catch (err) {
                const errMsg = err.response?.data?.detail || err.message || "Failed to send message";
                setSendError(errMsg);
            }
        }

        setConversations(prev => [newConv, ...prev.filter(c => c.recipient_phone !== formattedPhone)]);
        setSelectedConv(newConv);
        setMessages(newConv.messages || []);
        setShowMobileChat(true);
        setShowNewChatModal(false);
        setNewChatPhone("");
        setNewChatName("");
        setNewChatMessage("");
        setCreatingChat(false);
    };

    const handleSimulateReplySubmit = async (e) => {
        e?.preventDefault();
        if (!simContent.trim()) return;
        setSimulating(true);

        const targetPhone = simPhone.trim() || selectedConv?.recipient_phone || "+91 98765 99999";
        const targetName = simName.trim() || selectedConv?.recipient || "Customer";
        const replyText = simContent.trim();
        const nowIso = new Date().toISOString();

        const newReplyMsg = {
            _id: `sim-m-${Date.now()}`,
            direction: "inbound",
            sender: targetName,
            sender_phone: targetPhone,
            content: replyText,
            status: "delivered",
            created_at: nowIso
        };

        try {
            await simulateReply({
                sender_phone: targetPhone,
                sender_name: targetName,
                content: replyText,
            });
        } catch (err) {
            console.warn("API simulation fallback");
        }

        // Update Conversations & Auto Move to "replies" with unread badge if not active
        setConversations(prev => {
            const idx = prev.findIndex(c => c.recipient_phone === targetPhone || c.recipient === targetName);
            let updatedList = [...prev];

            if (idx !== -1) {
                const target = updatedList[idx];
                const isActiveConv = selectedConv?.conversation_id === target.conversation_id;
                updatedList[idx] = {
                    ...target,
                    last_message: newReplyMsg,
                    updated_at: nowIso,
                    unread_count: isActiveConv ? 0 : (target.unread_count || 0) + 1,
                    has_reply: true
                };
                if (isActiveConv) {
                    setMessages(m => [...m, newReplyMsg]);
                }
            } else {
                const newConvObj = {
                    conversation_id: `conv-sim-${Date.now()}`,
                    recipient: targetName,
                    recipient_phone: targetPhone,
                    unread_count: 1,
                    has_reply: true,
                    updated_at: nowIso,
                    last_message: newReplyMsg,
                    messages: [
                        { _id: `out-init-${Date.now()}`, direction: "outbound", sender: "DelegateX", content: `Welcome to DelegateX!`, status: "read", created_at: new Date(Date.now() - 60000).toISOString() },
                        newReplyMsg
                    ]
                };
                updatedList.unshift(newConvObj);
            }

            updatedList.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
            return updatedList;
        });

        // Automatically switch filter tab to "replies" for instant feedback
        setFilterTab("replies");

        // Clear form & close modal
        setSimContent("");
        setSimName("");
        setSimPhone("");
        setSimulating(false);
        setShowSimModal(false);
    };

    // Filter Logic
    const filteredConversations = conversations.filter(conv => {
        if (isDummyConversation(conv)) return false;
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
            conv.recipient?.toLowerCase().includes(query) ||
            conv.recipient_phone?.includes(query) ||
            conv.last_message?.content?.toLowerCase().includes(query) ||
            (conv.messages && conv.messages.some(m => m.content?.toLowerCase().includes(query)));

        if (!matchesSearch) return false;

        // Unread Filter: Display ONLY conversations where unread_count > 0
        if (filterTab === "unread") return (conv.unread_count || 0) > 0;
        if (filterTab === "active") return true;
        if (filterTab === "replies") {
            // Replies Filter: Display conversations with customer replies regardless of read/unread state
            return conv.has_reply === true || conv.last_message?.direction === "inbound";
        }
        return true;
    });

    const formatTime = (isoStr) => {
        if (!isoStr) return "";
        try { return new Date(isoStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
    };

    const formatDate = (isoStr) => {
        if (!isoStr) return "";
        try {
            const d = new Date(isoStr);
            const today = new Date();
            if (d.toDateString() === today.toDateString()) return "Today";
            return d.toLocaleDateString();
        } catch { return ""; }
    };

    const groupedMessages = messages.reduce((groups, msg) => {
        const dateKey = msg.created_at ? msg.created_at.split("T")[0] : "today";
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(msg);
        return groups;
    }, {});

    if (loading) {
        return (
            <div className="space-y-4 animate-pulse mt-2">
                <div className="h-20 bg-slate-200/60 rounded-2xl"></div>
                <div className="h-[calc(100vh-14rem)] bg-slate-100 border border-slate-200/80 rounded-2xl"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4 mt-2 pb-6 animate-fade-in">
            <WhatsAppHeader activeTab="inbox" searchQuery={searchQuery} onSearchChange={setSearchQuery} />

            {/* Omnichannel Dual Panel Container */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-[0_4px_20px_rgba(15,23,42,0.03)] overflow-hidden" style={{ height: "calc(100vh - 14rem)" }}>
                <div className="flex h-full">

                    {/* Left Panel — Conversation List */}
                    <div className={`${showMobileChat ? "hidden md:flex" : "flex"} w-full md:w-80 lg:w-96 flex-col border-r border-slate-100 bg-slate-50/40`}>
                        {/* Conversation Header Toolbar */}
                        <div className="p-3.5 border-b border-slate-100 space-y-2.5 bg-white">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-800 font-display">Conversations</span>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => setShowNewChatModal(true)}
                                        className="text-[10px] font-bold text-white bg-[#25D366] hover:bg-emerald-600 px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                        title="Start a real WhatsApp chat"
                                    >
                                        <FiPlus size={11} /> New Chat
                                    </button>
                                    <button
                                        onClick={() => setShowSimModal(true)}
                                        className="text-[10px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg transition border border-slate-200/60 cursor-pointer flex items-center gap-1 shadow-2xs"
                                        title="Simulate inbound customer reply"
                                    >
                                        Simulate
                                    </button>
                                </div>
                            </div>

                            {/* Filter Tabs (All | Unread | Active | Replies) */}
                            <div className="flex gap-1 p-1 bg-slate-100/70 rounded-xl">
                                {[
                                    { id: "all", label: "All" },
                                    { id: "unread", label: "Unread" },
                                    { id: "active", label: "Active" },
                                    { id: "replies", label: "Replies" },
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setFilterTab(tab.id)}
                                        className={`flex-1 py-1.5 text-[10px] font-bold capitalize rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${filterTab === tab.id
                                            ? "bg-white text-slate-900 shadow-xs border border-slate-200/50"
                                            : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
                                            }`}
                                    >
                                        <span>{tab.label}</span>
                                        {tab.id === "unread" && conversations.some(c => (c.unread_count || 0) > 0) && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#25D366]"></span>
                                        )}
                                        {tab.id === "replies" && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Conversation Cards List */}
                        <div className="flex-1 overflow-y-auto divide-y divide-slate-100/60">
                            {filteredConversations.length === 0 ? (
                                filterTab === "replies" ? (
                                    /* PROFESSIONAL EMPTY STATE FOR REPLIES TAB */
                                    <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-3 animate-fade-in">
                                        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-2xs">
                                            <FiCornerDownLeft size={24} />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-slate-800 font-display">No Customer Replies Yet</h4>
                                            <p className="text-[10px] text-slate-400 mt-1 max-w-xs leading-relaxed">
                                                Customer replies will automatically appear here once they respond to your WhatsApp messages.
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setShowSimModal(true)}
                                            className="px-4 py-2 bg-[#25D366] hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer flex items-center gap-1.5 mt-1"
                                        >
                                            <FiPlus size={13} /> Simulate Reply
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-2">
                                        <FiMessageCircle size={32} className="text-slate-300" />
                                        <p className="text-xs text-slate-400 font-medium">No conversations found.</p>
                                    </div>
                                )
                            ) : (
                                filteredConversations.map((conv) => {
                                    const isSelected = selectedConv?.conversation_id === conv.conversation_id;
                                    const isRepliedConv = conv.has_reply || conv.last_message?.direction === "inbound";
                                    const isLastInbound = conv.last_message?.direction === "inbound";

                                    return (
                                        <button
                                            key={conv.conversation_id}
                                            onClick={() => handleSelectConversation(conv)}
                                            className={`w-full flex items-start gap-3 p-3.5 hover:bg-slate-100/70 transition-all text-left cursor-pointer relative group ${isSelected ? "bg-emerald-50/60 border-l-4 border-l-[#25D366]" : ""}`}
                                        >
                                            <div className="relative shrink-0">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-500 to-[#25D366] flex items-center justify-center text-white font-bold text-xs shadow-xs">
                                                    {(conv.recipient || "?")[0]?.toUpperCase()}
                                                </div>
                                                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"></span>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-baseline">
                                                    <div className="flex items-center gap-1.5 truncate">
                                                        <span className={`text-xs truncate ${conv.unread_count > 0 ? "font-extrabold text-slate-900" : "font-bold text-slate-800"}`}>{conv.recipient || "Unknown"}</span>
                                                        {isRepliedConv && (
                                                            <span className="text-[8px] font-extrabold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded border border-emerald-200 shrink-0">
                                                                Replied
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-[9px] text-slate-400 font-medium shrink-0 ml-1">{formatTime(conv.updated_at)}</span>
                                                </div>

                                                {/* Latest Message Preview */}
                                                <p className={`text-[10px] truncate mt-0.5 ${conv.unread_count > 0 ? "font-bold text-slate-900" : isLastInbound ? "text-slate-800 font-semibold" : "text-slate-400"}`}>
                                                    {isLastInbound ? (
                                                        <span className="text-emerald-600 font-bold">Customer replied: </span>
                                                    ) : (
                                                        <span className="text-slate-400 font-medium">✓ You: </span>
                                                    )}
                                                    {conv.last_message?.content || "..."}
                                                </p>

                                                <div className="flex items-center justify-between mt-1">
                                                    <span className="text-[9px] text-slate-400 font-mono">{conv.recipient_phone}</span>
                                                    {/* Green Unread Badge */}
                                                    {conv.unread_count > 0 && (
                                                        <span className="w-4 h-4 bg-[#25D366] text-white text-[8px] font-extrabold rounded-full flex items-center justify-center shadow-xs animate-pulse-subtle">
                                                            {conv.unread_count}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Right Panel — Authentic WhatsApp Web Chat Layout */}
                    <div className={`${showMobileChat ? "flex" : "hidden md:flex"} flex-1 flex-col bg-wa-pattern bg-[#E5DDD5]/20 relative`}>
                        {selectedConv ? (
                            <>
                                {/* Conversation Header */}
                                <div className="px-5 py-3 border-b border-slate-200/70 flex items-center justify-between bg-white/90 backdrop-blur-md sticky top-0 z-10 shadow-xs">
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setShowMobileChat(false)} className="md:hidden p-1 text-slate-400 hover:text-slate-600">
                                            <FiChevronLeft size={20} />
                                        </button>
                                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-500 to-[#25D366] flex items-center justify-center text-white font-bold text-xs shadow-xs">
                                            {(selectedConv.recipient || "?")[0]?.toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="text-xs font-bold text-slate-900">{selectedConv.recipient}</p>
                                                {selectedConv.has_reply && (
                                                    <span className="text-[8px] font-extrabold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded border border-emerald-200">
                                                        Replied
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[9px] text-emerald-600 font-mono font-semibold flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> online · {selectedConv.recipient_phone}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {providerInfo?.type === "meta_cloud" ? (
                                            <span className="text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-md uppercase flex items-center gap-1.5 shadow-2xs">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                Meta WhatsApp Cloud API
                                            </span>
                                        ) : providerInfo?.type === "simulation" ? (
                                            <span className="text-[9px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-md uppercase flex items-center gap-1.5 shadow-2xs">
                                                Simulation Mode
                                            </span>
                                        ) : (
                                            <span className="text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-md uppercase flex items-center gap-1.5 shadow-2xs">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                Meta WhatsApp Cloud API
                                            </span>
                                        )}
                                    </div>


                                </div>

                                {/* Messages Stream */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                    {Object.entries(groupedMessages).map(([dateKey, msgs]) => (
                                        <div key={dateKey}>
                                            <div className="flex items-center justify-center my-3">
                                                <span className="text-[9px] font-bold bg-white text-slate-500 px-3 py-1 rounded-full shadow-xs border border-slate-200/60 uppercase tracking-wider">
                                                    {formatDate(msgs[0]?.created_at)}
                                                </span>
                                            </div>
                                            {msgs.map((msg) => (
                                                <div key={msg._id || Math.random()} className={`flex mb-2 ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                                                    <div className={`max-w-[70%] px-3.5 py-2.5 rounded-2xl shadow-xs animate-fade-in ${msg.direction === "outbound"
                                                        ? "bg-[#DCF8C6] text-slate-900 rounded-tr-none border border-emerald-200/60"
                                                        : "bg-white text-slate-900 rounded-tl-none border border-slate-200/60"
                                                        }`}>
                                                        {msg.direction === "inbound" && (
                                                            <p className="text-[9px] font-bold text-emerald-700 mb-0.5">{msg.sender || selectedConv.recipient}</p>
                                                        )}
                                                        <p className="text-xs leading-relaxed whitespace-pre-wrap font-sans">{msg.content}</p>
                                                        <div className="flex items-center justify-end gap-1 mt-1">
                                                            <span className="text-[8px] text-slate-400 font-mono">{formatTime(msg.created_at)}</span>
                                                            {msg.direction === "outbound" && <MessageStatus status={msg.status || "read"} />}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                    <div ref={chatEndRef} />
                                </div>

                                {/* Send Error Alert Banner */}
                                {sendError && (
                                    <div className="mx-4 mb-2 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center justify-between shadow-xs animate-shake">
                                        <div className="flex items-center gap-2">
                                            <FiAlertCircle className="text-rose-600 shrink-0" size={16} />
                                            <div>
                                                <span className="font-bold text-[10px] bg-rose-200/80 text-rose-800 px-1.5 py-0.5 rounded uppercase mr-1.5">Meta API Error</span>
                                                <span className="text-[11px] font-medium">{sendError}</span>
                                            </div>
                                        </div>
                                        <button onClick={() => setSendError(null)} className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer">
                                            <FiX size={14} />
                                        </button>
                                    </div>
                                )}

                                {/* Footer Input Toolbar */}
                                <div className="p-3 border-t border-slate-200/70 bg-white/95 backdrop-blur-md relative">
                                    <div className="flex items-center gap-2">
                                        <div className="relative">
                                            <button
                                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                                className="p-2 text-slate-400 hover:text-amber-500 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                                            >
                                                <FiSmile size={18} />
                                            </button>

                                            {showEmojiPicker && (
                                                <div className="absolute bottom-full left-0 mb-2 bg-white border border-slate-200 rounded-xl p-2 shadow-xl grid grid-cols-5 gap-1.5 w-44 z-20">
                                                    {EMOJIS.map((e) => (
                                                        <button
                                                            key={e}
                                                            onClick={() => { setNewMessage(prev => prev + e); setShowEmojiPicker(false); }}
                                                            className="p-1 hover:bg-slate-100 rounded text-sm text-center cursor-pointer"
                                                        >
                                                            {e}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <input
                                            type="text"
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                                            placeholder="Type a message..."
                                            className="flex-1 px-4 py-2.5 text-xs bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition font-sans"
                                        />

                                        <button
                                            onClick={handleSend}
                                            disabled={!newMessage.trim() || sending}
                                            className="p-2.5 bg-[#25D366] hover:bg-emerald-600 text-white rounded-xl transition shadow-md shadow-emerald-500/20 cursor-pointer disabled:opacity-40"
                                        >
                                            <FiSend size={16} />
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3">
                                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
                                    <FiMessageCircle size={28} />
                                </div>
                                <h3 className="text-sm font-bold text-slate-800 font-display">Omnichannel WhatsApp Inbox</h3>
                                <p className="text-xs text-slate-400 max-w-xs">Select a conversation from the left panel to start messaging or test customer replies.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* SIMULATE INCOMING REPLY MODAL */}
            {showSimModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setShowSimModal(false)}></div>
                    <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-200/90 animate-slide-up space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 font-display">Simulate Customer WhatsApp Reply</h3>
                                <p className="text-[10px] text-slate-400 mt-0.5">Test real-time reply dispatches & AI auto-reply triggers</p>
                            </div>
                            <button onClick={() => setShowSimModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><FiX size={16} /></button>
                        </div>

                        <form onSubmit={handleSimulateReplySubmit} className="space-y-3.5">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Customer Name</label>
                                <input
                                    type="text"
                                    placeholder="Customer Name (e.g. Purab / Client)"
                                    value={simName}
                                    onChange={(e) => setSimName(e.target.value)}
                                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Phone Number</label>
                                <input
                                    type="text"
                                    placeholder="Phone Number (e.g. +91 91794 85720)"
                                    value={simPhone}
                                    onChange={(e) => setSimPhone(e.target.value)}
                                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Message Content</label>
                                <textarea
                                    required
                                    placeholder="Incoming reply (e.g. 'Can we schedule a meeting tomorrow?')"
                                    value={simContent}
                                    onChange={(e) => setSimContent(e.target.value)}
                                    rows={3}
                                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl resize-none font-sans focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Reply Time</label>
                                <input
                                    type="text"
                                    value={simReplyTime}
                                    onChange={(e) => setSimReplyTime(e.target.value)}
                                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-600 font-semibold"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowSimModal(false)} className="flex-1 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition cursor-pointer">
                                    Cancel
                                </button>
                                <button type="submit" disabled={simulating} className="flex-1 py-2.5 text-xs font-semibold text-white bg-[#25D366] hover:bg-emerald-600 rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50">
                                    {simulating ? <FiRefreshCw className="animate-spin" size={13} /> : <FiSend size={13} />}
                                    <span>{simulating ? "Dispatching..." : "Dispatch Reply"}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* NEW CHAT MODAL */}
            {showNewChatModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setShowNewChatModal(false)}></div>
                    <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-200/90 animate-slide-up space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 font-display">Start New WhatsApp Chat</h3>
                                <p className="text-[10px] text-slate-400 mt-0.5">Send a real WhatsApp message to any phone number</p>
                            </div>
                            <button onClick={() => setShowNewChatModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><FiX size={16} /></button>
                        </div>

                        <form onSubmit={handleStartNewChat} className="space-y-3.5">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">WhatsApp Phone Number *</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="e.g. +91 91794 85720 or 9179485720"
                                    value={newChatPhone}
                                    onChange={(e) => setNewChatPhone(e.target.value)}
                                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                />
                                <p className="text-[9px] text-slate-400 mt-1">Enter with country code or 10-digit Indian number.</p>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Contact Name (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. My Phone / Purab"
                                    value={newChatName}
                                    onChange={(e) => setNewChatName(e.target.value)}
                                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">First Message (Optional)</label>
                                <textarea
                                    placeholder="e.g. Hello, testing real WhatsApp automation!"
                                    value={newChatMessage}
                                    onChange={(e) => setNewChatMessage(e.target.value)}
                                    rows={2}
                                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl resize-none font-sans focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowNewChatModal(false)} className="flex-1 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition cursor-pointer">
                                    Cancel
                                </button>
                                <button type="submit" disabled={creatingChat || !newChatPhone.trim()} className="flex-1 py-2.5 text-xs font-semibold text-white bg-[#25D366] hover:bg-emerald-600 rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50">
                                    {creatingChat ? <FiRefreshCw className="animate-spin" size={13} /> : <FiSend size={13} />}
                                    <span>{creatingChat ? "Starting..." : "Start Chat"}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default WhatsAppInbox;
