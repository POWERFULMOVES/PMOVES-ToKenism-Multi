/**
 * Firefly-iii API Type Definitions
 * Replaces `any` types with proper interfaces for type safety
 */

/** Account from Firefly-iii API */
export interface FireflyAccount {
  id: string;
  attributes: {
    name: string;
    type: string;
    current_balance: string;
    currency_code: string;
    account_role?: string;
    user_id?: string;
  };
}

/** Transaction from Firefly-iii API */
export interface FireflyTransaction {
  transaction_journal_id: string;
  amount: string;
  description: string;
  date: string;
  category_name?: string;
  source_name: string;
  destination_name: string;
  type: string;
}

/** Transaction group from Firefly-iii API */
export interface FireflyTransactionGroup {
  id: string;
  attributes: {
    transactions: FireflyTransaction[];
  };
}

/** Insight response for category spending */
export interface FireflyInsightResponse {
  name: string;
  sum: string;
  count: string;
}

/** Budget analysis response */
export interface FireflyBudgetResponse {
  name: string;
  budgeted: string;
  sum: string;
}

/** Piggy bank from Firefly-iii API */
export interface FireflyPiggyBank {
  attributes: {
    name: string;
    target_amount: string;
    current_amount: string;
  };
}

/** Generic API response wrapper */
export interface FireflyApiResponse<T> {
  data: T;
}

/** Account list response */
export interface FireflyAccountResponse {
  data: FireflyAccount[];
}

/** Transaction list response */
export interface FireflyTransactionResponse {
  data: FireflyTransactionGroup[];
}

/** Piggy bank list response */
export interface FireflyPiggyBankResponse {
  data: FireflyPiggyBank[];
}

/** Create account request */
export interface FireflyCreateAccountRequest {
  name: string;
  type: string;
  opening_balance?: string;
  opening_balance_date?: string;
  account_role?: string;
}

/** Create transaction request */
export interface FireflyCreateTransactionRequest {
  type: 'withdrawal' | 'deposit' | 'transfer';
  date: string;
  amount: string;
  description: string;
  source_id?: string;
  destination_id?: string;
  source_name?: string;
  destination_name?: string;
  category_name?: string;
  budget_name?: string;
}
