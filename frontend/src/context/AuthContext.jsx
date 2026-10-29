import axios from "axios";

// Console session: a signed token from POST /api/auth/login. The backend rejects every API call and
// WebSocket without it, so the helpers below attach it to all requests and sign out when it is refused.
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const TOKEN_KEY = "authToken";
const EMAIL_KEY = "userEmail";
const EXPIRES_KEY = "authExpiresAt";

const read = (key) => {
    try { return localStorage.getItem(key); } catch { return null; }
};

export const getToken = () => {
    const token = read(TOKEN_KEY);
    const expiresAt = Number(read(EXPIRES_KEY) || 0);
    return token && expiresAt * 1000 > Date.now() ? token : null;
};

export const isSignedIn = () => Boolean(getToken());

export const getUserEmail = () => (isSignedIn() ? read(EMAIL_KEY) : null);

const clearSession = () => {
    try {
        [TOKEN_KEY, EMAIL_KEY, EXPIRES_KEY].forEach((key) => localStorage.removeItem(key));
    } catch { /* storage unavailable */ }
};

export const signIn = async (email, password, remember) => {
    const { data } = await axios.post(`${API_BASE}/api/auth/login`, { email, password, remember });
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(EMAIL_KEY, data.email);
    localStorage.setItem(EXPIRES_KEY, String(data.expires_at));
    return data;
};

const goToLogin = () => {
    const here = window.location.pathname + window.location.search;
    // A full page load drops every open WebSocket and all cached page state of the old session.
    window.location.assign(here.startsWith("/login") ? "/login" : `/login?redirect=${encodeURIComponent(here)}`);
};

export const signOut = () => {
    clearSession();
    window.location.assign("/login");
};

// The server refused the session (expired, or signed out elsewhere): back to the sign-in page.
export const handleUnauthorized = (error) => {
    const url = error?.config?.url || "";
    if (error?.response?.status === 401 && !url.includes("/api/auth/login")) {
        clearSession();
        goToLogin();
    }
    return Promise.reject(error);
};

export const attachToken = (config) => {
    const token = getToken();
    if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
};

// Requests made with the default axios instance (notifications, chatbot).
axios.interceptors.request.use(attachToken);
axios.interceptors.response.use((response) => response, handleUnauthorized);
