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
export const getWhatsAppTemplates = async () => {
    try {
        const response = await API.get("/api/whatsapp/templates");
        return response.data.templates || [];
    } catch (error) {
        console.error("WhatsApp templates error:", error);
        return [];
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
