import { handler } from '../ai/query';
import { db } from '../shared/db';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

const ddbMock = mockClient(db as any);

// Define a global mock that Jest can hoist
const mockSendMessage = jest.fn();

jest.mock('@google/genai', () => {
  return {
    GoogleGenAI: jest.fn().mockImplementation(() => ({
      chats: {
        create: jest.fn().mockReturnValue({
          sendMessage: (...args: any[]) => mockSendMessage(...args)
        })
      }
    })),
    Type: {
      OBJECT: 'OBJECT',
      STRING: 'STRING'
    }
  };
});

jest.mock('../auth/verifyToken', () => ({
  verifyToken: jest.fn().mockReturnValue({ mobileNumber: '+919999999999' }),
}));

describe('AI Query Lambda', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    ddbMock.reset();
    process.env = { ...originalEnv, GEMINI_API_KEY: 'test-key', JWT_SECRET: 'test-secret' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const createEvent = (body: object): APIGatewayProxyEventV2 => {
    return {
      body: JSON.stringify(body),
      headers: {},
      cookies: ['token=valid-token'],
      isBase64Encoded: false,
      rawPath: '/ai/query',
      rawQueryString: '',
      routeKey: 'POST /api/ai/query',
      version: '2.0',
      requestContext: {
        http: { method: 'POST', path: '/api/ai/query', protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'test' }
      }
    } as any;
  };

  it('should return 400 if message is missing', async () => {
    const event = createEvent({});
    const res = await handler(event, {} as any) as any;
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toHaveProperty('error', 'Message is required');
  });

  it('should process simple message successfully', async () => {
    mockSendMessage.mockResolvedValueOnce({
      text: JSON.stringify({ text: "Hello", chartData: [] })
    });

    const event = createEvent({ message: 'Hello' });
    const res = await handler(event, {} as any) as any;
    
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toHaveProperty('text', 'Hello');
    expect(mockSendMessage).toHaveBeenCalledWith({ message: 'Hello' });
  });

  it('should handle tool calls and fetch transactions', async () => {
    mockSendMessage.mockResolvedValueOnce({
      functionCalls: [{
        name: 'fetch_transactions',
        args: { month: '2026-07' }
      }]
    }).mockResolvedValueOnce({
      text: JSON.stringify({ text: "You spent 500", chartData: [] })
    });

    ddbMock.on(QueryCommand).resolves({
      Items: [{ timestamp: '2026-07-15', amount: 500, type: 'EXPENSE' }]
    });

    const event = createEvent({ message: 'How much did I spend in July?' });
    const res = await handler(event, {} as any) as any;
    
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toHaveProperty('text', 'You spent 500');
    expect(ddbMock.calls().length).toBe(1);
    expect(mockSendMessage).toHaveBeenCalledTimes(2);
  });

  it('should handle rate limit gracefully', async () => {
    mockSendMessage.mockRejectedValueOnce({ status: 429, message: 'Quota exceeded' });

    const event = createEvent({ message: 'Hello' });
    const res = await handler(event, {} as any) as any;
    
    expect(res.statusCode).toBe(429);
    expect(JSON.parse(res.body)).toHaveProperty('error', 'Rate limit exceeded for this model.');
  });
});
