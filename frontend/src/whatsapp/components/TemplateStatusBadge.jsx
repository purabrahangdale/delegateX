const STATUS_STYLES = {
    DRAFT: { cls: "text-slate-600 bg-slate-50 border-slate-200", label: "Draft" },
    PENDING: { cls: "text-amber-700 bg-amber-50 border-amber-200", label: "Pending review" },
    APPROVED: { cls: "text-emerald-700 bg-emerald-50 border-emerald-200", label: "Approved" },
    REJECTED: { cls: "text-rose-700 bg-rose-50 border-rose-200", label: "Rejected" },
    PAUSED: { cls: "text-orange-700 bg-orange-50 border-orange-200", label: "Paused" },
    DISABLED: { cls: "text-rose-700 bg-rose-50 border-rose-200", label: "Disabled" },
    IN_APPEAL: { cls: "text-indigo-700 bg-indigo-50 border-indigo-200", label: "In appeal" },
    DELETED: { cls: "text-slate-500 bg-slate-100 border-slate-200", label: "Deleted on Meta" },
};

const TEMPLATE_STATUS_HELP = {
    DRAFT: "Saved in the ERP only. Submit it to Meta for review before it can be sent.",
    PENDING: "Meta is reviewing this template. It cannot be sent until it is approved.",
    APPROVED: "Approved by Meta — available in campaigns and automations.",
    REJECTED: "Meta rejected this template. Edit it and resubmit.",
    PAUSED: "Meta paused this template because of low quality feedback. It cannot be sent.",
    DISABLED: "Meta disabled this template. It cannot be sent.",
    DELETED: "This template no longer exists on Meta.",
};

function TemplateStatusBadge({ status, className = "" }) {
    const key = (status || "DRAFT").toUpperCase();
    const style = STATUS_STYLES[key] || { cls: "text-slate-600 bg-slate-50 border-slate-200", label: key };
    return (
        <span
            title={TEMPLATE_STATUS_HELP[key] || key}
            className={`text-[9px] font-bold px-2 py-0.5 rounded-md border uppercase whitespace-nowrap ${style.cls} ${className}`}
        >
            {style.label}
        </span>
    );
}

export default TemplateStatusBadge;
