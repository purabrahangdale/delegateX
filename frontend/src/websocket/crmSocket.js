import { ReconnectingWebSocket, getWebSocketUrl } from "./socket";

export const createCrmSocket = () => {
    const url = getWebSocketUrl("/ws/crm");
    const ws = new ReconnectingWebSocket(url);
    return ws;
};
