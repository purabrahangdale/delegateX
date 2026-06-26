import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiMail, FiLock, FiArrowRight, FiInfo, FiActivity, FiTrendingUp, FiEye, FiEyeOff } from "react-icons/fi";
import { useToast } from "../context/ToastContext";
import Logo from "../components/Logo";

function Login() {
    const navigate = useNavigate();
    const { showToast } = useToast();

    // Form states
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [rememberMe, setRememberMe] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    
    // UI states
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    // Form validation
    const validateForm = () => {
        const newErrors = {};
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!email) {
            newErrors.email = "Email address is required";
        } else if (!emailRegex.test(email)) {
            newErrors.email = "Please enter a valid email address";
        }

        if (!password) {
            newErrors.password = "Password is required";
        } else if (password.length < 6) {
            newErrors.password = "Password must be at least 6 characters";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Handle submit
    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (!validateForm()) {
            showToast("Please check the form for errors", "error");
            return;
        }

        setIsLoading(true);

        // Simulate API request authentication check
        setTimeout(() => {
            setIsLoading(false);
            if (email === "admin@delegatex.com" && password === "admin123") {
                showToast("Logged in successfully! Welcome back.", "success");
                localStorage.setItem("authToken", "mock-saas-jwt-token");
                localStorage.setItem("userEmail", email);
                navigate("/");
            } else {
                setErrors({
                    form: "Invalid email or password. Please use the default credentials."
                });
                showToast("Authentication failed. Invalid credentials.", "error");
            }
        }, 1200);
    };

    // Check if form is partially filled to manage active/disabled state
    const isFormEmpty = !email || !password;

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row overflow-x-hidden font-sans">
            
            {/* LEFT SIDE: BRANDING AREA (Hidden on small screens, split layout on medium/tablet and up) */}
            <div className="hidden md:flex md:w-[35%] lg:w-[40%] xl:w-[42%] bg-slate-950 text-white flex-col justify-between p-8 lg:p-12 relative overflow-hidden select-none border-r border-slate-900">
                {/* Glowing Ambient Shapes */}
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[80px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-600/10 blur-[100px]"></div>
                
                {/* Top Branding Section */}
                <div className="relative z-10">
                    <Logo 
                        iconSize="h-10 w-10" 
                        textClass="text-white" 
                        subtextClass="text-slate-500" 
                    />
                </div>

                {/* Center SaaS Illustration & Tagline Area */}
                <div className="relative z-10 my-auto py-10 space-y-10">
                    <div className="space-y-4">
                        <h2 className="text-2xl lg:text-3xl xl:text-4xl font-extrabold font-display leading-[1.15] tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
                            Intelligent delegation.<br />
                            Real-time alignment.<br />
                            Zero friction.
                        </h2>
                        <p className="text-slate-400 text-xs lg:text-sm max-w-sm leading-relaxed font-medium">
                            Empower your team leads, streamline tasks status, and get robust delegation metrics all in one place.
                        </p>
                    </div>

                    {/* Small Analytics Preview Cards */}
                    <div className="space-y-4 max-w-sm">
                        {/* Preview Card 1: Metric */}
                        <div className="bg-slate-900/60 backdrop-blur border border-slate-800/80 rounded-2xl p-4 shadow-[0_4px_16px_rgba(2,6,23,0.3)] flex items-center justify-between">
                            <div className="space-y-1">
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Active Trackings</span>
                                <div className="text-lg font-bold text-slate-200 font-display">12 Projects</div>
                            </div>
                            <div className="p-2.5 rounded-xl border border-indigo-950 bg-indigo-950/40 text-indigo-400">
                                <FiTrendingUp size={14} />
                            </div>
                        </div>

                        {/* Preview Card 2: Mini Line Chart */}
                        <div className="bg-slate-900/60 backdrop-blur border border-slate-800/80 rounded-2xl p-4 shadow-[0_4px_16px_rgba(2,6,23,0.3)]">
                            <div className="flex justify-between items-center mb-3">
                                <div>
                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Resolution Trend</span>
                                </div>
                                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded-lg border border-emerald-500/15 flex items-center gap-1">
                                    <FiActivity size={8} />
                                    +12% Up
                                </span>
                            </div>
                            {/* SVG Mini Chart */}
                            <div className="h-10 w-full flex items-end">
                                <svg className="w-full h-full overflow-visible" viewBox="0 0 300 40" preserveAspectRatio="none">
                                    <defs>
                                        <linearGradient id="miniChartGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                                            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                                        </linearGradient>
                                    </defs>
                                    <path d="M 0 40 Q 50 15, 100 30 T 200 10 T 300 5 L 300 40 Z" fill="url(#miniChartGrad)" />
                                    <path d="M 0 40 Q 50 15, 100 30 T 200 10 T 300 5" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" />
                                    <circle cx="300" cy="5" r="3" fill="#ffffff" stroke="#6366f1" strokeWidth="1.5" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Footer Info */}
                <div className="relative z-10 text-[10px] text-slate-600 font-semibold tracking-wide">
                    &copy; 2026 DELEGATEX INC. ALL RIGHTS RESERVED.
                </div>
            </div>

            {/* RIGHT SIDE: LOGIN FORM AREA */}
            <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-10 md:p-12 lg:p-16 relative">
                
                {/* Mobile Header Logo (Visible on mobile only) */}
                <div className="block md:hidden mb-8 self-center">
                    <Logo 
                        iconSize="h-8 w-8" 
                        textClass="text-slate-900" 
                        subtextClass="text-slate-500" 
                    />
                </div>

                {/* Form Wrapper with Dashboard Card Style */}
                <div className="w-full max-w-[420px] bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-[0_2px_12px_rgba(15,23,42,0.015)] transition-all duration-300">
                    
                    {/* Header Text */}
                    <div className="mb-6">
                        <h1 className="text-xl sm:text-2xl font-bold font-display text-slate-900 tracking-tight">
                            Welcome back
                        </h1>
                        <p className="text-slate-500 text-xs mt-1 leading-normal font-sans">
                            Enter your administrative credentials to access the workspace management console.
                        </p>
                    </div>

                    {/* Backend Form-Level Error Warning */}
                    {errors.form && (
                        <div className="mb-5 p-3 rounded-xl border border-rose-100 bg-rose-50/50 text-rose-800 text-xs font-medium flex gap-2.5 items-start">
                            <FiInfo className="text-rose-500 shrink-0 mt-0.5" size={14} />
                            <span>{errors.form}</span>
                        </div>
                    )}

                    {/* Sign-In Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        
                        {/* Email Input Field */}
                        <div className="space-y-1.5">
                            <label htmlFor="email-input" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                Email Address
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                    <FiMail size={14} />
                                </div>
                                <input
                                    id="email-input"
                                    type="email"
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        if (errors.email) setErrors(prev => ({ ...prev, email: null }));
                                        if (errors.form) setErrors(prev => ({ ...prev, form: null }));
                                    }}
                                    placeholder="name@company.com"
                                    className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-xs text-slate-800 bg-white placeholder-slate-400 transition-all duration-200 outline-none focus:outline-none ${
                                        errors.email 
                                            ? "border-rose-300 focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500" 
                                            : "border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500"
                                    }`}
                                />
                            </div>
                            {errors.email && (
                                <p className="text-rose-500 text-[10px] font-semibold mt-1 flex items-center gap-1">
                                    <FiInfo size={10} />
                                    {errors.email}
                                </p>
                            )}
                        </div>

                        {/* Password Input Field with Toggle */}
                        <div className="space-y-1.5">
                            <label htmlFor="password-input" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                Password
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                    <FiLock size={14} />
                                </div>
                                <input
                                    id="password-input"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        if (errors.password) setErrors(prev => ({ ...prev, password: null }));
                                        if (errors.form) setErrors(prev => ({ ...prev, form: null }));
                                    }}
                                    placeholder="••••••••"
                                    className={`w-full pl-10 pr-10 py-2.5 rounded-xl border text-xs text-slate-800 bg-white placeholder-slate-400 transition-all duration-200 outline-none focus:outline-none ${
                                        errors.password 
                                            ? "border-rose-300 focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500" 
                                            : "border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500"
                                    }`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    tabIndex={0}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-none focus:text-indigo-600 cursor-pointer"
                                    title={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                                </button>
                            </div>
                            {errors.password && (
                                <p className="text-rose-500 text-[10px] font-semibold mt-1 flex items-center gap-1">
                                    <FiInfo size={10} />
                                    {errors.password}
                                </p>
                            )}
                        </div>

                        {/* Options Section: Remember Me & Forgot Password */}
                        <div className="flex items-center justify-between pt-1 pb-2">
                            <label className="flex items-center gap-2 select-none cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 focus:ring-2 focus:ring-offset-0 cursor-pointer"
                                />
                                <span className="text-[11px] font-semibold text-slate-500">Remember this console</span>
                            </label>
                            
                            <a 
                                href="#forgot" 
                                onClick={(e) => {
                                    e.preventDefault();
                                    showToast("Password reset request service offline. Please contact the DevOps admin.", "info");
                                }}
                                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 transition"
                            >
                                Forgot password?
                            </a>
                        </div>

                        {/* Submit Button (Supports Idle, Hover, Loading, Disabled states) */}
                        <button
                            type="submit"
                            disabled={isFormEmpty || isLoading}
                            className={`w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 
                                ${isLoading 
                                    ? "bg-indigo-600/80 text-white cursor-wait opacity-80" 
                                    : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/15 hover:shadow-xl hover:shadow-indigo-600/20 active:scale-[0.99] disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:scale-100 disabled:cursor-not-allowed"
                                }`}
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    <span>Verifying Secure Access...</span>
                                </>
                            ) : (
                                <>
                                    <span>Authenticate Console</span>
                                    <FiArrowRight size={13} />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Developer Credentials Helper Box */}
                    <div className="mt-6 p-3 rounded-xl border border-indigo-100 bg-indigo-50/20 text-indigo-900 text-[10px] sm:text-[11px] leading-relaxed flex gap-2.5">
                        <FiInfo className="text-indigo-500 shrink-0 mt-0.5" size={14} />
                        <div>
                            <span className="font-bold block text-indigo-950 mb-0.5">Testing Credentials</span>
                            Use <code className="bg-indigo-50 px-1 py-0.5 rounded border border-indigo-150 font-mono font-bold text-indigo-700 select-all">admin@delegatex.com</code> and password <code className="bg-indigo-50 px-1 py-0.5 rounded border border-indigo-150 font-mono font-bold text-indigo-700 select-all">admin123</code>.
                        </div>
                    </div>
                </div>

                {/* Mobile Copyright Line */}
                <div className="block md:hidden mt-8 text-[9px] text-slate-400 font-semibold tracking-wide">
                    &copy; 2026 DELEGATEX INC.
                </div>
            </div>
        </div>
    );
}

export default Login;
