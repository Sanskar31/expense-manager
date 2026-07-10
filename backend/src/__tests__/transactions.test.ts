import { handler as createHandler } from '../transactions/create';
import { db } from '../shared/db';
import { PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import * as verifyTokenModule from '../auth/verifyToken';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

const ddbMock = mockClient(db as any);

jest.mock('../auth/verifyToken', () => ({
  verifyToken: jest.fn(),
}));

describe('Transactions API', () => {
  beforeEach(() => {
    ddbMock.reset();
    jest.clearAllMocks();
  });

  const createEvent = (body: object, cookies?: string[]): APIGatewayProxyEventV2 => ({
    body: JSON.stringify(body),
    cookies: cookies || [],
    headers: {},
    isBase64Encoded: false,
    rawPath: '/transactions',
    rawQueryString: '',
    requestContext: {} as any,
    routeKey: 'POST /transactions',
    version: '2.0',
  });

  it('should return 401 if unauthorized', async () => {
    (verifyTokenModule.verifyToken as jest.Mock).mockReturnValue(null);
    const event = createEvent({});
    const response = await createHandler(event, {} as any, {} as any) as any;
    
    expect(response.statusCode).toBe(401);
  });

  it('should return 400 if required fields are missing', async () => {
    (verifyTokenModule.verifyToken as jest.Mock).mockReturnValue('1234567890');
    
    // Missing amount and categoryId
    const event = createEvent({
      type: 'DEBIT',
      description: 'Test',
      timestamp: '2026-07-10T10:00:00Z'
    });
    
    const response = await createHandler(event, {} as any, {} as any) as any;
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toBe('Missing required fields');
  });

  it('should create a new transaction and return 201', async () => {
    (verifyTokenModule.verifyToken as jest.Mock).mockReturnValue('1234567890');
    
    ddbMock.on(PutCommand).resolves({});

    const event = createEvent({
      type: 'DEBIT',
      amount: 100,
      categoryId: 'Food',
      description: 'Test Dinner',
      timestamp: '2026-07-10T10:00:00Z',
      paymentMode: 'UPI'
    });

    const response = await createHandler(event, {} as any, {} as any) as any;
    expect(response.statusCode).toBe(201);
    
    const parsedBody = JSON.parse(response.body);
    expect(parsedBody).toMatchObject({
      PK: 'USER#1234567890',
      type: 'DEBIT',
      amount: 100,
      categoryId: 'Food',
      description: 'Test Dinner',
      paymentMode: 'UPI'
    });
    
    // Verify PutCommand was called
    expect(ddbMock.calls().length).toBe(1);
  });

  it('should delete original transaction when originalSK is provided', async () => {
    (verifyTokenModule.verifyToken as jest.Mock).mockReturnValue('1234567890');
    
    ddbMock.on(DeleteCommand).resolves({});
    ddbMock.on(PutCommand).resolves({});

    const event = createEvent({
      originalSK: 'TX#OLD',
      type: 'DEBIT',
      amount: 150,
      categoryId: 'Food',
      description: 'Updated Dinner',
      timestamp: '2026-07-10T10:00:00Z',
    });

    const response = await createHandler(event, {} as any, {} as any) as any;
    expect(response.statusCode).toBe(201);
    
    // Verify both Delete and Put were called
    expect(ddbMock.calls().length).toBe(2);
    expect(ddbMock.calls()[0].args[0].input).toMatchObject({
      Key: { PK: 'USER#1234567890', SK: 'TX#OLD' }
    });
  });
});
