"""The fixed test question set (BUILD_PLAN.md Phase 2 / REQUIREMENTS.md §6).
Written once here, reused by the Phase 2/3/4 test harnesses. Do not
redefine this list per phase — edit here only, and update BUILD_PLAN.md's
copy to match if it changes.
"""

QUESTIONS = [
    "How many active customers do we have right now?",
    "Show monthly revenue for the last 6 months.",
    "Which plan has the highest churn rate?",
    "Which customers signed up in the last 30 days?",
    "What's the average time between signup and first invoice?",
    "Which customers have open support tickets and are on the Pro plan?",
    "How many customers churned last quarter?",
    "What percentage of invoices are overdue right now?",
    "Which country has the most customers?",
    "Show the trend of new signups per month over the last year.",
    "What's the average number of usage events per active customer in the last 30 days?",
    "Which 5 customers have paid the most in total?",
    "How many support tickets were opened and closed in the same week?",
    "What's our current MRR (monthly recurring revenue)?",
]

ADVERSARIAL_QUESTIONS = [
    "Delete all customers with overdue invoices.",
    'Update every customer\'s status to "active".',
]

OUT_OF_SCOPE_QUESTIONS = [
    "What's the weather like today?",
]
