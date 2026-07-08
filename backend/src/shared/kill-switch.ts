import { LambdaClient, PutFunctionConcurrencyCommand } from "@aws-sdk/client-lambda";

const lambdaClient = new LambdaClient({});

export const handler = async (event: any) => {
  console.log("KILL SWITCH ACTIVATED. RECEIVED SNS EVENT:", JSON.stringify(event, null, 2));

  const functionNamesStr = process.env.FUNCTION_NAMES;
  if (!functionNamesStr) {
    console.error("No FUNCTION_NAMES provided in environment.");
    return;
  }

  const functionNames = functionNamesStr.split(",");
  
  const promises = functionNames.map(async (funcName) => {
    try {
      console.log(`Setting concurrency to 0 for function: ${funcName}`);
      const command = new PutFunctionConcurrencyCommand({
        FunctionName: funcName,
        ReservedConcurrentExecutions: 0,
      });
      await lambdaClient.send(command);
      console.log(`Successfully shut down ${funcName}`);
    } catch (error) {
      console.error(`Failed to shut down ${funcName}:`, error);
    }
  });

  await Promise.all(promises);
  console.log("Kill switch execution completed.");
};
