import { getOrCreateSocketSingleton } from "./socket";

export const createNotificationSocket = () => {
    return getOrCreateSocketSingleton("/ws/notifications");
};
