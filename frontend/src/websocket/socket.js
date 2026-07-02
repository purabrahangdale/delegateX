// WebSocket Base client with reconnection logic

export const getWebSocketUrl = (path) => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
    // Replace http/https with ws/wss
    let wsBase = apiBase.replace(/^http/, "ws");
    // Ensure trailing slash is handled nicely
    if (wsBase.endsWith("/")) {
        wsBase = wsBase.slice(0, -1);
    }
    return `${wsBase}${path}`;
};

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
    }

    connect() {
        this.shouldReconnect = true;
        try {
            this.socket = new WebSocket(this.url, this.protocols);
        } catch (e) {
            console.error("WebSocket connection error:", e);
            this.scheduleReconnect();
            return;
        }

        this.socket.onopen = (event) => {
            console.log(`WebSocket connected to ${this.url}`);
            this.reconnectAttempts = 0;
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
            console.error(`WebSocket error on ${this.url}`, event);
            this.trigger("error", event);
        };

        this.socket.onclose = (event) => {
            console.log(`WebSocket closed for ${this.url}`);
            this.trigger("close", event);
            if (this.shouldReconnect) {
                this.scheduleReconnect();
            }
        };
    }

    send(data) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(data));
        } else {
            console.warn("WebSocket not open. Msg not sent:", data);
        }
    }

    scheduleReconnect() {
        const delay = Math.min(
            this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts),
            this.maxReconnectInterval
        );
        this.reconnectAttempts++;
        console.log(`Scheduling reconnect to ${this.url} in ${delay}ms`);
        setTimeout(() => {
            if (this.shouldReconnect) {
                this.connect();
            }
        }, delay);
    }

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
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
                    console.error("Error in WS listener callback:", e);
                }
            });
        }
    }

    close() {
        this.shouldReconnect = false;
        if (this.socket) {
            this.socket.close();
        }
    }
}
