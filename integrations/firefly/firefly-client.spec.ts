import axios, { AxiosInstance, AxiosResponse } from 'axios';
import FireflyClient from './firefly-client';

jest.mock('axios');

describe('FireflyClient exportTransactionsCSV', () => {
  let mockAxiosInstance: jest.Mocked<AxiosInstance>;
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  const createMockResponse = <T>(data: T): AxiosResponse<T> => ({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {},
  });

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

  it('initializes axios with configured base URL, headers, and timeout', () => {
    const client = new FireflyClient({
      baseUrl: 'https://firefly.example',
      apiToken: 'secure-token',
      apiVersion: 'v2',
      timeout: 10_000,
    });

    expect(mockedAxios.create).toHaveBeenCalledWith({
      baseURL: 'https://firefly.example/api/v2',
      timeout: 10_000,
      headers: {
        Authorization: 'Bearer secure-token',
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    // Use the instance to avoid unused variable lint complaints in stricter configs
    expect(client).toBeTruthy();
  });

  it('requests CSV export with correct parameters and returns CSV data', async () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');
    const csvData = 'date,description,amount\n2024-01-01,Sample,100';

    mockAxiosInstance.get.mockResolvedValue(createMockResponse(csvData));

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

  it('returns an empty string when the API responds with an empty CSV', async () => {
    const startDate = new Date('2024-02-01');
    const endDate = new Date('2024-02-15');
    mockAxiosInstance.get.mockResolvedValue(createMockResponse(''));

    const client = new FireflyClient({ apiToken: 'token' });
    const result = await client.exportTransactionsCSV(startDate, endDate);

    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/data/export/transactions', {
      params: {
        start_date: '2024-02-01',
        end_date: '2024-02-15',
      },
      responseType: 'text',
    });
    expect(result).toBe('');
  });

  it('handles identical start and end dates by passing a single-day range', async () => {
    const date = new Date('2024-03-10');
    mockAxiosInstance.get.mockResolvedValue(createMockResponse('csv'));

    const client = new FireflyClient({ apiToken: 'token' });
    await client.exportTransactionsCSV(date, date);

    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/data/export/transactions', {
      params: {
        start_date: '2024-03-10',
        end_date: '2024-03-10',
      },
      responseType: 'text',
    });
  });

  it('passes through boundary dates such as epoch and far future', async () => {
    const startDate = new Date(0);
    const endDate = new Date('9999-12-31');
    mockAxiosInstance.get.mockResolvedValue(createMockResponse('data'));

    const client = new FireflyClient({ apiToken: 'token' });
    await client.exportTransactionsCSV(startDate, endDate);

    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/data/export/transactions', {
      params: {
        start_date: '1970-01-01',
        end_date: '9999-12-31',
      },
      responseType: 'text',
    });
  });

  it('surfaces API errors for invalid date ranges', async () => {
    const startDate = new Date('2024-05-10');
    const endDate = new Date('2024-05-01');
    const error = Object.assign(new Error('Invalid range'), { response: { status: 400 } });
    mockAxiosInstance.get.mockRejectedValue(error);

    const client = new FireflyClient({ apiToken: 'token' });

    await expect(client.exportTransactionsCSV(startDate, endDate)).rejects.toThrow('Invalid range');
    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/data/export/transactions', {
      params: {
        start_date: '2024-05-10',
        end_date: '2024-05-01',
      },
      responseType: 'text',
    });
  });

  it.each([
    [new Error('Network timeout')],
    [Object.assign(new Error('Not Found'), { response: { status: 404 } })],
    [Object.assign(new Error('Server error'), { response: { status: 500 } })],
  ])('propagates specific error types (%s)', async (
    error: Error & { response?: { status: number } }
  ) => {
    mockAxiosInstance.get.mockRejectedValue(error);

    const client = new FireflyClient({ apiToken: 'token' });

    await expect(
      client.exportTransactionsCSV(new Date('2024-04-01'), new Date('2024-04-02'))
    ).rejects.toThrow(error.message);
  });
});
