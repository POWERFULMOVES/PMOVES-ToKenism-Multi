import axios, { AxiosInstance } from 'axios';
import FireflyClient from './firefly-client';

jest.mock('axios');

describe('FireflyClient exportTransactionsCSV', () => {
  let mockAxiosInstance: jest.Mocked<AxiosInstance>;
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  beforeEach(() => {
    mockAxiosInstance = {
      get: jest.fn(),
      interceptors: {
        response: {
          use: jest.fn(),
          eject: jest.fn(),
        },
      },
      defaults: {},
    } as unknown as jest.Mocked<AxiosInstance>;

    mockedAxios.create.mockReturnValue(mockAxiosInstance);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('requests CSV export with correct parameters and returns CSV data', async () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');
    const csvData = 'date,description,amount\n2024-01-01,Sample,100';

    mockAxiosInstance.get.mockResolvedValue({ data: csvData } as any);

    const client = new FireflyClient({
      baseUrl: 'http://example.com',
      apiToken: 'token',
    });

    const result = await client.exportTransactionsCSV(startDate, endDate);

    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/data/export/transactions', {
      params: {
        start_date: '2024-01-01',
        end_date: '2024-01-31',
      },
      responseType: 'text',
    });
    expect(result).toBe(csvData);
  });

  it('propagates errors when export fails', async () => {
    const error = new Error('Export failed');
    mockAxiosInstance.get.mockRejectedValue(error);

    const client = new FireflyClient({ apiToken: 'token' });

    await expect(
      client.exportTransactionsCSV(new Date('2024-01-01'), new Date('2024-01-02'))
    ).rejects.toThrow('Export failed');
  });
});
