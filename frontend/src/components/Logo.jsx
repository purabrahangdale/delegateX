import React from "react";
import dtableLogo from "../assets/dtable-logo.png";

export function Logo({ className = "", iconSize = "h-9 w-9", textClass = "text-slate-900", subtextClass = "text-slate-500", showText = true }) {
    return (
        <div className={`flex items-center gap-3 ${className}`}>
            <div className={`${iconSize} relative flex-shrink-0 select-none bg-white p-0.5 rounded-xl border border-slate-200 flex items-center justify-center shadow-sm overflow-hidden`}>
                <img src={dtableLogo} alt="D-Table Analytics Logo" className="w-full h-full object-contain rounded-lg" />
            </div>
            
            {/* Branding Text */}
            {showText && (
                <div>
                    <span className={`font-display font-bold text-lg tracking-tight leading-none block ${textClass}`}>
                        D-TABLE ANALYTICS
                    </span>
                    <p className={`text-[9px] font-semibold uppercase tracking-wider mt-0.5 ${subtextClass}`}>
                        WhatsApp Automation Tool
                    </p>
                </div>
            )}
        </div>
    );
}

export default Logo;
