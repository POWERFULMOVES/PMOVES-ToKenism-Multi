/**
 * Firefly-iii API Client
 * Handles all interactions with PMOVES-Firefly-iii API
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

export interface FireflyConfig {
  baseUrl: string;
  apiToken: string;
  apiVersion: string;
  timeout: number;
  retryCount: number;
}

export interface CategorySpending {
  category: string;
  amount: number;
  count: number;
}

export interface BudgetAnalysis {
  budgetName: string;
  budgeted: number;
  actual: number;
  variance: number;
  variancePercent: number;
}

export interface WealthDistribution {
  userId: string;
  totalWealth: number;
  accounts: Array<{
    name: string;
    balance: number;
    type: string;
  }>;
}

export interface Transaction {
  id: string;
  amount: number;
  description: string;
  date: string;
  category: string;
  sourceAccount: string;
  destinationAccount: string;
  type: string;
}

export interface SavingsMetrics {
  totalSavings: number;
  savingsRate: number;
  piggyBanks: Array<{
    name: string;
    targetAmount: number;
    currentAmount: number;
    progressPercent: number;
  }>;
}

export class FireflyClient {
  private client: AxiosInstance;
  private config: FireflyConfig;

  constructor(config: Partial<FireflyConfig>) {
    this.config = {
      baseUrl: 'http://firefly:8080',
      apiVersion: 'v1',
      timeout: 30000,
      retryCount: 3,
      ...config,
      apiToken: config.apiToken || '',
    };

    this.client = axios.create({
      baseURL: `${this.config.baseUrl}/api/${this.config.apiVersion}`,
      timeout: this.config.timeout,
      headers: {
        Authorization: `Bearer ${this.config.apiToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const config = error.config as AxiosRequestConfig & { retryCount?: number };

        // Security: Sanitize error logs to prevent API token exposure
        const sanitizedConfig = {
          url: config.url,
          method: config.method,
          baseURL: config.baseURL,
        };
        console.error('[FireflyClient] Request failed:', {
          ...sanitizedConfig,
          status: error.response?.status,
          statusText: error.response?.statusText,
        });

        if (!config.retryCount) {
          config.retryCount = 0;
        }

        if (config.retryCount < this.config.retryCount) {
          config.retryCount++;
          console.log(
            `[FireflyClient] Retrying request (${config.retryCount}/${this.config.retryCount})`
          );

          // Exponential backoff
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, config.retryCount!) * 1000)
          );

          return this.client(config);
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Get spending by category for a date range
   */
  async getSpendingByCategory(
    startDate: Date,
    endDate: Date
  ): Promise<CategorySpending[]> {
    try {
      const response = await this.client.get('/insight/expense/category', {
        params: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0],
        },
      });

      return response.data.map((item: any) => ({
        category: item.name,
        amount: parseFloat(item.sum || '0'),
        count: parseInt(item.count || '0', 10),
      }));
    } catch (error) {
      console.error('[FireflyClient] Failed to get spending by category:', error);
      throw error;
    }
  }

  /**
   * Get budget vs actual analysis
   */
  async getBudgetVsActual(
    startDate: Date,
    endDate: Date
  ): Promise<BudgetAnalysis[]> {
    try {
      const response = await this.client.get('/insight/expense/budget', {
        params: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0],
        },
      });

      return response.data.map((item: any) => {
        const budgeted = parseFloat(item.budgeted || '0');
        const actual = parseFloat(item.sum || '0');
        const variance = budgeted - actual;

        return {
          budgetName: item.name,
          budgeted,
          actual,
          variance,
          variancePercent: budgeted > 0 ? (variance / budgeted) * 100 : 0,
        };
      });
    } catch (error) {
      console.error('[FireflyClient] Failed to get budget analysis:', error);
      throw error;
    }
  }

  /**
   * Get wealth distribution for a user group
   */
  async getUserGroupWealth(userGroupId: string): Promise<WealthDistribution[]> {
    try {
      const response = await this.client.get('/accounts', {
        params: {
          user_group_id: userGroupId,
          type: 'asset',
        },
      });

      const accountsByUser = new Map<string, any[]>();

      // Group accounts by user
      for (const account of response.data.data) {
        const userId = account.attributes.user_id;
        if (!accountsByUser.has(userId)) {
          accountsByUser.set(userId, []);
        }
        accountsByUser.get(userId)!.push(account);
      }

      // Calculate total wealth per user
      const wealthDistribution: WealthDistribution[] = [];

      for (const [userId, accounts] of accountsByUser) {
        const totalWealth = accounts.reduce(
          (sum, account) =>
            sum + parseFloat(account.attributes.current_balance || '0'),
          0
        );

        wealthDistribution.push({
          userId,
          totalWealth,
          accounts: accounts.map((account) => ({
            name: account.attributes.name,
            balance: parseFloat(account.attributes.current_balance || '0'),
            type: account.attributes.type,
          })),
        });
      }

      return wealthDistribution;
    } catch (error) {
      console.error('[FireflyClient] Failed to get wealth distribution:', error);
      throw error;
    }
  }

  /**
   * Get savings progress (piggy banks)
   */
  async getSavingsProgress(): Promise<SavingsMetrics> {
    try {
      const response = await this.client.get('/piggy-banks');

      const piggyBanks = response.data.data.map((pb: any) => {
        const targetAmount = parseFloat(pb.attributes.target_amount || '0');
        const currentAmount = parseFloat(pb.attributes.current_amount || '0');

        return {
          name: pb.attributes.name,
          targetAmount,
          currentAmount,
          progressPercent:
            targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0,
        };
      });

      const totalSavings = piggyBanks.reduce(
        (sum: number, pb: any) => sum + pb.currentAmount,
        0
      );

      // Calculate savings rate (would need income data for accurate calculation)
      const savingsRate = 0; // Placeholder

      return {
        totalSavings,
        savingsRate,
        piggyBanks,
      };
    } catch (error) {
      console.error('[FireflyClient] Failed to get savings progress:', error);
      throw error;
    }
  }

  /**
   * Get transactions for a date range
   */
  async getTransactions(
    startDate: Date,
    endDate: Date,
    type?: string
  ): Promise<Transaction[]> {
    try {
      const response = await this.client.get('/transactions', {
        params: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0],
          type,
        },
      });

      return response.data.data.flatMap((group: any) =>
        group.attributes.transactions.map((tx: any) => ({
          id: tx.transaction_journal_id,
          amount: parseFloat(tx.amount),
          description: tx.description,
          date: tx.date,
          category: tx.category_name || 'uncategorized',
          sourceAccount: tx.source_name,
          destinationAccount: tx.destination_name,
          type: tx.type,
        }))
      );
    } catch (error) {
      console.error('[FireflyClient] Failed to get transactions:', error);
      throw error;
    }
  }

  /**
   * Export transactions to CSV
   */
  async exportTransactionsCSV(
    startDate: Date,
    endDate: Date
  ): Promise<string> {
    try {
      const response = await this.client.get('/data/export/transactions', {
        params: {
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
        },
        responseType: 'text',
      });

      return response.data;
    } catch (error) {
      console.error('[FireflyClient] Failed to export transactions:', error);
      throw error;
    }
  }

  /**
   * Test connection to Firefly-iii
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/about');
      console.log('[FireflyClient] Connection successful:', response.data);
      return true;
    } catch (error) {
      console.error('[FireflyClient] Connection failed:', error);
      return false;
    }
  }
  /**
   * Create a new account
   */
  async createAccount(data: {
    name: string;
    type: string;
    balance?: number;
    accountRole?: string;
  }): Promise<any> {
    try {
      const payload: any = {
        name: data.name,
        type: data.type,
        opening_balance: data.balance?.toString() || '0',
        opening_balance_date: new Date().toISOString().split('T')[0],
      };

      // Asset accounts require an account_role
      if (data.type === 'asset') {
        payload.account_role = data.accountRole || 'defaultAsset';
      }

      const response = await this.client.post('/accounts', payload);
      return response.data.data;
    } catch (error) {
      console.error('[FireflyClient] Failed to create account:', error);
      throw error;
    }
  }

  /**
   * Create a new transaction
   */
  async createTransaction(data: {
    type: 'withdrawal' | 'deposit' | 'transfer';
    date: Date;
    amount: number;
    description: string;
    sourceId?: string;
    destinationId?: string;
    sourceName?: string;
    destinationName?: string;
    category?: string;
    budget?: string;
  }): Promise<any> {
    try {
      const payload: any = {
        type: data.type,
        date: data.date.toISOString().split('T')[0],
        amount: data.amount.toString(),
        description: data.description,
      };

      if (data.sourceId) payload.source_id = data.sourceId;
      if (data.destinationId) payload.destination_id = data.destinationId;
      if (data.sourceName) payload.source_name = data.sourceName;
      if (data.destinationName) payload.destination_name = data.destinationName;
      if (data.category) payload.category_name = data.category;
      if (data.budget) payload.budget_name = data.budget;

      const response = await this.client.post('/transactions', {
        transactions: [payload],
      });
      return response.data.data;
    } catch (error) {
      console.error('[FireflyClient] Failed to create transaction:', error);
      throw error;
    }
  }

  /**
   * Get all accounts
   */
  async getAccounts(type: string = 'asset'): Promise<any[]> {
    try {
      const response = await this.client.get('/accounts', {
        params: { type },
      });
      return response.data.data;
    } catch (error) {
      console.error('[FireflyClient] Failed to get accounts:', error);
      throw error;
    }
  }
}

export default FireflyClient;
