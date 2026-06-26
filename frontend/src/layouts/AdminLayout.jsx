import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";

function AdminLayout() {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <div className="min-h-screen bg-slate-50 flex">
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
                    <div className="relative flex-1 flex flex-col max-w-xs w-full bg-slate-900 animate-slide-in-right">
                        <Sidebar isCollapsed={false} setIsCollapsed={() => {}} />
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

                <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl w-full mx-auto animate-fade-in">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

export default AdminLayout;