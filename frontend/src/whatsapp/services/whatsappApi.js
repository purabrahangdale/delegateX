import axios from "axios";

const primaryBaseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const API = axios.create({
    baseURL: primaryBaseURL,
});

// ── Selected WhatsApp business number ─────────────────────────
// Every WhatsApp request names the number it operates on; the backend validates it and scopes all data.
export const SELECTED_NUMBER_STORAGE_KEY = "whatsapp.selectedNumberId";
let activeNumberId = (() => {
    try { return localStorage.getItem(SELECTED_NUMBER_STORAGE_KEY) || null; } catch { return null; }
})();
export const getActiveNumberId = () => activeNumberId;
export const setActiveNumberId = (id) => {
    activeNumberId = id || null;
    try {
        if (id) localStorage.setItem(SELECTED_NUMBER_STORAGE_KEY, id);
        else localStorage.removeItem(SELECTED_NUMBER_STORAGE_KEY);
    } catch { /* storage unavailable — selection still applies for this session */ }
};
// WhatsApp contacts are kept in this browser per business number. The list saved before multi-number
// support stays under the legacy key and is only copied into a number when the user chooses to.
export const LEGACY_CONTACTS_STORAGE_KEY = "whatsapp_contacts_list";
export const contactsStorageKey = () => (activeNumberId ? `${LEGACY_CONTACTS_STORAGE_KEY}:${activeNumberId}` : LEGACY_CONTACTS_STORAGE_KEY);
// Live WebSocket events are broadcast for every number; pages only apply those of the selected number.
export const isEventForActiveNumber = (data) => (data?.number_id || null) === (activeNumberId || null);
// Error codes meaning the selected number is gone or no longer accessible (the selector re-validates).
export const NUMBER_SELECTION_ERRORS = ["number_not_found", "number_forbidden", "no_default_number"];

// Identify the acting ERP user on WhatsApp actions (campaign launch/cancel audit trail).
API.interceptors.request.use((config) => {
    const userEmail = localStorage.getItem("userEmail");
    if (userEmail && !config.headers["X-User-Email"]) {
        config.headers["X-User-Email"] = userEmail;
    }
    if (activeNumberId && !config.headers["X-WhatsApp-Number-Id"]) {
        config.headers["X-WhatsApp-Number-Id"] = activeNumberId;
    }
    return config;
});

// Turn an axios error into a user-facing message (FastAPI `detail` may be a string or {message}).
export const apiErrorMessage = (error, fallback = "Request failed") => {
    const detail = error?.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (detail?.message) return detail.message;
    if (Array.isArray(detail)) return detail.map((d) => d.msg).join("; ");
    if (!error?.response) return "Cannot reach the server. Check that the backend is running.";
    return error?.message || fallback;
};

API.interceptors.response.use(
    (response) => response,
    async (error) => {
        const code = error?.response?.data?.detail?.code;
        if (NUMBER_SELECTION_ERRORS.includes(code)) {
            window.dispatchEvent(new CustomEvent("whatsapp:number-invalid", { detail: { code } }));
        }
        const originalRequest = error.config;
        if (
            !originalRequest._retry &&
            primaryBaseURL !== "http://localhost:8000" &&
            primaryBaseURL !== "http://127.0.0.1:8000" &&
            (!error.response || [502, 503, 504].includes(error.response.status))
        ) {
            originalRequest._retry = true;
            originalRequest.baseURL = "http://localhost:8000";
            return API(originalRequest);
        }
        return Promise.reject(error);
    }
);

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

// ── Template lifecycle (Meta) ──────────────────────────────────
// These throw on failure so callers can show the real Meta error.
export const getSendableTemplates = async () => (await API.get("/api/whatsapp/templates/sendable")).data.templates || [];
export const syncTemplatesFromMeta = async () => (await API.post("/api/whatsapp/templates/sync")).data;
export const validateWhatsAppTemplate = async (id) => (await API.post(`/api/whatsapp/templates/${id}/validate`)).data;
export const submitWhatsAppTemplate = async (id) => (await API.post(`/api/whatsapp/templates/${id}/submit`)).data;
export const getWhatsAppTemplate = async (id) => (await API.get(`/api/whatsapp/templates/${id}`)).data;
export const deleteWhatsAppTemplateLocalOnly = async (id) => (await API.delete(`/api/whatsapp/templates/${id}`, { params: { local_only: true } })).data;

