import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cw_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as lambda from 'aws-cdk-lib/aws-lambda';

interface ObservabilityProps {
  httpApi: apigwv2.HttpApi;
  table: dynamodb.Table;
  distribution: cloudfront.Distribution;
  listTransactionsLambda: lambda.Function;
  killSwitchLambda: lambda.Function;
  allApiFunctions: lambda.Function[];
  config: any;
}

export function createObservability(stack: cdk.Stack, props: ObservabilityProps) {
  const { httpApi, table, distribution, listTransactionsLambda, killSwitchLambda, allApiFunctions, config } = props;

  const alertTopic = new sns.Topic(stack, 'PocketLogAlertsTopic', {
    topicName: 'PocketLog-Alerts',
  });
  alertTopic.addSubscription(new subscriptions.EmailSubscription(config.emails.alert));
  
  const killSwitchTopic = new sns.Topic(stack, 'PocketLogBudgetKillSwitchTopic', {
    topicName: 'PocketLog-BudgetKillSwitch',
  });
  killSwitchTopic.addSubscription(new subscriptions.LambdaSubscription(killSwitchLambda));
  
  killSwitchTopic.addToResourcePolicy(new iam.PolicyStatement({
    actions: ['sns:Publish'],
    principals: [new iam.ServicePrincipal('budgets.amazonaws.com')],
    resources: [killSwitchTopic.topicArn],
  }));

  const budget = new budgets.CfnBudget(stack, 'ZeroCostBudget', {
    budget: {
      budgetType: 'COST',
      timeUnit: 'MONTHLY',
      budgetLimit: {
        amount: config.budget.amount,
        unit: config.budget.limitUnit,
      },
    },
    notificationsWithSubscribers: [
      {
        notification: {
          notificationType: 'ACTUAL',
          comparisonOperator: 'GREATER_THAN',
          threshold: config.budget.threshold,
        },
        subscribers: [
          {
            subscriptionType: 'SNS',
            address: killSwitchTopic.topicArn,
          },
          {
            subscriptionType: 'EMAIL',
            address: config.emails.budgetAlert,
          }
        ],
      },
    ],
  });

  const budgetActionRole = new iam.Role(stack, 'BudgetActionRole', {
    assumedBy: new iam.ServicePrincipal('budgets.amazonaws.com'),
    managedPolicies: [
      iam.ManagedPolicy.fromAwsManagedPolicyName('AWSBudgetsActions_RolePolicyForResourceAdministrationWithSSM'),
    ],
  });

  const denyPolicy = new iam.ManagedPolicy(stack, 'DenyAllPolicy', {
    statements: [
      new iam.PolicyStatement({
        effect: iam.Effect.DENY,
        actions: ['*'],
        resources: ['*'],
      }),
    ],
  });

  budgetActionRole.addToPolicy(new iam.PolicyStatement({
    actions: ['iam:AttachRolePolicy', 'iam:AttachUserPolicy', 'iam:AttachGroupPolicy'],
    resources: ['*'],
  }));

  new budgets.CfnBudgetsAction(stack, 'BudgetNativeAction', {
    budgetName: budget.ref,
    actionType: 'APPLY_IAM_POLICY',
    actionThreshold: {
      type: 'PERCENTAGE',
      value: config.budget.threshold,
    },
    definition: {
      iamActionDefinition: {
        policyArn: denyPolicy.managedPolicyArn,
        roles: allApiFunctions.map(f => f.role!.roleName),
      },
    },
    executionRoleArn: budgetActionRole.roleArn,
    notificationType: 'ACTUAL',
    subscribers: [
      {
        address: config.emails.budgetAlert,
        type: 'EMAIL',
      },
    ],
    approvalModel: 'AUTOMATIC',
  });

  const alarmAction = new cw_actions.SnsAction(alertTopic);

  const api5xxAlarm = new cloudwatch.Alarm(stack, 'Api5xxAlarm', {
    metric: new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: '5XXError',
      dimensionsMap: { ApiId: httpApi.httpApiId },
      statistic: 'sum',
      period: cdk.Duration.minutes(5),
    }),
    threshold: config.alarms.api5xxThreshold,
    evaluationPeriods: 1,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    alarmDescription: 'API Gateway 5XX Error Rate > 0',
  });
  api5xxAlarm.addAlarmAction(alarmAction);

  const apiLatencyAlarm = new cloudwatch.Alarm(stack, 'ApiLatencyAlarm', {
    metric: new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: 'Latency',
      dimensionsMap: { ApiId: httpApi.httpApiId },
      statistic: 'p95',
      period: cdk.Duration.minutes(5),
    }),
    threshold: config.alarms.apiLatencyThreshold,
    evaluationPeriods: 1,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    alarmDescription: 'API Gateway P95 Latency > 2000ms',
  });
  apiLatencyAlarm.addAlarmAction(alarmAction);

  const lambdaErrorsAlarm = new cloudwatch.Alarm(stack, 'LambdaErrorsAlarm', {
    metric: listTransactionsLambda.metricErrors({
      statistic: 'sum',
      period: cdk.Duration.minutes(1),
    }),
    threshold: config.alarms.lambdaErrorThreshold,
    evaluationPeriods: 1,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    alarmDescription: 'Lambda Invocation Errors > 0',
  });
  lambdaErrorsAlarm.addAlarmAction(alarmAction);

  const lambdaThrottlesAlarm = new cloudwatch.Alarm(stack, 'LambdaThrottlesAlarm', {
    metric: listTransactionsLambda.metricThrottles({
      statistic: 'sum',
      period: cdk.Duration.minutes(1),
    }),
    threshold: config.alarms.lambdaThrottleThreshold,
    evaluationPeriods: 1,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    alarmDescription: 'Lambda Function Throttling > 0',
  });
  lambdaThrottlesAlarm.addAlarmAction(alarmAction);

  const lambdaDurationAlarm = new cloudwatch.Alarm(stack, 'LambdaDurationAlarm', {
    metric: listTransactionsLambda.metricDuration({
      statistic: 'p90',
      period: cdk.Duration.minutes(5),
    }),
    threshold: config.alarms.lambdaDurationThreshold,
    evaluationPeriods: 1,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    alarmDescription: 'Lambda Duration P90 > 3000ms',
  });
  lambdaDurationAlarm.addAlarmAction(alarmAction);

  const ddbReadThrottleAlarm = new cloudwatch.Alarm(stack, 'DdbReadThrottleAlarm', {
    metric: table.metric('ReadThrottleEvents', {
      statistic: 'sum',
      period: cdk.Duration.minutes(5),
    }),
    threshold: config.alarms.ddbReadThrottleThreshold,
    evaluationPeriods: 1,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    alarmDescription: 'DynamoDB Read Throttle Events > 5',
  });
  ddbReadThrottleAlarm.addAlarmAction(alarmAction);

  const ddbWriteThrottleAlarm = new cloudwatch.Alarm(stack, 'DdbWriteThrottleAlarm', {
    metric: table.metric('WriteThrottleEvents', {
      statistic: 'sum',
      period: cdk.Duration.minutes(5),
    }),
    threshold: config.alarms.ddbWriteThrottleThreshold,
    evaluationPeriods: 1,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    alarmDescription: 'DynamoDB Write Throttle Events > 5',
  });
  ddbWriteThrottleAlarm.addAlarmAction(alarmAction);

  const cf5xxAlarm = new cloudwatch.Alarm(stack, 'Cf5xxAlarm', {
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
    threshold: config.alarms.cf5xxThreshold,
    evaluationPeriods: 1,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    alarmDescription: 'CloudFront 5XX Error Rate > 1%',
  });
  cf5xxAlarm.addAlarmAction(alarmAction);
}
