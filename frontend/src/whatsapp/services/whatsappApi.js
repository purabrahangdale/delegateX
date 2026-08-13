import axios from "axios";

const API = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || "https://delegatex.onrender.com",
});

// ── Dashboard ──────────────────────────────────────────────────
export const getWhatsAppDashboardStats = async () => {
    try {
        const response = await API.get("/api/whatsapp/dashboard/stats");
        return response.data;
    } catch (error) {
        console.error("WhatsApp Dashboard stats error:", error);
        return null;
    }
};

// ── Messages / Inbox ───────────────────────────────────────────
export const getConversations = async () => {
    try {
        const response = await API.get("/api/whatsapp/messages/conversations");
        return response.data.conversations || [];
    } catch (error) {
        console.error("WhatsApp conversations error:", error);
        return [];
    }
};

export const getConversationMessages = async (conversationId) => {
    try {
        const response = await API.get(`/api/whatsapp/messages/conversation/${conversationId}`);
        return response.data.messages || [];
    } catch (error) {
        console.error("WhatsApp messages error:", error);
        return [];
    }
};

export const sendWhatsAppMessage = async (data) => {
    try {
        const response = await API.post("/api/whatsapp/messages/send", data);
        return response.data;
    } catch (error) {
        console.error("WhatsApp send error:", error);
        throw error;
    }
};

export const simulateReply = async (data) => {
    try {
        const response = await API.post("/api/whatsapp/messages/simulate-reply", data);
        return response.data;
    } catch (error) {
        console.error("WhatsApp simulate reply error:", error);
        throw error;
    }
};

// ── Templates ──────────────────────────────────────────────────
export const getWhatsAppTemplates = async (params = {}) => {
    try {
        const response = await API.get("/api/whatsapp/templates", { params });
        return response.data.templates || [];
    } catch (error) {
        console.error("WhatsApp templates error:", error);
        return [];
    }
};

export const getWhatsAppTemplateNames = async () => {
    try {
        const response = await API.get("/api/whatsapp/templates/names");
        return response.data.names || [];
    } catch (error) {
        console.error("WhatsApp template names error:", error);
        return [];
    }
};

export const getWhatsAppTemplateInsights = async () => {
    try {
        const response = await API.get("/api/whatsapp/templates/insights");
        return response.data;
    } catch (error) {
        console.error("WhatsApp template insights error:", error);
        return null;
    }
};

export const toggleWhatsAppTemplateFavorite = async (templateId) => {
    try {
        const response = await API.post(`/api/whatsapp/templates/${templateId}/favorite`);
        return response.data;
    } catch (error) {
        console.error("WhatsApp toggle favorite error:", error);
        throw error;
    }
};

export const incrementWhatsAppTemplateView = async (templateId) => {
    try {
        const response = await API.post(`/api/whatsapp/templates/${templateId}/view`);
        return response.data;
    } catch (error) {
        console.error("WhatsApp increment view error:", error);
        return null;
    }
};

export const createWhatsAppTemplate = async (data) => {
    try {
        const response = await API.post("/api/whatsapp/templates", data);
        return response.data;
    } catch (error) {
        console.error("WhatsApp create template error:", error);
        throw error;
    }
};

export const updateWhatsAppTemplate = async (templateId, data) => {
    try {
        const response = await API.put(`/api/whatsapp/templates/${templateId}`, data);
        return response.data;
    } catch (error) {
        console.error("WhatsApp update template error:", error);
        throw error;
    }
};

export const deleteWhatsAppTemplate = async (templateId) => {
    try {
        await API.delete(`/api/whatsapp/templates/${templateId}`);
        return true;
    } catch (error) {
        console.error("WhatsApp delete template error:", error);
        throw error;
    }
};

export const seedWhatsAppTemplates = async () => {
    try {
        const response = await API.post("/api/whatsapp/templates/seed");
        return response.data;
    } catch (error) {
        console.error("WhatsApp seed templates error:", error);
        throw error;
    }
};

// ── Automation Logs ────────────────────────────────────────────
export const getAutomationLogs = async (params = {}) => {
    try {
        const response = await API.get("/api/whatsapp/logs", { params });
        return response.data;
    } catch (error) {
        console.error("WhatsApp logs error:", error);
        return { logs: [], total: 0 };
    }
};

// ── Settings ───────────────────────────────────────────────────
export const getWhatsAppSettings = async () => {
    try {
        const response = await API.get("/api/whatsapp/settings");
        return response.data;
    } catch (error) {
        console.error("WhatsApp settings error:", error);
        return null;
    }
};

export const updateWhatsAppSettings = async (data) => {
    try {
        const response = await API.put("/api/whatsapp/settings", data);
        return response.data;
    } catch (error) {
        console.error("WhatsApp settings update error:", error);
        throw error;
    }
};

// ── Manual Triggers ────────────────────────────────────────────
export const triggerAutomation = async (workflowName, payload = {}) => {
    try {
        const response = await API.post(`/api/whatsapp/automations/trigger/${workflowName}`, payload);
        return response.data;
    } catch (error) {
        console.error("WhatsApp trigger error:", error);
        throw error;
    }
};

// ── AI Writing Assistant ───────────────────────────────────────
export const processWhatsAppAiAssistant = async (payload) => {
    try {
        const response = await API.post("/api/whatsapp/ai-assistant", payload);
        return response.data;
    } catch (error) {
        console.error("WhatsApp AI assistant error:", error);
        throw error;
    }
};

