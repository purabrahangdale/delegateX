/**
 * Helpers for template variable mappings.
 * mapping shape: { [slotKey]: { source: "field" | "static", value: string } }
 */
export const suggestMapping = (slots, fieldOptions, current = {}) => {
    const fieldValues = new Set(fieldOptions.map((f) => f.value));
    const next = {};
    for (const slot of slots || []) {
        if (current[slot.key]?.value) {
            next[slot.key] = current[slot.key];
        } else if (slot.local_name && fieldValues.has(slot.local_name)) {
            next[slot.key] = { source: "field", value: slot.local_name };
        } else if (slot.local_name && /name/.test(slot.local_name) && fieldValues.has("name")) {
            next[slot.key] = { source: "field", value: "name" };
        } else {
            next[slot.key] = { source: "field", value: "" };
        }
    }
    return next;
};

export const unmappedSlots = (slots, mapping) =>
    (slots || []).filter((s) => !(mapping?.[s.key]?.value || "").toString().trim());
