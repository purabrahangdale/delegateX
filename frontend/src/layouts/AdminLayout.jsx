import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import AIChatbot from "../components/chatbot/AIChatbot";

function AdminLayout() {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Lock body scroll when mobile sidebar is open
    useEffect(() => {
        if (isMobileMenuOpen) {
            document.body.classList.add("sidebar-open");
        } else {
            document.body.classList.remove("sidebar-open");
        }
        return () => document.body.classList.remove("sidebar-open");
    }, [isMobileMenuOpen]);

    return (
        <div className="min-h-screen bg-slate-50 flex overflow-x-hidden">
            {/* Desktop Sidebar */}
            <div className="hidden md:block">
                <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
            </div>

            {/* Mobile Sidebar (Slide Over Drawer) */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-50 md:hidden flex">
                    {/* Backdrop */}
                    <div 
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
                        onClick={() => setIsMobileMenuOpen(false)}
                    ></div>

                    {/* Drawer Content */}
                    <div className="relative flex-1 flex flex-col max-w-xs w-full bg-slate-950 animate-slide-in-left">
                        <Sidebar
                            isCollapsed={false}
                            setIsCollapsed={() => {}}
                            onClose={() => setIsMobileMenuOpen(false)}
                        />
                    </div>

                    {/* Close button zone */}
                    <div className="flex-shrink-0 w-14" onClick={() => setIsMobileMenuOpen(false)}></div>
                </div>
            )}

            {/* Main Content Layout Wrapper */}
            <div 
                className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
                    isCollapsed ? "md:pl-20" : "md:pl-64"
                }`}
            >
                <Navbar onToggleMobileMenu={() => setIsMobileMenuOpen(true)} />

                <main className="flex-1 p-3 sm:p-4 md:p-6 lg:p-8 overflow-y-auto max-w-7xl w-full mx-auto animate-fade-in">
                    <Outlet />
                </main>
                <AIChatbot />
            </div>
        </div>
    );
}

export default AdminLayout;