import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as Backend from '../lib/backend-stack';

describe('Backend Stack', () => {
  let app: cdk.App;
  let stack: Backend.BackendStack;
  let template: Template;

  beforeAll(() => {
    app = new cdk.App();
    stack = new Backend.BackendStack(app, 'MyTestStack');
    template = Template.fromStack(stack);
  });

  it('Creates a DynamoDB table with correct configuration', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'PK', AttributeType: 'S' },
        { AttributeName: 'SK', AttributeType: 'S' }
      ],
      BillingMode: 'PAY_PER_REQUEST'
    });
  });

  it('Creates Lambda functions with NODEJS_22_X', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs22.x',
      Handler: 'index.handler'
    });
  });

  it('Creates a CloudFront Distribution', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        Enabled: true,
        DefaultCacheBehavior: {
          ViewerProtocolPolicy: 'redirect-to-https'
        }
      }
    });
  });

  it('Creates an S3 Bucket for website hosting', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true
      }
    });
  });

  it('Creates an API Gateway (HTTP API)', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
      ProtocolType: 'HTTP',
      CorsConfiguration: Match.anyValue()
    });
  });

  it('Creates AWS Budgets', () => {
    template.hasResourceProperties('AWS::Budgets::Budget', {
      Budget: {
        BudgetType: 'COST',
        TimeUnit: 'MONTHLY'
      }
    });
  });
});
