import * as cdk from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';

const app = new cdk.App();
const stack = new cdk.Stack(app, 'TestStack');
const httpApi = new apigwv2.HttpApi(stack, 'TestApi');

const stage = httpApi.defaultStage?.node.defaultChild as apigwv2.CfnStage;
if (stage) {
  stage.defaultRouteSettings = {
    throttlingBurstLimit: 50,
    throttlingRateLimit: 100,
  };
}
console.log('Success');
