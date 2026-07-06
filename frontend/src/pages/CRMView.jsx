import { useState, useEffect } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import {
    FiUser, FiMail, FiPhone, FiLayers, FiCheckCircle, FiXCircle,
    FiCalendar, FiDollarSign, FiSearch, FiSliders, FiPlus, FiAlertCircle,
    FiX, FiCheck, FiZap, FiChevronDown, FiGift, FiFileText,
    FiList, FiVideo, FiMapPin, FiClock, FiInfo, FiChevronLeft, FiChevronRight,
    FiTrendingUp, FiTrendingDown, FiRefreshCw, FiActivity
} from "react-icons/fi";
import { useToast } from "../context/ToastContext";
import { useWebSockets } from "../context/WebSocketContext";


/* ─── Local UI Helpers to match Delegation styling ─── */
function SectionCard({ icon: Icon, title, subtitle, children, accentColor = "indigo" }) {
    const colorMap = {
        indigo: "text-indigo-600 bg-indigo-50 border-indigo-100",
        violet: "text-violet-600 bg-violet-50 border-violet-100",
        sky: "text-sky-600 bg-sky-50 border-sky-100",
        emerald: "text-emerald-600 bg-emerald-50 border-emerald-100",
        amber: "text-amber-600 bg-amber-50 border-amber-100",
        rose: "text-rose-600 bg-rose-50 border-rose-100",
    };
    const accent = colorMap[accentColor] || colorMap.indigo;
    return (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm w-full">
            <div className="flex items-start gap-3.5 px-6 py-5 border-b border-slate-100">
                <div className={`p-2 rounded-xl border ${accent} flex-shrink-0`}>
                    <Icon size={15} />
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-slate-800 font-display">{title}</h3>
                    {subtitle && (
                        <p className="text-xs text-slate-400 mt-0.5 font-sans leading-relaxed">{subtitle}</p>
                    )}
                </div>
            </div>
            <div className="px-6 py-5">{children}</div>
        </div>
    );
}

function InputLabel({ children, required }) {
    return (
        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 font-sans">
            {children}
            {required && <span className="text-rose-500 ml-1">*</span>}
        </label>
    );
}