// ── Campaigns ──────────────────────────────────────────────────
export const previewCampaign = async (data) => (await API.post("/api/whatsapp/campaigns/preview", data)).data;
export const createCampaign = async (data) => (await API.post("/api/whatsapp/campaigns", data)).data;
export const listCampaigns = async (params = {}) => (await API.get("/api/whatsapp/campaigns", { params })).data;
export const getCampaign = async (id) => (await API.get(`/api/whatsapp/campaigns/${id}`)).data;
export const getCampaignRecipients = async (id, params = {}) => (await API.get(`/api/whatsapp/campaigns/${id}/recipients`, { params })).data;
export const launchCampaign = async (id, data) => (await API.post(`/api/whatsapp/campaigns/${id}/launch`, data)).data;
export const cancelCampaign = async (id) => (await API.post(`/api/whatsapp/campaigns/${id}/cancel`)).data;
export const pauseCampaign = async (id) => (await API.post(`/api/whatsapp/campaigns/${id}/pause`)).data;
export const resumeCampaign = async (id) => (await API.post(`/api/whatsapp/campaigns/${id}/resume`)).data;
export const retryFailedCampaignRecipients = async (id) => (await API.post(`/api/whatsapp/campaigns/${id}/retry-failed`)).data;
export const deleteDraftCampaign = async (id) => (await API.delete(`/api/whatsapp/campaigns/${id}`)).data;

// ── Automation rules (template bindings) ───────────────────────
export const getAutomationWorkflows = async () => (await API.get("/api/whatsapp/automations")).data.workflows || [];
export const saveAutomationBinding = async (key, data) => (await API.put(`/api/whatsapp/automations/${key}`, data)).data;
export const getAutomationRuns = async (params = {}) => (await API.get("/api/whatsapp/automations/runs", { params })).data;

// ── Diagnostics ────────────────────────────────────────────────
export const getWhatsAppDiagnostics = async () => (await API.get("/api/whatsapp/diagnostics")).data;
export const subscribeAppToWaba = async () => (await API.post("/api/whatsapp/diagnostics/subscribe")).data;
export const sendTestTemplateMessage = async (data) => (await API.post("/api/whatsapp/diagnostics/test-message", data)).data;
export const getSendJob = async (id) => (await API.get(`/api/whatsapp/send-jobs/${id}`)).data;

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

// ── WhatsApp Business Numbers ──────────────────────────────────
// These throw on failure so callers can show the backend's validation message.
export const getWhatsAppNumbers = async () => (await API.get("/api/whatsapp/numbers")).data;
export const createWhatsAppNumber = async (data) => (await API.post("/api/whatsapp/numbers", data)).data;
export const updateWhatsAppNumber = async (id, data) => (await API.put(`/api/whatsapp/numbers/${id}`, data)).data;
export const testWhatsAppNumber = async (id) => (await API.post(`/api/whatsapp/numbers/${id}/test`)).data;
export const verifyWhatsAppNumber = async (data) => (await API.post("/api/whatsapp/numbers/verify", data)).data;
export const activateWhatsAppNumber = async (id) => (await API.post(`/api/whatsapp/numbers/${id}/activate`)).data;
export const deactivateWhatsAppNumber = async (id) => (await API.post(`/api/whatsapp/numbers/${id}/deactivate`)).data;
export const setDefaultWhatsAppNumber = async (id) => (await API.post(`/api/whatsapp/numbers/${id}/default`)).data;
export const removeWhatsAppNumber = async (id) => (await API.delete(`/api/whatsapp/numbers/${id}`)).data;
export const getUnassignedLegacyRecords = async () => (await API.get("/api/whatsapp/numbers/legacy/unassigned")).data;
export const assignLegacyRecordsToNumber = async (id) => (await API.post(`/api/whatsapp/numbers/${id}/assign-legacy`, { confirm: true })).data;

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


