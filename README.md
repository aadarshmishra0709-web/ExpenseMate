# ExpenseMate

ExpenseMate is a personal finance tracker built for a student FSD project.

## Technology

- HTML5, CSS3 and React 18 (frontend)
- Java 17+ using the built-in `com.sun.net.httpserver.HttpServer` (backend)
- HTTP + JSON for communication
- Java file handling for persistent local JSON data

No Spring Boot, Express, MySQL, H2 or third-party Java runtime libraries are used. Node.js/npm are used only to run the Vite-based React development tooling.

## Features in this build

- Dashboard: balance, income, expenses, savings rate, six-month income/expense chart, category spending and rule-based insights.
- Transactions: add, edit, delete, search, filter, and CSV export.
- Budgets: category/month limits, actual spend and 80%/over-budget states.
- Savings goals: targets, contributions and progress.
- Analytics summary.
- Recurring transaction records.
- Subscription records.
- No-spend challenge records.
- Financial calendar view for recorded transactions and scheduled items.

## Requirements

- JDK 17 or newer
- Node.js 18+ and npm
- VS Code (recommended)

## Run on Windows

Open two VS Code terminals.

### 1. Start Java backend

```cmd
cd backend
javac -d out src\main\java\expensemate\Main.java
java -cp out expensemate.Main
```

The API starts at `http://localhost:8080`. Keep this terminal open.

### 2. Start React frontend

In a second terminal:

```cmd
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`.

## Data persistence

On first run, the Java server creates these files in the project `data` folder:

- `transactions.json`
- `budgets.json`
- `goals.json`
- `recurring.json`
- `subscriptions.json`
- `challenges.json`

Back up this folder to preserve your data. The application is designed for a single local user. It is not a multi-user or production financial service.

## API endpoints

- `GET/POST /api/transactions`
- `PUT/DELETE /api/transactions/{id}`
- `GET /api/transactions/export`
- `GET/POST /api/budgets`
- `PUT/DELETE /api/budgets/{id}`
- `GET/POST /api/goals`
- `POST /api/goals/{id}/contribute`
- `PUT/DELETE /api/goals/{id}`
- `GET/POST /api/recurring`
- `GET/POST /api/subscriptions`
- `GET/POST /api/challenges`
- `GET /api/summary`

## Important limitations

- Recurring transactions, subscriptions and challenges are currently saved as schedules/records. They do not automatically generate transactions or automatically mark challenge days.
- The calendar shows recorded transactions and scheduled items, not a full month-grid calendar.
- There is no login or multi-user support.
- The budget health score and month-over-month budget comparison are not implemented in this version.
- Report export currently exports transactions as CSV.
- The backend uses a small built-in JSON parser/writer to avoid third-party Java dependencies. It is intended for this academic single-user project, not untrusted public traffic.
- The backend writes JSON files directly. Do not run multiple backend instances against the same data folder.
- This source package has not been run in your local Windows environment. Compile and build it using the commands above, then report any terminal errors for fixes.
