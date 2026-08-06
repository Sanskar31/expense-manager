import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { createDatabase } from './constructs/database';
import { createApi } from './constructs/api';
import { createUi } from './constructs/ui';
import { createObservability } from './constructs/observability';

const CONFIG = {
  rateLimits: {
    burst: 15,
    rate: 10,
  },
  budget: {
    amount: 1,
    limitUnit: 'USD',
    threshold: 100, // percentage
  },
  emails: {
    alert: 'sanskaragarwal05+aws@gmail.com',
    budgetAlert: 'sanskaragarwal05@gmail.com',
  },
  alarms: {
    api5xxThreshold: 0,
    apiLatencyThreshold: 2000,
    lambdaErrorThreshold: 0,
    lambdaThrottleThreshold: 0,
    lambdaDurationThreshold: 3000,
    ddbReadThrottleThreshold: 5,
    ddbWriteThrottleThreshold: 5,
    cf5xxThreshold: 1,
  }
};

export class BackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. Database
    const { table } = createDatabase(this);

    // 2. API & Backend Lambdas
    const { httpApi, listTransactionsLambda, killSwitchLambda, allApiFunctions } = createApi(this, {
      table,
      config: CONFIG,
      // cloudfrontDomain will be left undefined to allow '*' for initial API creation, 
      // or we can hardcode the known prod domain if we want strict CORS immediately:
      cloudfrontDomain: 'dzi0kxfaslc0l.cloudfront.net',
    });

    // 3. UI (CloudFront & S3)
    const { distribution } = createUi(this, httpApi);

    // 4. Observability & Security (Budgets, Alarms)
    createObservability(this, {
      httpApi,
      table,
      distribution,
      listTransactionsLambda,
      killSwitchLambda,
      allApiFunctions,
      config: CONFIG,
    });
  }
}
