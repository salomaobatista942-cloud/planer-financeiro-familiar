-- Run this SQL in your Supabase SQL Editor to create the transactions table

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  description TEXT NOT NULL,
  amount INTEGER NOT NULL,
  category TEXT NOT NULL,
  group_name TEXT,
  subcategory TEXT,
  status TEXT NOT NULL,
  payment_method TEXT,
  date TEXT NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  installments INTEGER DEFAULT 1,
  installment_month INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (allow all for now)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON transactions FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
