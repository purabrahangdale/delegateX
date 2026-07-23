import { getOrCreateSocketSingleton } from "./socket";

export const createCrmSocket = () => {
    return getOrCreateSocketSingleton("/ws/crm");
};
