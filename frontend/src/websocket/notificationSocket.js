import { ReconnectingWebSocket, getWebSocketUrl } from "./socket";

export const createNotificationSocket = () => {
    const url = getWebSocketUrl("/ws/notifications");
    const ws = new ReconnectingWebSocket(url);
    return ws;
};
