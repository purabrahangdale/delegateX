export const generateUniqueId = (prefix = "field") => {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
};

export const parseOptionsString = (str) => {
    if (!str) return [];
    return str.split(",")
        .map(opt => opt.trim())
        .filter(opt => opt.length > 0);
};

export const formatTimestamp = (isoString) => {
    if (!isoString) return "";
    try {
        const d = new Date(isoString);
        return d.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    } catch (e) {
        return isoString;
    }
};
