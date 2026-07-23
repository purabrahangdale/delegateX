// WebSocket Base client with reconnection logic & singleton pool

export const getWebSocketUrl = (path) => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
    let wsBase = apiBase.replace(/^http/, "ws");
    if (wsBase.endsWith("/")) {
        wsBase = wsBase.slice(0, -1);
    }
    return `${wsBase}${path}`;
};

// Global pool to reuse connections across StrictMode remounts and re-renders
const socketPool = new Map();

export class ReconnectingWebSocket {
    constructor(url, protocols = []) {
        this.url = url;
        this.protocols = protocols;
        this.listeners = {};
        this.socket = null;
        this.reconnectInterval = 3000;
        this.maxReconnectInterval = 30000;
        this.reconnectAttempts = 0;
        this.shouldReconnect = true;
        this.reconnectTimer = null;
        this.isExplicitClosed = false;
    }

    connect() {
        this.shouldReconnect = true;
        this.isExplicitClosed = false;

        // Reuse an existing OPEN or CONNECTING connection
        if (this.socket) {
            if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
                return;
            }
        }

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        try {
            this.socket = new WebSocket(this.url, this.protocols);
        } catch (e) {
            this.scheduleReconnect();
            return;
        }

        this.socket.onopen = (event) => {
            this.reconnectAttempts = 0;
            if (this.isExplicitClosed) {
                if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                    this.socket.close();
                }
                return;
            }
            this.trigger("open", event);
        };

        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.trigger("message", data);
            } catch (err) {
                this.trigger("message", event.data);
            }
        };

        this.socket.onerror = (event) => {
            this.trigger("error", event);
        };

        this.socket.onclose = (event) => {
            this.trigger("close", event);
            if (this.shouldReconnect && !this.isExplicitClosed) {
                this.scheduleReconnect();
            }
        };
    }

    send(data) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(data));
        }
    }

    scheduleReconnect() {
        if (!this.shouldReconnect || this.isExplicitClosed) return;
        if (this.reconnectTimer) return;

        const delay = Math.min(
            this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts),
            this.maxReconnectInterval
        );
        this.reconnectAttempts++;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (this.shouldReconnect && !this.isExplicitClosed) {
                this.connect();
            }
        }, delay);
    }

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        if (!this.listeners[event].includes(callback)) {
            this.listeners[event].push(callback);
        }
    }

    off(event, callback) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }

    trigger(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (e) {
                    // Suppress handler errors
                }
            });
        }
    }

    close() {
        this.shouldReconnect = false;
        this.isExplicitClosed = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.socket) {
            if (this.socket.readyState === WebSocket.OPEN) {
                this.socket.close();
            } else if (this.socket.readyState === WebSocket.CONNECTING) {
                const s = this.socket;
                s.onopen = () => {
                    try { s.close(); } catch (e) {}
                };
            }
        }
    }
}

export const getOrCreateSocketSingleton = (path) => {
    const url = getWebSocketUrl(path);
    if (!socketPool.has(url)) {
        socketPool.set(url, new ReconnectingWebSocket(url));
    }
    return socketPool.get(url);
};
