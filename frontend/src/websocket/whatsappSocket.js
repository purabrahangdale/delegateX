import { getOrCreateSocketSingleton } from "./socket";

export const createWhatsappSocket = () => {
    return getOrCreateSocketSingleton("/ws/whatsapp");
};
