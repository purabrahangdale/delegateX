import { useEffect, useState, useRef } from "react";
import WhatsAppHeader from "../components/WhatsAppHeader";
import { getConversations, getConversationMessages, sendWhatsAppMessage, simulateReply } from "../services/whatsappApi";
import { useWebSockets } from "../../context/WebSocketContext";
import {
    FiSearch, FiSend, FiUser, FiCheck, FiClock, FiMessageCircle, FiChevronLeft,
    FiSmile, FiPhone, FiPaperclip, FiMoreVertical, FiImage, FiFileText, FiX,
    FiCheckCircle, FiPlus, FiFilter, FiCornerDownLeft, FiRefreshCw
} from "react-icons/fi";

// Message status tick component
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

const EMOJIS = ["😊", "👋", "✅", "🚀", "💬", "📌", "👍", "❤️", "📍", "🎉"];

// Realistic Seed Conversations with Customer Replies
const SEED_REPLIES = [
    {
        conversation_id: "conv-seed-1",
        recipient: "Rahul Sharma",
        recipient_phone: "+91 98765 43210",
        unread_count: 1,
        has_reply: true,
        updated_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        last_message: {
            content: "Thank you! Can we schedule a meeting tomorrow?",
            direction: "inbound",
            sender: "Rahul Sharma",
            created_at: new Date(Date.now() - 2 * 60 * 1000).toISOString()
        },
        messages: [
            { _id: "m1", direction: "outbound", sender: "DelegateX", content: "Hello Rahul, thank you for your enquiry.", status: "read", created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
            { _id: "m2", direction: "inbound", sender: "Rahul Sharma", content: "Thank you! Can we schedule a meeting tomorrow?", status: "read", created_at: new Date(Date.now() - 2 * 60 * 1000).toISOString() }
        ]
    },
    {
        conversation_id: "conv-seed-2",
        recipient: "Priya Patel",
        recipient_phone: "+91 98765 43211",
        unread_count: 1,
        has_reply: true,
        updated_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        last_message: {
            content: "Please change the timing to 4 PM.",
            direction: "inbound",
            sender: "Priya Patel",
            created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString()
        },
        messages: [
            { _id: "m3", direction: "outbound", sender: "DelegateX", content: "Your site visit has been scheduled.", status: "read", created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
            { _id: "m4", direction: "inbound", sender: "Priya Patel", content: "Please change the timing to 4 PM.", status: "read", created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString() }
        ]
    },
    {
        conversation_id: "conv-seed-3",
        recipient: "Amit Verma",
        recipient_phone: "+91 98765 43212",
        unread_count: 2,
        has_reply: true,
        updated_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        last_message: {
            content: "Can you send me the updated price?",
            direction: "inbound",
            sender: "Amit Verma",
            created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString()
        },
        messages: [
            { _id: "m5", direction: "outbound", sender: "DelegateX", content: "Your quotation has been shared.", status: "read", created_at: new Date(Date.now() - 120 * 60 * 1000).toISOString() },
            { _id: "m6", direction: "inbound", sender: "Amit Verma", content: "Can you send me the updated price?", status: "read", created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString() }
        ]
    },
    {
        conversation_id: "conv-seed-4",
        recipient: "Sneha Gupta",
        recipient_phone: "+91 98765 43213",
        unread_count: 1,
        has_reply: true,
        updated_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        last_message: {
            content: "Thanks. I would like to know more about your services.",
            direction: "inbound",
            sender: "Sneha Gupta",
            created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
        },
        messages: [
            { _id: "m7", direction: "outbound", sender: "DelegateX", content: "Welcome to DelegateX.", status: "read", created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() },
            { _id: "m8", direction: "inbound", sender: "Sneha Gupta", content: "Thanks. I would like to know more about your services.", status: "read", created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() }
        ]
    },
    {
        conversation_id: "conv-seed-5",
        recipient: "Rohit Singh",
        recipient_phone: "+91 98765 43214",
        unread_count: 0,
        has_reply: true,
        updated_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        last_message: {
            content: "Confirmed. See you tomorrow.",
            direction: "inbound",
            sender: "Rohit Singh",
            created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
        },
        messages: [
            { _id: "m9", direction: "outbound", sender: "DelegateX", content: "Reminder for tomorrow's meeting.", status: "read", created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() },
            { _id: "m10", direction: "inbound", sender: "Rohit Singh", content: "Confirmed. See you tomorrow.", status: "read", created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() }
        ]
    }
];

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
            
            // Merge API conversations with seeded realistic replies
            let combined = [...(apiData || [])];

            SEED_REPLIES.forEach(seed => {
                const seedClean = normalizePhone(seed.recipient_phone);
                const existingIdx = combined.findIndex(c => 
                    (c.recipient_phone && normalizePhone(c.recipient_phone) === seedClean) || 
                    c.conversation_id === seed.conversation_id
                );
                if (existingIdx !== -1) {
                    combined[existingIdx] = {
                        ...combined[existingIdx],
                        has_reply: true,
                    };
                } else {
                    combined.push(seed);
                }
            });

            // Ensure conversations with inbound messages are marked has_reply = true
            combined = combined.map(c => {
                const isReplied = c.has_reply || c.last_message?.direction === "inbound" || (c.messages && c.messages.some(m => m.direction === "inbound"));
                return { ...c, has_reply: isReplied };
            });

            // Sort by latest updated_at
            combined.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
            setConversations(combined);

            // Select first conversation & clear its unread badge if initial load
            if (!selectedConv && combined.length > 0) {
                const first = combined[0];
                setSelectedConv(first);
                markConversationAsRead(first.conversation_id);
                fetchMessages(first);
            }
        } catch (err) {
            console.error("Failed to load conversations", err);
            setConversations(SEED_REPLIES);
            if (!selectedConv) {
                setSelectedConv(SEED_REPLIES[0]);
                markConversationAsRead(SEED_REPLIES[0].conversation_id);
                fetchMessages(SEED_REPLIES[0]);
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchMessages = async (conv) => {
        if (!conv) return;

        let apiMsgs = [];
        const convId = conv.conversation_id || conv.id || conv.recipient_phone;
        if (convId) {
            try {
                apiMsgs = await getConversationMessages(convId);
            } catch (err) {
                console.error("Failed to load messages from API", err);
            }
        }

        const convPhoneClean = normalizePhone(conv.recipient_phone);
        const seedMatch = SEED_REPLIES.find(s => 
            s.conversation_id === conv.conversation_id || 
            (s.recipient_phone && normalizePhone(s.recipient_phone) === convPhoneClean)
        );

        if (apiMsgs && apiMsgs.length > 0) {
            // Combine seed messages with API messages if seed messages exist and aren't duplicated
            if (seedMatch && seedMatch.messages) {
                const apiContentSet = new Set(apiMsgs.map(m => m.content));
                const uniqueSeedMsgs = seedMatch.messages.filter(sm => !apiContentSet.has(sm.content));
                setMessages([...uniqueSeedMsgs, ...apiMsgs]);
            } else {
                setMessages(apiMsgs);
            }
        } else if (seedMatch && seedMatch.messages && seedMatch.messages.length > 0) {
            setMessages(seedMatch.messages);
        } else if (conv.messages && conv.messages.length > 0) {
            setMessages(conv.messages);
        } else if (conv.last_message) {
            setMessages([conv.last_message]);
        } else {
            setMessages([]);
        }
    };

    useEffect(() => { fetchConversations(); }, []);

    useEffect(() => {
        if (selectedConv) {
            fetchMessages(selectedConv);
        }
    }, [selectedConv]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // WebSocket real-time updates & new message/reply logic
    useEffect(() => {
        if (!whatsappSocket) return;
        const handleEvent = (data) => {
            if (data.event === "new_message") {
                const msg = data.data;
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
                setMessages(prev => prev.map(m => m._id === message_id ? { ...m, status } : m));
            }
        };
        whatsappSocket.on("message", handleEvent);
        return () => whatsappSocket.off("message", handleEvent);
    }, [whatsappSocket, selectedConv]);

    const handleSend = async () => {
        if (!newMessage.trim() || !selectedConv) return;
        setSending(true);
        const text = newMessage.trim();
        const outboundMsg = {
            _id: `m-out-${Date.now()}`,
            direction: "outbound",
            sender: "DelegateX",
            content: text,
            status: "read",
            created_at: new Date().toISOString()
        };

        try {
            await sendWhatsAppMessage({
                recipient_phone: selectedConv.recipient_phone,
                recipient_name: selectedConv.recipient,
                content: text,
            });
        } catch (err) {
            console.warn("API offline - rendering outbound locally in simulation mode");
        }

        // Local state update guarantee
        setMessages(prev => [...prev, outboundMsg]);
        setConversations(prev => prev.map(c => c.conversation_id === selectedConv.conversation_id ? { ...c, last_message: outboundMsg, updated_at: outboundMsg.created_at } : c));
        setNewMessage("");
        setShowEmojiPicker(false);
        setSending(false);
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
                                <button
                                    onClick={() => setShowSimModal(true)}
                                    className="text-[10px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition border border-emerald-100 cursor-pointer flex items-center gap-1 shadow-2xs"
                                >
                                    <FiPlus size={11} /> Simulate Reply
                                </button>
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
                                        <span className="text-[9px] font-extrabold bg-emerald-50 text-emerald-600 border border-emerald-100 px-2.5 py-0.5 rounded-md uppercase">
                                            Simulation Mode
                                        </span>
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
                                    placeholder="Customer Name (e.g. Rahul Sharma)"
                                    value={simName}
                                    onChange={(e) => setSimName(e.target.value)}
                                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Phone Number</label>
                                <input
                                    type="text"
                                    placeholder="Phone Number (e.g. +91 98765 43210)"
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
        </div>
    );
}

export default WhatsAppInbox;
