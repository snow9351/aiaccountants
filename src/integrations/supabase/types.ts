export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ── New enum type aliases from 20240411 schema migration ──────────────────────
export type JournalEntryStatus = 'draft' | 'pending_review' | 'posted' | 'voided';
export type NormalBalanceType = 'debit' | 'credit';
export type FsSectionType =
  | 'current_assets' | 'fixed_assets' | 'current_liabilities'
  | 'long_term_liabilities' | 'equity' | 'revenue' | 'cogs'
  | 'operating_expenses' | 'other_income' | 'other_expenses';
export type SuggestionTypeEnum =
  | 'categorization' | 'account_mapping' | 'vendor_match'
  | 'duplicate_detection' | 'anomaly' | 'journal_entry';
export type AuditActionType =
  | 'create' | 'update' | 'delete' | 'void'
  | 'post' | 'approve' | 'reject' | 'ai_suggest'
  | 'ai_apply' | 'period_close' | 'period_reopen';
// ─────────────────────────────────────────────────────────────────────────────

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          business_type: string;
          fiscal_year_end_month: number;
          base_currency: string;
          tax_id: string | null;
          managed_by_firm_id: string | null;
          address: Json | null;
          require_account_numbers: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['organizations']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['organizations']['Insert']>;
      };
      users: {
        Row: {
          id: string;
          org_id: string | null;
          email: string;
          full_name: string | null;
          role: 'admin' | 'accountant' | 'viewer';
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };
      payment_terms: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          days_due: number;
          discount_percent: number | null;
          discount_days: number | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['payment_terms']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['payment_terms']['Insert']>;
      };
      contacts: {
        Row: {
          id: string;
          org_id: string;
          display_name: string;
          legal_name: string | null;
          contact_type: 'customer' | 'vendor' | 'both';
          billing_address: Json | null;
          shipping_address: Json | null;
          tax_id: string | null;
          is_1099_eligible: boolean;
          payment_terms_id: string | null;
          default_income_account_id: string | null;
          default_expense_account_id: string | null;
          email: string | null;
          phone: string | null;
          notes: string | null;
          ytd_1099_payments: number;
          ytd_1099_year: number;
          customer_id: string | null;
          vendor_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['contacts']['Row'], 'id' | 'ytd_1099_payments' | 'ytd_1099_year' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['contacts']['Insert']>;
      };
      accounts: {
        Row: {
          id: string;
          org_id: string;
          account_number: string | null;
          name: string;
          type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
          sub_type: string;
          parent_id: string | null;
          description: string | null;
          is_active: boolean;
          is_system: boolean;
          normal_balance: NormalBalanceType;
          tax_category: string | null;
          is_reconcilable: boolean;
          fs_section: FsSectionType | null;
          sort_order: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['accounts']['Row'], 'id' | 'is_reconcilable' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['accounts']['Insert']>;
      };
      journal_entries: {
        Row: {
          id: string;
          org_id: string;
          entry_number: string;
          date: string;
          description: string;
          reference: string | null;
          is_posted: boolean;
          is_voided: boolean;
          voided_by: string | null;
          voided_at: string | null;
          void_reason: string | null;
          period_closed: boolean;
          status: JournalEntryStatus;
          created_by: string | null;
          prev_hash: string | null;
          entry_hash: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['journal_entries']['Row'], 'id' | 'is_voided' | 'period_closed' | 'status' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['journal_entries']['Insert']>;
      };
      journal_entry_lines: {
        Row: {
          id: string;
          journal_entry_id: string;
          account_id: string;
          debit: number;
          credit: number;
          description: string | null;
          line_number: number;
          org_id: string | null;
          is_voided: boolean;
          created_at: string;
          updated_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['journal_entry_lines']['Row'], 'id' | 'is_voided' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['journal_entry_lines']['Insert']>;
      };
      customers: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          display_name: string | null;
          legal_name: string | null;
          email: string | null;
          phone: string | null;
          billing_address: Json | null;
          shipping_address: Json | null;
          tax_id: string | null;
          payment_terms_id: string | null;
          default_income_account_id: string | null;
          credit_limit: number | null;
          payment_score: number;
          total_revenue: number;
          ar_balance: number;
          industry: string | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['customers']['Insert']>;
      };
      invoices: {
        Row: {
          id: string;
          org_id: string;
          invoice_number: string;
          customer_id: string;
          status: 'draft' | 'sent' | 'viewed' | 'partial' | 'paid' | 'overdue' | 'cancelled' | 'voided';
          issue_date: string;
          due_date: string;
          subtotal: number;
          tax_amount: number;
          total: number;
          amount_paid: number;
          balance_due: number;
          notes: string | null;
          discount_type: 'none' | 'percent' | 'flat';
          discount_value: number;
          currency: string;
          is_recurring: boolean;
          recurring_interval: string | null;
          journal_entry_id: string | null;
          sent_at: string | null;
          viewed_at: string | null;
          stripe_payment_intent_id: string | null;
          stripe_payment_link_id: string | null;
          payment_link_url: string | null;
          pdf_url: string | null;
          last_reminder_at: string | null;
          reminder_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['invoices']['Row'], 'id' | 'balance_due' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['invoices']['Insert']>;
      };
      invoice_line_items: {
        Row: {
          id: string;
          invoice_id: string;
          description: string;
          quantity: number;
          unit_price: number;
          amount: number;
          tax_rate: number;
          account_id: string | null;
          line_number: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['invoice_line_items']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['invoice_line_items']['Insert']>;
      };
      invoice_payments: {
        Row: {
          id: string;
          invoice_id: string;
          payment_date: string;
          amount: number;
          payment_method: string;
          reference: string | null;
          notes: string | null;
          stripe_payment_intent_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['invoice_payments']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['invoice_payments']['Insert']>;
      };
      vendors: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          display_name: string | null;
          legal_name: string | null;
          email: string | null;
          phone: string | null;
          address: Json | null;
          billing_address: Json | null;
          tax_id: string | null;
          payment_terms_id: string | null;
          default_expense_account_id: string | null;
          preferred_payment_method: string | null;
          total_spend: number;
          ap_balance: number;
          reliability_score: number;
          is_1099: boolean;
          ytd_1099_payments: number;
          ytd_1099_year: number;
          is_active: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['vendors']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['vendors']['Insert']>;
      };
      bills: {
        Row: {
          id: string;
          org_id: string;
          vendor_id: string;
          bill_number: string | null;
          status: 'draft' | 'received' | 'approved' | 'partial' | 'paid' | 'overdue' | 'cancelled';
          bill_date: string;
          due_date: string;
          subtotal: number;
          tax_amount: number;
          total: number;
          amount_paid: number;
          balance_due: number;
          description: string | null;
          po_number: string | null;
          is_duplicate: boolean;
          receipt_url: string | null;
          journal_entry_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['bills']['Row'], 'id' | 'balance_due' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['bills']['Insert']>;
      };
      bill_line_items: {
        Row: {
          id: string;
          bill_id: string;
          description: string;
          quantity: number;
          unit_price: number;
          amount: number;
          tax_rate: number;
          account_id: string | null;
          line_number: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['bill_line_items']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['bill_line_items']['Insert']>;
      };
      bill_payments: {
        Row: {
          id: string;
          bill_id: string;
          payment_date: string;
          amount: number;
          payment_method: string;
          reference: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['bill_payments']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['bill_payments']['Insert']>;
      };
      expenses: {
        Row: {
          id: string;
          org_id: string;
          date: string;
          vendor_id: string | null;
          vendor_name: string | null;
          description: string;
          amount: number;
          account_id: string | null;
          category: string | null;
          status: 'pending' | 'auto_categorized' | 'review' | 'approved' | 'rejected';
          ai_confidence: number | null;
          ai_suggested_category: string | null;
          receipt_url: string | null;
          payment_date: string | null;
          payment_method: string | null;
          payment_reference: string | null;
          bank_transaction_id: string | null;
          journal_entry_id: string | null;
          project_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['expenses']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['expenses']['Insert']>;
      };
      receipts: {
        Row: {
          id: string;
          org_id: string;
          expense_id: string | null;
          file_name: string;
          file_url: string;
          file_type: string;
          ocr_text: string | null;
          extracted_vendor: string | null;
          extracted_date: string | null;
          extracted_amount: number | null;
          extracted_tax: number | null;
          extracted_items: Json | null;
          ocr_confidence: number | null;
          is_duplicate: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['receipts']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['receipts']['Insert']>;
      };
      bank_accounts: {
        Row: {
          id: string;
          org_id: string;
          account_name: string;
          account_number_masked: string | null;
          bank_name: string;
          account_type: 'checking' | 'savings' | 'credit' | 'investment';
          currency: string;
          current_balance: number;
          gl_account_id: string | null;
          plaid_account_id: string | null;
          last_sync_at: string | null;
          sync_status: 'syncing' | 'synced' | 'failed' | 'disconnected';
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['bank_accounts']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['bank_accounts']['Insert']>;
      };
      bank_transactions: {
        Row: {
          id: string;
          org_id: string;
          bank_account_id: string;
          date: string;
          description: string;
          amount: number;
          type: 'income' | 'expense' | 'transfer';
          category: string | null;
          merchant: string | null;
          balance_after: number | null;
          external_id: string | null;
          is_matched: boolean;
          is_reconciled: boolean;
          matched_journal_entry_line_id: string | null;
          ai_confidence: number | null;
          ai_suggested_category: string | null;
          is_pending: boolean;
          account_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['bank_transactions']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['bank_transactions']['Insert']>;
      };
      bank_reconciliations: {
        Row: {
          id: string;
          org_id: string;
          bank_account_id: string;
          reconciliation_date: string;
          statement_beginning_balance: number;
          statement_ending_balance: number;
          gl_beginning_balance: number;
          gl_ending_balance: number;
          outstanding_deposits: number;
          outstanding_checks: number;
          status: 'in_progress' | 'completed' | 'has_discrepancy';
          notes: string | null;
          created_by: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['bank_reconciliations']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['bank_reconciliations']['Insert']>;
      };
      employees: {
        Row: {
          id: string;
          org_id: string;
          first_name: string;
          last_name: string;
          email: string | null;
          phone: string | null;
          job_title: string | null;
          department: string | null;
          hire_date: string;
          termination_date: string | null;
          status: 'active' | 'inactive' | 'on_leave' | 'terminated';
          employment_type: 'full_time' | 'part_time' | 'contractor';
          salary: number | null;
          salary_frequency: 'annual' | 'monthly' | 'biweekly' | 'weekly' | 'hourly';
          overtime_multiplier: number;
          address: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['employees']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['employees']['Insert']>;
      };
      timesheets: {
        Row: {
          id: string;
          org_id: string;
          employee_id: string;
          week_start_date: string;
          total_hours: number;
          total_overtime_hours: number;
          status: 'draft' | 'submitted' | 'approved' | 'rejected';
          notes: string | null;
          submitted_at: string | null;
          approved_at: string | null;
          approved_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['timesheets']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['timesheets']['Insert']>;
      };
      payroll_runs: {
        Row: {
          id: string;
          org_id: string;
          pay_period_start: string;
          pay_period_end: string;
          payroll_date: string;
          status: 'draft' | 'processing' | 'completed' | 'failed';
          total_gross: number;
          total_taxes: number;
          total_deductions: number;
          total_net: number;
          employee_count: number;
          notes: string | null;
          created_by: string | null;
          processed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['payroll_runs']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['payroll_runs']['Insert']>;
      };
      payroll_details: {
        Row: {
          id: string;
          payroll_run_id: string;
          employee_id: string;
          gross_pay: number;
          federal_tax: number;
          state_tax: number;
          fica_employee: number;
          fica_employer: number;
          other_deductions: number;
          net_pay: number;
          payment_method: string;
          paystub_url: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['payroll_details']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['payroll_details']['Insert']>;
      };
      budgets: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          fiscal_year: number;
          period_type: 'monthly' | 'quarterly' | 'annual';
          scenario: 'expected' | 'best_case' | 'worst_case';
          status: 'draft' | 'approved' | 'active' | 'archived';
          created_by: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['budgets']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['budgets']['Insert']>;
      };
      budget_lines: {
        Row: {
          id: string;
          budget_id: string;
          account_id: string;
          period_label: string;
          amount: number;
          notes: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['budget_lines']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['budget_lines']['Insert']>;
      };
      projects: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          customer_id: string | null;
          status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
          project_type: 'fixed_price' | 'time_and_materials' | 'cost_plus';
          start_date: string | null;
          end_date: string | null;
          budget_amount: number;
          actual_cost: number;
          revenue_amount: number;
          percent_complete: number;
          description: string | null;
          manager_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['projects']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['projects']['Insert']>;
      };
      project_phases: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          phase_order: number;
          start_date: string | null;
          end_date: string | null;
          budget_amount: number;
          status: 'pending' | 'in_progress' | 'completed';
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['project_phases']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['project_phases']['Insert']>;
      };
      tax_settings: {
        Row: {
          id: string;
          org_id: string;
          jurisdiction: string;
          entity_type: 'sole_prop' | 'partnership' | 's_corp' | 'c_corp' | 'llc';
          tax_id: string | null;
          fiscal_year_end: string | null;
          state: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['tax_settings']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['tax_settings']['Insert']>;
      };
      estimated_tax_payments: {
        Row: {
          id: string;
          org_id: string;
          tax_year: number;
          quarter: number;
          due_date: string;
          estimated_liability: number;
          amount_paid: number | null;
          paid_at: string | null;
          status: 'pending' | 'paid' | 'overdue';
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['estimated_tax_payments']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['estimated_tax_payments']['Insert']>;
      };
      ai_alerts: {
        Row: {
          id: string;
          org_id: string;
          type: string;
          priority: 'high' | 'medium' | 'low';
          title: string;
          description: string;
          action_label: string | null;
          action_url: string | null;
          is_dismissed: boolean;
          dismissed_at: string | null;
          related_table: string | null;
          related_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['ai_alerts']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['ai_alerts']['Insert']>;
      };
      anomalies_detected: {
        Row: {
          id: string;
          org_id: string;
          anomaly_type: string;
          severity: 'low' | 'medium' | 'high' | 'critical';
          description: string;
          source_entity_id: string | null;
          source_entity_type: string | null;
          anomaly_score: number;
          was_reviewed: boolean;
          user_action: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['anomalies_detected']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['anomalies_detected']['Insert']>;
      };
      ai_transaction_suggestions: {
        Row: {
          id: string;
          org_id: string;
          suggestion_type: SuggestionTypeEnum;
          source_entity_id: string | null;
          suggested_value: Json;
          confidence_score: number;
          was_accepted: boolean | null;
          user_correction: string | null;
          model_version: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          source_table: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['ai_transaction_suggestions']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['ai_transaction_suggestions']['Insert']>;
      };
      forecasts: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          type: 'revenue' | 'expense' | 'cash_flow';
          period: string;
          methodology: string;
          confidence_level: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['forecasts']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['forecasts']['Insert']>;
      };
      audit_log: {
        Row: {
          id: string;
          org_id: string;
          timestamp: string;
          actor_id: string | null;
          actor_type: 'user' | 'ai' | 'system';
          actor_name: string;
          action: AuditActionType;
          target_table: string | null;
          target_id: string | null;
          target_description: string | null;
          old_value: Json | null;
          new_value: Json | null;
          ai_confidence: number | null;
          is_flagged: boolean;
          ip_address: string | null;
        };
        Insert: Omit<Database['public']['Tables']['audit_log']['Row'], 'id'>;
        Update: never;
      };
      nlq_queries: {
        Row: {
          id: string;
          org_id: string;
          user_id: string | null;
          query: string;
          response: string | null;
          was_helpful: boolean | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['nlq_queries']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['nlq_queries']['Insert']>;
      };
      exchange_rates: {
        Row: {
          id: string;
          org_id: string;
          from_currency: string;
          to_currency: string;
          rate: number;
          rate_date: string;
          source: string | null;
          is_manual: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['exchange_rates']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['exchange_rates']['Insert']>;
      };
      periods: {
        Row: {
          id: string;
          org_id: string;
          fiscal_year: number;
          period_number: number;
          period_start: string;
          period_end: string;
          status: 'open' | 'closed' | 'locked';
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['periods']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['periods']['Insert']>;
      };

      // ── MVP v2 tables ─────────────────────────────────────

      plans: {
        Row: {
          id: string;
          name: 'starter' | 'pro' | 'accountant' | 'firm';
          display_name: string;
          price_monthly: number;
          price_annually: number;
          stripe_price_id_monthly: string | null;
          stripe_price_id_annually: string | null;
          max_companies: number;
          max_users: number;
          features: Json;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['plans']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['plans']['Insert']>;
      };
      firms: {
        Row: {
          id: string;
          name: string;
          ein: string | null;
          owner_id: string | null;
          stripe_customer_id: string | null;
          plan: 'starter' | 'pro' | 'accountant' | 'firm';
          subscription_status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused';
          billing_model: 'client_pays' | 'accountant_pays' | 'revenue_share';
          max_clients: number;
          logo_url: string | null;
          website: string | null;
          phone: string | null;
          address: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['firms']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['firms']['Insert']>;
      };
      stripe_customers: {
        Row: {
          id: string;
          org_id: string | null;
          firm_id: string | null;
          user_id: string | null;
          stripe_customer_id: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['stripe_customers']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['stripe_customers']['Insert']>;
      };
      subscriptions: {
        Row: {
          id: string;
          org_id: string | null;
          firm_id: string | null;
          stripe_subscription_id: string;
          stripe_customer_id: string;
          plan: 'starter' | 'pro' | 'accountant' | 'firm';
          billing_model: 'client_pays' | 'accountant_pays' | 'revenue_share';
          status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused';
          current_period_start: string | null;
          current_period_end: string | null;
          trial_end: string | null;
          cancel_at_period_end: boolean;
          canceled_at: string | null;
          payment_method_last4: string | null;
          payment_method_brand: string | null;
          dunning_count: number;
          dunning_grace_until: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['subscriptions']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['subscriptions']['Insert']>;
      };
      company_memberships: {
        Row: {
          id: string;
          org_id: string;
          user_id: string;
          firm_id: string | null;
          role: 'owner' | 'accountant' | 'bookkeeper' | 'read_only';
          is_billing_owner: boolean;
          invited_by: string | null;
          joined_at: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['company_memberships']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['company_memberships']['Insert']>;
      };
      invitations: {
        Row: {
          id: string;
          org_id: string | null;
          firm_id: string | null;
          invited_by: string;
          email: string;
          role: 'owner' | 'accountant' | 'bookkeeper' | 'read_only';
          token: string;
          status: 'pending' | 'accepted' | 'expired' | 'revoked';
          expires_at: string;
          accepted_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['invitations']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['invitations']['Insert']>;
      };
      mfa_settings: {
        Row: {
          id: string;
          user_id: string;
          is_enabled: boolean;
          is_required: boolean;
          totp_secret: string | null;
          backup_codes: string[] | null;
          last_verified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['mfa_settings']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['mfa_settings']['Insert']>;
      };
      plaid_connections: {
        Row: {
          id: string;
          org_id: string;
          bank_account_id: string | null;
          access_token: string;
          item_id: string;
          institution_id: string | null;
          institution_name: string | null;
          status: 'active' | 'error' | 'pending_expiration' | 'revoked';
          cursor: string | null;
          last_synced_at: string | null;
          error_code: string | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['plaid_connections']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['plaid_connections']['Insert']>;
      };
      ai_categorization_signals: {
        Row: {
          id: string;
          org_id: string;
          transaction_id: string | null;
          merchant_name: string | null;
          description_normalized: string | null;
          amount_range: string | null;
          suggested_account_id: string | null;
          confirmed_account_id: string | null;
          was_overridden: boolean;
          confidence: number | null;
          model_version: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['ai_categorization_signals']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['ai_categorization_signals']['Insert']>;
      };
      reconciliation_periods: {
        Row: {
          id: string;
          org_id: string;
          bank_account_id: string;
          period_start: string;
          period_end: string;
          opening_balance: number;
          closing_balance: number;
          statement_balance: number;
          difference: number;
          status: 'in_progress' | 'completed' | 'locked';
          locked_by: string | null;
          locked_at: string | null;
          completed_at: string | null;
          pdf_url: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['reconciliation_periods']['Row'], 'id' | 'difference' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['reconciliation_periods']['Insert']>;
      };
      csv_import_jobs: {
        Row: {
          id: string;
          org_id: string;
          bank_account_id: string;
          file_name: string;
          file_url: string | null;
          status: string;
          rows_total: number | null;
          rows_imported: number | null;
          rows_duplicate: number | null;
          rows_failed: number | null;
          error_message: string | null;
          imported_by: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['csv_import_jobs']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['csv_import_jobs']['Insert']>;
      };

      // ── Puzzle parity tables ──────────────────────────────

      close_checklists: {
        Row: {
          id: string;
          org_id: string;
          period: string;
          status: 'open' | 'in_review' | 'closed';
          started_at: string | null;
          closed_at: string | null;
          closed_by: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['close_checklists']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['close_checklists']['Insert']>;
      };
      close_tasks: {
        Row: {
          id: string;
          checklist_id: string;
          title: string;
          description: string | null;
          category: 'bank' | 'receivables' | 'payables' | 'payroll' | 'accruals' | 'review';
          status: 'pending' | 'in_progress' | 'completed' | 'skipped';
          assigned_to: string | null;
          completed_at: string | null;
          completed_by: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['close_tasks']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['close_tasks']['Insert']>;
      };
      revenue_contracts: {
        Row: {
          id: string;
          org_id: string;
          customer_name: string;
          contract_name: string;
          total_value: number;
          recognized_to_date: number;
          deferred_revenue: number;
          start_date: string;
          end_date: string;
          recognition_method: 'straight_line' | 'milestone' | 'usage_based' | 'point_in_time';
          status: 'active' | 'completed' | 'paused';
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['revenue_contracts']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['revenue_contracts']['Insert']>;
      };
      revenue_schedules: {
        Row: {
          id: string;
          contract_id: string;
          period: string;
          amount: number;
          status: 'scheduled' | 'recognized' | 'adjusted';
          recognized_at: string | null;
          journal_entry_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['revenue_schedules']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['revenue_schedules']['Insert']>;
      };
      categorization_rules: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          match_field: 'description' | 'vendor' | 'amount' | 'memo';
          match_type: 'contains' | 'starts_with' | 'exact' | 'regex' | 'greater_than' | 'less_than';
          match_value: string;
          target_account_id: string;
          target_account_name: string;
          priority: number;
          is_active: boolean;
          auto_apply: boolean;
          times_applied: number;
          last_applied_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['categorization_rules']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['categorization_rules']['Insert']>;
      };
      client_requests: {
        Row: {
          id: string;
          org_id: string;
          title: string;
          description: string | null;
          requested_by: string;
          requested_by_name: string;
          assigned_to: string | null;
          assigned_to_name: string | null;
          status: 'open' | 'in_progress' | 'resolved' | 'closed';
          priority: 'low' | 'medium' | 'high';
          category: 'question' | 'document_request' | 'review' | 'adjustment' | 'tax';
          created_at: string;
          resolved_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['client_requests']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['client_requests']['Insert']>;
      };
      accruals: {
        Row: {
          id: string;
          org_id: string;
          type: 'expense' | 'revenue';
          description: string;
          vendor_or_customer: string | null;
          amount: number;
          account_id: string;
          account_name: string;
          period: string;
          frequency: 'one_time' | 'monthly' | 'quarterly';
          status: 'draft' | 'posted' | 'reversed';
          journal_entry_id: string | null;
          reversal_entry_id: string | null;
          auto_reverse: boolean;
          created_at: string;
          posted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['accruals']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['accruals']['Insert']>;
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      ensure_my_accounting_firm: {
        Args: { p_ein?: string | null; p_name: string };
        Returns: string;
      };
      generate_default_coa: {
        Args: { p_org_id: string; p_entity_type: string };
        Returns: void;
      };
      merge_accounts: {
        Args: { p_org_id: string; p_from_account_id: string; p_to_account_id: string };
        Returns: void;
      };
      create_contact: {
        Args: {
          p_org_id: string;
          p_contact_type: 'customer' | 'vendor' | 'both';
          p_display_name: string;
          p_legal_name?: string | null;
          p_billing_address?: Json | null;
          p_shipping_address?: Json | null;
          p_tax_id?: string | null;
          p_is_1099_eligible?: boolean;
          p_payment_terms_id?: string | null;
          p_default_income_account_id?: string | null;
          p_default_expense_account_id?: string | null;
          p_email?: string | null;
          p_phone?: string | null;
          p_notes?: string | null;
        };
        Returns: string;
      };
      record_bill_payment: {
        Args: {
          p_bill_id: string;
          p_payment_date?: string | null;
          p_amount?: number | null;
          p_payment_method?: string | null;
          p_reference?: string | null;
        };
        Returns: string | null;
      };
      create_invoice_with_lines: {
        Args: {
          p_org_id: string;
          p_customer_id: string;
          p_invoice_number: string;
          p_issue_date?: string;
          p_due_date?: string | null;
          p_notes?: string | null;
          p_discount_type?: string;
          p_discount_value?: number;
          p_lines?: Json;
        };
        Returns: string;
      };
      transition_invoice_status: {
        Args: { p_invoice_id: string; p_new_status: Database['public']['Enums']['invoice_status'] };
        Returns: Database['public']['Tables']['invoices']['Row'];
      };
      record_invoice_payment: {
        Args: {
          p_invoice_id: string;
          p_payment_date?: string | null;
          p_amount?: number | null;
          p_payment_method?: string | null;
          p_reference?: string | null;
          p_notes?: string | null;
          p_stripe_payment_intent_id?: string | null;
        };
        Returns: string;
      };
      vendors_1099_threshold: {
        Args: { p_org_id: string; p_year?: number | null };
        Returns: Array<{
          contact_id: string | null;
          vendor_id: string;
          display_name: string;
          tax_id: string | null;
          ytd_1099_payments: number;
          threshold: number;
        }>;
      };
      seed_default_payment_terms: {
        Args: { p_org_id: string };
        Returns: void;
      };
      my_companies: {
        Args: Record<PropertyKey, never>;
        Returns: Array<{
          accounting_method: string;
          entity_type: string;
          fiscal_year_start: number;
          id: string;
          logo_url: string | null;
          name: string;
          plan: Database["public"]["Enums"]["plan_name"];
          role: Database["public"]["Enums"]["user_role"];
          subscription_status: Database["public"]["Enums"]["subscription_status"];
          tax_id: string | null;
          timezone: string;
          trial_ends_at: string | null;
          require_account_numbers: boolean;
        }>;
      };
    };
    Enums: {
      account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
      invoice_status: 'draft' | 'sent' | 'viewed' | 'partial' | 'paid' | 'overdue' | 'cancelled' | 'voided';
      bill_status: 'draft' | 'received' | 'approved' | 'paid' | 'overdue' | 'cancelled';
      expense_status: 'pending' | 'auto_categorized' | 'review' | 'approved' | 'rejected';
      transaction_type: 'income' | 'expense' | 'transfer';
      actor_type: 'user' | 'ai' | 'system';
      employee_status: 'active' | 'inactive' | 'on_leave' | 'terminated';
      payroll_status: 'draft' | 'processing' | 'completed' | 'failed';
      user_role: 'owner' | 'accountant' | 'bookkeeper' | 'read_only';
      plan_name: 'starter' | 'pro' | 'accountant' | 'firm';
      billing_model: 'client_pays' | 'accountant_pays' | 'revenue_share';
      subscription_status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused';
      invite_status: 'pending' | 'accepted' | 'expired' | 'revoked';
      reconciliation_status: 'in_progress' | 'completed' | 'locked';
      categorization_status: 'unreviewed' | 'ai_suggested' | 'confirmed' | 'overridden';
      plaid_status: 'active' | 'error' | 'pending_expiration' | 'revoked';
      journal_entry_status: 'draft' | 'pending_review' | 'posted' | 'voided';
      normal_balance_type: 'debit' | 'credit';
      fs_section_type: 'current_assets' | 'fixed_assets' | 'current_liabilities' | 'long_term_liabilities' | 'equity' | 'revenue' | 'cogs' | 'operating_expenses' | 'other_income' | 'other_expenses';
      suggestion_type_enum: 'categorization' | 'account_mapping' | 'vendor_match' | 'duplicate_detection' | 'anomaly' | 'journal_entry';
      audit_action_type: 'create' | 'update' | 'delete' | 'void' | 'post' | 'approve' | 'reject' | 'ai_suggest' | 'ai_apply' | 'period_close' | 'period_reopen';
    };
  };
};

// Convenience type aliases
export type Organization = Database['public']['Tables']['organizations']['Row'];
export type OrgUser = Database['public']['Tables']['users']['Row'];
export type Account = Database['public']['Tables']['accounts']['Row'];
export type JournalEntry = Database['public']['Tables']['journal_entries']['Row'];
export type JournalEntryLine = Database['public']['Tables']['journal_entry_lines']['Row'];
export type Contact = Database['public']['Tables']['contacts']['Row'];
export type ContactType = Contact['contact_type'];
export type Customer = Database['public']['Tables']['customers']['Row'];
export type Invoice = Database['public']['Tables']['invoices']['Row'];
export type InvoiceLineItem = Database['public']['Tables']['invoice_line_items']['Row'];
export type InvoicePayment = Database['public']['Tables']['invoice_payments']['Row'];
export type Vendor = Database['public']['Tables']['vendors']['Row'];
export type Bill = Database['public']['Tables']['bills']['Row'];
export type BillLineItem = Database['public']['Tables']['bill_line_items']['Row'];
export type BillPayment = Database['public']['Tables']['bill_payments']['Row'];
export type Expense = Database['public']['Tables']['expenses']['Row'];
export type FiscalPeriod = Database['public']['Tables']['periods']['Row'];
export type Receipt = Database['public']['Tables']['receipts']['Row'];
export type BankAccount = Database['public']['Tables']['bank_accounts']['Row'];
export type BankTransaction = Database['public']['Tables']['bank_transactions']['Row'];
export type BankReconciliation = Database['public']['Tables']['bank_reconciliations']['Row'];
export type Employee = Database['public']['Tables']['employees']['Row'];
export type Timesheet = Database['public']['Tables']['timesheets']['Row'];
export type PayrollRun = Database['public']['Tables']['payroll_runs']['Row'];
export type PayrollDetail = Database['public']['Tables']['payroll_details']['Row'];
export type Budget = Database['public']['Tables']['budgets']['Row'];
export type BudgetLine = Database['public']['Tables']['budget_lines']['Row'];
export type Project = Database['public']['Tables']['projects']['Row'];
export type ProjectPhase = Database['public']['Tables']['project_phases']['Row'];
export type TaxSetting = Database['public']['Tables']['tax_settings']['Row'];
export type EstimatedTaxPayment = Database['public']['Tables']['estimated_tax_payments']['Row'];
export type AIAlert = Database['public']['Tables']['ai_alerts']['Row'];
export type Anomaly = Database['public']['Tables']['anomalies_detected']['Row'];
export type AuditEvent = Database['public']['Tables']['audit_log']['Row'];
export type NLQQuery = Database['public']['Tables']['nlq_queries']['Row'];
export type ExchangeRate = Database['public']['Tables']['exchange_rates']['Row'];
export type PaymentTerms = Database['public']['Tables']['payment_terms']['Row'];

// MVP v2 types
export type Plan = Database['public']['Tables']['plans']['Row'];
export type Firm = Database['public']['Tables']['firms']['Row'];
export type StripeCustomer = Database['public']['Tables']['stripe_customers']['Row'];
export type Subscription = Database['public']['Tables']['subscriptions']['Row'];
export type CompanyMembership = Database['public']['Tables']['company_memberships']['Row'];
export type Invitation = Database['public']['Tables']['invitations']['Row'];
export type MFASetting = Database['public']['Tables']['mfa_settings']['Row'];
export type PlaidConnection = Database['public']['Tables']['plaid_connections']['Row'];
export type AICategorization = Database['public']['Tables']['ai_categorization_signals']['Row'];
export type ReconciliationPeriod = Database['public']['Tables']['reconciliation_periods']['Row'];
export type CSVImportJob = Database['public']['Tables']['csv_import_jobs']['Row'];

// Puzzle parity types
export type CloseChecklist = Database['public']['Tables']['close_checklists']['Row'];
export type CloseTask = Database['public']['Tables']['close_tasks']['Row'];
export type RevenueContract = Database['public']['Tables']['revenue_contracts']['Row'];
export type RevenueSchedule = Database['public']['Tables']['revenue_schedules']['Row'];
export type CategorizationRule = Database['public']['Tables']['categorization_rules']['Row'];
export type ClientRequest = Database['public']['Tables']['client_requests']['Row'];
export type Accrual = Database['public']['Tables']['accruals']['Row'];
export type AITransactionSuggestion = Database['public']['Tables']['ai_transaction_suggestions']['Row'];
