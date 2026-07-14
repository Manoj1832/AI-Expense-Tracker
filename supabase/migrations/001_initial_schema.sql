-- Supabase initial migration schema for AI Expense Tracker

-- Drop tables if exist
drop table if exists expense_corrections;
drop table if exists expenses;

-- Create expenses table
create table expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  amount numeric not null,
  category text not null,
  merchant text,
  note text,
  raw_text text not null,
  source text check (source in ('voice', 'text')) not null,
  expense_date date not null,
  model_version text default 'v1.0',
  created_at timestamptz default now()
);

-- Create expense corrections table for model retraining
create table expense_corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  raw_text text not null,
  predicted_category text,
  corrected_category text not null,
  created_at timestamptz default now()
);

-- Enable Row Level Security (RLS)
alter table expenses enable row level security;
alter table expense_corrections enable row level security;

-- Policies for expenses
create policy "Users manage own expenses" on expenses
  for all using (auth.uid() = user_id);

-- Policies for corrections
create policy "Users manage own corrections" on expense_corrections
  for all using (auth.uid() = user_id);

-- Create indexes for performance and fast lookups
create index idx_expenses_user_id on expenses(user_id);
create index idx_expenses_date on expenses(expense_date);
create index idx_corrections_user_id on expense_corrections(user_id);
