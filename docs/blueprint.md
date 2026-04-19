# **App Name**: DebtorScan AI

## Core Features:

- Document OCR & Data Extraction: Enable users to upload PDF (scanned or digital) financial documents. The system will utilize an advanced OCR engine to automatically detect tables and extract specific data points like client code, invoice details, amounts, and aging days, mapping them to a structured format.
- Data Cleaning & Validation: Automatically correct common OCR errors (e.g., in numbers, dates), standardize data formats (e.g., currency, decimals), and validate data consistency (e.g., verifying 'balance = amount - paid').
- Secured Data Storage: Securely store all extracted and processed client and invoice data in a PostgreSQL or MongoDB database for historical tracking, analysis, and efficient retrieval.
- Debt Classification & Key Indicators: Automatically classify outstanding debts based on aging (e.g., 0-30 days 'sain', >365 days 'critique') and calculate key performance indicators such as total debt, total per client, top risky clients, and recovery rate.
- Interactive Analytics Dashboard: Provide a clear and interactive dashboard displaying analyzed data through visual charts (e.g., debt aging graphs) and sortable client lists, incorporating visual alerts and filtering options (by client, date, risk level).
- Smart Alert & Recommendation Tool: Generate automatic notifications for critical debt situations (e.g., overdue invoices, exceeding client thresholds) and provide intelligent, tool-based suggestions for next recovery actions (e.g., send reminder, legal action).
- Export & Reporting: Allow users to export processed data and analytical reports into common formats such as Excel or PDF, facilitating external sharing and further analysis.

## Style Guidelines:

- Primary color: A deep, professional blue (#333399) to evoke trust and competence in financial data management and analysis.
- Background color: A very light, desaturated blue-purple (#F0F0FC) to ensure excellent readability and a clean, spacious feel for data-rich dashboards.
- Accent color: A vibrant cyan-blue (#1499EB) to highlight interactive elements, calls to action, and important notifications, ensuring visibility and user engagement.
- Status colors: Implement a clear scheme of green, yellow, orange, and red to visually categorize debt aging statuses (0-30 days 'sain', 31-90 days 'à surveiller', 91-365 days 'en retard', >365 days 'critique').
- Headline and body font: 'Inter' (sans-serif) will be used for its modern, neutral, and highly readable qualities, ideal for displaying financial data and analytical insights consistently.
- Utilize a consistent set of clean, vector-based icons that visually represent financial concepts, data management, reporting, and alerts (e.g., document upload, charts, currency symbols, warning signs).
- Employ a structured, grid-based layout with generous whitespace to ensure data clarity and easy navigation. Key metrics should be prominently displayed on the dashboard, supporting progressive disclosure of detailed information.
- Incorporate subtle, functional animations for data loading, filtering, and chart transitions to enhance user experience without distracting from critical financial analysis.