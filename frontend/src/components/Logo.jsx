import React from "react";

export function Logo({ className = "", iconSize = "h-9 w-9", textClass = "text-slate-900", subtextClass = "text-slate-500", showText = true }) {
    return (
        <div className={`flex items-center gap-3 ${className}`}>
            {/* Geometric SVG Icon */}
            <div className={`${iconSize} relative flex-shrink-0 select-none`}>
                <svg viewBox="0 0 32 32" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="logo-grad-svg" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#6366f1" /> {/* indigo-500 */}
                            <stop offset="100%" stopColor="#4f46e5" /> {/* indigo-600 */}
                        </linearGradient>
                    </defs>
                    {/* Rounded base container */}
                    <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#logo-grad-svg)" />
                    
                    {/* Interconnecting workflow paths */}
                    <line x1="9" y1="9" x2="23" y2="9" stroke="white" strokeWidth="1.5" strokeOpacity="0.4" strokeLinecap="round" />
                    <line x1="9" y1="9" x2="9" y2="23" stroke="white" strokeWidth="1.5" strokeOpacity="0.4" strokeLinecap="round" />
                    <line x1="9" y1="23" x2="23" y2="23" stroke="white" strokeWidth="1.5" strokeOpacity="0.4" strokeLinecap="round" />
                    <line x1="23" y1="9" x2="23" y2="23" stroke="white" strokeWidth="1.5" strokeOpacity="0.4" strokeLinecap="round" />
                    <line x1="9" y1="9" x2="23" y2="23" stroke="white" strokeWidth="1.5" strokeOpacity="0.4" strokeLinecap="round" />
                    
                    {/* Team nodes representing members */}
                    <circle cx="9" cy="9" r="3" fill="white" />
                    <circle cx="23" cy="9" r="3" fill="white" />
                    <circle cx="9" cy="23" r="3" fill="white" />
                    <circle cx="23" cy="23" r="3" fill="white" />
                    
                    {/* Center coordination node (The Manager/Delegate hub) */}
                    <circle cx="16" cy="16" r="4" fill="#1e1b4b" stroke="white" strokeWidth="2" />
                </svg>
            </div>
            
            {/* Branding Text */}
            {showText && (
                <div>
                    <span className={`font-display font-bold text-lg tracking-tight leading-none block ${textClass}`}>
                        DelegateX
                    </span>
                    <p className={`text-[9px] font-semibold uppercase tracking-wider mt-0.5 ${subtextClass}`}>
                        Employee Management System
                    </p>
                </div>
            )}
        </div>
    );
}

export default Logo;
