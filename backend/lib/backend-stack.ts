import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwv2_integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as cw_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as path from 'path';

export class BackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const table = new dynamodb.Table(this, 'ExpenseTable', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const jwtSecret = process.env.JWT_SECRET || 'development_secret';

    const lambdaProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: {
        TABLE_NAME: table.tableName,
        JWT_SECRET: jwtSecret,
      },
      bundling: {
        minify: true,
        nodeModules: ['bcryptjs'],
      },
      timeout: cdk.Duration.seconds(15),
      memorySize: 1024,
    };

    const registerLambda = new nodejs.NodejsFunction(this, 'RegisterLambda', {
      entry: path.join(__dirname, '../src/auth/register.ts'),
      ...lambdaProps,
    });
    table.grantReadWriteData(registerLambda);

    const loginLambda = new nodejs.NodejsFunction(this, 'LoginLambda', {
      entry: path.join(__dirname, '../src/auth/login.ts'),
      ...lambdaProps,
    });
    table.grantReadWriteData(loginLambda);

    const getCategoriesLambda = new nodejs.NodejsFunction(this, 'GetCategoriesLambda', {
      entry: path.join(__dirname, '../src/categories/get.ts'),
      ...lambdaProps,
    });
    table.grantReadData(getCategoriesLambda);

    const updateCategoryLambda = new nodejs.NodejsFunction(this, 'UpdateCategoryLambda', {
      entry: path.join(__dirname, '../src/categories/update.ts'),
      ...lambdaProps,
    });
    table.grantReadWriteData(updateCategoryLambda);

    const deleteCategoryLambda = new nodejs.NodejsFunction(this, 'DeleteCategoryLambda', {
      entry: path.join(__dirname, '../src/categories/delete.ts'),
      ...lambdaProps,
    });
    table.grantReadWriteData(deleteCategoryLambda);

    const createTransactionLambda = new nodejs.NodejsFunction(this, 'CreateTransactionLambda', {
      entry: path.join(__dirname, '../src/transactions/create.ts'),
      ...lambdaProps,
    });
    table.grantReadWriteData(createTransactionLambda);

    const listTransactionsLambda = new nodejs.NodejsFunction(this, 'ListTransactionsLambda', {
      entry: path.join(__dirname, '../src/transactions/list.ts'),
      ...lambdaProps,
    });
    table.grantReadData(listTransactionsLambda);

    const deleteTransactionLambda = new nodejs.NodejsFunction(this, 'DeleteTransactionLambda', {
      entry: path.join(__dirname, '../src/transactions/delete.ts'),
      ...lambdaProps,
    });
    table.grantReadWriteData(deleteTransactionLambda);

    const httpApi = new apigwv2.HttpApi(this, 'ExpenseApi', {
      corsPreflight: {
        allowHeaders: ['Content-Type', 'Authorization'],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.DELETE,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ['*'],
      },
    });

    const defaultStage = httpApi.defaultStage?.node.defaultChild as apigwv2.CfnStage;
    if (defaultStage) {
      defaultStage.defaultRouteSettings = {
        throttlingBurstLimit: 100,
        throttlingRateLimit: 50,
      };
    }

    const logoutLambda = new nodejs.NodejsFunction(this, 'LogoutLambda', {
      entry: path.join(__dirname, '../src/auth/logout.ts'),
      ...lambdaProps,
    });

    httpApi.addRoutes({
      path: '/api/auth/register',
      methods: [apigwv2.HttpMethod.POST],
      integration: new apigwv2_integrations.HttpLambdaIntegration('RegisterIntegration', registerLambda),
    });

    httpApi.addRoutes({
      path: '/api/auth/login',
      methods: [apigwv2.HttpMethod.POST],
      integration: new apigwv2_integrations.HttpLambdaIntegration('LoginIntegration', loginLambda),
    });

    httpApi.addRoutes({
      path: '/api/auth/logout',
      methods: [apigwv2.HttpMethod.POST],
      integration: new apigwv2_integrations.HttpLambdaIntegration('LogoutIntegration', logoutLambda),
    });

    httpApi.addRoutes({
      path: '/api/categories',
      methods: [apigwv2.HttpMethod.GET],
      integration: new apigwv2_integrations.HttpLambdaIntegration('GetCatIntegration', getCategoriesLambda),
    });

    httpApi.addRoutes({
      path: '/api/categories',
      methods: [apigwv2.HttpMethod.POST],
      integration: new apigwv2_integrations.HttpLambdaIntegration('UpdateCatIntegration', updateCategoryLambda),
    });

    httpApi.addRoutes({
      path: '/api/categories',
      methods: [apigwv2.HttpMethod.DELETE],
      integration: new apigwv2_integrations.HttpLambdaIntegration('DeleteCatIntegration', deleteCategoryLambda),
    });

    httpApi.addRoutes({
      path: '/api/transactions',
      methods: [apigwv2.HttpMethod.POST],
      integration: new apigwv2_integrations.HttpLambdaIntegration('CreateTxIntegration', createTransactionLambda),
    });

    httpApi.addRoutes({
      path: '/api/transactions',
      methods: [apigwv2.HttpMethod.GET],
      integration: new apigwv2_integrations.HttpLambdaIntegration('ListTxIntegration', listTransactionsLambda),
    });

    httpApi.addRoutes({
      path: '/api/transactions',
      methods: [apigwv2.HttpMethod.DELETE],
      integration: new apigwv2_integrations.HttpLambdaIntegration('DeleteTxIntegration', deleteTransactionLambda),
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: httpApi.apiEndpoint,
    });

    // Frontend Hosting
    const websiteBucket = new s3.Bucket(this, 'PocketLogWebsiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    
    // Check if S3BucketOrigin exists on origins, otherwise fallback to S3Origin
    const origin = (origins as any).S3BucketOrigin 
      ? (origins as any).S3BucketOrigin.withOriginAccessControl(websiteBucket) 
      : new (origins as any).S3Origin(websiteBucket);

    const distribution = new cloudfront.Distribution(this, 'PocketLogDistribution', {
      defaultBehavior: {
        origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    const apiDomain = cdk.Fn.select(1, cdk.Fn.split('://', httpApi.apiEndpoint));
    const apiOrigin = new origins.HttpOrigin(apiDomain);
    
    distribution.addBehavior('/api/*', apiOrigin, {
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
    });

    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../../frontend/dist'))],
      destinationBucket: websiteBucket,
      distribution,
      distributionPaths: ['/*'],
    });

    new cdk.CfnOutput(this, 'WebsiteUrl', {
      value: distribution.distributionDomainName,
    });

    // --- OBSERVABILITY (CloudWatch Alarms & SNS) ---

    // 1. SNS Topic
    const alertTopic = new sns.Topic(this, 'PocketLogAlertsTopic', {
      topicName: 'PocketLog-Alerts',
    });
    alertTopic.addSubscription(new subscriptions.EmailSubscription('sanskaragarwal05@gmail.com'));
    
    const alarmAction = new cw_actions.SnsAction(alertTopic);

    // 2. API Gateway Alarms
    const api5xxAlarm = new cloudwatch.Alarm(this, 'Api5xxAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '5XXError',
        dimensionsMap: { ApiId: httpApi.httpApiId },
        statistic: 'sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 0,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'API Gateway 5XX Error Rate > 0',
    });
    api5xxAlarm.addAlarmAction(alarmAction);

    const apiLatencyAlarm = new cloudwatch.Alarm(this, 'ApiLatencyAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: 'Latency',
        dimensionsMap: { ApiId: httpApi.httpApiId },
        statistic: 'p95',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 2000,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'API Gateway P95 Latency > 2000ms',
    });
    apiLatencyAlarm.addAlarmAction(alarmAction);

    // 3. Lambda Alarms (targeting listTransactionsLambda as the critical function)
    const lambdaErrorsAlarm = new cloudwatch.Alarm(this, 'LambdaErrorsAlarm', {
      metric: listTransactionsLambda.metricErrors({
        statistic: 'sum',
        period: cdk.Duration.minutes(1),
      }),
      threshold: 0,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'Lambda Invocation Errors > 0',
    });
    lambdaErrorsAlarm.addAlarmAction(alarmAction);

    const lambdaThrottlesAlarm = new cloudwatch.Alarm(this, 'LambdaThrottlesAlarm', {
      metric: listTransactionsLambda.metricThrottles({
        statistic: 'sum',
        period: cdk.Duration.minutes(1),
      }),
      threshold: 0,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'Lambda Function Throttling > 0',
    });
    lambdaThrottlesAlarm.addAlarmAction(alarmAction);

    const lambdaDurationAlarm = new cloudwatch.Alarm(this, 'LambdaDurationAlarm', {
      metric: listTransactionsLambda.metricDuration({
        statistic: 'p90',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 3000,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'Lambda Duration P90 > 3000ms',
    });
    lambdaDurationAlarm.addAlarmAction(alarmAction);

    // 4. DynamoDB Alarms
    const ddbReadThrottleAlarm = new cloudwatch.Alarm(this, 'DdbReadThrottleAlarm', {
      metric: table.metric('ReadThrottleEvents', {
        statistic: 'sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 5,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'DynamoDB Read Throttle Events > 5',
    });
    ddbReadThrottleAlarm.addAlarmAction(alarmAction);

    const ddbWriteThrottleAlarm = new cloudwatch.Alarm(this, 'DdbWriteThrottleAlarm', {
      metric: table.metric('WriteThrottleEvents', {
        statistic: 'sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 5,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'DynamoDB Write Throttle Events > 5',
    });
    ddbWriteThrottleAlarm.addAlarmAction(alarmAction);

    // 5. CloudFront Alarms
    const cf5xxAlarm = new cloudwatch.Alarm(this, 'Cf5xxAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/CloudFront',
        metricName: '5xxErrorRate',
        dimensionsMap: {
          DistributionId: distribution.distributionId,
          Region: 'Global',
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'CloudFront 5XX Error Rate > 1%',
    });
    cf5xxAlarm.addAlarmAction(alarmAction);
  }
}
