import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwv2_integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';

interface ApiProps {
  table: dynamodb.Table;
  config: any;
  cloudfrontDomain?: string; // We can pass the domain after creating the UI construct for tight CORS
}

export function createApi(stack: cdk.Stack, props: ApiProps) {
  const { table, config, cloudfrontDomain } = props;

  const lambdaProps = {
    runtime: lambda.Runtime.NODEJS_22_X,
    projectRoot: path.join(__dirname, '../../../backend'),
    depsLockFilePath: path.join(__dirname, '../../../backend/package-lock.json'),
    environment: {
      TABLE_NAME: table.tableName,
      // Using CDK to resolve SSM parameters at deploy-time.
      // If they don't exist, this will throw a synth error, enforcing secure secret management.
      JWT_SECRET: cdk.aws_ssm.StringParameter.valueForStringParameter(stack, '/expense-manager/jwt-secret'),
      GEMINI_API_KEY: cdk.aws_ssm.StringParameter.valueForStringParameter(stack, '/expense-manager/gemini-api-key'),
    },
    bundling: {
      minify: true,
      nodeModules: ['bcryptjs'],
    },
    timeout: cdk.Duration.seconds(29),
    memorySize: 1024,
  };

  const allowedOrigins = cloudfrontDomain 
    ? [`https://${cloudfrontDomain}`, 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'] 
    : ['*'];

  const httpApi = new apigwv2.HttpApi(stack, 'ExpenseApi', {
    corsPreflight: {
      allowHeaders: ['Content-Type', 'Authorization', 'Cookie'],
      allowMethods: [
        apigwv2.CorsHttpMethod.GET,
        apigwv2.CorsHttpMethod.POST,
        apigwv2.CorsHttpMethod.PUT,
        apigwv2.CorsHttpMethod.DELETE,
        apigwv2.CorsHttpMethod.OPTIONS,
      ],
      allowOrigins: allowedOrigins,
      allowCredentials: true,
    },
  });

  const defaultStage = httpApi.defaultStage?.node.defaultChild as apigwv2.CfnStage;
  if (defaultStage) {
    defaultStage.defaultRouteSettings = {
      throttlingBurstLimit: config.rateLimits.burst,
      throttlingRateLimit: config.rateLimits.rate,
    };
  }

  const allApiFunctions: nodejs.NodejsFunction[] = [];

  const createApiRoute = (
    id: string,
    entryFile: string,
    routePath: string,
    method: apigwv2.HttpMethod,
    tablePermission: 'read' | 'write' | 'none' = 'none'
  ) => {
    const fn = new nodejs.NodejsFunction(stack, id, {
      entry: path.join(__dirname, `../../../backend/src/${entryFile}`),
      ...lambdaProps,
    });
    allApiFunctions.push(fn);

    if (tablePermission === 'read') table.grantReadData(fn);
    if (tablePermission === 'write') table.grantReadWriteData(fn);

    httpApi.addRoutes({
      path: routePath,
      methods: [method],
      integration: new apigwv2_integrations.HttpLambdaIntegration(`${id}Integration`, fn),
    });

    return fn;
  };

  createApiRoute('RegisterLambda', 'auth/register.ts', '/api/auth/register', apigwv2.HttpMethod.POST, 'write');
  createApiRoute('LoginLambda', 'auth/login.ts', '/api/auth/login', apigwv2.HttpMethod.POST, 'write');
  createApiRoute('LogoutLambda', 'auth/logout.ts', '/api/auth/logout', apigwv2.HttpMethod.POST, 'none');
  
  createApiRoute('GetCategoriesLambda', 'categories/get.ts', '/api/categories', apigwv2.HttpMethod.GET, 'read');
  createApiRoute('UpdateCategoryLambda', 'categories/update.ts', '/api/categories', apigwv2.HttpMethod.POST, 'write');
  createApiRoute('DeleteCategoryLambda', 'categories/delete.ts', '/api/categories', apigwv2.HttpMethod.DELETE, 'write');

  createApiRoute('CreateTransactionLambda', 'transactions/create.ts', '/api/transactions', apigwv2.HttpMethod.POST, 'write');
  const listTransactionsLambda = createApiRoute('ListTransactionsLambda', 'transactions/list.ts', '/api/transactions', apigwv2.HttpMethod.GET, 'read');
  createApiRoute('DeleteTransactionLambda', 'transactions/delete.ts', '/api/transactions', apigwv2.HttpMethod.DELETE, 'write');

  createApiRoute('AdminUsersLambda', 'admin/users.ts', '/api/admin/users', apigwv2.HttpMethod.GET, 'read');

  const aiQueryQueueDlq = new sqs.Queue(stack, 'AiQueryQueueDlq', {
    retentionPeriod: cdk.Duration.days(14),
  });

  const aiQueryQueue = new sqs.Queue(stack, 'AiQueryQueue', {
    visibilityTimeout: cdk.Duration.minutes(5),
    deadLetterQueue: {
      queue: aiQueryQueueDlq,
      maxReceiveCount: 3,
    }
  });

  const queryInitLambda = createApiRoute('QueryInitLambda', 'ai/queryInit.ts', '/api/ai/query', apigwv2.HttpMethod.POST, 'write');
  queryInitLambda.addEnvironment('QUEUE_URL', aiQueryQueue.queueUrl);
  aiQueryQueue.grantSendMessages(queryInitLambda);

  createApiRoute('QueryStatusLambda', 'ai/queryStatus.ts', '/api/ai/status', apigwv2.HttpMethod.GET, 'read');
  createApiRoute('AiChatHistoryLambda', 'ai/chatHistory.ts', '/api/ai/history', apigwv2.HttpMethod.ANY, 'write');

  const queryWorkerLambda = new nodejs.NodejsFunction(stack, 'QueryWorkerLambda', {
    entry: path.join(__dirname, '../../../backend/src/ai/queryWorker.ts'),
    ...lambdaProps,
    timeout: cdk.Duration.minutes(5),
  });
  table.grantReadWriteData(queryWorkerLambda);
  queryWorkerLambda.addEventSource(new lambdaEventSources.SqsEventSource(aiQueryQueue, {
    batchSize: 1,
  }));
  allApiFunctions.push(queryWorkerLambda);

  const killSwitchLambda = new nodejs.NodejsFunction(stack, 'KillSwitchLambda', {
    entry: path.join(__dirname, '../../../backend/src/shared/kill-switch.ts'),
    ...lambdaProps,
    environment: {
      ...lambdaProps.environment,
      FUNCTION_NAMES: allApiFunctions.map(f => f.functionName).join(','),
    },
  });

  killSwitchLambda.addToRolePolicy(new iam.PolicyStatement({
    actions: ['lambda:PutFunctionConcurrency'],
    resources: ['*'],
  }));

  new cdk.CfnOutput(stack, 'ApiUrl', {
    value: httpApi.apiEndpoint,
  });

  return { httpApi, listTransactionsLambda, killSwitchLambda, allApiFunctions };
}
