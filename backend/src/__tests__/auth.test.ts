import { handler } from '../auth/login';
import { db } from '../shared/db';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import * as bcrypt from 'bcryptjs';
import { mockClient } from 'aws-sdk-client-mock';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

const ddbMock = mockClient(db as any);

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
}));

describe('Login Lambda', () => {
  beforeEach(() => {
    ddbMock.reset();
    jest.clearAllMocks();
  });

  const createEvent = (body: object): APIGatewayProxyEventV2 => ({
    body: JSON.stringify(body),
    headers: {},
    isBase64Encoded: false,
    rawPath: '/login',
    rawQueryString: '',
    requestContext: {} as any,
    routeKey: 'POST /login',
    version: '2.0',
  });

  it('should return 400 if mobileNumber or password is missing', async () => {
    const event = createEvent({ mobileNumber: '123' });
    const response = await handler(event, {} as any, {} as any) as any;
    
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({ message: 'Mobile number and password required' });
  });

  it('should return 401 if user not found', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    
    const event = createEvent({ mobileNumber: '1234567890', password: 'password123' });
    const response = await handler(event, {} as any, {} as any) as any;
    
    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body)).toEqual({ message: 'Invalid credentials' });
  });

  it('should return 401 if password does not match', async () => {
    ddbMock.on(GetCommand).resolves({ 
      Item: { PK: 'USER#1234567890', SK: 'METADATA', passwordHash: 'hash' } 
    });
    
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    
    const event = createEvent({ mobileNumber: '1234567890', password: 'wrongpassword' });
    const response = await handler(event, {} as any, {} as any) as any;
    
    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body)).toEqual({ message: 'Invalid credentials' });
  });

  it('should return 200 and a token cookie if credentials are valid', async () => {
    ddbMock.on(GetCommand).resolves({ 
      Item: { PK: 'USER#1234567890', SK: 'METADATA', passwordHash: 'hash', name: 'Test User' } 
    });
    
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    
    const event = createEvent({ mobileNumber: '1234567890', password: 'correctpassword' });
    const response = await handler(event, {} as any, {} as any) as any;
    
    expect(response.statusCode).toBe(200);
    expect(response.headers?.['Set-Cookie']).toMatch(/^token=.*?HttpOnly;/);
    expect(JSON.parse(response.body)).toEqual({ 
      message: 'Login successful', 
      user: { mobileNumber: '1234567890', name: 'Test User' } 
    });
  });
});
