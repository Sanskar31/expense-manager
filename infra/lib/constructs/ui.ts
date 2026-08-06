import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as path from 'path';

export function createUi(stack: cdk.Stack, httpApi: apigwv2.HttpApi) {
  const websiteBucket = new s3.Bucket(stack, 'PocketLogWebsiteBucket', {
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
    autoDeleteObjects: true,
  });
  
  const origin = (origins as any).S3BucketOrigin 
    ? (origins as any).S3BucketOrigin.withOriginAccessControl(websiteBucket) 
    : new (origins as any).S3Origin(websiteBucket);

  const distribution = new cloudfront.Distribution(stack, 'PocketLogDistribution', {
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

  new s3deploy.BucketDeployment(stack, 'DeployWebsite', {
    sources: [s3deploy.Source.asset(path.join(__dirname, '../../../frontend/dist'))],
    destinationBucket: websiteBucket,
    distribution,
    distributionPaths: ['/*'],
  });

  new cdk.CfnOutput(stack, 'WebsiteUrl', {
    value: distribution.distributionDomainName,
  });

  return { websiteBucket, distribution };
}
