import * as cdk from 'aws-cdk-lib';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class TestStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const budget = new budgets.CfnBudget(this, 'MyBudget', {
      budget: { budgetType: 'COST', timeUnit: 'MONTHLY', budgetLimit: { amount: 1, unit: 'USD' } }
    });

    const role = new iam.Role(this, 'MyRole', { assumedBy: new iam.ServicePrincipal('budgets.amazonaws.com') });
    const targetRole = new iam.Role(this, 'TargetRole', { assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com') });

    new budgets.CfnBudgetsAction(this, 'Action', {
      actionType: 'APPLY_IAM_POLICY',
      actionThreshold: { type: 'PERCENTAGE', value: 100 },
      budgetName: budget.ref,
      definition: {
        iamActionDefinition: { policyArn: 'arn:aws:iam::aws:policy/AdministratorAccess', roles: [targetRole.roleName] }
      },
      executionRoleArn: role.roleArn,
      notificationType: 'ACTUAL',
      subscribers: [{ address: 'test@example.com', type: 'EMAIL' }],
      approvalModel: 'AUTOMATIC'
    });
  }
}
const app = new cdk.App();
new TestStack(app, 'TestStack');