// ── Global DND / Blocklist ─────────────────────────────────────
export const getWhatsAppDNDList = async (params = {}) => {
    try {
        const response = await API.get("/api/whatsapp/dnd", { params });
        return response.data;
    } catch (error) {
        console.error("WhatsApp DND fetch error:", error);
        return { items: [], total: 0, summary: {} };
    }
};

export const addWhatsAppDNDNumber = async (data) => {
    try {
        const response = await API.post("/api/whatsapp/dnd", data);
        return response.data;
    } catch (error) {
        console.error("WhatsApp DND add error:", error);
        throw error;
    }
};

export const addWhatsAppDNDBulk = async (items) => {
    try {
        const response = await API.post("/api/whatsapp/dnd/bulk", { items });
        return response.data;
    } catch (error) {
        console.error("WhatsApp DND bulk add error:", error);
        throw error;
    }
};

export const deleteWhatsAppDNDNumber = async (phone) => {
    try {
        const response = await API.delete(`/api/whatsapp/dnd/${encodeURIComponent(phone)}`);
        return response.data;
    } catch (error) {
        console.error("WhatsApp DND delete error:", error);
        throw error;
    }
};

export const checkWhatsAppDNDBatch = async (phoneNumbers) => {
    try {
        const response = await API.post("/api/whatsapp/dnd/check-batch", { phone_numbers: phoneNumbers });
        return response.data;
    } catch (error) {
        console.error("WhatsApp DND check batch error:", error);
        throw error;
    }
};

// ── Customer Replies & Reports ─────────────────────────────────
export const getCustomerReplies = async (params = {}) => {
    try {
        const response = await API.get("/api/whatsapp/replies", { params });
        return response.data;
    } catch (error) {
        console.error("WhatsApp customer replies error:", error);
        return { replies: [], total: 0, stats: {} };
    }
};

export const getCustomerReplyStats = async () => {
    try {
        const response = await API.get("/api/whatsapp/replies/stats");
        return response.data;
    } catch (error) {
        console.error("WhatsApp reply stats error:", error);
        return null;
    }
};

export const exportCustomerRepliesExcel = async (params = {}) => {
    try {
        const response = await API.get("/api/whatsapp/replies/export", {
            params,
            responseType: "blob",
        });

        // Trigger browser file download with explicit Excel MIME type
        const blob = new Blob([response.data], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;


        // Try to get filename from header
        let fileName = `Customer_Replies_${new Date().toISOString().slice(0, 10)}.xlsx`;
        const contentDisposition = response.headers["content-disposition"];
        if (contentDisposition) {
            const match = contentDisposition.match(/filename="?([^"]+)"?/);
            if (match && match[1]) {
                fileName = match[1];
            }
        }

        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        return true;
    } catch (error) {
        console.error("WhatsApp reply export error:", error);
        throw error;
    }
};


// ── CHAT ACCESS AUDIT FUNCTIONS ──────────────────────────────────────

export const logChatAccess = async (conversationId, contactInfo = {}) => {
    if (!conversationId) return null;
    try {
        const userEmail = localStorage.getItem("userEmail") || "admin@delegatex.com";
        const userName = localStorage.getItem("userName") || (userEmail === "admin@delegatex.com" ? "Admin User" : userEmail.split("@")[0]);

        const response = await API.post(
            `/api/whatsapp/conversations/${encodeURIComponent(conversationId)}/access`,
            {
                conversation_id: conversationId,
                contact_phone: contactInfo.contact_phone || contactInfo.recipient_phone || "",
                contact_name: contactInfo.contact_name || contactInfo.recipient || "Customer",
                manager_email: userEmail,
                manager_name: userName,
                manager_id: userEmail,
            },
            {
                headers: {
                    "X-User-Email": userEmail,
                    "X-Manager-Email": userEmail,
                    "X-Manager-Name": userName,
                }
            }
        );
        return response.data;
    } catch (error) {
        console.error("Log chat access error:", error);
        return null;
    }
};

export const getChatAccessLogs = async (params = {}) => {
    try {
        const response = await API.get("/api/whatsapp/access-logs", { params });
        return response.data;
    } catch (error) {
        console.error("Get chat access logs error:", error);
        return { access_logs: [], total: 0 };
    }
};

export const getChatAccessStats = async () => {
    try {
        const response = await API.get("/api/whatsapp/access-logs/stats");
        return response.data;
    } catch (error) {
        console.error("Get chat access stats error:", error);
        return {
            total_openings: 0,
            replied_count: 0,
            unreplied_count: 0,
            unique_managers: 0,
            unique_customers: 0,
            reply_rate: 0,
        };
    }
};

export const exportChatAccessLogsExcel = async (params = {}) => {
    try {
        const response = await API.get("/api/whatsapp/access-logs/export", {
            params,
            responseType: "blob",
        });

        const blob = new Blob([response.data], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;

        let fileName = `Chat_Access_History_${new Date().toISOString().slice(0, 10)}.xlsx`;
        const contentDisposition = response.headers["content-disposition"];
        if (contentDisposition) {
            const match = contentDisposition.match(/filename="?([^"]+)"?/);
            if (match && match[1]) {
                fileName = match[1];
            }
        }

        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        return true;
    } catch (error) {
        console.error("Export chat access logs error:", error);
        throw error;
    }
};


