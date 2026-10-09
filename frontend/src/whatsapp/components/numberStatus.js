// Status dot colour for a WhatsApp business number (inactive → grey, connected → green, error → red, untested → amber).
export const connectionDot = (number) => {
    if (!number?.is_active) return "bg-slate-300";
    const status = number?.connection?.status;
    if (status === "connected") return "bg-emerald-500";
    if (status === "error") return "bg-rose-500";
    return "bg-amber-400";
};
