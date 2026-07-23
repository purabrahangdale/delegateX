import { getOrCreateSocketSingleton } from "./socket";

export const createDelegationSocket = () => {
    return getOrCreateSocketSingleton("/ws/delegation");
};
