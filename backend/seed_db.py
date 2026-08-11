import os
import re
import urllib.parse
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

MONGO_URL = os.getenv("MONGO_URL") or os.getenv("DATABASE_URL")
if not MONGO_URL:
    raise ValueError("MongoDB database connection URL is not set in environment variables.")

def sanitize_mongo_url(url: str) -> str:
    pattern = r'^(mongodb(?:\+srv)?://)(.*)@([^/]+.*)$'
    match = re.match(pattern, url)
    if match:
        scheme, userinfo, rest = match.groups()
        if ':' in userinfo:
            user, password = userinfo.split(':', 1)
            user = urllib.parse.unquote(user)
            password = urllib.parse.unquote(password)
            quoted_user = urllib.parse.quote_plus(user)
            quoted_password = urllib.parse.quote_plus(password)
            return f"{scheme}{quoted_user}:{quoted_password}@{rest}"
    return url

MONGO_URL = sanitize_mongo_url(MONGO_URL)
client = MongoClient(MONGO_URL)
db = client["delegation_system"]

# Collections
employee_col = db["employees"]
project_col = db["projects"]
task_col = db["tasks"]

def seed_database():
    print("Clearing existing collections...")
    employee_col.delete_many({})
    project_col.delete_many({})
    task_col.delete_many({})

    # 1. Define Realistic Projects
    projects = [
        {
            "name": "Ecommerce Platform",
            "description": "High-performance online storefront with integrated payment gateway and inventory system.",
            "deadline": "2026-08-15",
            "progress": 45,
            "status": "In Progress"
        },
        {
            "name": "HR Management System",
            "description": "Enterprise portal for payroll tracking, leave approval, and resource allocation workflows.",
            "deadline": "2026-09-30",
            "progress": 15,
            "status": "In Progress"
        },
        {
            "name": "CRM Dashboard",
            "description": "Client relation metrics aggregator with real-time leads visualizers.",
            "deadline": "2026-06-20",
            "progress": 100,
            "status": "Completed"
        },
        {
            "name": "AI Analytics Tool",
            "description": "Predictive parsing tool leveraging historical delegation records to forecast project delays.",
            "deadline": "2026-11-10",
            "progress": 5,
            "status": "Pending"
        },
        {
            "name": "Task Delegation System",
            "description": "Kanban workspace for resource tracking and internal ticketing workflow management.",
            "deadline": "2026-07-30",
            "progress": 65,
            "status": "In Progress"
        },
        {
            "name": "Employee Tracking Platform",
            "description": "Real-time metrics visualizer showing team active workloads and attendance logs.",
            "deadline": "2026-10-15",
            "progress": 0,
            "status": "Pending"
        }
    ]

    print("Inserting projects...")
    project_col.insert_many(projects)

    # 2. Define Realistic Employees with Roles and Emails
    employees = [
        # Ecommerce Platform Allocations
        {"name": "Aman Verma", "role": "Frontend Engineer", "project": "Ecommerce Platform", "status": "Active", "email": "aman.verma@gmail.com"},
        {"name": "Sanjay Kumar", "role": "Frontend Engineer", "project": "Ecommerce Platform", "status": "Active", "email": "sanjay.kumar@gmail.com"},
        {"name": "Nisha Patel", "role": "Frontend Engineer", "project": "Ecommerce Platform", "status": "Active", "email": "nisha.patel@gmail.com"},
        {"name": "Rohan Sharma", "role": "Backend Engineer", "project": "Ecommerce Platform", "status": "Active", "email": "rohan.sharma@gmail.com"},
        {"name": "Meera Joshi", "role": "QA Tester", "project": "Ecommerce Platform", "status": "Active", "email": "meera.joshi@gmail.com"},
        
        # CRM Dashboard Allocations (Completed Project)
        {"name": "Vikram Singh", "role": "Backend Engineer", "project": "CRM Dashboard", "status": "Away", "email": "vikram.singh@gmail.com"},
        {"name": "Pooja Hegde", "role": "Backend Engineer", "project": "CRM Dashboard", "status": "Active", "email": "pooja.hegde@gmail.com"},
        {"name": "Ajay Rao", "role": "QA Tester", "project": "CRM Dashboard", "status": "Active", "email": "ajay.rao@gmail.com"},

        # HR Management Allocations
        {"name": "Priya Patel", "role": "Fullstack Developer", "project": "HR Management System", "status": "Active", "email": "priya.patel@gmail.com"},
        {"name": "Karan Malhotra", "role": "MERN Developer", "project": "HR Management System", "status": "On Leave", "email": "karan.malhotra@gmail.com"},
        
        # Cross Project / Management
        {"name": "Rajesh Mehta", "role": "Project Manager", "project": "Task Delegation System", "status": "Active", "email": "rajesh.mehta@gmail.com"},
        {"name": "Divya Teja", "role": "Process Coordinator", "project": "Task Delegation System", "status": "Active", "email": "divya.teja@gmail.com"},
        
        # AI Analytics & Platform Build
        {"name": "Ananya Roy", "role": "UI/UX Designer", "project": "AI Analytics Tool", "status": "Active", "email": "ananya.roy@gmail.com"},
        {"name": "Kabir Das", "role": "DevOps Engineer", "project": "AI Analytics Tool", "status": "Active", "email": "kabir.das@gmail.com"},
        {"name": "Arjun Nair", "role": "Fullstack Developer", "project": "Employee Tracking Platform", "status": "Active", "email": "arjun.nair@gmail.com"},
    ]

    print("Inserting employees...")
    employee_col.insert_many(employees)

    # 3. Define Realistic Tasks to show distribution
    tasks = [
        # Aman Verma (Frontend Engineer - Ecommerce Platform)
        {
            "title": "Delegation Assigned",
            "description": "Create a responsive checkout list grid using modern HSL colors and hover scales.",
            "employee": "Aman Verma",
            "project": "Ecommerce Platform",
            "priority": "High",
            "deadline": "2026-07-10",
            "status": "In Progress"
        },
        {
            "title": "Integrate Stripe Checkout API",
            "description": "Link frontend catalog page checkout button trigger to the payment service endpoint.",
            "employee": "Aman Verma",
            "project": "Ecommerce Platform",
            "priority": "High",
            "deadline": "2026-07-20",
            "status": "Pending"
        },
        {
            "title": "Resolve Mobile Hamburger Layout Bug",
            "description": "Fix alignment on mobile hamburger navigation drawers showing double borders.",
            "employee": "Aman Verma",
            "project": "Ecommerce Platform",
            "priority": "Low",
            "deadline": "2026-06-30",
            "status": "Completed"
        },

        # Sanjay Kumar (Frontend Engineer - Ecommerce Platform)
        {
            "title": "Add Dark Mode Theme Switcher",
            "description": "Implement light/dark theme CSS token bindings inside tailwind index.css.",
            "employee": "Sanjay Kumar",
            "project": "Ecommerce Platform",
            "priority": "Low",
            "deadline": "2026-07-25",
            "status": "In Progress"
        },
        {
            "title": "Build Product Review Card Components",
            "description": "Design reusable rating review badges for product landing pages.",
            "employee": "Sanjay Kumar",
            "project": "Ecommerce Platform",
            "priority": "Medium",
            "deadline": "2026-07-05",
            "status": "Completed"
        },

        # Rohan Sharma (Backend Engineer - Ecommerce Platform)
        {
            "title": "Build Mongo Authentication Middleware",
            "description": "Write JWT session verification routes and security headers inside the server logic.",
            "employee": "Rohan Sharma",
            "project": "Ecommerce Platform",
            "priority": "High",
            "deadline": "2026-07-02",
            "status": "In Progress"
        },
        {
            "title": "Design Database Schema for Orders",
            "description": "Define MongoDB schemas for order transactions containing pricing and billing address records.",
            "employee": "Rohan Sharma",
            "project": "Ecommerce Platform",
            "priority": "High",
            "deadline": "2026-06-20",
            "status": "Completed"
        },

        # Meera Joshi (QA Tester - Ecommerce Platform)
        {
            "title": "Perform E2E Integration Testing on Cart",
            "description": "Write automated Selenium script logs testing item addition, quantity updates, and checkout.",
            "employee": "Meera Joshi",
            "project": "Ecommerce Platform",
            "priority": "Medium",
            "deadline": "2026-07-28",
            "status": "Pending"
        },

        # Priya Patel (Fullstack - HR Management System)
        {
            "title": "Develop Payroll Calculator Form UI",
            "description": "Build dynamic tax calculations input grids and payslip generation scripts.",
            "employee": "Priya Patel",
            "project": "HR Management System",
            "priority": "High",
            "deadline": "2026-07-10",
            "status": "In Progress"
        },
        {
            "title": "Migrate Attendance Table records",
            "description": "Write database aggregation pipelines summarizing employee leaves by department indexes.",
            "employee": "Priya Patel",
            "project": "HR Management System",
            "priority": "Medium",
            "deadline": "2026-07-18",
            "status": "Completed"
        },

        # Vikram Singh (Backend - CRM Dashboard)
        {
            "title": "Deploy CRM Lead Generation Webhooks",
            "description": "Set up webhook receivers processing external customer subscription logs in real-time.",
            "employee": "Vikram Singh",
            "project": "CRM Dashboard",
            "priority": "High",
            "deadline": "2026-06-15",
            "status": "Completed"
        },

        # Pooja Hegde (Backend - CRM Dashboard)
        {
            "title": "Optimize MongoDB CRM Aggregations",
            "description": "Index search columns to reduce aggregation latency under high concurrent load checks.",
            "employee": "Pooja Hegde",
            "project": "CRM Dashboard",
            "priority": "Medium",
            "deadline": "2026-06-18",
            "status": "Completed"
        },

        # Rajesh Mehta (Project Manager - Task Delegation System)
        {
            "title": "Define Sprint Milestones & SLA Targets",
            "description": "Organize JIRA boards, timeline sprints, and priority lists for task delegation phases.",
            "employee": "Rajesh Mehta",
            "project": "Task Delegation System",
            "priority": "High",
            "deadline": "2026-07-05",
            "status": "In Progress"
        },
        {
            "title": "Perform Risk Analysis Audit",
            "description": "Verify team workload balance ratios to ensure task count targets fit timeline capacities.",
            "employee": "Rajesh Mehta",
            "project": "Task Delegation System",
            "priority": "Medium",
            "deadline": "2026-07-15",
            "status": "Pending"
        },
        {
            "title": "Conduct Client Kick-off Review",
            "description": "Present prototype wireframes to stakeholders for feedback sign-off.",
            "employee": "Rajesh Mehta",
            "project": "Task Delegation System",
            "priority": "Low",
            "deadline": "2026-06-22",
            "status": "Completed"
        },

        # Ananya Roy (UI/UX - AI Analytics Tool)
        {
            "title": "Design Analytics Dashboard Wireframes",
            "description": "Draw Figma wireframes detailing allocation pie charts and distribution metrics widgets.",
            "employee": "Ananya Roy",
            "project": "AI Analytics Tool",
            "priority": "High",
            "deadline": "2026-07-08",
            "status": "In Progress"
        },
        {
            "title": "Define Design System UI Guidelines",
            "description": "Select brand display typography, color palette, and layout border systems.",
            "employee": "Ananya Roy",
            "project": "AI Analytics Tool",
            "priority": "Medium",
            "deadline": "2026-06-28",
            "status": "Completed"
        },

        # Kabir Das (DevOps - AI Analytics Tool)
        {
            "title": "Set up CI/CD Pipeline via GitHub Actions",
            "description": "Configure build tests and automated staging deployments to verify server builds.",
            "employee": "Kabir Das",
            "project": "AI Analytics Tool",
            "priority": "High",
            "deadline": "2026-07-12",
            "status": "Pending"
        }
    ]

    print("Inserting tasks...")
    task_col.insert_many(tasks)
    print("Database seeding completed successfully!")

if __name__ == "__main__":
    seed_database()
