import { FiInfo } from "react-icons/fi";

// Maps every parameter slot of a Meta template to a recipient field or a fixed value (helpers in ./variableMapping).

const KIND_HINT = {
    media: "Public HTTPS link to the image/video/document shown in the header.",
    url_suffix: "Text appended to the button's base URL.",
    coupon: "Code copied when the customer taps the button.",
};

function VariableMappingEditor({ slots, mapping, onChange, fieldOptions }) {
    if (!slots?.length) {
        return <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded-xl p-3">This template has no variables — every recipient receives the same message.</p>;
    }

    const update = (key, patch) => onChange({ ...mapping, [key]: { ...(mapping[key] || { source: "field", value: "" }), ...patch } });

    return (
        <div className="space-y-2">
            {slots.map((slot) => {
                const rule = mapping[slot.key] || { source: "field", value: "" };
                const missing = !(rule.value || "").toString().trim();
                const forceStatic = slot.kind === "media";
                return (
                    <div key={slot.key} className={`p-3 rounded-xl border ${missing ? "border-amber-300 bg-amber-50/40" : "border-slate-200 bg-white"}`}>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="min-w-0">
                                <p className="text-[11px] font-bold text-slate-800 truncate">
                                    <span className="font-mono text-indigo-600 mr-1">{slot.key}</span> {slot.label}
                                </p>
                                {(slot.example || KIND_HINT[slot.kind]) && (
                                    <p className="text-[9px] text-slate-400 flex items-center gap-1">
                                        <FiInfo size={9} /> {KIND_HINT[slot.kind] || ""} {slot.example ? `Example: ${slot.example}` : ""}
                                    </p>
                                )}
                            </div>
                            {!forceStatic && (
                                <select
                                    value={rule.source}
                                    onChange={(e) => update(slot.key, { source: e.target.value, value: "" })}
                                    className="text-[10px] border border-slate-200 rounded-lg px-2 py-1 bg-white shrink-0"
                                >
                                    <option value="field">Recipient field</option>
                                    <option value="static">Same text for everyone</option>
                                </select>
                            )}
                        </div>
                        {rule.source === "field" && !forceStatic ? (
                            <select
                                value={rule.value}
                                onChange={(e) => update(slot.key, { value: e.target.value })}
                                className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white"
                            >
                                <option value="">— choose a field —</option>
                                {fieldOptions.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                            </select>
                        ) : (
                            <input
                                value={rule.value}
                                onChange={(e) => update(slot.key, { source: "static", value: e.target.value })}
                                placeholder={slot.example || "Enter value"}
                                className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2"
                            />
                        )}
                        {missing && <p className="text-[9px] text-amber-700 font-semibold mt-1">Required — the message cannot be sent without this value.</p>}
                    </div>
                );
            })}
        </div>
    );
}

export default VariableMappingEditor;