export default function CRMView() {
    const { view } = useParams();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const { crmSocket } = useWebSockets();
    const API = import.meta.env.VITE_API_BASE_URL || "https://delegatex.onrender.com";
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [emailError, setEmailError] = useState("");
    const [phoneError, setPhoneError] = useState("");
    const [spouseMobileError, setSpouseMobileError] = useState("");

    const validateEmail = (email) => {
        if (!email) return "Email is required.";
        const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!re.test(email)) {
            return "Please enter a valid email address.";
        }
        return "";
    };

    const validatePhone = (phone) => {
        if (!phone) return "Contact number is required.";
        const digits = phone.replace(/\D/g, "");
        if (digits.length !== 10) {
            return "Contact number must be exactly 10 digits.";
        }
        return "";
    };

    const handlePhoneKeyPress = (e) => {
        if (!/[0-9]/.test(e.key)) {
            e.preventDefault();
        }
    };

    const handlePhonePaste = (e) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData("text");
        const cleanData = pastedData.replace(/\D/g, "").slice(0, 10);
        setLeadForm({ ...leadForm, phone: cleanData });
        setPhoneError(validatePhone(cleanData));
    };

    const validateSpousePhone = (phone) => {
        if (!phone) return "";
        const digits = phone.replace(/\D/g, "");
        if (digits.length !== 10) {
            return "Spouse contact number must be exactly 10 digits.";
        }
        return "";
    };

    const handleSpousePhonePaste = (e) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData("text");
        const cleanData = pastedData.replace(/\D/g, "").slice(0, 10);
        setLeadForm({ ...leadForm, spouseMobile: cleanData });
        setSpouseMobileError(validateSpousePhone(cleanData));
    };

    // In-memory mock leads state to allow basic interactive search & creation
    const [leads, setLeads] = useState([
        { id: 1, name: "Acme Corp", contact: "Alice Vance", email: "alice@acme.com", value: 12000, status: "Meeting Scheduled", date: "2026-06-25" },
        { id: 2, name: "Globex Corporation", contact: "Bob Vance", email: "bob@globex.com", value: 45000, status: "Converted", date: "2026-06-20" },
        { id: 3, name: "Initech", contact: "Peter Gibbons", email: "peter@initech.com", value: 8500, status: "Contacted", date: "2026-06-24" },
        { id: 4, name: "Umbrella Corp", contact: "Albert Wesker", email: "wesker@umbrella.com", value: 95000, status: "Lost", date: "2026-06-15" },
        { id: 5, name: "Hooli", contact: "Gavin Belson", email: "gavin@hooli.xyz", value: 150000, status: "Converted", date: "2026-06-18" },
        { id: 6, name: "Veer Industries", contact: "Rajesh Veer", email: "rajesh@veer.in", value: 30000, status: "Meeting Scheduled", date: "2026-06-26" },
        { id: 7, name: "Soylent Corp", contact: "Robert Thorn", email: "thorn@soylent.org", value: 15000, status: "Lost", date: "2026-06-10" }
    ]);

    // REDESIGNED Meetings mock database and control states
    const [meetings, setMeetings] = useState([
        {
            id: "mtg-1",
            leadId: 1,
            clientName: "Acme Corp",
            category: "Product Demo",
            location: "Zoom Video",
            date: "2026-06-25",
            time: "10:30 AM",
            duration: "45 mins",
            phone: "+91 98765 43210",
            notes: "Initial consultation to discuss custom ecommerce integration, Stripe payment gateway configurations, and inventory sync options.",
            attendees: ["Alice Vance", "purab rahangdale"],
            status: "Completed"
        },
        {
            id: "mtg-2",
            leadId: 6,
            clientName: "Veer Industries",
            category: "Consultation",
            location: "On-Site Office",
            date: "2026-06-26",
            time: "02:00 PM",
            duration: "60 mins",
            phone: "+91 87654 32109",
            notes: "Detailed architecture design review of CRM features and dashboard customization needs for team workflows.",
            attendees: ["Rajesh Veer", "Divya Teja"],
            status: "Scheduled"
        },
        {
            id: "mtg-3",
            leadId: 3,
            clientName: "Initech",
            category: "Follow-up",
            location: "Phone Call",
            date: "2026-06-28",
            time: "11:00 AM",
            duration: "30 mins",
            phone: "+91 76543 21098",
            notes: "Quick check-in to align on timeline estimates and coordinate developer allocations.",
            attendees: ["Peter Gibbons", "Aman Verma"],
            status: "Scheduled"
        }
    ]);

    const location = useLocation();

    const [selectedDate, setSelectedDate] = useState("2026-06-26");
    const [layoutMode, setLayoutMode] = useState("calendar"); // "calendar" | "list"
    const [filterPendingOnly, setFilterPendingOnly] = useState(false);
    const [selectedMeetingForMom, setSelectedMeetingForMom] = useState(null);
    const [selectedLeadForDetails, setSelectedLeadForDetails] = useState(null);
    const [isMomModalOpen, setIsMomModalOpen] = useState(false);
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [momText, setMomText] = useState("");

    // Follow-up date picker modal state
    const [followupDateModal, setFollowupDateModal] = useState(null); // { idx, task }
    const [followupTasks, setFollowupTasks] = useState([
        { customer: "Aarav Mehta", tag: "Overdue", note: "Follow up on demo feedback and answer custom API integration queries.", time: "Yesterday at 4:30 PM", date: "", id: "CLI-FU-001", email: "aarav.mehta@enterprise.com", phone: "+91 98200 12345", location: "Mumbai", status: "Meeting Done", stage: "Follow-up Due", priority: "High", source: "Referral", projectType: "Commercial", industry: "Real Estate", assignedTo: "Sarah Jenkins", budget: "₹1.2Cr – ₹1.8Cr", notes: "Client is overdue on demo feedback. Needs urgent follow-up on API integration queries and custom workflow setup." },
        { customer: "Rohan Verma", tag: "Today", note: "Send revised pricing table and SLAs before EOD.", time: "Today at 2:00 PM", date: new Date().toISOString().split("T")[0], id: "CLI-FU-002", email: "rohan.verma@fingroup.in", phone: "+91 99100 98765", location: "Delhi NCR", status: "Contacted", stage: "Follow-up Due", priority: "High", source: "Cold Call", projectType: "Residential", industry: "Finance", assignedTo: "Priya Sen", budget: "₹80L – ₹1.2Cr", notes: "Pricing table revision pending. Client requested updated SLAs including enterprise tier details before EOD today." },
        { customer: "Priya Sharma", tag: "Tomorrow", note: "Brief meeting to review NDA revisions and legal sign-off timeline.", time: "Tomorrow at 11:30 AM", date: "", id: "CLI-FU-003", email: "priya.sharma@saastech.io", phone: "+91 80456 78901", location: "Bangalore", status: "Contacted", stage: "Follow-up Due", priority: "Medium", source: "Website", projectType: "Corporate", industry: "SaaS Tech", assignedTo: "Rohan Nair", budget: "₹40L – ₹60L", notes: "NDA revisions scheduled for tomorrow. Legal team review required. Sign-off timeline to be confirmed by EOD." },
        { customer: "Aditya Joshi", tag: "Scheduled", note: "Discuss volume discount options for enterprise tier subscription.", time: "Jul 2, 2026 at 3:00 PM", date: "2026-07-02", id: "CLI-FU-004", email: "aditya.joshi@ecomhub.com", phone: "+91 20567 89012", location: "Pune", status: "Meeting Done", stage: "Follow-up Due", priority: "Medium", source: "Google Search", projectType: "Commercial", industry: "E-Commerce", assignedTo: "Sarah Jenkins", budget: "₹50L – ₹75L", notes: "Scheduled call to discuss volume discounts for enterprise tier. Client comparing with 2 competitors." },
        { customer: "Kavya Nair", tag: "Scheduled", note: "Initial kickoff session with customer success and dev leads.", time: "Jul 5, 2026 at 10:00 AM", date: "2026-07-05", id: "CLI-FU-005", email: "kavya.nair@healthcare.co", phone: "+91 44234 56789", location: "Chennai", status: "Contacted", stage: "Follow-up Due", priority: "Low", source: "Instagram", projectType: "Retail", industry: "Healthcare", assignedTo: "Amir Khan", budget: "₹20L – ₹35L", notes: "Kickoff session planned. Customer success team and dev leads to attend. Initial retail expansion discussion." }
    ]);
    const [selectedFollowupDate, setSelectedFollowupDate] = useState("");

    useEffect(() => {
        if (!crmSocket) return;

        const handleCrmMessage = (eventData) => {
            console.log("CRM event received:", eventData);
            const { event, data } = eventData;

            if (event === "lead_created") {
                setLeads(prev => {
                    if (prev.some(l => l.id === data.id)) return prev;
                    return [data, ...prev];
                });
                setAllLeadsRegistry(prev => {
                    if (prev.some(l => l.id === data.id)) return prev;
                    const regLead = {
                        id: `CLI-2026-${data.id.toString().slice(-4)}`,
                        name: data.name,
                        phone: data.phone || "+91 99999 99999",
                        email: data.email,
                        location: data.location || "Bhopal, Madhya Pradesh",
                        projectType: data.projectType || "Residential",
                        status: data.status,
                        stage: "Enquiry",
                        date: data.date,
                        priority: data.priority || "Medium",
                        source: data.source || "Website"
                    };
                    return [regLead, ...prev];
                });
            } else if (event === "followup_scheduled") {
                setMeetings(prev => {
                    if (prev.some(m => m.id === data.id)) return prev;
                    return [data, ...prev];
                });
                // Sync status of the lead locally if it changed
                setLeads(prev => prev.map(l => l.id === data.leadId ? { ...l, status: "Meeting Scheduled" } : l));
            } else if (event === "meeting_status_updated") {
                setMeetings(prev => prev.map(m => m.id === data.id ? { ...m, ...data } : m));
            } else if (event === "followup_rescheduled") {
                setFollowupTasks(prev => prev.map(t => t.id === data.id ? { ...t, ...data } : t));
            }
        };

        crmSocket.on("message", handleCrmMessage);
        return () => {
            crmSocket.off("message", handleCrmMessage);
        };
    }, [crmSocket]);

    useEffect(() => {
        const fetchCrmData = async () => {
            setIsLoading(true);
            try {
                const [leadsRes, meetingsRes] = await Promise.all([
                    axios.get(`${API}/crm/leads`),
                    axios.get(`${API}/crm/meetings`)
                ]);
                if (leadsRes.data && leadsRes.data.length > 0) {
                    setLeads(leadsRes.data);
                    
                    // Map to allLeadsRegistry format
                    const formattedRegistry = leadsRes.data.map(l => ({
                        id: l.id ? (typeof l.id === "string" && l.id.startsWith("CLI-") ? l.id : `CLI-2026-${l.id.toString().slice(-4)}`) : `CLI-2026-${Math.floor(Math.random() * 9000 + 1000)}`,
                        name: l.name,
                        phone: l.phone,
                        email: l.email,
                        location: l.location || "Bhopal, Madhya Pradesh",
                        projectType: l.projectType,
                        status: l.status,
                        stage: l.stage || "Enquiry",
                        date: l.date,
                        priority: l.priority || "Medium",
                        source: l.leadSource || "Website"
                    }));
                    setAllLeadsRegistry(formattedRegistry);
                }
                if (meetingsRes.data && meetingsRes.data.length > 0) {
                    setMeetings(meetingsRes.data);
                }
            } catch (err) {
                console.error("Failed to fetch CRM data", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchCrmData();
    }, []);


    const [meetingForm, setMeetingForm] = useState({
        leadId: "",
        category: "Product Demo",
        location: "Zoom Video",
        date: "2026-06-26",
        time: "10:00 AM",
        duration: "30 mins",
        notes: "",
        attendees: ""
    });

    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const getDaysInMonth = (month, year) => {
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (month, year) => {
        return new Date(year, month, 1).getDay();
    };

    const handlePrevMonth = () => {
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear(currentYear - 1);
        } else {
            setCurrentMonth(currentMonth - 1);
        }
    };

    const handleNextMonth = () => {
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear(currentYear + 1);
        } else {
            setCurrentMonth(currentMonth + 1);
        }
    };

    const getFilteredMeetings = () => {
        let list = meetings;
        if (filterPendingOnly) {
            list = list.filter((m) => m.status === "Scheduled" || m.status === "Rescheduled");
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter((m) =>
                m.clientName.toLowerCase().includes(q) ||
                m.category.toLowerCase().includes(q) ||
                (m.notes && m.notes.toLowerCase().includes(q))
            );
        }
        return list;
    };

    const getMeetingsForSelectedDate = () => {
        const filtered = getFilteredMeetings();
        if (selectedDate) {
            return filtered.filter((m) => m.date === selectedDate);
        }
        return filtered;
    };

    const handleScheduleMeeting = (e) => {
        if (e) e.preventDefault();

        if (!meetingForm.leadId) {
            showToast("Please select a pipeline lead.", "error");
            return;
        }

        const selectedLead = leads.find((l) => String(l.id) === meetingForm.leadId);
        if (!selectedLead) {
            showToast("Selected lead could not be found.", "error");
            return;
        }

        const newMtg = {
            id: `mtg-${Date.now()}`,
            leadId: selectedLead.id,
            clientName: selectedLead.name,
            category: meetingForm.category,
            location: meetingForm.location,
            date: meetingForm.date,
            time: meetingForm.time,
            duration: meetingForm.duration || "30 mins",
            phone: selectedLead.phone || "+91 99999 99999",
            notes: meetingForm.notes,
            attendees: meetingForm.attendees
                ? meetingForm.attendees.split(",").map(s => s.trim()).filter(Boolean)
                : [selectedLead.contact || selectedLead.name, "purab rahangdale"],
            status: "Scheduled"
        };

        setMeetings([newMtg, ...meetings]);

        if (selectedLead.status !== "Meeting Scheduled") {
            const updatedLeads = leads.map((l) =>
                l.id === selectedLead.id ? { ...l, status: "Meeting Scheduled" } : l
            );
            setLeads(updatedLeads);
        }

        if (crmSocket) {
            crmSocket.send({ event: "followup_scheduled", data: newMtg });
        }

        axios.post(`${API}/notifications`, {
            type: "meeting_scheduled",
            title: "Meeting Scheduled",
            message: `A meeting (${newMtg.category}) with client '${newMtg.clientName}' has been scheduled for ${newMtg.date} at ${newMtg.time}.`
        }).catch(err => console.error(err));

        showToast(`Meeting with '${selectedLead.name}' scheduled successfully!`, "success");
        setIsScheduleModalOpen(false);
        setMeetingForm({
            leadId: "",
            category: "Product Demo",
            location: "Zoom Video",
            date: "2026-06-26",
            time: "10:00 AM",
            duration: "30 mins",
            notes: "",
            attendees: ""
        });
    };

    const handleSaveMom = (e) => {
        if (e) e.preventDefault();
        if (!selectedMeetingForMom) return;

        const updated = meetings.map((m) =>
            m.id === selectedMeetingForMom.id ? { ...m, notes: momText, status: "Completed" } : m
        );
        setMeetings(updated);

        if (crmSocket) {
            crmSocket.send({
                event: "meeting_status_updated",
                data: { id: selectedMeetingForMom.id, notes: momText, status: "Completed" }
            });
        }

        showToast(`MOM updated and meeting marked as 'Completed'`, "success");
        setIsMomModalOpen(false);
        setSelectedMeetingForMom(null);
        setMomText("");
    };


    const [leadForm, setLeadForm] = useState({
        name: "",
        phone: "",
        email: "",
        spouseName: "",
        spouseMobile: "",
        leadSource: "Walk-In",
        referredBy: "",
        referrerPhone: "",
        referralEmail: "",
        projectType: "Residential",
        value: "",
        status: "Contacted",
        requirements: ""
    });

    const [searchQuery, setSearchQuery] = useState("");

    // Converted Leads mock database and filter states
    const [convertedLeads, setConvertedLeads] = useState([
        { id: "CRM-2026-4101", name: "Aarav Mehta", phone: "+91 98765 43210", email: "aarav.mehta@gmail.com", location: "Mumbai", projectType: "Residential", date: "2026-06-28", priority: "High" },
        { id: "CRM-2026-4102", name: "Priya Kulkarni", phone: "+91 91234 56789", email: "priya.k@yahoo.com", location: "Pune", projectType: "Commercial", date: "2026-06-26", priority: "Medium" },
        { id: "CRM-2026-4103", name: "Rohan Deshmukh", phone: "+91 88888 77777", email: "rohan.d@outlook.com", location: "Bengaluru", projectType: "Corporate", date: "2026-06-24", priority: "High" },
        { id: "CRM-2026-4104", name: "Kavya Nair", phone: "+91 77777 66666", email: "kavya.nair@gmail.com", location: "Hyderabad", projectType: "Retail", date: "2026-06-22", priority: "Low" },
        { id: "CRM-2026-4105", name: "Arjun Verma", phone: "+91 99999 88888", email: "arjun.v@gmail.com", location: "Indore", projectType: "Residential", date: "2026-06-20", priority: "Medium" },
        { id: "CRM-2026-4106", name: "Sneha Patil", phone: "+91 92222 33333", email: "sneha.patil@yahoo.in", location: "Ahmedabad", projectType: "Commercial", date: "2026-06-18", priority: "High" },
        { id: "CRM-2026-4107", name: "Vikram Malhotra", phone: "+91 93333 44444", email: "vikram.m@malhotra.co", location: "Mumbai", projectType: "Corporate", date: "2026-06-15", priority: "Medium" },
        { id: "CRM-2026-4108", name: "Ananya Sen", phone: "+91 94444 55555", email: "ananya.sen@gmail.com", location: "Bengaluru", projectType: "Retail", date: "2026-06-12", priority: "Low" },
        { id: "CRM-2026-4109", name: "Kabir Joshi", phone: "+91 95555 66666", email: "kabir.j@hotmail.com", location: "Pune", projectType: "Residential", date: "2026-06-10", priority: "High" },
        { id: "CRM-2026-4110", name: "Meera Reddy", phone: "+91 96666 77777", email: "meera.reddy@gmail.com", location: "Hyderabad", projectType: "Commercial", date: "2026-06-08", priority: "Medium" },
        { id: "CRM-2026-4111", name: "Devendra Singh", phone: "+91 97777 88888", email: "devendra.s@gmail.com", location: "Indore", projectType: "Corporate", date: "2026-06-05", priority: "Low" },
        { id: "CRM-2026-4112", name: "Ishita Sharma", phone: "+91 98888 99999", email: "ishita.s@yahoo.com", location: "Ahmedabad", projectType: "Retail", date: "2026-06-02", priority: "High" }
    ]);

    const [convertedSearchQuery, setConvertedSearchQuery] = useState("");
    const [convertedSortOption, setConvertedSortOption] = useState("newest");
    const [convertedProjectType, setConvertedProjectType] = useState("All Types");
    const [convertedDatePreset, setConvertedDatePreset] = useState("All Time");

    // Lost Leads mock database and filter states
    const [lostLeads, setLostLeads] = useState([
        { id: "CRM-2026-9051", name: "Aditya Sen", phone: "+91 90000 11111", email: "aditya.sen@gmail.com", location: "Mumbai", projectType: "Residential", date: "2026-06-19", priority: "High" },
        { id: "CRM-2026-9052", name: "Maya Patel", phone: "+91 91111 22222", email: "maya.patel@yahoo.com", location: "Pune", projectType: "Commercial", date: "2026-06-16", priority: "Medium" },
        { id: "CRM-2026-9053", name: "Kabir Roy", phone: "+91 92222 33333", email: "kabir.roy@gmail.com", location: "Bengaluru", projectType: "Corporate", date: "2026-06-13", priority: "High" },
        { id: "CRM-2026-9054", name: "Divya Rao", phone: "+91 93333 44444", email: "divya.rao@outlook.com", location: "Hyderabad", projectType: "Retail", date: "2026-06-10", priority: "Low" },
        { id: "CRM-2026-9055", name: "Neha Sharma", phone: "+91 94444 55555", email: "neha.sharma@gmail.com", location: "Indore", projectType: "Residential", date: "2026-06-07", priority: "Medium" },
        { id: "CRM-2026-9056", name: "Rajiv Reddy", phone: "+91 95555 66666", email: "rajiv.reddy@gmail.com", location: "Ahmedabad", projectType: "Commercial", date: "2026-06-04", priority: "High" },
        { id: "CRM-2026-9057", name: "Siddharth Dixit", phone: "+91 96666 77777", email: "sid.dixit@yahoo.in", location: "Pune", projectType: "Corporate", date: "2026-06-01", priority: "Medium" },
        { id: "CRM-2026-9058", name: "Kriti Kapoor", phone: "+91 97777 88888", email: "kriti.k@gmail.com", location: "Bengaluru", projectType: "Retail", date: "2026-05-28", priority: "Low" }
    ]);

    const [lostSearchQuery, setLostSearchQuery] = useState("");
    const [lostSortOption, setLostSortOption] = useState("newest");
    const [lostProjectType, setLostProjectType] = useState("All Types");
    const [lostDatePreset, setLostDatePreset] = useState("All Time");

    const getFilteredLostLeads = () => {
        let list = [...lostLeads];

        // Search filter
        if (lostSearchQuery.trim()) {
            const q = lostSearchQuery.toLowerCase();
            list = list.filter(l => 
                l.name.toLowerCase().includes(q) ||
                l.phone.includes(q) ||
                l.projectType.toLowerCase().includes(q) ||
                l.location.toLowerCase().includes(q) ||
                l.id.toLowerCase().includes(q)
            );
        }

        // Project Type filter
        if (lostProjectType !== "All Types") {
            list = list.filter(l => l.projectType === lostProjectType);
        }

        // Date range filter presets
        if (lostDatePreset !== "All Time") {
            const today = new Date();
            list = list.filter(l => {
                const leadDate = new Date(l.date);
                const diffTime = Math.abs(today - leadDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (lostDatePreset === "7-days") return diffDays <= 7;
                if (lostDatePreset === "30-days") return diffDays <= 30;
                if (lostDatePreset === "90-days") return diffDays <= 90;
                return true;
            });
        }

        // Sorting logic
        list.sort((a, b) => {
            if (lostSortOption === "newest") {
                return new Date(b.date) - new Date(a.date);
            }
            if (lostSortOption === "oldest") {
                return new Date(a.date) - new Date(b.date);
            }
            if (lostSortOption === "alpha-asc") {
                return a.name.localeCompare(b.name);
            }
            if (lostSortOption === "alpha-desc") {
                return b.name.localeCompare(a.name);
            }
            return 0;
        });

        return list;
    };

    // All Leads Registry Mock Database (35 entries)
    const [allLeadsRegistry, setAllLeadsRegistry] = useState([
        { id: "CLI-2026-0115", name: "Mukesh Sahu", phone: "+91 98759 45483", email: "nidhisahu@dtableanalytics.com", location: "Bhopal, Madhya Pradesh", projectType: "Residential", status: "Converted", stage: "Project Started", date: "2026-06-26", priority: "High", source: "Referral" },
        { id: "CLI-2026-0114", name: "Purab Jain", phone: "+91 98774 93287", email: "purab@gmail.com", location: "Gwalior, Madhya Pradesh", projectType: "Residential", status: "Meeting Done", stage: "Follow-up Due", date: "2026-06-26", priority: "Medium", source: "Website" },
        { id: "CLI-2026-0113", name: "Neha Yadav", phone: "+91 98995 95948", email: "nehayadav@gmail.com", location: "Indore, Madhya Pradesh", projectType: "Residential", status: "Meeting Done", stage: "Follow-up Due", date: "2026-06-26", priority: "Medium", source: "Walk-In" },
        { id: "CLI-2026-0112", name: "Neha Sahu", phone: "+91 95959 59595", email: "neha@gmail.com", location: "Bhopal, Madhya Pradesh", projectType: "Residential", status: "Converted", stage: "Project Started", date: "2026-06-23", priority: "High", source: "Referral" },
        { id: "CLI-2026-0111", name: "Abhishek Rawat", phone: "+91 91777 30914", email: "abhishekrawat@dtable.com", location: "Bhopal, Madhya Pradesh", projectType: "Residential", status: "Meeting Done", stage: "Interested", date: "2026-06-22", priority: "Low", source: "Cold Call" },
        { id: "CLI-2026-0110", name: "Rajesh Sharma", phone: "+91 98260 12345", email: "rajesh.s@yahoo.com", location: "Indore, Madhya Pradesh", projectType: "Commercial", status: "Contacted", stage: "Discovery", date: "2026-06-20", priority: "Medium", source: "Instagram" },
        { id: "CLI-2026-0109", name: "Anjali Gupta", phone: "+91 94250 54321", email: "anjali@gmail.com", location: "Jabalpur, Madhya Pradesh", projectType: "Corporate", status: "Converted", stage: "Project Started", date: "2026-06-18", priority: "High", source: "Referral" },
        { id: "CLI-2026-0108", name: "Suresh Patel", phone: "+91 98930 98765", email: "suresh.p@gmail.com", location: "Bhopal, Madhya Pradesh", projectType: "Retail", status: "Lost", stage: "Archived", date: "2026-06-15", priority: "Low", source: "Google Search" },
        { id: "CLI-2026-0107", name: "Vikram Singh", phone: "+91 91111 22222", email: "vikram.s@outlook.com", location: "Ujjain, Madhya Pradesh", projectType: "Residential", status: "Meeting Done", stage: "Proposal Sent", date: "2026-06-12", priority: "High", source: "Facebook Ad" },
        { id: "CLI-2026-0106", name: "Divya Sharma", phone: "+91 93000 44444", email: "divya@yahoo.com", location: "Indore, Madhya Pradesh", projectType: "Commercial", status: "Contacted", stage: "Discovery", date: "2026-06-10", priority: "Medium", source: "Website" },
        { id: "CLI-2026-0105", name: "Amit Mishra", phone: "+91 94066 55555", email: "amit.m@gmail.com", location: "Gwalior, Madhya Pradesh", projectType: "Corporate", status: "Converted", stage: "Project Started", date: "2026-06-08", priority: "High", source: "Walk-In" },
        { id: "CLI-2026-0104", name: "Kiran Lodhi", phone: "+91 98270 66666", email: "kiran@gmail.com", location: "Bhopal, Madhya Pradesh", projectType: "Retail", status: "Meeting Done", stage: "Negotiation", date: "2026-06-05", priority: "Medium", source: "Cold Call" },
        { id: "CLI-2026-0103", name: "Deepak Chaurasia", phone: "+91 98935 77777", email: "deepak@chaurasia.co", location: "Jabalpur, Madhya Pradesh", projectType: "Residential", status: "Contacted", stage: "Enquiry", date: "2026-06-02", priority: "Low", source: "Instagram" },
        { id: "CLI-2026-0102", name: "Pooja Verma", phone: "+91 91790 88888", email: "pooja@yahoo.com", location: "Indore, Madhya Pradesh", projectType: "Commercial", status: "Converted", stage: "Project Started", date: "2026-05-30", priority: "High", source: "Referral" },
        { id: "CLI-2026-0101", name: "Sunil Dutt", phone: "+91 98263 99999", email: "sunildutt@gmail.com", location: "Bhopal, Madhya Pradesh", projectType: "Corporate", status: "Lost", stage: "Archived", date: "2026-05-28", priority: "High", source: "Website" },
        { id: "CLI-2026-0100", name: "Shalini Dixit", phone: "+91 98932 11111", email: "shalini@outlook.com", location: "Ujjain, Madhya Pradesh", projectType: "Retail", status: "Meeting Done", stage: "Interested", date: "2026-05-25", priority: "Medium", source: "Facebook Ad" },
        { id: "CLI-2026-0099", name: "Rakesh Roshan", phone: "+91 94253 22222", email: "rakesh@roshan.com", location: "Bhopal, Madhya Pradesh", projectType: "Residential", status: "Contacted", stage: "Discovery", date: "2026-05-22", priority: "Low", source: "Cold Call" },
        { id: "CLI-2026-0098", name: "Kirti Azad", phone: "+91 98272 33333", email: "kirti@azad.in", location: "Indore, Madhya Pradesh", projectType: "Commercial", status: "Converted", stage: "Project Started", date: "2026-05-20", priority: "High", source: "Referral" },
        { id: "CLI-2026-0097", name: "Vijay Mallya", phone: "+91 91111 44444", email: "vijay@ub.com", location: "Gwalior, Madhya Pradesh", projectType: "Corporate", status: "Lost", stage: "Archived", date: "2026-05-18", priority: "High", source: "Google Search" },
        { id: "CLI-2026-0096", name: "Sanjay Dutt", phone: "+91 93000 55555", email: "sanjay@gmail.com", location: "Jabalpur, Madhya Pradesh", projectType: "Residential", status: "Meeting Done", stage: "Follow-up Due", date: "2026-05-15", priority: "Medium", source: "Walk-In" },
        { id: "CLI-2026-0095", name: "Pradeep Kumar", phone: "+91 94065 66666", email: "pradeep@gmail.com", location: "Bhopal, Madhya Pradesh", projectType: "Retail", status: "Contacted", stage: "Discovery", date: "2026-05-12", priority: "Low", source: "Instagram" },
        { id: "CLI-2026-0094", name: "Raman Singh", phone: "+91 98275 77777", email: "raman@yahoo.com", location: "Indore, Madhya Pradesh", projectType: "Residential", status: "Converted", stage: "Project Started", date: "2026-05-09", priority: "High", source: "Referral" },
        { id: "CLI-2026-0093", name: "Harish Rawat", phone: "+91 98933 88888", email: "harish@rawat.co", location: "Ujjain, Madhya Pradesh", projectType: "Commercial", status: "Lost", stage: "Archived", date: "2026-05-06", priority: "Medium", source: "Cold Call" },
        { id: "CLI-2026-0092", name: "Geeta Johri", phone: "+91 91795 99999", email: "geeta@johri.org", location: "Bhopal, Madhya Pradesh", projectType: "Corporate", status: "Meeting Done", stage: "Proposal Sent", date: "2026-05-03", priority: "High", source: "Website" },
        { id: "CLI-2026-0091", name: "Kamal Nath", phone: "+91 98264 11112", email: "kamal@nath.com", location: "Chhindwara, Madhya Pradesh", projectType: "Retail", status: "Contacted", stage: "Discovery", date: "2026-04-30", priority: "Medium", source: "Instagram" },
        { id: "CLI-2026-0090", name: "Shivraj Chouhan", phone: "+91 98934 22223", email: "shivraj@gmail.com", location: "Bhopal, Madhya Pradesh", projectType: "Residential", status: "Converted", stage: "Project Started", date: "2026-04-27", priority: "High", source: "Referral" },
        { id: "CLI-2026-0089", name: "Jyotiraditya Scindia", phone: "+91 94254 33334", email: "jyotiraditya@scindia.co", location: "Gwalior, Madhya Pradesh", projectType: "Commercial", status: "Meeting Done", stage: "Negotiation", date: "2026-04-24", priority: "Medium", source: "Website" },
        { id: "CLI-2026-0088", name: "Digvijaya Singh", phone: "+91 98274 44445", email: "digvijaya@singh.in", location: "Bhopal, Madhya Pradesh", projectType: "Corporate", status: "Contacted", stage: "Enquiry", date: "2026-04-21", priority: "Low", source: "Cold Call" },
        { id: "CLI-2026-0087", name: "Uma Bharti", phone: "+91 91112 55556", email: "uma@bharti.org", location: "Tikamgarh, Madhya Pradesh", projectType: "Retail", status: "Converted", stage: "Project Started", date: "2026-04-18", priority: "High", source: "Referral" },
        { id: "CLI-2026-0086", name: "Babulal Gaur", phone: "+91 93001 66667", email: "babulal@gaur.com", location: "Bhopal, Madhya Pradesh", projectType: "Residential", status: "Lost", stage: "Archived", date: "2026-04-15", priority: "Low", source: "Google Search" },
        { id: "CLI-2026-0085", name: "Kailash Joshi", phone: "+91 94064 77778", email: "kailash@joshi.co", location: "Indore, Madhya Pradesh", projectType: "Commercial", status: "Contacted", stage: "Discovery", date: "2026-04-12", priority: "Medium", source: "Walk-In" },
        { id: "CLI-2026-0084", name: "Sunderlal Patwa", phone: "+91 98276 88889", email: "sunderlal@patwa.org", location: "Bhopal, Madhya Pradesh", projectType: "Corporate", status: "Converted", stage: "Project Started", date: "2026-04-09", priority: "High", source: "Referral" },
        { id: "CLI-2026-0083", name: "Virendra Saklecha", phone: "+91 98936 99990", email: "virendra@saklecha.com", location: "Indore, Madhya Pradesh", projectType: "Retail", status: "Meeting Done", stage: "Follow-up Due", date: "2026-04-06", priority: "Medium", source: "Website" },
        { id: "CLI-2026-0082", name: "Motilal Vora", phone: "+91 91796 11113", email: "motilal@vora.org", location: "Bhopal, Madhya Pradesh", projectType: "Residential", status: "Contacted", stage: "Enquiry", date: "2026-04-03", priority: "Low", source: "Cold Call" },
        { id: "CLI-2026-0081", name: "Arjun Singh", phone: "+91 98265 22224", email: "arjun@singh.co", location: "Sidhi, Madhya Pradesh", projectType: "Commercial", status: "Converted", stage: "Project Started", date: "2026-03-31", priority: "High", source: "Referral" }
    ]);

    const [leadsSearchQuery, setLeadsSearchQuery] = useState("");
    const [leadsSortOption, setLeadsSortOption] = useState("newest");
    const [leadsStatusFilter, setLeadsStatusFilter] = useState("All Statuses");
    const [leadsProjectTypeFilter, setLeadsProjectTypeFilter] = useState("All Types");
    const [leadsLifecycleStageFilter, setLeadsLifecycleStageFilter] = useState("All Stages");
    const [leadsSourceFilter, setLeadsSourceFilter] = useState("All Sources");
    const [leadsPriorityFilter, setLeadsPriorityFilter] = useState("All Priorities");
    const [leadsDatePresetFilter, setLeadsDatePresetFilter] = useState("All Time");
    const [leadsPage, setLeadsPage] = useState(1);
    const [selectedClient, setSelectedClient] = useState(null);

    // Apply pre-selected filters when navigating from dashboard sections
    useEffect(() => {
        if (view === "leads") {
            if (location.state?.preStageFilter) {
                setLeadsLifecycleStageFilter(location.state.preStageFilter);
                setLeadsPage(1);
                window.history.replaceState({}, "");
            }
            if (location.state?.preHotLeadsFilter) {
                setLeadsPriorityFilter("High");
                setLeadsPage(1);
                window.history.replaceState({}, "");
            }
        }
    }, [view, location.state]);

    const getFilteredAllRegistryLeads = () => {
        let list = [...allLeadsRegistry];

        // Search match (name, phone, email, location, id)
        if (leadsSearchQuery.trim()) {
            const q = leadsSearchQuery.toLowerCase();
            list = list.filter(l => 
                l.name.toLowerCase().includes(q) ||
                l.phone.includes(q) ||
                l.email.toLowerCase().includes(q) ||
                l.location.toLowerCase().includes(q) ||
                l.id.toLowerCase().includes(q)
            );
        }

        // Status match
        if (leadsStatusFilter !== "All Statuses") {
            list = list.filter(l => l.status === leadsStatusFilter);
        }

        // Project Type match
        if (leadsProjectTypeFilter !== "All Types") {
            list = list.filter(l => l.projectType === leadsProjectTypeFilter);
        }

        // Lifecycle Stage match
        if (leadsLifecycleStageFilter !== "All Stages") {
            list = list.filter(l => l.stage === leadsLifecycleStageFilter);
        }

        // Source match
        if (leadsSourceFilter !== "All Sources") {
            list = list.filter(l => l.source === leadsSourceFilter);
        }

        // Priority match
        if (leadsPriorityFilter !== "All Priorities") {
            list = list.filter(l => l.priority === leadsPriorityFilter);
        }

        // Date preset range filter
        if (leadsDatePresetFilter !== "All Time") {
            const today = new Date();
            list = list.filter(l => {
                const leadDate = new Date(l.date);
                const diffTime = Math.abs(today - leadDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (leadsDatePresetFilter === "7-days") return diffDays <= 7;
                if (leadsDatePresetFilter === "30-days") return diffDays <= 30;
                if (leadsDatePresetFilter === "90-days") return diffDays <= 90;
                return true;
            });
        }

        // Sorting logic
        list.sort((a, b) => {
            if (leadsSortOption === "newest") {
                return new Date(b.date) - new Date(a.date);
            }
            if (leadsSortOption === "oldest") {
                return new Date(a.date) - new Date(b.date);
            }
            if (leadsSortOption === "alpha-asc") {
                return a.name.localeCompare(b.name);
            }
            if (leadsSortOption === "alpha-desc") {
                return b.name.localeCompare(a.name);
            }
            return 0;
        });

        return list;
    };

    const getFilteredConvertedLeads = () => {
        let list = [...convertedLeads];

        // Search filter
        if (convertedSearchQuery.trim()) {
            const q = convertedSearchQuery.toLowerCase();
            list = list.filter(l => 
                l.name.toLowerCase().includes(q) ||
                l.phone.includes(q) ||
                l.projectType.toLowerCase().includes(q) ||
                l.location.toLowerCase().includes(q) ||
                l.id.toLowerCase().includes(q)
            );
        }

        // Project Type filter
        if (convertedProjectType !== "All Types") {
            list = list.filter(l => l.projectType === convertedProjectType);
        }

        // Date range filter presets
        if (convertedDatePreset !== "All Time") {
            const today = new Date();
            list = list.filter(l => {
                const leadDate = new Date(l.date);
                const diffTime = Math.abs(today - leadDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (convertedDatePreset === "7-days") return diffDays <= 7;
                if (convertedDatePreset === "30-days") return diffDays <= 30;
                if (convertedDatePreset === "90-days") return diffDays <= 90;
                return true;
            });
        }

        // Sorting logic
        list.sort((a, b) => {
            if (convertedSortOption === "newest") {
                return new Date(b.date) - new Date(a.date);
            }
            if (convertedSortOption === "oldest") {
                return new Date(a.date) - new Date(b.date);
            }
            if (convertedSortOption === "alpha-asc") {
                return a.name.localeCompare(b.name);
            }
            if (convertedSortOption === "alpha-desc") {
                return b.name.localeCompare(a.name);
            }
            return 0;
        });

        return list;
    };

    const handleCreateLead = (e) => {
        if (e) e.preventDefault();
        if (!leadForm.name || !leadForm.phone || !leadForm.email) {
            showToast("Please fill in all required fields.", "error");
            return;
        }
        const error = validateEmail(leadForm.email);
        if (error) {
            setEmailError(error);
            showToast(error, "error");
            return;
        }
        const phoneErr = validatePhone(leadForm.phone);
        if (phoneErr) {
            setPhoneError(phoneErr);
            showToast(phoneErr, "error");
            return;
        }
        const spousePhoneErr = validateSpousePhone(leadForm.spouseMobile);
        if (spousePhoneErr) {
            setSpouseMobileError(spousePhoneErr);
            showToast(spousePhoneErr, "error");
            return;
        }
        setIsSubmitting(true);
        const newLead = {
            id: Date.now(),
            name: leadForm.name,
            contact: leadForm.name,
            email: leadForm.email,
            phone: leadForm.phone,
            spouseName: leadForm.spouseName,
            spouseMobile: leadForm.spouseMobile,
            leadSource: leadForm.leadSource,
            referredBy: leadForm.referredBy,
            referrerPhone: leadForm.referrerPhone,
            referralEmail: leadForm.referralEmail,
            projectType: leadForm.projectType,
            value: parseFloat(leadForm.value) || 0,
            status: leadForm.status,
            requirements: leadForm.requirements,
            stage: "Enquiry",
            priority: "Medium",
            assignedTo: "Sarah Jenkins",
            date: new Date().toISOString().split("T")[0]
        };

        const formData = newLead;
        console.log(formData);

        axios.post(`${API}/crm/leads`, newLead)
            .then(() => {
                showToast(`Enquiry for '${leadForm.name}' registered successfully!`, "success");
                handleReset();
                navigate("/crm/leads");
            })
            .catch((err) => {
                console.error("Failed to register lead", err);
                showToast("Failed to register lead in database", "error");
            })
            .finally(() => {
                setIsSubmitting(false);
            });
    };

    const handleReset = () => {
        setLeadForm({
            name: "",
            phone: "",
            email: "",
            spouseName: "",
            spouseMobile: "",
            leadSource: "Walk-In",
            referredBy: "",
            referrerPhone: "",
            referralEmail: "",
            projectType: "Residential",
            value: "",
            status: "Contacted",
            requirements: ""
        });
        setEmailError("");
        setPhoneError("");
        setSpouseMobileError("");
    };

    // Filter logic based on the active view
    const getFilteredLeads = () => {
        let list = leads;

        if (view === "converted") {
            list = list.filter(l => l.status === "Converted");
        } else if (view === "lost") {
            list = list.filter(l => l.status === "Lost");
        } else if (view === "meetings") {
            list = list.filter(l => l.status === "Meeting Scheduled");
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(l =>
                l.name.toLowerCase().includes(q) ||
                (l.contact && l.contact.toLowerCase().includes(q)) ||
                l.email.toLowerCase().includes(q)
            );
        }

        return list;
    };

    const filteredLeads = getFilteredLeads();

    // Stats calculations
    const totalLeads = leads.length;
    const totalValue = leads.reduce((acc, curr) => acc + curr.value, 0);
    const convertedCount = leads.filter(l => l.status === "Converted").length;
    const lostCount = leads.filter(l => l.status === "Lost").length;
    const meetingsCount = leads.filter(l => l.status === "Meeting Scheduled").length;

    // Advanced dashboard metrics
    const activePipelineValue = leads
        .filter(l => l.status !== "Converted" && l.status !== "Lost")
        .reduce((acc, curr) => acc + curr.value, 0);
    const inProgressCount = leads.filter(l => l.status === "Contacted").length;
    const interestedCount = leads.filter(l => l.status === "Meeting Scheduled").length;
    const followUpsCount = meetings.filter(m => m.status === "Scheduled").length;

    // View metadata builder
    const getViewMetadata = () => {
        switch (view) {
            case "dashboard":
                return {
                    title: "CRM Dashboard",
                    subtitle: "Real-time pipeline metrics, opportunities tracking, and team sales conversions.",
                    color: "indigo"
                };
            case "create-lead":
                return {
                    title: "Create New Enquiry",
                    subtitle: "Register a new prospective client and their initial project requirements.",
                    color: "violet"
                };
            case "meetings":
                return {
                    title: "Scheduled Meetings",
                    subtitle: "List of pipeline prospects with scheduled product demos or consultations.",
                    color: "sky"
                };
            case "converted":
                return {
                    title: "Converted Deals",
                    subtitle: "Successfully closed opportunities that have transitioned into active customers.",
                    color: "emerald"
                };
            case "lost":
                return {
                    title: "Lost Opportunities",
                    subtitle: "Leads marked as closed/lost, archived for training and analytics audits.",
                    color: "rose"
                };
            case "leads":
            default:
                return {
                    title: "All Leads",
                    subtitle: "Complete repository of active, incoming, and archived CRM opportunities.",
                    color: "indigo"
                };
        }
    };

    const MeetingCard = ({ meeting }) => {
        const statusColors = {
            Scheduled: "bg-indigo-50 text-indigo-755 border-indigo-100",
            Completed: "bg-emerald-50 text-emerald-755 border-emerald-100",
            Rescheduled: "bg-amber-50 text-amber-755 border-amber-100",
            Cancelled: "bg-rose-50 text-rose-755 border-rose-100"
        };

        const handleStatusChange = (newStatus) => {
            const updated = meetings.map((m) =>
                m.id === meeting.id ? { ...m, status: newStatus } : m
            );
            setMeetings(updated);

            if (crmSocket) {
                crmSocket.send({
                    event: "meeting_status_updated",
                    data: { id: meeting.id, status: newStatus }
                });
            }

            showToast(`Meeting status updated to '${newStatus}'`, "success");
        };

        return (
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-[0_1px_3px_rgba(15,23,42,0.01)] hover:shadow-md hover:border-slate-350 transition-all duration-200 flex flex-col relative overflow-hidden group">
                {/* Thick accent status bar on left */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${meeting.status === "Completed"
                    ? "bg-emerald-500"
                    : meeting.status === "Cancelled"
                        ? "bg-rose-500"
                        : meeting.status === "Rescheduled"
                            ? "bg-amber-500"
                            : "bg-indigo-500"
                    }`} />

                <div className="p-5 pl-6 space-y-4">
                    {/* Top Row: Client Name and Badge / Dropdown */}
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                            <h4 className="text-sm font-bold text-slate-800 leading-snug group-hover:text-indigo-600 transition-colors">
                                {meeting.clientName}
                            </h4>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wide font-sans flex items-center gap-1">
                                    <FiZap size={9} />
                                    {meeting.category}
                                </span>
                                <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wide font-sans flex items-center gap-1">
                                    <FiMapPin size={9} />
                                    {meeting.location}
                                </span>
                            </div>
                        </div>

                        {/* Status Select dropdown */}
                        <div className="relative">
                            <select
                                value={meeting.status}
                                onChange={(e) => handleStatusChange(e.target.value)}
                                className={`text-[10px] font-bold uppercase border px-2 py-1 rounded-lg bg-white cursor-pointer focus:outline-none transition ${statusColors[meeting.status] || "bg-slate-50 text-slate-650 border-slate-100"
                                    }`}
                            >
                                <option value="Scheduled">Scheduled</option>
                                <option value="Completed">Completed</option>
                                <option value="Rescheduled">Rescheduled</option>
                                <option value="Cancelled">Cancelled</option>
                            </select>
                        </div>
                    </div>

                    {/* Middle details row */}
                    <div className="grid grid-cols-2 gap-3 text-[11px] font-semibold text-slate-500 font-sans border-t border-b border-slate-100/50 py-3">
                        <div className="flex items-center gap-2">
                            <FiCalendar size={13} className="text-slate-400" />
                            <span>{meeting.date} at {meeting.time}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <FiClock size={13} className="text-slate-400" />
                            <span>{meeting.duration}</span>
                        </div>
                        <div className="flex items-center gap-2 col-span-2">
                            <FiPhone size={13} className="text-slate-400" />
                            <span>{meeting.phone}</span>
                        </div>
                    </div>

                    {/* Meeting Notes */}
                    {meeting.notes && (
                        <div className="space-y-1 bg-slate-50/50 p-3 rounded-xl border border-slate-100 font-sans">
                            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider flex items-center gap-1.5">
                                <FiFileText size={11} />
                                <span>Meeting Notes / Agenda</span>
                            </span>
                            <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                                {meeting.notes}
                            </p>
                        </div>
                    )}

                    {/* Attendees avatars section */}
                    <div className="flex items-center justify-between flex-wrap gap-2.5 pt-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">
                                Attendees:
                            </span>
                            <div className="flex items-center gap-1 flex-wrap">
                                {meeting.attendees.map((att, index) => (
                                    <span
                                        key={index}
                                        className="text-[10px] font-semibold bg-indigo-50/50 text-indigo-600 px-2 py-0.5 rounded-md border border-indigo-100/50"
                                    >
                                        {att}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 ml-auto">
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedMeetingForMom(meeting);
                                    setMomText(meeting.notes || "");
                                    setIsMomModalOpen(true);
                                }}
                                className="text-[11px] font-bold text-indigo-600 hover:text-white hover:bg-indigo-600 border border-indigo-200 hover:border-transparent px-3 py-1.5 rounded-lg transition-all cursor-pointer bg-white"
                            >
                                Record MOM
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const lead = leads.find((l) => l.id === meeting.leadId);
                                    if (lead) {
                                        setSelectedLeadForDetails(lead);
                                    } else {
                                        setSelectedLeadForDetails({
                                            name: meeting.clientName,
                                            contact: meeting.clientName,
                                            email: "No email stored",
                                            phone: meeting.phone,
                                            value: 0,
                                            status: "Meeting Scheduled",
                                            date: meeting.date,
                                            requirements: meeting.notes
                                        });
                                    }
                                }}
                                className="text-[11px] font-bold text-slate-650 hover:text-white hover:bg-slate-700 border border-slate-200 hover:border-transparent px-3 py-1.5 rounded-lg transition-all cursor-pointer bg-white"
                            >
                                View Lead Details
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const meta = getViewMetadata();

    if (isLoading) {
        return (
            <div className="w-full max-w-none px-4 md:px-6 py-4 space-y-6 animate-pulse">
                {/* Header Skeleton */}
                <div className="flex justify-between items-center">
                    <div className="space-y-2">
                        <div className="h-6 w-48 bg-slate-200 rounded"></div>
                        <div className="h-3 w-64 bg-slate-150 rounded"></div>
                    </div>
                </div>

                {/* 5-Column Dashboard Card Skeletons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm flex flex-col justify-between h-[120px]">
                            <div className="flex justify-between items-start">
                                <div className="space-y-2">
                                    <div className="h-3.5 w-20 bg-slate-200 rounded"></div>
                                    <div className="h-6 w-16 bg-slate-200 rounded"></div>
                                </div>
                                <div className="h-9 w-9 bg-slate-100 rounded-xl"></div>
                            </div>
                            <div className="h-3 w-12 bg-slate-100 rounded"></div>
                        </div>
                    ))}
                </div>

                {/* Content Grid Skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Table / List Skeleton */}
                    <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 space-y-4">
                        <div className="h-4 w-32 bg-slate-200 rounded"></div>
                        <div className="space-y-3">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="flex items-center justify-between border-t border-slate-100 pt-3">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-slate-200"></div>
                                        <div className="space-y-2">
                                            <div className="h-3 w-32 bg-slate-200 rounded"></div>
                                            <div className="h-2.5 w-24 bg-slate-150 rounded"></div>
                                        </div>
                                    </div>
                                    <div className="h-4 w-16 bg-slate-200 rounded"></div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Sidebar Card Skeleton */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200/80 space-y-4">
                        <div className="h-4 w-28 bg-slate-200 rounded"></div>
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex gap-3 border-t border-slate-100 pt-3">
                                <div className="h-10 w-10 bg-slate-200 rounded-lg"></div>
                                <div className="space-y-2 flex-1">
                                    <div className="h-3 w-2/3 bg-slate-200 rounded"></div>
                                    <div className="h-2.5 w-1/3 bg-slate-150 rounded"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-none px-4 md:px-6 py-4 space-y-6">

            {/* Page Header */}
            {view !== "converted" && view !== "lost" && view !== "leads" && (
                <div className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight">
                            {meta.title}
                        </h1>
                        <p className="text-slate-500 text-xs mt-0.5 leading-relaxed font-sans">
                            {meta.subtitle}
                        </p>
                    </div>
                    {view === "dashboard" && (
                        <div className="flex flex-wrap items-center gap-3">
                            {/* Time Range Selector */}
                            <div className="relative">
                                <select
                                    className="appearance-none bg-white border border-slate-200 text-slate-700 text-xs font-semibold px-4 pr-9 py-2 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all cursor-pointer shadow-sm h-10"
                                    defaultValue="30-days"
                                >
                                    <option value="7-days">Last 7 Days</option>
                                    <option value="30-days">Last 30 Days</option>
                                    <option value="this-month">This Month</option>
                                    <option value="last-quarter">Last Quarter</option>
                                </select>
                                <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                            </div>

                            {/* Custom Range Button */}
                            <button
                                type="button"
                                className="flex items-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-750 text-xs font-semibold px-4 py-2 rounded-xl shadow-sm transition h-10 cursor-pointer"
                            >
                                <FiCalendar size={14} className="text-slate-400" />
                                <span>Custom Range</span>
                            </button>

                            {/* Refresh Button */}
                            <button
                                type="button"
                                onClick={() => {
                                    showToast("CRM dashboard data refreshed.", "success");
                                }}
                                className="flex items-center justify-center border border-slate-200 bg-white hover:bg-slate-50 text-slate-750 p-2.5 rounded-xl shadow-sm transition h-10 w-10 cursor-pointer"
                                title="Refresh Data"
                            >
                                <FiRefreshCw size={14} className="text-slate-400 hover:text-slate-750 transition" />
                            </button>

                            {/* Ask AI Button */}
                            <button
                                type="button"
                                onClick={() => {
                                    showToast("Analyzing pipeline with CRM AI Copilot...", "info");
                                }}
                                className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-semibold px-4 py-2 shadow-md shadow-indigo-600/10 hover:shadow-lg transition-all h-10 border-0 cursor-pointer"
                            >
                                <FiZap size={14} />
                                <span>Ask AI</span>
                            </button>
                        </div>
                    )}
                    {view === "meetings" && (
                        <div className="flex items-center gap-3">
                            {/* Calendar / List Toggle Group */}
                            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setLayoutMode("calendar")}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${layoutMode === "calendar"
                                        ? "bg-white text-indigo-600 shadow-sm"
                                        : "text-slate-550 hover:text-slate-800"
                                        }`}
                                >
                                    <FiCalendar size={13} />
                                    <span>Calendar</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setLayoutMode("list")}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${layoutMode === "list"
                                        ? "bg-white text-indigo-600 shadow-sm"
                                        : "text-slate-550 hover:text-slate-800"
                                        }`}
                                >
                                    <FiList size={13} />
                                    <span>List</span>
                                </button>
                            </div>

                            {/* Schedule Meeting CTA */}
                            <button
                                type="button"
                                onClick={() => setIsScheduleModalOpen(true)}
                                className="flex items-center gap-1.5 h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/10 hover:shadow-lg transition-all border-0 cursor-pointer"
                            >
                                <FiPlus size={14} />
                                <span>Schedule Meeting</span>
                            </button>
                        </div>
                    )}
                    {view === "create-lead" && (
                        <button
                            onClick={handleReset}
                            className="text-xs text-slate-400 hover:text-rose-500 font-medium transition-colors flex items-center gap-1.5 py-1.5 px-3 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-100"
                        >
                            <FiX size={11} />
                            Clear Form
                        </button>
                    )}
                </div>
            )}

            {/* Metrics Row (only shown on dashboard view) */}
            {view === "dashboard" && (
                /* Redesigned 5-Column Main KPI Grid */
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        {/* 1. Total Leads */}
                        <div 
                            className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm hover:shadow-md hover:scale-[1.02] cursor-pointer transition-all duration-200 flex flex-col justify-between h-[120px] relative overflow-hidden group"
                            onClick={() => navigate('/crm/leads')}
                        >
                            <div className="flex justify-between items-start">
                                <div className="space-y-0.5">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Leads</span>
                                    <p className="text-2xl font-extrabold text-slate-800 tracking-tight font-display">{totalLeads}</p>
                                </div>
                                <div className="p-2.5 bg-indigo-50 border border-indigo-100/50 rounded-xl text-indigo-600">
                                    <FiUser size={16} />
                                </div>
                            </div>
                            <div className="flex items-center justify-between mt-2.5">
                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-lg flex items-center gap-0.5">
                                    <FiTrendingUp size={11} />
                                    <span>+8.4%</span>
                                </span>
                                <svg className="w-16 h-8 text-indigo-500 stroke-2 opacity-80 group-hover:opacity-100 transition-opacity" viewBox="0 0 100 30" fill="none">
                                    <path d="M0,25 Q15,5 30,20 T60,10 T90,25 T100,5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                        </div>

                        {/* 2. Active Pipeline */}
                        <div 
                            className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm hover:shadow-md hover:scale-[1.02] cursor-pointer transition-all duration-200 flex flex-col justify-between h-[120px] relative overflow-hidden group"
                            onClick={() => navigate('/crm/create-lead')}
                        >
                            <div className="flex justify-between items-start">
                                <div className="space-y-0.5">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Pipeline</span>
                                    <p className="text-2xl font-extrabold text-slate-800 tracking-tight font-display">${activePipelineValue.toLocaleString()}</p>
                                </div>
                                <div className="p-2.5 bg-purple-50 border border-purple-100/50 rounded-xl text-purple-600">
                                    <FiDollarSign size={16} />
                                </div>
                            </div>
                            <div className="flex items-center justify-between mt-2.5">
                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-lg flex items-center gap-0.5">
                                    <FiTrendingUp size={11} />
                                    <span>+12.1%</span>
                                </span>
                                <svg className="w-16 h-8 text-purple-500 stroke-2 opacity-80 group-hover:opacity-100 transition-opacity" viewBox="0 0 100 30" fill="none">
                                    <path d="M0,20 Q15,25 30,10 T60,25 T90,5 T100,15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                        </div>

                        {/* 3. Conversion Rate */}
                        <div 
                            className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm hover:shadow-md hover:scale-[1.02] cursor-pointer transition-all duration-200 flex flex-col justify-between h-[120px] relative overflow-hidden group"
                            onClick={() => navigate('/crm/converted')}
                        >
                            <div className="flex justify-between items-start">
                                <div className="space-y-0.5">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Conversion Rate</span>
                                    <p className="text-2xl font-extrabold text-slate-800 tracking-tight font-display">
                                        {totalLeads > 0 ? ((convertedCount / totalLeads) * 100).toFixed(1) : 0}%
                                    </p>
                                </div>
                                <div className="p-2.5 bg-emerald-50 border border-emerald-100/50 rounded-xl text-emerald-600">
                                    <FiCheckCircle size={16} />
                                </div>
                            </div>
                            <div className="flex items-center justify-between mt-2.5">
                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-lg flex items-center gap-0.5">
                                    <FiTrendingUp size={11} />
                                    <span>+2.1%</span>
                                </span>
                                <svg className="w-16 h-8 text-emerald-500 stroke-2 opacity-80 group-hover:opacity-100 transition-opacity" viewBox="0 0 100 30" fill="none">
                                    <path d="M0,25 Q15,20 30,5 T60,15 T90,5 T100,2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                        </div>

                        {/* 4. Lost Rate */}
                        <div 
                            className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm hover:shadow-md hover:scale-[1.02] cursor-pointer transition-all duration-200 flex flex-col justify-between h-[120px] relative overflow-hidden group"
                            onClick={() => navigate('/crm/lost')}
                        >
                            <div className="flex justify-between items-start">
                                <div className="space-y-0.5">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Lost Rate</span>
                                    <p className="text-2xl font-extrabold text-slate-800 tracking-tight font-display">
                                        {totalLeads > 0 ? ((lostCount / totalLeads) * 100).toFixed(1) : 0}%
                                    </p>
                                </div>
                                <div className="p-2.5 bg-rose-50 border border-rose-100/50 rounded-xl text-rose-600">
                                    <FiXCircle size={16} />
                                </div>
                            </div>
                            <div className="flex items-center justify-between mt-2.5">
                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-lg flex items-center gap-0.5">
                                    <FiTrendingDown size={11} className="rotate-180" />
                                    <span>-0.5%</span>
                                </span>
                                <svg className="w-16 h-8 text-rose-500 stroke-2 opacity-80 group-hover:opacity-100 transition-opacity" viewBox="0 0 100 30" fill="none">
                                    <path d="M0,5 Q15,10 30,25 T60,5 T90,20 T100,25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                        </div>

                        {/* 5. Avg Deal Cycle */}
                        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between h-[120px] relative overflow-hidden group">
                            <div className="flex justify-between items-start">
                                <div className="space-y-0.5">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Avg Deal Cycle</span>
                                    <p className="text-2xl font-extrabold text-slate-800 tracking-tight font-display">18.4 Days</p>
                                </div>
                                <div className="p-2.5 bg-sky-50 border border-sky-100/50 rounded-xl text-sky-600">
                                    <FiClock size={16} />
                                </div>
                            </div>
                            <div className="flex items-center justify-between mt-2.5">
                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-lg flex items-center gap-0.5">
                                    <FiTrendingDown size={11} className="rotate-180" />
                                    <span>-1.2%</span>
                                </span>
                                <svg className="w-16 h-8 text-sky-500 stroke-2 opacity-80 group-hover:opacity-100 transition-opacity" viewBox="0 0 100 30" fill="none">
                                    <path d="M0,20 Q15,10 30,15 T60,25 T90,5 T100,10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                        </div>
                    </div>
            )}

            {/* Main Interactive Views */}
            {view === "create-lead" ? (
                /* Full-Width Form Layout matching Reference Screenshot & Delegation color theme */
                <form onSubmit={handleCreateLead} className="w-full space-y-6">

                    {/* Section 1: Personal Information */}
                    <SectionCard icon={FiUser} title="Personal Information" subtitle="Client primary identification and contact credentials." accentColor="violet">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            {/* Full Name / Client Name */}
                            <div>
                                <InputLabel required>Full Name / Client Name</InputLabel>
                                <div className="relative">
                                    <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={15} />
                                    <input
                                        type="text"
                                        placeholder="Ex: Rajesh Kumar"
                                        value={leadForm.name}
                                        onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                                        className="w-full h-12 rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-xs text-slate-800 placeholder:text-slate-350 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans"
                                    />
                                </div>
                            </div>

                            {/* Contact Number */}
                            <div>
                                <InputLabel required>Contact Number</InputLabel>
                                <div className="relative flex">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-slate-400 pointer-events-none">
                                        <FiPhone size={14} />
                                        <span className="text-xs font-semibold border-r border-slate-200 pr-2">+91</span>
                                    </div>
                                    <input
                                        type="tel"
                                        placeholder="10-digit mobile"
                                        value={leadForm.phone}
                                        onKeyPress={handlePhoneKeyPress}
                                        onPaste={handlePhonePaste}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                                            setLeadForm({ ...leadForm, phone: val });
                                            setPhoneError(validatePhone(val));
                                        }}
                                        className={`w-full h-12 rounded-xl border bg-white pl-20 pr-4 text-xs text-slate-800 placeholder:text-slate-350 focus:outline-none focus:ring-4 transition-all font-sans ${
                                            phoneError 
                                                ? "border-rose-500 focus:border-rose-500 focus:ring-rose-100/50" 
                                                : "border-slate-200 focus:border-indigo-400 focus:ring-indigo-100/50"
                                        }`}
                                    />
                                </div>
                                {phoneError && (
                                    <p className="text-[10px] text-rose-500 font-semibold mt-1 pl-1">{phoneError}</p>
                                )}
                            </div>

                            {/* Email Address */}
                            <div>
                                <InputLabel required>Email Address</InputLabel>
                                <div className="relative">
                                    <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={15} />
                                    <input
                                        type="email"
                                        placeholder="client@example.com"
                                        value={leadForm.email}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setLeadForm({ ...leadForm, email: val });
                                            setEmailError(validateEmail(val));
                                        }}
                                        className={`w-full h-12 rounded-xl border bg-white pl-11 pr-4 text-xs text-slate-800 placeholder:text-slate-350 focus:outline-none focus:ring-4 transition-all font-sans ${
                                            emailError 
                                                ? "border-rose-500 focus:border-rose-500 focus:ring-rose-100/50" 
                                                : "border-slate-200 focus:border-indigo-400 focus:ring-indigo-100/50"
                                        }`}
                                    />
                                </div>
                                {emailError && (
                                    <p className="text-[10px] text-rose-500 font-semibold mt-1 pl-1">{emailError}</p>
                                )}
                            </div>

                            {/* Spouse Name */}
                            <div>
                                <InputLabel>Spouse Name</InputLabel>
                                <div className="relative">
                                    <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={15} />
                                    <input
                                        type="text"
                                        placeholder="Optional"
                                        value={leadForm.spouseName}
                                        onChange={(e) => setLeadForm({ ...leadForm, spouseName: e.target.value })}
                                        className="w-full h-12 rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-xs text-slate-800 placeholder:text-slate-350 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans"
                                    />
                                </div>
                            </div>

                            {/* Spouse Mobile */}
                            <div>
                                <InputLabel>Spouse Mobile</InputLabel>
                                <div className="relative flex">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-slate-400 pointer-events-none">
                                        <FiPhone size={14} />
                                        <span className="text-xs font-semibold border-r border-slate-200 pr-2">+91</span>
                                    </div>
                                    <input
                                        type="tel"
                                        placeholder="Optional"
                                        value={leadForm.spouseMobile}
                                        onKeyPress={handlePhoneKeyPress}
                                        onPaste={handleSpousePhonePaste}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                                            setLeadForm({ ...leadForm, spouseMobile: val });
                                            setSpouseMobileError(validateSpousePhone(val));
                                        }}
                                        className={`w-full h-12 rounded-xl border bg-white pl-20 pr-4 text-xs text-slate-800 placeholder:text-slate-350 focus:outline-none focus:ring-4 transition-all font-sans ${
                                            spouseMobileError 
                                                ? "border-rose-500 focus:border-rose-500 focus:ring-rose-100/50" 
                                                : "border-slate-200 focus:border-indigo-400 focus:ring-indigo-100/50"
                                        }`}
                                    />
                                </div>
                                {spouseMobileError && (
                                    <p className="text-[10px] text-rose-500 font-semibold mt-1 pl-1">{spouseMobileError}</p>
                                )}
                            </div>
                        </div>
                    </SectionCard>

                    {/* Section 2: Referral & Source */}
                    <SectionCard icon={FiGift} title="Referral & Source" subtitle="Campaign track channels and external lead referrers." accentColor="indigo">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            {/* Lead Source */}
                            <div>
                                <InputLabel>Lead Source</InputLabel>
                                <select
                                    value={leadForm.leadSource}
                                    onChange={(e) => setLeadForm({ ...leadForm, leadSource: e.target.value })}
                                    className="w-full h-12 rounded-xl border border-slate-200 bg-white px-4 text-xs text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans cursor-pointer"
                                >
                                    <option>Walk-In</option>
                                    <option>Referral</option>
                                    <option>Instagram</option>
                                    <option>Facebook</option>
                                    <option>Website</option>
                                    <option>Other</option>
                                </select>
                            </div>

                            {/* Referred By */}
                            <div>
                                <InputLabel>Referred By</InputLabel>
                                <div className="relative">
                                    <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={15} />
                                    <input
                                        type="text"
                                        placeholder="Name / Instagram handle"
                                        value={leadForm.referredBy}
                                        onChange={(e) => setLeadForm({ ...leadForm, referredBy: e.target.value })}
                                        className="w-full h-12 rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-xs text-slate-800 placeholder:text-slate-350 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans"
                                    />
                                </div>
                            </div>

                            {/* Referrer Phone */}
                            <div>
                                <InputLabel>Referrer Phone</InputLabel>
                                <div className="relative flex">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-slate-400 pointer-events-none">
                                        <FiPhone size={14} />
                                        <span className="text-xs font-semibold border-r border-slate-200 pr-2">+91</span>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Optional"
                                        value={leadForm.referrerPhone}
                                        onChange={(e) => setLeadForm({ ...leadForm, referrerPhone: e.target.value })}
                                        className="w-full h-12 rounded-xl border border-slate-200 bg-white pl-20 pr-4 text-xs text-slate-800 placeholder:text-slate-350 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans"
                                    />
                                </div>
                            </div>

                            {/* Referral Email */}
                            <div>
                                <InputLabel>Referral Email</InputLabel>
                                <div className="relative">
                                    <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={15} />
                                    <input
                                        type="email"
                                        placeholder="Optional"
                                        value={leadForm.referralEmail}
                                        onChange={(e) => setLeadForm({ ...leadForm, referralEmail: e.target.value })}
                                        className="w-full h-12 rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-xs text-slate-800 placeholder:text-slate-350 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans"
                                    />
                                </div>
                            </div>

                            {/* Project Type */}
                            <div>
                                <InputLabel>Project Type</InputLabel>
                                <select
                                    value={leadForm.projectType}
                                    onChange={(e) => setLeadForm({ ...leadForm, projectType: e.target.value })}
                                    className="w-full h-12 rounded-xl border border-slate-200 bg-white px-4 text-xs text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans cursor-pointer"
                                >
                                    <option>Residential</option>
                                    <option>Commercial</option>
                                    <option>Renovation</option>
                                    <option>Other</option>
                                </select>
                            </div>
                        </div>
                    </SectionCard>

                    {/* Section 3: Project Requirements */}
                    <SectionCard icon={FiFileText} title="Project Requirements" subtitle="Project budget, target details and client demands." accentColor="emerald">
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                {/* Deal Value */}
                                <div>
                                    <InputLabel>Estimated Deal Value ($)</InputLabel>
                                    <div className="relative">
                                        <FiDollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={15} />
                                        <input
                                            type="number"
                                            placeholder="e.g. 15000"
                                            value={leadForm.value}
                                            onChange={(e) => setLeadForm({ ...leadForm, value: e.target.value })}
                                            className="w-full h-12 rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-xs text-slate-800 placeholder:text-slate-350 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans"
                                        />
                                    </div>
                                </div>

                                {/* Status */}
                                <div>
                                    <InputLabel>Pipeline Status</InputLabel>
                                    <select
                                        value={leadForm.status}
                                        onChange={(e) => setLeadForm({ ...leadForm, status: e.target.value })}
                                        className="w-full h-12 rounded-xl border border-slate-200 bg-white px-4 text-xs text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans cursor-pointer"
                                    >
                                        <option>Contacted</option>
                                        <option>Meeting Scheduled</option>
                                        <option>Converted</option>
                                        <option>Lost</option>
                                    </select>
                                </div>
                            </div>

                            {/* Requirements Notes */}
                            <div>
                                <InputLabel>Requirements & Notes</InputLabel>
                                <textarea
                                    rows={4}
                                    placeholder="Describe specific client requirements, site details, and project notes..."
                                    value={leadForm.requirements}
                                    onChange={(e) => setLeadForm({ ...leadForm, requirements: e.target.value })}
                                    className="w-full bg-white border border-slate-200 focus:border-indigo-500 text-slate-800 text-xs p-3.5 rounded-xl outline-none transition font-sans resize-none"
                                />
                            </div>
                        </div>
                    </SectionCard>

                    {/* Form Actions footer */}
                    <div className="flex justify-end gap-3.5 pt-2">
                        <button
                            type="button"
                            onClick={handleReset}
                            className="h-12 px-6 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer"
                        >
                            Reset Form
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="h-12 px-8 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/15 transition cursor-pointer flex items-center justify-center gap-1.5 border-0"
                        >
                            {isSubmitting ? (
                                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                            ) : (
                                <FiCheck size={14} />
                            )}
                            <span>{isSubmitting ? "Registering..." : "Register Enquiry"}</span>
                        </button>
                    </div>
                </form>
            ) : view === "dashboard" ? (
                /* Redesigned Dashboard Analytics & Summary Lists */
                <div className="space-y-6">
                    {/* Second Analytics Row: CRM Stage Cards (Moved here to align with Row 1 Metrics) */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                        {/* 1. In Progress */}
                        <div 
                            className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-sm hover:shadow-md hover:scale-[1.02] cursor-pointer transition-all duration-200 flex flex-col justify-between"
                            onClick={() => navigate('/crm/leads')}
                        >
                            <div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">In Progress</span>
                                <h4 className="text-xl font-extrabold text-slate-800 tracking-tight font-display mt-1">{inProgressCount}</h4>
                            </div>
                            <span className="text-[10px] text-blue-600 bg-blue-50 border border-blue-100/50 px-1.5 py-0.5 rounded-lg font-semibold mt-3 self-start">
                                Contacted Stage
                            </span>
                        </div>

                        {/* 2. Interested */}
                        <div 
                            className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-sm hover:shadow-md hover:scale-[1.02] cursor-pointer transition-all duration-200 flex flex-col justify-between"
                            onClick={() => navigate('/crm/leads')}
                        >
                            <div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Interested</span>
                                <h4 className="text-xl font-extrabold text-slate-800 tracking-tight font-display mt-1">{interestedCount}</h4>
                            </div>
                            <span className="text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-100/50 px-1.5 py-0.5 rounded-lg font-semibold mt-3 self-start">
                                Demos Slated
                            </span>
                        </div>

                        {/* 3. Follow-Ups */}
                        <div 
                            className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-sm hover:shadow-md hover:scale-[1.02] cursor-pointer transition-all duration-200 flex flex-col justify-between"
                            onClick={() => navigate('/crm/leads')}
                        >
                            <div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Follow-Ups</span>
                                <h4 className="text-xl font-extrabold text-slate-800 tracking-tight font-display mt-1">{followUpsCount}</h4>
                            </div>
                            <span className="text-[10px] text-purple-600 bg-purple-50 border border-purple-100/50 px-1.5 py-0.5 rounded-lg font-semibold mt-3 self-start">
                                Pending Action
                            </span>
                        </div>

                        {/* 4. Converted */}
                        <div 
                            className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-sm hover:shadow-md hover:scale-[1.02] cursor-pointer transition-all duration-200 flex flex-col justify-between"
                            onClick={() => navigate('/crm/converted')}
                        >
                            <div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Converted</span>
                                <h4 className="text-xl font-extrabold text-slate-800 tracking-tight font-display mt-1">{convertedCount}</h4>
                            </div>
                            <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100/50 px-1.5 py-0.5 rounded-lg font-semibold mt-3 self-start">
                                Won Contracts
                            </span>
                        </div>

                        {/* 5. Lost Leads */}
                        <div 
                            className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-sm hover:shadow-md hover:scale-[1.02] cursor-pointer transition-all duration-200 flex flex-col justify-between"
                            onClick={() => navigate('/crm/lost')}
                        >
                            <div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Lost Leads</span>
                                <h4 className="text-xl font-extrabold text-slate-800 tracking-tight font-display mt-1">{lostCount}</h4>
                            </div>
                            <span className="text-[10px] text-rose-600 bg-rose-50 border border-rose-100/50 px-1.5 py-0.5 rounded-lg font-semibold mt-3 self-start">
                                Archived Leads
                            </span>
                        </div>
                    </div>

                    {/* New Analytics Trend & Lead Sources Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-fade-in">
                        {/* Lead Acquisition Trend (70% width) */}
                        <div className="lg:col-span-2 bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 flex flex-col gap-4">
                            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-bold text-slate-800 font-display">Lead Acquisition Trend</h3>
                                        <span className="text-[10px] font-bold text-indigo-650 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-150">
                                            131 Leads
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-sans mt-0.5">Monthly registration rate over the last 6 months</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => showToast("Navigating to all leads...", "info")}
                                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 transition cursor-pointer border-0 bg-transparent"
                                >
                                    All Leads
                                </button>
                            </div>
                            <div className="w-full">
                                <svg className="w-full h-[200px]" viewBox="0 0 500 200">
                                    <defs>
                                        <linearGradient id="trend-gradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.2" />
                                            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
                                        </linearGradient>
                                    </defs>
                                    {/* Grid lines */}
                                    <line x1="40" y1="170" x2="480" y2="170" stroke="#f1f5f9" strokeWidth="1" />
                                    <line x1="40" y1="140" x2="480" y2="140" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                                    <line x1="40" y1="110" x2="480" y2="110" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                                    <line x1="40" y1="80" x2="480" y2="80" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                                    <line x1="40" y1="50" x2="480" y2="50" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                                    <line x1="40" y1="20" x2="480" y2="20" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />

                                    {/* Area fill */}
                                    <path
                                        d="M40,134 L128,113 L216,125 L304,74 L392,95 L480,56 L480,170 L40,170 Z"
                                        fill="url(#trend-gradient)"
                                    />

                                    {/* Line path */}
                                    <path
                                        d="M40,134 L128,113 L216,125 L304,74 L392,95 L480,56"
                                        fill="none"
                                        stroke="#4f46e5"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />

                                    {/* Data point markers */}
                                    <circle cx="40" cy="134" r="4" fill="#ffffff" stroke="#4f46e5" strokeWidth="2" />
                                    <circle cx="128" cy="113" r="4" fill="#ffffff" stroke="#4f46e5" strokeWidth="2" />
                                    <circle cx="216" cy="125" r="4" fill="#ffffff" stroke="#4f46e5" strokeWidth="2" />
                                    <circle cx="304" cy="74" r="4" fill="#ffffff" stroke="#4f46e5" strokeWidth="2" />
                                    <circle cx="392" cy="95" r="4" fill="#ffffff" stroke="#4f46e5" strokeWidth="2" />
                                    <circle cx="480" cy="56" r="4" fill="#ffffff" stroke="#4f46e5" strokeWidth="2" />

                                    {/* X-axis Month labels */}
                                    <text x="40" y="190" textAnchor="middle" className="text-[10px] fill-slate-400 font-sans font-semibold">Jan</text>
                                    <text x="128" y="190" textAnchor="middle" className="text-[10px] fill-slate-400 font-sans font-semibold">Feb</text>
                                    <text x="216" y="190" textAnchor="middle" className="text-[10px] fill-slate-400 font-sans font-semibold">Mar</text>
                                    <text x="304" y="190" textAnchor="middle" className="text-[10px] fill-slate-400 font-sans font-semibold">Apr</text>
                                    <text x="392" y="190" textAnchor="middle" className="text-[10px] fill-slate-400 font-sans font-semibold">May</text>
                                    <text x="480" y="190" textAnchor="middle" className="text-[10px] fill-slate-400 font-sans font-semibold">Jun</text>

                                    {/* Y-axis labels */}
                                    <text x="30" y="174" textAnchor="end" className="text-[10px] fill-slate-400 font-sans font-semibold">0</text>
                                    <text x="30" y="144" textAnchor="end" className="text-[10px] fill-slate-400 font-sans font-semibold">10</text>
                                    <text x="30" y="114" textAnchor="end" className="text-[10px] fill-slate-400 font-sans font-semibold">20</text>
                                    <text x="30" y="84" textAnchor="end" className="text-[10px] fill-slate-400 font-sans font-semibold">30</text>
                                    <text x="30" y="54" textAnchor="end" className="text-[10px] fill-slate-400 font-sans font-semibold">40</text>
                                    <text x="30" y="24" textAnchor="end" className="text-[10px] fill-slate-400 font-sans font-semibold">50</text>
                                </svg>
                            </div>
                        </div>

                        {/* Lead Sources (30% width) */}
                        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 flex flex-col gap-4">
                            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-bold text-slate-800 font-display">Lead Sources</h3>
                                        <span className="text-[9px] font-bold text-emerald-650 bg-emerald-50 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                            Active
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-sans mt-0.5">Top performing customer acquisition paths</p>
                                </div>
                            </div>

                            {/* Chart representation */}
                            <div className="flex justify-center py-2 relative">
                                <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 36 36">
                                    {/* Base circle background */}
                                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                                    {/* Website (35%) */}
                                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#4f46e5" strokeWidth="3.2" strokeDasharray="35 100" strokeDashoffset="0" />
                                    {/* LinkedIn (25%) */}
                                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#a855f7" strokeWidth="3.2" strokeDasharray="25 100" strokeDashoffset="-35" />
                                    {/* Referral (15%) */}
                                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#0ea5e9" strokeWidth="3.2" strokeDasharray="15 100" strokeDashoffset="-60" />
                                    {/* Instagram (12%) */}
                                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#10b981" strokeWidth="3.2" strokeDasharray="12 100" strokeDashoffset="-75" />
                                    {/* WhatsApp (8%) */}
                                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#14b8a6" strokeWidth="3.2" strokeDasharray="8 100" strokeDashoffset="-87" />
                                    {/* Cold Outreach (5%) */}
                                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#64748b" strokeWidth="3.2" strokeDasharray="5 100" strokeDashoffset="-95" />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-base font-extrabold text-slate-800 font-display">100 Leads</span>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Total Channels</span>
                                </div>
                            </div>

                            {/* Legend section */}
                            <div className="grid grid-cols-2 gap-2 text-[10px] font-sans font-semibold text-slate-600 mt-2 border-t border-slate-50 pt-3">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0"></span>
                                    <span>Website: 35% (35)</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0"></span>
                                    <span>LinkedIn: 25% (25)</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0"></span>
                                    <span>Referral: 15% (15)</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                                    <span>Instagram: 12% (12)</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-teal-500 shrink-0"></span>
                                    <span>WhatsApp: 8% (8)</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-slate-500 shrink-0"></span>
                                    <span>Outreach: 5% (5)</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Hot Leads & Follow-ups Section */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6 animate-fade-in">
                        {/* Hot Leads Panel */}
                        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 flex flex-col gap-5 hover:shadow-md transition-all duration-200">
                            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <FiZap className="text-rose-500" size={16} />
                                        <h3 className="text-sm font-bold text-slate-800 font-display">Hot Leads</h3>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-sans mt-0.5">High potential customers requiring attention</p>
                                </div>
                            <button
                                    type="button"
                                    onClick={() => navigate('/crm/leads', { state: { preHotLeadsFilter: true } })}
                                    className="text-[11px] font-bold text-indigo-655 hover:text-indigo-800 transition cursor-pointer border-0 bg-transparent"
                                >
                                    View All
                                </button>
                            </div>

                            {/* Hot Leads list */}
                            <div className="flex flex-col gap-3">
                                {[
                                    { name: "Aarav Mehta", initials: "AM", priority: "High", stage: "Proposal Review", industry: "Real Estate", location: "Mumbai", phone: "+91 98200 12345", active: "5m ago", id: "CLI-HOT-001", email: "aarav.mehta@enterprise.com", status: "Meeting Done", projectType: "Commercial", date: "2026-06-29", source: "Referral", assignedTo: "Sarah Jenkins", budget: "₹1.2Cr – ₹1.8Cr", notes: "Client is extremely keen on finalizing the commercial layout by Q3. Budget confirmed. Needs proposal by this week." },
                                    { name: "Priya Sharma", initials: "PS", priority: "Medium", stage: "Meeting Scheduled", industry: "SaaS Tech", location: "Bangalore", phone: "+91 80456 78901", active: "1h ago", id: "CLI-HOT-002", email: "priya.sharma@saastech.io", status: "Contacted", projectType: "Corporate", date: "2026-06-28", source: "Website", assignedTo: "Rohan Nair", budget: "₹40L – ₹60L", notes: "Interested in SaaS integration and CRM customization. Scheduled follow-up demo for next week." },
                                    { name: "Rohan Verma", initials: "RV", priority: "High", stage: "Contract Draft", industry: "Finance", location: "Delhi NCR", phone: "+91 99100 98765", active: "12m ago", id: "CLI-HOT-003", email: "rohan.verma@fingroup.in", status: "Meeting Done", projectType: "Residential", date: "2026-06-27", source: "Cold Call", assignedTo: "Priya Sen", budget: "₹80L – ₹1.2Cr", notes: "Contract draft stage. Legal review pending. Client requested a revised NDA before signing off." },
                                    { name: "Kavya Nair", initials: "KN", priority: "Low", stage: "Initial Inquiry", industry: "Healthcare", location: "Chennai", phone: "+91 44234 56789", active: "2h ago", id: "CLI-HOT-004", email: "kavya.nair@healthcare.co", status: "Contacted", projectType: "Retail", date: "2026-06-26", source: "Instagram", assignedTo: "Amir Khan", budget: "₹20L – ₹35L", notes: "Early stage inquiry. Exploring options for retail expansion. Initial discovery call completed." },
                                    { name: "Aditya Joshi", initials: "AJ", priority: "Medium", stage: "Demo Completed", industry: "E-Commerce", location: "Pune", phone: "+91 20567 89012", active: "45m ago", id: "CLI-HOT-005", email: "aditya.joshi@ecomhub.com", status: "Meeting Done", projectType: "Commercial", date: "2026-06-25", source: "Google Search", assignedTo: "Sarah Jenkins", budget: "₹50L – ₹75L", notes: "Demo completed successfully. Client is evaluating 2 other vendors. Need to send competitive pricing by EOD." }
                                ].map((lead, idx) => {
                                    const priorityColors = {
                                        High: "bg-rose-50 text-rose-700 border-rose-100",
                                        Medium: "bg-amber-50 text-amber-700 border-amber-100",
                                        Low: "bg-emerald-50 text-emerald-700 border-emerald-100"
                                    };
                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => setSelectedClient(lead)}
                                            className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-slate-50/30 transition-all duration-150 gap-4 group cursor-pointer"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-650 border border-indigo-100/50 flex items-center justify-center font-bold text-xs shrink-0 group-hover:scale-105 transition-transform">
                                                    {lead.initials}
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="text-xs font-bold text-slate-800 tracking-tight truncate group-hover:text-indigo-700 transition-colors">{lead.name}</h4>
                                                    <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-slate-450 mt-1 font-medium font-sans">
                                                        <span>{lead.stage}</span>
                                                        <span>•</span>
                                                        <span>{lead.industry}</span>
                                                        <span>•</span>
                                                        <span>{lead.location}</span>
                                                    </div>
                                                    <div className="text-[9px] text-slate-400 font-sans mt-0.5 flex items-center gap-2">
                                                        <span>{lead.phone}</span>
                                                        <span>|</span>
                                                        <span>{lead.active}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold border uppercase tracking-wider shrink-0 ${priorityColors[lead.priority]}`}>
                                                {lead.priority}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Follow-ups Panel */}
                        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 flex flex-col gap-5 hover:shadow-md transition-all duration-200">
                            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <FiCalendar className="text-indigo-500" size={16} />
                                        <h3 className="text-sm font-bold text-slate-800 font-display">Follow-ups</h3>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-sans mt-0.5">Upcoming and overdue customer follow-ups</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        navigate('/crm/leads', { state: { preStageFilter: 'Follow-up Due' } });
                                    }}
                                    className="text-[11px] font-bold text-indigo-655 hover:text-indigo-800 transition cursor-pointer border-0 bg-transparent"
                                >
                                    View All
                                </button>
                            </div>

                            {/* Follow-ups list */}
                            <div className="flex flex-col gap-3">
                                {followupTasks.map((task, idx) => {
                                    const tagColors = {
                                        Today: "bg-blue-50 text-blue-700 border-blue-100",
                                        Tomorrow: "bg-indigo-50 text-indigo-700 border-indigo-100",
                                        Overdue: "bg-rose-50 text-rose-700 border-rose-100",
                                        Scheduled: "bg-emerald-50 text-emerald-700 border-emerald-100"
                                    };
                                    // Build a selectedClient-compatible object from this task
                                    const clientPayload = {
                                        name: task.customer,
                                        id: task.id || `CLI-FU-${idx + 1}`,
                                        email: task.email || "",
                                        phone: task.phone || "",
                                        location: task.location || "",
                                        status: task.status || "Contacted",
                                        stage: task.stage || "Follow-up Due",
                                        priority: task.priority || "Medium",
                                        source: task.source || "Referral",
                                        projectType: task.projectType || "Commercial",
                                        industry: task.industry || "",
                                        assignedTo: task.assignedTo || "Sarah Jenkins",
                                        budget: task.budget || "",
                                        notes: task.notes || task.note || "",
                                        date: task.date || new Date().toISOString().split("T")[0]
                                    };
                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => setSelectedClient(clientPayload)}
                                            className="flex flex-col p-3.5 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-slate-50/30 transition-all duration-150 gap-2 font-sans cursor-pointer group"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <h4 className="text-xs font-bold text-slate-800 leading-snug truncate group-hover:text-indigo-700 transition-colors">{task.customer}</h4>
                                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold border uppercase tracking-wider shrink-0 ${tagColors[task.tag]}`}>
                                                    {task.tag}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 font-medium leading-relaxed font-sans mt-0.5">
                                                {task.note}
                                            </p>
                                            <div className="flex items-center justify-between text-[9px] text-slate-400 font-medium border-t border-slate-100/50 pt-2 mt-1">
                                                <span className="flex items-center gap-1.5">
                                                    <FiClock size={11} className="text-slate-350" />
                                                    <span>{task.time}</span>
                                                </span>
                                                <button
                                                    type="button"
                                                    title="Schedule / Reschedule follow-up date"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedFollowupDate(task.date || "");
                                                        setFollowupDateModal({ idx, task });
                                                    }}
                                                    className="group/cal flex items-center gap-1 text-slate-350 hover:text-indigo-600 transition-all duration-200 cursor-pointer border-0 bg-transparent p-0.5 rounded-md hover:bg-indigo-50"
                                                >
                                                    <FiCalendar size={11} className="transition-transform duration-200 group-hover/cal:scale-110" />
                                                    {task.date && <span className="text-[9px] font-semibold">{task.date}</span>}
                                                </button>
                                            </div>
                                    </div>
                                    );
                                })}
                            </div>

                            {/* Follow-up Date Picker Modal */}
                            {followupDateModal !== null && (
                                <div
                                    className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in"
                                    onClick={(e) => { if (e.target === e.currentTarget) setFollowupDateModal(null); }}
                                >
                                    <div
                                        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm overflow-hidden animate-slide-up"
                                    >
                                        {/* Modal Header */}
                                        <div className="flex justify-between items-center px-5 py-4 border-b border-slate-100">
                                            <div>
                                                <h3 className="text-sm font-bold text-slate-800 font-display">Schedule Follow-up</h3>
                                                <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                                                    {followupDateModal.task.customer}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setFollowupDateModal(null)}
                                                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer border-0 bg-transparent"
                                            >
                                                <FiX size={15} />
                                            </button>
                                        </div>

                                        {/* Modal Body */}
                                        <div className="px-5 py-5 space-y-4">
                                            {/* Current info */}
                                            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 font-sans">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Current Schedule</p>
                                                <p className="text-xs font-semibold text-slate-700">{followupDateModal.task.time}</p>
                                            </div>

                                            {/* Date Picker */}
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 font-sans">
                                                    New Follow-up Date <span className="text-rose-500">*</span>
                                                </label>
                                                <input
                                                    type="date"
                                                    value={selectedFollowupDate}
                                                    min={new Date().toISOString().split("T")[0]}
                                                    onChange={(e) => setSelectedFollowupDate(e.target.value)}
                                                    className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans cursor-pointer"
                                                />
                                                <p className="text-[10px] text-slate-400 mt-1.5 font-sans">
                                                    ✓ Today and future dates are selectable. Past dates are disabled.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Modal Footer */}
                                        <div className="flex justify-end gap-2.5 px-5 py-4 border-t border-slate-100">
                                            <button
                                                type="button"
                                                onClick={() => setFollowupDateModal(null)}
                                                className="h-9 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                disabled={!selectedFollowupDate}
                                                onClick={() => {
                                                    if (!selectedFollowupDate) return;
                                                    const dateObj = new Date(selectedFollowupDate);
                                                    const formattedDisplay = dateObj.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
                                                    const today = new Date().toISOString().split("T")[0];
                                                    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
                                                    let newTag = "Scheduled";
                                                    if (selectedFollowupDate === today) newTag = "Today";
                                                    else if (selectedFollowupDate === tomorrow) newTag = "Tomorrow";

                                                    const rescheduledTask = {
                                                        id: followupDateModal.task.id,
                                                        date: selectedFollowupDate,
                                                        time: formattedDisplay,
                                                        tag: newTag
                                                    };

                                                    setFollowupTasks(prev => prev.map((t, i) =>
                                                        i === followupDateModal.idx
                                                            ? { ...t, date: selectedFollowupDate, time: `${formattedDisplay}`, tag: newTag }
                                                            : t
                                                    ));

                                                    if (crmSocket) {
                                                        crmSocket.send({
                                                            event: "followup_rescheduled",
                                                            data: rescheduledTask
                                                        });
                                                    }

                                                    axios.post(`${API}/notifications`, {
                                                        type: "followup_reminder",
                                                        title: "Follow-up Rescheduled",
                                                        message: `Follow-up for customer '${followupDateModal.task.customer}' rescheduled to ${formattedDisplay}.`
                                                    }).catch(err => console.error(err));

                                                    showToast(`Follow-up for ${followupDateModal.task.customer} rescheduled to ${formattedDisplay}`, "success");
                                                    setFollowupDateModal(null);
                                                }}
                                                className="h-9 px-5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/10 transition cursor-pointer border-0"
                                            >
                                                Save Date
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sales Funnel & Project Type Mix Section */}
                    <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6 mt-6 animate-fade-in">
                        {/* Sales Funnel Card */}
                        <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm p-6 flex flex-col gap-5 hover:shadow-md transition-all duration-200">
                            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100/50 flex items-center justify-center shrink-0">
                                        <FiSliders size={15} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-sm font-bold text-slate-800 font-display">Sales Funnel</h3>
                                            <span className="text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                                CURRENT
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-sans mt-0.5">Lifecycle stage flow & drop-off</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => showToast("Viewing full pipeline...", "info")}
                                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-850 transition cursor-pointer border-0 bg-transparent flex items-center gap-0.5"
                                    >
                                        Pipeline &gt;
                                    </button>
                                    <FiInfo size={14} className="text-slate-400 cursor-pointer hover:text-indigo-600 transition" />
                                </div>
                            </div>

                            {/* Funnel bars visualization */}
                            <div className="flex flex-col gap-2 pt-1 font-sans text-xs">
                                {[
                                    { key: "ENQUIRY", count: 60, pct: "100%", conv: "↘ 70.0% CONVERSION", width: "100%", color: "bg-blue-500" },
                                    { key: "MEETING", count: 42, pct: "70%", conv: "↘ 66.7% CONVERSION", width: "70%", color: "bg-teal-500" },
                                    { key: "INTERESTED", count: 28, pct: "47%", conv: "↘ 64.3% CONVERSION", width: "47%", color: "bg-amber-400" },
                                    { key: "PROPOSAL", count: 18, pct: "30%", conv: "↘ 66.7% CONVERSION", width: "30%", color: "bg-orange-400" },
                                    { key: "ADVANCE", count: 12, pct: "20%", conv: "↘ 75.0% CONVERSION", width: "20%", color: "bg-purple-500" },
                                    { key: "CONVERTED", count: 9, pct: "15%", conv: null, width: "15%", color: "bg-emerald-500" }
                                ].map((stage, idx) => (
                                    <div key={idx} className="flex flex-col gap-1.5 w-full">
                                        <div className="flex items-center justify-between gap-3 w-full">
                                            <div className="flex-1">
                                                <div 
                                                    className={`${stage.color} text-white rounded-xl h-10 px-4 flex items-center justify-between shadow-sm hover:scale-[1.002] transition-transform min-w-[120px]`}
                                                    style={{ width: stage.width }}
                                                >
                                                    <span className="font-bold tracking-wider uppercase text-[10px]">{stage.key}</span>
                                                    <span className="font-extrabold text-[11px]">{stage.count}</span>
                                                </div>
                                            </div>
                                            <span className="text-slate-400 text-[11px] font-bold w-10 text-right shrink-0">{stage.pct}</span>
                                        </div>
                                        {stage.conv && (
                                            <div className="flex items-center pl-4 py-0.5 text-rose-500 font-bold uppercase tracking-wider text-[9px] font-sans">
                                                {stage.conv}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Project Type Mix Card */}
                        <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm p-6 flex flex-col gap-5 hover:shadow-md transition-all duration-200">
                            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100/50 flex items-center justify-center shrink-0">
                                        <FiLayers size={15} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-sm font-bold text-slate-800 font-display">Project Type Mix</h3>
                                            <span className="text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                                CURRENT
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-sans mt-0.5">Residential vs Commercial</p>
                                    </div>
                                </div>
                                <FiInfo size={14} className="text-slate-400 cursor-pointer hover:text-indigo-600 transition shrink-0" />
                            </div>

                            {/* Donut Chart representation */}
                            <div className="flex justify-center py-4 relative">
                                <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 36 36">
                                    {/* Base circle background */}
                                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                                    {/* Residential (66.7%) */}
                                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#4f46e5" strokeWidth="3.2" strokeDasharray="66.7 100" strokeDashoffset="0" />
                                    {/* Commercial (33.3%) */}
                                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#a855f7" strokeWidth="3.2" strokeDasharray="33.3 100" strokeDashoffset="-66.7" />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">PROJECTS</span>
                                    <span className="text-base font-extrabold text-slate-800 font-display mt-0.5">75</span>
                                </div>
                            </div>

                            {/* Summary Rows */}
                            <div className="flex flex-col gap-2.5 font-sans text-xs mt-3 pt-3 border-t border-slate-50">
                                {[
                                    { name: "Residential", count: 50, revenue: "₹16.2Cr", color: "bg-indigo-600", bg: "bg-slate-50 border-slate-100 text-slate-700" },
                                    { name: "Commercial", count: 25, revenue: "₹9.4Cr", color: "bg-purple-500", bg: "bg-slate-50 border-slate-100 text-slate-700" }
                                ].map((cat, idx) => (
                                    <div key={idx} className={`flex items-center justify-between p-3 rounded-xl border ${cat.bg} font-semibold transition hover:scale-[1.005]`}>
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2.5 h-2.5 rounded-full ${cat.color}`}></span>
                                            <span>{cat.name}</span>
                                        </div>
                                        <div className="flex items-center gap-4 font-bold">
                                            <span className="text-slate-400 font-medium">{cat.count}</span>
                                            <span>{cat.revenue}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            ) : view === "meetings" ? (
                /* REDESIGNED Meetings Workspace */
                <div className="space-y-6 animate-fade-in font-sans">
                    {/* Filter controls row */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="relative flex-1 min-w-[280px]">
                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                <FiSearch size={14} />
                            </span>
                            <input
                                type="text"
                                placeholder="Search meetings by client name, category, or notes..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 text-xs text-slate-850 placeholder-slate-450 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans h-10 shadow-sm"
                            />
                        </div>
                    </div>

                    {layoutMode === "calendar" ? (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                            {/* Left-side Panel Column */}
                            <div className="lg:col-span-1 space-y-5">
                                {/* Calendar Panel Card */}
                                <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-5 space-y-4">
                                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                        <h3 className="text-sm font-bold text-slate-800 font-display">
                                            {monthNames[currentMonth]} {currentYear}
                                        </h3>
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={handlePrevMonth}
                                                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-555 hover:text-slate-850 transition cursor-pointer border-0 bg-transparent"
                                            >
                                                <FiChevronLeft size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleNextMonth}
                                                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-555 hover:text-slate-850 transition cursor-pointer border-0 bg-transparent"
                                            >
                                                <FiChevronRight size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Days of Week Header */}
                                    <div className="grid grid-cols-7 gap-1 text-center font-semibold text-[10px] text-slate-400 uppercase font-sans pb-1.5">
                                        <span>Su</span>
                                        <span>Mo</span>
                                        <span>Tu</span>
                                        <span>We</span>
                                        <span>Th</span>
                                        <span>Fr</span>
                                        <span>Sa</span>
                                    </div>

                                    {/* Calendar Grid */}
                                    <div className="grid grid-cols-7 gap-1 font-sans text-xs">
                                        {Array.from({ length: getFirstDayOfMonth(currentMonth, currentYear) }).map((_, idx) => (
                                            <div key={`empty-${idx}`} className="p-2" />
                                        ))}
                                        {Array.from({ length: getDaysInMonth(currentMonth, currentYear) }).map((_, idx) => {
                                            const dayNum = idx + 1;
                                            const formattedDay = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;

                                            const meetingsOnDay = meetings.filter((m) => m.date === formattedDay);
                                            const hasMeetings = meetingsOnDay.length > 0;

                                            const isSelected = selectedDate === formattedDay;
                                            const isToday = new Date().toISOString().split("T")[0] === formattedDay;

                                            return (
                                                <button
                                                    key={`day-${dayNum}`}
                                                    type="button"
                                                    onClick={() => setSelectedDate(formattedDay)}
                                                    className={`relative p-2 h-9 rounded-xl font-bold flex flex-col items-center justify-center transition-all cursor-pointer group ${isSelected
                                                        ? "bg-indigo-600 text-white shadow-sm font-extrabold scale-105"
                                                        : isToday
                                                            ? "border border-indigo-200 text-indigo-600 hover:bg-indigo-50/50"
                                                            : "text-slate-600 hover:bg-slate-100"
                                                        }`}
                                                >
                                                    <span>{dayNum}</span>
                                                    {hasMeetings && (
                                                        <span className={`absolute bottom-1 w-1 h-1 rounded-full ${isSelected ? "bg-white" : "bg-indigo-500"
                                                            }`} />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-450 font-semibold flex items-center justify-between">
                                        <span>Selected Date:</span>
                                        <span className="text-slate-700 font-bold font-sans">{selectedDate || "All"}</span>
                                    </div>
                                </div>

                                {/* Pending Filter Card */}
                                <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-5 space-y-3.5">
                                    <div className="pb-2 border-b border-slate-100 flex items-center justify-between">
                                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-sans">
                                            Meeting Filters
                                        </h3>
                                        <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded uppercase tracking-wide">
                                            Live
                                        </span>
                                    </div>

                                    <label className="flex items-center gap-2.5 text-xs font-bold text-slate-650 cursor-pointer select-none py-1">
                                        <input
                                            type="checkbox"
                                            checked={filterPendingOnly}
                                            onChange={(e) => setFilterPendingOnly(e.target.checked)}
                                            className="w-4 h-4 rounded text-indigo-650 border-slate-350 focus:ring-indigo-500 transition cursor-pointer"
                                        />
                                        <span>Show Pending Meetings Only</span>
                                    </label>

                                    {filterPendingOnly ? (
                                        <div className="text-[10px] text-indigo-650 bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100/50 font-semibold leading-relaxed font-sans flex items-start gap-1.5 animate-fade-in">
                                            <FiInfo size={12} className="text-indigo-500 shrink-0 mt-0.5" />
                                            <span>Displaying only Scheduled & Rescheduled consults. Completed and Cancelled events are hidden.</span>
                                        </div>
                                    ) : (
                                        <div className="text-[10px] text-slate-450 p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 font-semibold leading-relaxed font-sans">
                                            Currently showing all meeting statuses (Scheduled, Completed, Rescheduled, Cancelled).
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right-side Meeting list cards */}
                            <div className="lg:col-span-2 space-y-4">
                                <div className="flex items-center justify-between pb-1">
                                    <span className="text-xs font-bold text-slate-450 uppercase tracking-wider">
                                        Meetings {selectedDate ? `for ${selectedDate}` : "List"}
                                    </span>
                                    {getMeetingsForSelectedDate().length > 0 && (
                                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100/50">
                                            {getMeetingsForSelectedDate().length} Events
                                        </span>
                                    )}
                                </div>
                                {getMeetingsForSelectedDate().length > 0 ? (
                                    <div className="space-y-4">
                                        {getMeetingsForSelectedDate().map((mtg) => (
                                            <MeetingCard key={mtg.id} meeting={mtg} />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-white border border-slate-200/80 rounded-2xl p-10 text-center flex flex-col items-center justify-center gap-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.01)]">
                                        <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-450">
                                            <FiCalendar size={22} className="opacity-70" />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-sm font-bold text-slate-750">No Meetings Scheduled</h4>
                                            <p className="text-xs text-slate-400 max-w-[280px] mx-auto font-medium">
                                                There are no events registered for {selectedDate}. Schedule a new consult or view all.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedDate("")}
                                            className="text-xs text-indigo-600 hover:text-indigo-700 font-bold underline transition cursor-pointer border-0 bg-transparent"
                                        >
                                            View All Meetings
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* List View - Full width cards */
                        <div className="space-y-4">
                            <div className="flex items-center justify-between pb-1">
                                <span className="text-xs font-bold text-slate-450 uppercase tracking-wider">
                                    All Scheduled Meetings ({getFilteredMeetings().length})
                                </span>
                            </div>
                            {getFilteredMeetings().length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {getFilteredMeetings().map((mtg) => (
                                        <MeetingCard key={mtg.id} meeting={mtg} />
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-3 shadow-sm">
                                    <FiAlertCircle size={28} className="text-slate-350 animate-pulse" />
                                    <span className="text-sm font-semibold text-slate-800">No meetings match search query</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Floating action / help button */}
                    <div className="fixed bottom-6 right-6 z-40 group">
                        <div className="absolute right-0 bottom-14 w-64 bg-slate-900 text-white text-xs p-3.5 rounded-2xl shadow-xl border border-slate-800 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-300 translate-y-2 group-hover:translate-y-0 leading-relaxed font-sans">
                            <div className="font-bold text-indigo-400 mb-1 flex items-center gap-1.5 font-display text-[13px]">
                                <FiZap size={13} />
                                <span>Quick CRM Tips</span>
                            </div>
                            Schedule consultations and log Minutes of Meetings (MOM) immediately to capture specifications and speed up delegation workflows.
                        </div>
                        <button
                            type="button"
                            className="w-12 h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all border-0 cursor-pointer transform hover:scale-105"
                        >
                            <FiInfo size={20} />
                        </button>
                    </div>

                    {/* Modals integrated inside view content */}
                    {/* Schedule Meeting Modal */}
                    {isScheduleModalOpen && (
                        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up">
                                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-800 font-display">Schedule New Consultation</h3>
                                        <p className="text-[10px] text-slate-400 font-sans mt-0.5">Link a pipeline lead to a designated date and agenda.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsScheduleModalOpen(false)}
                                        className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer border-0 bg-transparent"
                                    >
                                        <FiX size={16} />
                                    </button>
                                </div>

                                <form onSubmit={handleScheduleMeeting} className="p-6 space-y-4">
                                    <div>
                                        <InputLabel required>Select Pipeline Lead / Prospect</InputLabel>
                                        <select
                                            value={meetingForm.leadId}
                                            onChange={(e) => {
                                                const lead = leads.find(l => String(l.id) === e.target.value);
                                                setMeetingForm({
                                                    ...meetingForm,
                                                    leadId: e.target.value,
                                                    attendees: lead ? `${lead.contact}, purab rahangdale` : "purab rahangdale"
                                                });
                                            }}
                                            className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-850 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans cursor-pointer"
                                            required
                                        >
                                            <option value="">-- Choose Lead --</option>
                                            {leads.map((l) => (
                                                <option key={l.id} value={l.id}>
                                                    {l.name} (${l.value.toLocaleString()})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <InputLabel>Category</InputLabel>
                                            <select
                                                value={meetingForm.category}
                                                onChange={(e) => setMeetingForm({ ...meetingForm, category: e.target.value })}
                                                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-850 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans cursor-pointer"
                                            >
                                                <option>Product Demo</option>
                                                <option>Consultation</option>
                                                <option>Follow-up</option>
                                                <option>Pricing Review</option>
                                                <option>Contract Signoff</option>
                                            </select>
                                        </div>
                                        <div>
                                            <InputLabel>Location</InputLabel>
                                            <select
                                                value={meetingForm.location}
                                                onChange={(e) => setMeetingForm({ ...meetingForm, location: e.target.value })}
                                                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-850 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans cursor-pointer"
                                            >
                                                <option>Zoom Video</option>
                                                <option>Google Meet</option>
                                                <option>On-Site Office</option>
                                                <option>Client Location</option>
                                                <option>Phone Call</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="col-span-2">
                                            <InputLabel required>Date</InputLabel>
                                            <input
                                                type="date"
                                                value={meetingForm.date}
                                                onChange={(e) => setMeetingForm({ ...meetingForm, date: e.target.value })}
                                                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-850 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <InputLabel required>Time</InputLabel>
                                            <input
                                                type="text"
                                                placeholder="e.g. 10:00 AM"
                                                value={meetingForm.time}
                                                onChange={(e) => setMeetingForm({ ...meetingForm, time: e.target.value })}
                                                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-850 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <InputLabel>Duration</InputLabel>
                                            <input
                                                type="text"
                                                placeholder="e.g. 45 mins"
                                                value={meetingForm.duration}
                                                onChange={(e) => setMeetingForm({ ...meetingForm, duration: e.target.value })}
                                                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-850 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <InputLabel>Attendees (Comma separated)</InputLabel>
                                            <input
                                                type="text"
                                                placeholder="e.g. Alice Vance, purab rahangdale"
                                                value={meetingForm.attendees}
                                                onChange={(e) => setMeetingForm({ ...meetingForm, attendees: e.target.value })}
                                                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-850 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <InputLabel>Notes / Agenda Description</InputLabel>
                                        <textarea
                                            rows={3}
                                            placeholder="Detail specific client consultation objectives and discussion roadmap..."
                                            value={meetingForm.notes}
                                            onChange={(e) => setMeetingForm({ ...meetingForm, notes: e.target.value })}
                                            className="w-full bg-white border border-slate-200 focus:border-indigo-500 text-slate-800 text-xs p-3 rounded-xl outline-none transition font-sans resize-none"
                                        />
                                    </div>

                                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                                        <button
                                            type="button"
                                            onClick={() => setIsScheduleModalOpen(false)}
                                            className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="h-10 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/10 transition cursor-pointer border-0"
                                        >
                                            Schedule Event
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* Record MOM Modal */}
                    {isMomModalOpen && selectedMeetingForMom && (
                        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
                                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-800 font-display">Record Minutes of Meeting (MOM)</h3>
                                        <p className="text-[10px] text-slate-400 font-sans mt-0.5">Update notes for the meeting with {selectedMeetingForMom.clientName}.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsMomModalOpen(false);
                                            setSelectedMeetingForMom(null);
                                        }}
                                        className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer border-0 bg-transparent"
                                    >
                                        <FiX size={16} />
                                    </button>
                                </div>

                                <form onSubmit={handleSaveMom} className="p-6 space-y-4">
                                    <div>
                                        <InputLabel>MOM Notes / Discussion Summary</InputLabel>
                                        <textarea
                                            rows={6}
                                            placeholder="Ex: Discussed timeline milestones. Client signed off on checkout page layouts but requested adding Stripe invoice automation."
                                            value={momText}
                                            onChange={(e) => setMomText(e.target.value)}
                                            className="w-full bg-white border border-slate-200 focus:border-indigo-500 text-slate-800 text-xs p-3.5 rounded-xl outline-none transition font-sans resize-none"
                                            required
                                        />
                                    </div>

                                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsMomModalOpen(false);
                                                setSelectedMeetingForMom(null);
                                            }}
                                            className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer"
                                        >
                                            Close
                                        </button>
                                        <button
                                            type="submit"
                                            className="h-10 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/10 transition cursor-pointer border-0"
                                        >
                                            Save Minutes
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* View Lead Details Modal */}
                    {selectedLeadForDetails && (
                        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
                                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-800 font-display">Client Pipeline Card</h3>
                                        <p className="text-[10px] text-slate-400 font-sans mt-0.5">Enquiry record and project details.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedLeadForDetails(null)}
                                        className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer border-0 bg-transparent"
                                    >
                                        <FiX size={16} />
                                    </button>
                                </div>

                                <div className="p-6 space-y-4 font-sans text-xs">
                                    <div className="pb-3 border-b border-slate-100">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Company / Lead Name</span>
                                        <h4 className="text-base font-extrabold text-slate-850 font-display mt-0.5">{selectedLeadForDetails.name}</h4>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Primary Contact</span>
                                            <span className="font-semibold text-slate-700 block mt-1">{selectedLeadForDetails.contact || "N/A"}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Estimated Value</span>
                                            <span className="font-bold text-indigo-600 block mt-1">${(selectedLeadForDetails.value || 0).toLocaleString()}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Email Address</span>
                                            <span className="text-slate-600 block mt-1 break-all">{selectedLeadForDetails.email}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pipeline Status</span>
                                            <span className="inline-block mt-1 font-bold text-indigo-500 bg-indigo-50/50 px-2 py-0.5 rounded border border-indigo-150 uppercase text-[9px] tracking-wider">
                                                {selectedLeadForDetails.status}
                                            </span>
                                        </div>
                                    </div>

                                    {selectedLeadForDetails.requirements && (
                                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-1">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Lead Specifications</span>
                                            <p className="text-slate-600 leading-relaxed text-[11px] font-medium">
                                                {selectedLeadForDetails.requirements}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div className="px-6 py-3.5 bg-slate-50/50 border-t border-slate-100 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedLeadForDetails(null)}
                                        className="h-9 px-5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer border-0"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : view === "converted" ? (
                /* Dedicated Converted Leads Page */
                <div className="space-y-6 animate-fade-in font-sans">
                    {/* Custom Header with Vertical Accent & Conversion Rate Card */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100/50">
                        <div className="flex items-start gap-4">
                            <div className="w-1.5 h-12 bg-indigo-600 rounded-full shrink-0"></div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-display">Converted</h1>
                                <p className="text-slate-500 text-xs mt-0.5 leading-relaxed font-sans">
                                    {getFilteredConvertedLeads().length} leads found • Successfully converted leads
                                </p>
                            </div>
                        </div>

                        {/* Conversion Rate Percentage Card */}
                        <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 flex items-center gap-3.5 shadow-sm max-w-sm transition hover:shadow-md duration-200 font-sans">
                            {/* SVG Mini Donut Chart */}
                            <div className="relative w-11 h-11 flex items-center justify-center shrink-0">
                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                    <circle cx="18" cy="18" r="16" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                                    <circle cx="18" cy="18" r="16" fill="none" stroke="#10b981" strokeWidth="3.2" strokeDasharray="78 100" />
                                </svg>
                                <span className="absolute text-[10px] font-extrabold text-slate-800">78%</span>
                            </div>
                            <div className="space-y-0.5">
                                <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Conversion Success</span>
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-xs font-extrabold text-slate-800">78%</span>
                                    <span className="text-[10px] text-slate-450 font-medium">of total client accounts converted</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Top Filter Section */}
                    <div className="flex flex-col gap-4">
                        {/* 1. Search Bar */}
                        <div className="relative w-full">
                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                <FiSearch size={15} />
                            </span>
                            <input
                                type="text"
                                placeholder="Search by client name, phone, project…"
                                value={convertedSearchQuery}
                                onChange={(e) => setConvertedSearchQuery(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 text-xs text-slate-800 placeholder:text-slate-350 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans h-11 shadow-sm"
                            />
                        </div>

                        {/* 2. Filter Controls Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {/* A. Sort Dropdown */}
                            <div className="relative">
                                <select
                                    value={convertedSortOption}
                                    onChange={(e) => setConvertedSortOption(e.target.value)}
                                    className="w-full h-11 appearance-none bg-white border border-slate-200 text-slate-705 text-xs font-semibold px-4 pr-9 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all cursor-pointer shadow-sm"
                                >
                                    <option value="newest">Sort by: Newest first</option>
                                    <option value="oldest">Sort by: Oldest first</option>
                                    <option value="alpha-asc">Sort by: Name (A-Z)</option>
                                    <option value="alpha-desc">Sort by: Name (Z-A)</option>
                                </select>
                                <FiChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                            </div>

                            {/* B. Project Type Dropdown */}
                            <div className="relative">
                                <select
                                    value={convertedProjectType}
                                    onChange={(e) => setConvertedProjectType(e.target.value)}
                                    className="w-full h-11 appearance-none bg-white border border-slate-200 text-slate-705 text-xs font-semibold px-4 pr-9 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all cursor-pointer shadow-sm"
                                >
                                    <option value="All Types">Project Type: All Types</option>
                                    <option value="Residential">Residential</option>
                                    <option value="Commercial">Commercial</option>
                                    <option value="Corporate">Corporate</option>
                                    <option value="Retail">Retail</option>
                                </select>
                                <FiChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                            </div>

                            {/* C. Date Range Picker / Presets */}
                            <div className="relative">
                                <select
                                    value={convertedDatePreset}
                                    onChange={(e) => setConvertedDatePreset(e.target.value)}
                                    className="w-full h-11 appearance-none bg-white border border-slate-200 text-slate-705 text-xs font-semibold px-4 pr-9 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all cursor-pointer shadow-sm"
                                >
                                    <option value="All Time">Date Range: All Time</option>
                                    <option value="7-days">Last 7 Days</option>
                                    <option value="30-days">Last 30 Days</option>
                                    <option value="90-days">Last 90 Days</option>
                                </select>
                                <FiChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                            </div>
                        </div>
                    </div>

                    {/* Leads List Section */}
                    <div className="space-y-3.5 mt-2">
                        {getFilteredConvertedLeads().length > 0 ? (
                            getFilteredConvertedLeads().map((lead) => {
                                // Dynamic initials calculations
                                const initials = lead.name.split(" ").map(n => n[0]).join("").toUpperCase();
                                
                                // Color helper for priority
                                const priorityColors = {
                                    High: "bg-rose-50 text-rose-700 border-rose-100/60",
                                    Medium: "bg-amber-50 text-amber-700 border-amber-100/60",
                                    Low: "bg-slate-50 text-slate-600 border-slate-200"
                                };

                                return (
                                    <div
                                        key={lead.id}
                                        onClick={() => showToast(`Opening details for ${lead.name}...`, "info")}
                                        className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group"
                                    >
                                        {/* LEFT SECTION */}
                                        <div className="flex items-center gap-4">
                                            {/* Circular Initials Avatar */}
                                            <div className="w-12 h-12 flex items-center justify-center rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-sm shrink-0">
                                                {initials}
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2.5 flex-wrap">
                                                    <span className="font-extrabold text-slate-800 text-sm font-display">{lead.name}</span>
                                                    <span className="text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                                        {lead.id}
                                                    </span>
                                                </div>
                                                <div className="text-[11px] text-slate-450 font-medium font-sans">
                                                    {lead.phone}
                                                </div>
                                            </div>
                                        </div>

                                        {/* CENTER SECTION */}
                                        <div className="flex flex-wrap items-center gap-2.5 md:justify-center">
                                            {/* Location Badge */}
                                            <span className="flex items-center gap-1.5 bg-slate-50 border border-slate-100/80 px-3 py-1 rounded-xl text-slate-600 text-xs font-semibold font-sans">
                                                <FiMapPin size={11} className="text-slate-400" />
                                                {lead.location}
                                            </span>

                                            {/* Project Type Badge */}
                                            <span className="flex items-center gap-1.5 bg-indigo-50/40 border border-indigo-100/40 px-3 py-1 rounded-xl text-indigo-700 text-xs font-semibold font-sans">
                                                <FiLayers size={11} className="text-indigo-400" />
                                                {lead.projectType}
                                            </span>
                                        </div>

                                        {/* RIGHT SECTION */}
                                        <div className="flex items-center justify-between md:justify-end gap-3.5 flex-wrap md:flex-nowrap border-t border-slate-100 md:border-t-0 pt-3.5 md:pt-0">
                                            <span className="text-[11px] text-slate-400 font-semibold font-sans">
                                                {new Date(lead.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                            </span>
                                            
                                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-100/60 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase font-sans">
                                                CONVERTED
                                            </span>

                                            <span className={`px-2.5 py-1 rounded-xl border text-[10px] font-bold tracking-wider uppercase font-sans ${priorityColors[lead.priority]}`}>
                                                {lead.priority}
                                            </span>

                                            <FiChevronRight size={16} className="text-slate-350 group-hover:text-indigo-600 transition-colors hidden md:block" />
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-2.5 shadow-sm font-sans">
                                <FiAlertCircle size={28} className="text-slate-350 animate-pulse" />
                                <span className="text-sm font-semibold text-slate-800">No converted leads found</span>
                                <span className="text-xs text-slate-400">There are no leads in this category matching your search.</span>
                            </div>
                        )}
                    </div>
                </div>
            ) : view === "lost" ? (
                /* Dedicated Lost Leads Page */
                <div className="space-y-6 animate-fade-in font-sans">
                    {/* Custom Header with Vertical Accent & Lost Ratio Card */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100/50">
                        <div className="flex items-start gap-4">
                            <div className="w-1.5 h-12 bg-slate-500 rounded-full shrink-0"></div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-display">Lost</h1>
                                <p className="text-slate-500 text-xs mt-0.5 leading-relaxed font-sans">
                                    {getFilteredLostLeads().length} leads lost • Successfully archived lost opportunities
                                </p>
                            </div>
                        </div>

                        {/* Lost Ratio Percentage Card */}
                        <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 flex items-center gap-3.5 shadow-sm max-w-sm transition hover:shadow-md duration-200 font-sans">
                            {/* SVG Mini Donut Chart */}
                            <div className="relative w-11 h-11 flex items-center justify-center shrink-0">
                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                    <circle cx="18" cy="18" r="16" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                                    <circle cx="18" cy="18" r="16" fill="none" stroke="#f43f5e" strokeWidth="3.2" strokeDasharray="22 100" />
                                </svg>
                                <span className="absolute text-[10px] font-extrabold text-slate-800">22%</span>
                            </div>
                            <div className="space-y-0.5">
                                <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Lost Ratio</span>
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-xs font-extrabold text-slate-800">22%</span>
                                    <span className="text-[10px] text-slate-450 font-medium">of total opportunities archived</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Top Filter Section */}
                    <div className="flex flex-col gap-4">
                        {/* 1. Search Bar */}
                        <div className="relative w-full">
                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                <FiSearch size={15} />
                            </span>
                            <input
                                type="text"
                                placeholder="Search by client name, phone, project…"
                                value={lostSearchQuery}
                                onChange={(e) => setLostSearchQuery(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 text-xs text-slate-800 placeholder:text-slate-350 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans h-11 shadow-sm"
                            />
                        </div>

                        {/* 2. Filter Controls Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {/* A. Sort Dropdown */}
                            <div className="relative">
                                <select
                                    value={lostSortOption}
                                    onChange={(e) => setLostSortOption(e.target.value)}
                                    className="w-full h-11 appearance-none bg-white border border-slate-200 text-slate-705 text-xs font-semibold px-4 pr-9 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all cursor-pointer shadow-sm"
                                >
                                    <option value="newest">Sort by: Newest first</option>
                                    <option value="oldest">Sort by: Oldest first</option>
                                    <option value="alpha-asc">Sort by: Name (A-Z)</option>
                                    <option value="alpha-desc">Sort by: Name (Z-A)</option>
                                </select>
                                <FiChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                            </div>

                            {/* B. Project Type Dropdown */}
                            <div className="relative">
                                <select
                                    value={lostProjectType}
                                    onChange={(e) => setLostProjectType(e.target.value)}
                                    className="w-full h-11 appearance-none bg-white border border-slate-200 text-slate-705 text-xs font-semibold px-4 pr-9 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all cursor-pointer shadow-sm"
                                >
                                    <option value="All Types">Project Type: All Types</option>
                                    <option value="Residential">Residential</option>
                                    <option value="Commercial">Commercial</option>
                                    <option value="Corporate">Corporate</option>
                                    <option value="Retail">Retail</option>
                                </select>
                                <FiChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                            </div>

                            {/* C. Date Range Picker / Presets */}
                            <div className="relative">
                                <select
                                    value={lostDatePreset}
                                    onChange={(e) => setLostDatePreset(e.target.value)}
                                    className="w-full h-11 appearance-none bg-white border border-slate-200 text-slate-705 text-xs font-semibold px-4 pr-9 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all cursor-pointer shadow-sm"
                                >
                                    <option value="All Time">Date Range: All Time</option>
                                    <option value="7-days">Last 7 Days</option>
                                    <option value="30-days">Last 30 Days</option>
                                    <option value="90-days">Last 90 Days</option>
                                </select>
                                <FiChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                            </div>
                        </div>
                    </div>

                    {/* Leads List Section */}
                    <div className="space-y-3.5 mt-2">
                        {getFilteredLostLeads().length > 0 ? (
                            getFilteredLostLeads().map((lead) => {
                                // Dynamic initials calculations
                                const initials = lead.name.split(" ").map(n => n[0]).join("").toUpperCase();
                                
                                // Color helper for priority
                                const priorityColors = {
                                    High: "bg-rose-50 text-rose-700 border-rose-100/60",
                                    Medium: "bg-amber-50 text-amber-700 border-amber-100/60",
                                    Low: "bg-slate-50 text-slate-600 border-slate-200"
                                };

                                return (
                                    <div
                                        key={lead.id}
                                        onClick={() => showToast(`Opening details for ${lead.name}...`, "info")}
                                        className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group"
                                    >
                                        {/* LEFT SECTION */}
                                        <div className="flex items-center gap-4">
                                            {/* Circular Initials Avatar */}
                                            <div className="w-12 h-12 flex items-center justify-center rounded-full bg-slate-100 border border-slate-200 text-slate-705 font-bold text-sm shrink-0">
                                                {initials}
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2.5 flex-wrap">
                                                    <span className="font-extrabold text-slate-800 text-sm font-display">{lead.name}</span>
                                                    <span className="text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                                        {lead.id}
                                                    </span>
                                                </div>
                                                <div className="text-[11px] text-slate-450 font-medium font-sans">
                                                    {lead.phone}
                                                </div>
                                            </div>
                                        </div>

                                        {/* CENTER SECTION */}
                                        <div className="flex flex-wrap items-center gap-2.5 md:justify-center">
                                            {/* Location Badge */}
                                            <span className="flex items-center gap-1.5 bg-slate-50 border border-slate-100/80 px-3 py-1 rounded-xl text-slate-600 text-xs font-semibold font-sans">
                                                <FiMapPin size={11} className="text-slate-400" />
                                                {lead.location}
                                            </span>

                                            {/* Project Type Badge */}
                                            <span className="flex items-center gap-1.5 bg-indigo-50/40 border border-indigo-100/40 px-3 py-1 rounded-xl text-indigo-700 text-xs font-semibold font-sans">
                                                <FiLayers size={11} className="text-indigo-400" />
                                                {lead.projectType}
                                            </span>
                                        </div>

                                        {/* RIGHT SECTION */}
                                        <div className="flex items-center justify-between md:justify-end gap-3.5 flex-wrap md:flex-nowrap border-t border-slate-100 md:border-t-0 pt-3.5 md:pt-0">
                                            <span className="text-[11px] text-slate-400 font-semibold font-sans">
                                                {new Date(lead.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                            </span>
                                            
                                            <span className="bg-rose-50 text-rose-700 border border-rose-100/60 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase font-sans">
                                                LOST
                                            </span>

                                            <span className={`px-2.5 py-1 rounded-xl border text-[10px] font-bold tracking-wider uppercase font-sans ${priorityColors[lead.priority]}`}>
                                                {lead.priority}
                                            </span>

                                            <FiChevronRight size={16} className="text-slate-350 group-hover:text-indigo-650 transition-colors hidden md:block" />
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-2.5 shadow-sm font-sans">
                                <FiAlertCircle size={28} className="text-slate-350 animate-pulse" />
                                <span className="text-sm font-semibold text-slate-800">No lost leads found</span>
                                <span className="text-xs text-slate-400">There are no leads in this category matching your search.</span>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* Dedicated All Leads Registry View */
                <div className="space-y-6 animate-fade-in font-sans">
                    {/* Header Block with Actions */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 pb-4 border-b border-slate-100/50">
                        <div className="flex items-start gap-4">
                            {/* Registry Icon Box */}
                            <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-indigo-50 border border-indigo-100/50 text-indigo-650 shrink-0">
                                <FiSliders size={20} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-display">ALL LEADS</h1>
                                <p className="text-slate-500 text-xs mt-0.5 leading-relaxed font-sans">
                                    Complete client registry across all pipeline stages.
                                </p>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <button
                                onClick={() => {
                                    showToast("Refreshed leads registry successfully.", "success");
                                    setLeadsPage(1);
                                }}
                                className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl shadow-sm transition duration-200 cursor-pointer border-0"
                                title="Refresh Registry"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.28 15H18" />
                                </svg>
                            </button>

                            <button
                                onClick={() => showToast("Export / Import feature is not configured in this demo.", "info")}
                                className="h-10 px-4 flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl shadow-sm transition duration-200 cursor-pointer border-0"
                            >
                                <svg className="w-4 h-4 text-slate-450" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                                <span>Import</span>
                            </button>

                            <Link
                                to="/crm/create-lead"
                                className="h-10 px-4 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/10 transition duration-200 border-0 no-underline cursor-pointer flex items-center justify-center decoration-0"
                            >
                                <FiPlus size={15} />
                                <span>New Enquiry</span>
                            </Link>
                        </div>
                    </div>

                    {/* Search & Filters */}
                    <div className="space-y-4">
                        {/* 1. Large Search Bar */}
                        <div className="relative w-full">
                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                <FiSearch size={15} />
                            </span>
                            <input
                                type="text"
                                placeholder="Search by name, phone, email, city, tracking ID..."
                                value={leadsSearchQuery}
                                onChange={(e) => {
                                    setLeadsSearchQuery(e.target.value);
                                    setLeadsPage(1);
                                }}
                                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 text-xs text-slate-800 placeholder:text-slate-350 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-sans h-11 shadow-sm"
                            />
                        </div>

                        {/* 2. Responsive Filters Row */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                            {/* Sort */}
                            <div className="relative">
                                <select
                                    value={leadsSortOption}
                                    onChange={(e) => {
                                        setLeadsSortOption(e.target.value);
                                        setLeadsPage(1);
                                    }}
                                    className="w-full h-10 appearance-none bg-white border border-slate-200 text-slate-705 text-[11px] font-semibold px-3 pr-8 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all cursor-pointer shadow-sm"
                                >
                                    <option value="newest">Sort: Newest</option>
                                    <option value="oldest">Sort: Oldest</option>
                                    <option value="alpha-asc">Name (A-Z)</option>
                                    <option value="alpha-desc">Name (Z-A)</option>
                                </select>
                                <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
                            </div>

                            {/* Status */}
                            <div className="relative">
                                <select
                                    value={leadsStatusFilter}
                                    onChange={(e) => {
                                        setLeadsStatusFilter(e.target.value);
                                        setLeadsPage(1);
                                    }}
                                    className="w-full h-10 appearance-none bg-white border border-slate-200 text-slate-705 text-[11px] font-semibold px-3 pr-8 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all cursor-pointer shadow-sm"
                                >
                                    <option value="All Statuses">Status: All</option>
                                    <option value="Converted">Converted</option>
                                    <option value="Meeting Done">Meeting Done</option>
                                    <option value="Contacted">Contacted</option>
                                    <option value="Lost">Lost</option>
                                </select>
                                <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
                            </div>

                            {/* Project Type */}
                            <div className="relative">
                                <select
                                    value={leadsProjectTypeFilter}
                                    onChange={(e) => {
                                        setLeadsProjectTypeFilter(e.target.value);
                                        setLeadsPage(1);
                                    }}
                                    className="w-full h-10 appearance-none bg-white border border-slate-200 text-slate-705 text-[11px] font-semibold px-3 pr-8 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all cursor-pointer shadow-sm"
                                >
                                    <option value="All Types">Project: All</option>
                                    <option value="Residential">Residential</option>
                                    <option value="Commercial">Commercial</option>
                                    <option value="Corporate">Corporate</option>
                                    <option value="Retail">Retail</option>
                                </select>
                                <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
                            </div>

                            {/* Lifecycle Stage */}
                            <div className="relative">
                                <select
                                    value={leadsLifecycleStageFilter}
                                    onChange={(e) => {
                                        setLeadsLifecycleStageFilter(e.target.value);
                                        setLeadsPage(1);
                                    }}
                                    className="w-full h-10 appearance-none bg-white border border-slate-200 text-slate-705 text-[11px] font-semibold px-3 pr-8 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all cursor-pointer shadow-sm"
                                >
                                    <option value="All Stages">Stage: All</option>
                                    <option value="Project Started">Project Started</option>
                                    <option value="Follow-up Due">Follow-up Due</option>
                                    <option value="Interested">Interested</option>
                                    <option value="Discovery">Discovery</option>
                                    <option value="Proposal Sent">Proposal Sent</option>
                                    <option value="Negotiation">Negotiation</option>
                                    <option value="Enquiry">Enquiry</option>
                                    <option value="Archived">Archived</option>
                                </select>
                                <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
                            </div>

                            {/* Source */}
                            <div className="relative">
                                <select
                                    value={leadsSourceFilter}
                                    onChange={(e) => {
                                        setLeadsSourceFilter(e.target.value);
                                        setLeadsPage(1);
                                    }}
                                    className="w-full h-10 appearance-none bg-white border border-slate-200 text-slate-705 text-[11px] font-semibold px-3 pr-8 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all cursor-pointer shadow-sm"
                                >
                                    <option value="All Sources">Source: All</option>
                                    <option value="Referral">Referral</option>
                                    <option value="Website">Website</option>
                                    <option value="Walk-In">Walk-In</option>
                                    <option value="Cold Call">Cold Call</option>
                                    <option value="Instagram">Instagram</option>
                                    <option value="Google Search">Google Search</option>
                                    <option value="Facebook Ad">Facebook Ad</option>
                                </select>
                                <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
                            </div>

                            {/* Priority */}
                            <div className="relative">
                                <select
                                    value={leadsPriorityFilter}
                                    onChange={(e) => {
                                        setLeadsPriorityFilter(e.target.value);
                                        setLeadsPage(1);
                                    }}
                                    className="w-full h-10 appearance-none bg-white border border-slate-200 text-slate-705 text-[11px] font-semibold px-3 pr-8 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all cursor-pointer shadow-sm"
                                >
                                    <option value="All Priorities">Priority: All</option>
                                    <option value="High">High</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Low">Low</option>
                                </select>
                                <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
                            </div>

                            {/* Date range */}
                            <div className="relative">
                                <select
                                    value={leadsDatePresetFilter}
                                    onChange={(e) => {
                                        setLeadsDatePresetFilter(e.target.value);
                                        setLeadsPage(1);
                                    }}
                                    className="w-full h-10 appearance-none bg-white border border-slate-200 text-slate-705 text-[11px] font-semibold px-3 pr-8 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all cursor-pointer shadow-sm"
                                >
                                    <option value="All Time">Date: All Time</option>
                                    <option value="7-days">Last 7 Days</option>
                                    <option value="30-days">Last 30 Days</option>
                                    <option value="90-days">Last 90 Days</option>
                                </select>
                                <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
                            </div>
                        </div>
                    </div>

                    {/* Leads Table Card */}
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden font-sans">
                        {(() => {
                            const filteredList = getFilteredAllRegistryLeads();
                            const itemsPerPage = 10;
                            const totalPages = Math.ceil(filteredList.length / itemsPerPage) || 1;
                            const activePage = Math.min(leadsPage, totalPages);
                            const paginatedLeads = filteredList.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage);

                            return (
                                <>
                                    {paginatedLeads.length > 0 ? (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse text-xs">
                                                <thead>
                                                    <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-450 font-bold uppercase tracking-wider">
                                                        <th className="px-6 py-4">Client</th>
                                                        <th className="px-6 py-4">Contact</th>
                                                        <th className="px-6 py-4">Location</th>
                                                        <th className="px-6 py-4">Project</th>
                                                        <th className="px-6 py-4">Status</th>
                                                        <th className="px-6 py-4">Stage</th>
                                                        <th className="px-6 py-4">Added</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 text-slate-707 font-medium font-sans">
                                                    {paginatedLeads.map((lead) => {
                                                        const initials = lead.name.split(" ").map(n => n[0]).join("").toUpperCase();
                                                        
                                                        // Status styling helpers
                                                        const statusStyles = {
                                                            Converted: "bg-emerald-50 text-emerald-700 border-emerald-100/60",
                                                            "Meeting Done": "bg-amber-50 text-amber-700 border-amber-100/60",
                                                            Contacted: "bg-indigo-50 text-indigo-700 border-indigo-100/60",
                                                            Lost: "bg-rose-50 text-rose-700 border-rose-100/60"
                                                        };

                                                        return (
                                                            <tr key={lead.id} className="hover:bg-slate-50/40 transition-colors duration-150 cursor-pointer" onClick={() => setSelectedClient(lead)}>
                                                                {/* CLIENT COLUMN */}
                                                                <td className="px-6 py-4">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-9 h-9 flex items-center justify-center rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-xs shrink-0">
                                                                            {initials}
                                                                        </div>
                                                                        <div>
                                                                            <span className="font-bold text-slate-800 text-xs block">{lead.name}</span>
                                                                            <span className="text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1 py-0.5 rounded uppercase tracking-wider block w-max mt-0.5 font-sans">
                                                                                {lead.id}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </td>

                                                                {/* CONTACT COLUMN */}
                                                                <td className="px-6 py-4 space-y-0.5">
                                                                    <span className="font-bold text-slate-850 block">{lead.phone}</span>
                                                                    <span className="text-[10px] text-slate-400 font-medium block truncate max-w-[170px]">{lead.email}</span>
                                                                </td>

                                                                {/* LOCATION COLUMN */}
                                                                <td className="px-6 py-4 font-semibold text-slate-600">{lead.location}</td>

                                                                {/* PROJECT COLUMN */}
                                                                <td className="px-6 py-4 font-semibold text-slate-700">{lead.projectType}</td>

                                                                {/* STATUS COLUMN */}
                                                                <td className="px-6 py-4">
                                                                    <span className={`px-2.5 py-1 rounded-lg border text-[9px] font-bold tracking-wider uppercase ${statusStyles[lead.status]}`}>
                                                                        {lead.status}
                                                                    </span>
                                                                </td>

                                                                {/* STAGE COLUMN */}
                                                                <td className="px-6 py-4">
                                                                    <span className="font-semibold text-slate-505">{lead.stage}</span>
                                                                </td>

                                                                {/* ADDED COLUMN */}
                                                                <td className="px-6 py-4 font-semibold text-slate-450">
                                                                    {new Date(lead.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="py-16 text-center flex flex-col items-center justify-center gap-2.5 font-sans">
                                            <FiAlertCircle size={28} className="text-slate-350 animate-pulse" />
                                            <span className="text-sm font-semibold text-slate-800">No matching leads found</span>
                                            <span className="text-xs text-slate-400">There are no leads in the registry matching your filters or query.</span>
                                        </div>
                                    )}

                                    {/* Pagination Row */}
                                    {filteredList.length > 0 && (
                                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-500 text-xs font-semibold">
                                            <div>
                                                Showing {(activePage - 1) * itemsPerPage + 1} - {Math.min(activePage * itemsPerPage, filteredList.length)} of {filteredList.length} leads
                                            </div>

                                            <div className="flex items-center gap-1.5">
                                                {/* Prev Button */}
                                                <button
                                                    onClick={() => setLeadsPage(prev => Math.max(prev - 1, 1))}
                                                    disabled={activePage === 1}
                                                    className="h-8 px-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition duration-150 flex items-center justify-center cursor-pointer border-0"
                                                >
                                                    <FiChevronLeft size={14} />
                                                </button>

                                                {/* Page Number Buttons */}
                                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
                                                    <button
                                                        key={pageNumber}
                                                        onClick={() => setLeadsPage(pageNumber)}
                                                        className={`h-8 w-8 rounded-lg font-bold text-xs transition duration-150 flex items-center justify-center cursor-pointer border-0 ${
                                                            activePage === pageNumber
                                                                ? "bg-indigo-600 text-white shadow-sm"
                                                                : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-600"
                                                        }`}
                                                    >
                                                        {pageNumber}
                                                    </button>
                                                ))}

                                                {/* Next Button */}
                                                <button
                                                    onClick={() => setLeadsPage(prev => Math.min(prev + 1, totalPages))}
                                                    disabled={activePage === totalPages}
                                                    className="h-8 px-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition duration-150 flex items-center justify-center cursor-pointer border-0"
                                                >
                                                    <FiChevronRight size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* Client Details Side Panel */}
            {selectedClient && (
                <div className="fixed inset-0 z-50 flex justify-end font-sans">
                    {/* Backdrop */}
                    <div 
                        className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm transition-opacity animate-fade-in"
                        onClick={() => setSelectedClient(null)}
                    ></div>
                    
                    {/* Drawer */}
                    <div className="relative w-full max-w-md md:max-w-xl h-full bg-slate-50 shadow-2xl flex flex-col animate-fade-in overflow-hidden border-l border-slate-200">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-5 bg-white border-b border-slate-200 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-cyan-50 border border-cyan-100 text-cyan-600 font-bold text-lg shrink-0">
                                    {selectedClient.name.split(" ").map(n => n[0]).join("").toUpperCase()}
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800 font-display leading-tight">{selectedClient.name}</h2>
                                    <span className="text-xs font-semibold text-slate-400">{selectedClient.id}</span>
                                </div>
                            </div>
                            <button 
                                onClick={() => setSelectedClient(null)}
                                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer border-0 bg-transparent"
                            >
                                <FiX size={20} />
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-5">
                            
                            {/* 1. Basic Info */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 font-sans flex items-center gap-2">
                                    <FiUser className="text-cyan-500" /> Basic Information
                                </h3>
                                <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
                                    <div>
                                        <span className="block text-[10px] text-slate-400 font-semibold uppercase mb-0.5">Phone Number</span>
                                        <span className="font-semibold text-slate-700">{selectedClient.phone || "+1 555-0198"}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] text-slate-400 font-semibold uppercase mb-0.5">Email Address</span>
                                        <span className="font-semibold text-slate-700 block truncate pr-2">{selectedClient.email || "contact@client.com"}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] text-slate-400 font-semibold uppercase mb-0.5">Location</span>
                                        <span className="font-semibold text-slate-700">{selectedClient.location || "—"}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] text-slate-400 font-semibold uppercase mb-0.5">Industry / Sector</span>
                                        <span className="font-semibold text-slate-700">{selectedClient.industry || selectedClient.projectType || "Enterprise"}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="block text-[10px] text-slate-400 font-semibold uppercase mb-0.5">Client / Company</span>
                                        <span className="font-semibold text-slate-700">{selectedClient.name}</span>
                                    </div>
                                </div>
                            </div>

                            {/* 2. Lead Details */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 font-sans flex items-center gap-2">
                                    <FiLayers className="text-cyan-500" /> Lead Details
                                </h3>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="block text-[10px] text-slate-400 font-semibold uppercase mb-0.5">Project Type</span>
                                        <span className="font-semibold text-slate-700">{selectedClient.projectType || "Commercial"}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] text-slate-400 font-semibold uppercase mb-0.5">Budget Range</span>
                                        <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 text-xs">{selectedClient.budget || "$150,000 – $250,000"}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] text-slate-400 font-semibold uppercase mb-0.5">Lead Source</span>
                                        <span className="font-semibold text-slate-700">{selectedClient.source || "Google Search Ads"}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] text-slate-400 font-semibold uppercase mb-0.5">Priority Level</span>
                                        {(() => {
                                            const p = selectedClient.priority;
                                            const cls = p === "High" ? "text-rose-700 bg-rose-50 border-rose-100" : p === "Medium" ? "text-amber-700 bg-amber-50 border-amber-100" : "text-emerald-700 bg-emerald-50 border-emerald-100";
                                            return <span className={`font-bold px-2.5 py-0.5 rounded-md text-[10px] tracking-wider uppercase border ${cls}`}>{p || "Medium"}</span>;
                                        })()}
                                    </div>
                                    <div className="col-span-2">
                                        <span className="block text-[10px] text-slate-400 font-semibold uppercase mb-0.5">Assigned Employee</span>
                                        <span className="font-semibold text-slate-700">{selectedClient.assignedTo || "Sarah Jenkins"}</span>
                                    </div>
                                </div>
                            </div>

                            {/* 3. CRM Status */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 font-sans flex items-center gap-2">
                                    <FiActivity className="text-cyan-500" /> CRM Status
                                </h3>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="block text-[10px] text-slate-400 font-semibold uppercase mb-0.5">Current Status</span>
                                        <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md text-[10px] tracking-wider uppercase border border-indigo-100">{selectedClient.status || "Contacted"}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] text-slate-400 font-semibold uppercase mb-0.5">Pipeline Stage</span>
                                        <span className="font-semibold text-slate-700">{selectedClient.stage || "Discovery"}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] text-slate-400 font-semibold uppercase mb-0.5">Lead Source</span>
                                        <span className="font-semibold text-slate-700">{selectedClient.source || "Referral"}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] text-slate-400 font-semibold uppercase mb-0.5">Assigned To</span>
                                        <span className="font-semibold text-slate-700">{selectedClient.assignedTo || "Sarah Jenkins"}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] text-slate-400 font-semibold uppercase mb-0.5">Added Date</span>
                                        <span className="font-semibold text-slate-700">{selectedClient.date ? new Date(selectedClient.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] text-slate-400 font-semibold uppercase mb-0.5">Last Updated</span>
                                        <span className="font-semibold text-slate-700">Just now</span>
                                    </div>
                                </div>
                            </div>

                            {/* 4. Activity / Timeline */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 font-sans flex items-center gap-2">
                                    <FiClock className="text-cyan-500" /> Activity Timeline
                                </h3>
                                <div className="relative pl-3 space-y-5">
                                    <div className="absolute left-[11px] top-2 bottom-2 w-[2px] bg-slate-100"></div>
                                    <div className="relative flex gap-4">
                                        <div className="w-2.5 h-2.5 mt-1 rounded-full bg-cyan-500 ring-4 ring-white z-10 shrink-0"></div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-800">{selectedClient.stage || "Meeting Scheduled"}</p>
                                            <p className="text-[11px] text-slate-400 mt-0.5">Today at 10:30 AM — by {selectedClient.assignedTo || "Sarah Jenkins"}</p>
                                        </div>
                                    </div>
                                    <div className="relative flex gap-4">
                                        <div className="w-2.5 h-2.5 mt-1 rounded-full bg-indigo-400 ring-4 ring-white z-10 shrink-0"></div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-800">Proposal Shared</p>
                                            <p className="text-[11px] text-slate-400 mt-0.5">2 days ago — Sent via email to {selectedClient.email || "client@company.com"}</p>
                                        </div>
                                    </div>
                                    <div className="relative flex gap-4">
                                        <div className="w-2.5 h-2.5 mt-1 rounded-full bg-amber-400 ring-4 ring-white z-10 shrink-0"></div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-800">Status changed to {selectedClient.status || "Contacted"}</p>
                                            <p className="text-[11px] text-slate-400 mt-0.5">Yesterday at 4:15 PM by {selectedClient.assignedTo || "Sarah Jenkins"}</p>
                                        </div>
                                    </div>
                                    <div className="relative flex gap-4">
                                        <div className="w-2.5 h-2.5 mt-1 rounded-full bg-slate-300 ring-4 ring-white z-10 shrink-0"></div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-800">Follow-up Added</p>
                                            <p className="text-[11px] text-slate-400 mt-0.5">3 days ago — Reminder set for upcoming review</p>
                                        </div>
                                    </div>
                                    <div className="relative flex gap-4">
                                        <div className="w-2.5 h-2.5 mt-1 rounded-full bg-slate-200 ring-4 ring-white z-10 shrink-0"></div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-800">Enquiry Created</p>
                                            <p className="text-[11px] text-slate-400 mt-0.5">{selectedClient.date ? new Date(selectedClient.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"} at 9:00 AM via {selectedClient.source || "Referral"}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 5. Internal Notes */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 font-sans flex items-center gap-2">
                                    <FiFileText className="text-cyan-500" /> Internal Notes
                                </h3>
                                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 text-[13px] text-slate-600 leading-relaxed font-sans shadow-sm">
                                    <span className="font-bold text-slate-800 block mb-1">Sales Remarks ({selectedClient.assignedTo || "Sarah Jenkins"}):</span>
                                    {selectedClient.notes || "Client is highly interested in finalizing the commercial layout. Budget is confirmed and aligns with our enterprise tier. Key stakeholders need a demo by next Thursday. Mentioned timeframe as their #1 priority for this quarter. Follow up actively."}
                                </div>
                            </div>

                            {/* 6. Follow Up */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                                <div>
                                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-sans flex items-center gap-1.5">
                                        <FiCalendar className="text-cyan-500" /> Next Follow-up Date
                                    </h3>
                                    <p className="text-[15px] font-bold text-slate-800">Thursday, July 5th at 2:00 PM</p>
                                </div>
                                <div className="px-3 py-1.5 bg-amber-50 text-amber-600 text-xs font-bold rounded-lg border border-amber-100 shadow-sm">
                                    Reminder Active
                                </div>
                            </div>

                        </div>
                        
                        {/* Footer Actions */}
                        <div className="p-5 border-t border-slate-200 bg-white grid grid-cols-2 gap-3 shrink-0">
                            <button className="h-11 flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition cursor-pointer text-sm shadow-sm">
                                <FiMail /> Email Client
                            </button>
                            <button className="h-11 flex items-center justify-center gap-2 bg-cyan-600 border border-cyan-600 text-white font-semibold rounded-xl hover:bg-cyan-700 shadow-md shadow-cyan-600/20 transition cursor-pointer text-sm">
                                Edit Profile
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
