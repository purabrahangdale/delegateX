import { ReconnectingWebSocket, getWebSocketUrl } from "./socket";

export const createDelegationSocket = () => {
    const url = getWebSocketUrl("/ws/delegation");
    const ws = new ReconnectingWebSocket(url);
    return ws;
};
