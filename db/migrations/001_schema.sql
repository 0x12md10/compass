-- AI Analytics Copilot — demo SaaS schema (see REQUIREMENTS.md §2, db/SCHEMA.md)

CREATE TABLE plans (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    monthly_price   NUMERIC(10, 2) NOT NULL,
    tier            TEXT NOT NULL CHECK (tier IN ('starter', 'pro', 'enterprise'))
);

CREATE TABLE customers (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    company         TEXT NOT NULL,
    signup_date     DATE NOT NULL,
    country         TEXT NOT NULL,
    plan_id         INTEGER NOT NULL REFERENCES plans(id),
    status          TEXT NOT NULL CHECK (status IN ('active', 'churned', 'trial'))
);

CREATE TABLE subscriptions (
    id              SERIAL PRIMARY KEY,
    customer_id     INTEGER NOT NULL REFERENCES customers(id),
    plan_id         INTEGER NOT NULL REFERENCES plans(id),
    started_at      DATE NOT NULL,
    ended_at        DATE,
    status          TEXT NOT NULL CHECK (status IN ('active', 'ended'))
);

CREATE TABLE invoices (
    id              SERIAL PRIMARY KEY,
    customer_id     INTEGER NOT NULL REFERENCES customers(id),
    amount          NUMERIC(10, 2) NOT NULL,
    issued_at       DATE NOT NULL,
    paid_at         DATE,
    status          TEXT NOT NULL CHECK (status IN ('paid', 'overdue', 'failed'))
);

CREATE TABLE usage_events (
    id              SERIAL PRIMARY KEY,
    customer_id     INTEGER NOT NULL REFERENCES customers(id),
    event_type      TEXT NOT NULL,
    occurred_at     TIMESTAMP NOT NULL
);

CREATE TABLE support_tickets (
    id              SERIAL PRIMARY KEY,
    customer_id     INTEGER NOT NULL REFERENCES customers(id),
    opened_at       DATE NOT NULL,
    closed_at       DATE,
    priority        TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
    status          TEXT NOT NULL CHECK (status IN ('open', 'closed'))
);

CREATE INDEX idx_customers_plan_id ON customers(plan_id);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_subscriptions_customer_id ON subscriptions(customer_id);
CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_usage_events_customer_id ON usage_events(customer_id);
CREATE INDEX idx_usage_events_occurred_at ON usage_events(occurred_at);
CREATE INDEX idx_support_tickets_customer_id ON support_tickets(customer_id);
