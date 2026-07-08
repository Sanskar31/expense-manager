import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import * as crypto from 'crypto';

const client = new DynamoDBClient({ region: "us-east-1" });
const db = DynamoDBDocumentClient.from(client);
const TABLE_NAME = "BackendStack-ExpenseTableBAA136EA-V93TYW8W60Y6"; // Let's fetch actual table name later or via env var.

// Run via: TABLE_NAME=XYZ ts-node migrate.ts
const tableName = process.env.TABLE_NAME || TABLE_NAME;

async function runMigration() {
  console.log(`Starting migration on table: ${tableName}`);
  
  // 1. Scan all transactions (where SK begins with TX#)
  const txs: any[] = [];
  let lastEvaluatedKey: any = undefined;
  
  do {
    const res = await db.send(new ScanCommand({
      TableName: tableName,
      FilterExpression: "begins_with(SK, :skPrefix)",
      ExpressionAttributeValues: {
        ":skPrefix": "TX#"
      },
      ExclusiveStartKey: lastEvaluatedKey
    }));
    if (res.Items) {
      txs.push(...res.Items);
    }
    lastEvaluatedKey = res.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  
  console.log(`Found ${txs.length} transactions.`);
  
  // 2. Extract unique category strings per user
  // Map of PK (user) -> map of categoryName -> categoryId
  const userCategoryMap = new Map<string, Map<string, string>>();
  // Map of PK (user) -> map of categoryId -> CategoryItem
  const userNewCategories = new Map<string, Map<string, any>>();
  
  for (const tx of txs) {
    const pk = tx.PK;
    const catName = tx.categoryId; // Previously stored as a string
    
    // Ignore if it looks like a UUID already
    if (catName && catName.length === 36 && catName.split('-').length === 5) {
      continue;
    }
    
    if (!userCategoryMap.has(pk)) {
      userCategoryMap.set(pk, new Map());
      userNewCategories.set(pk, new Map());
    }
    
    const catMap = userCategoryMap.get(pk)!;
    if (catName && !catMap.has(catName)) {
      const catId = crypto.randomUUID();
      catMap.set(catName, catId);
      
      userNewCategories.get(pk)!.set(catId, {
        PK: pk,
        SK: `CAT#${catId}`,
        name: catName,
        icon: "💳", // default icon
        subcategories: {},
        isArchived: false,
        createdAt: new Date().toISOString()
      });
    }
  }
  
  console.log(`Extracted categories for ${userCategoryMap.size} users.`);
  
  // WAIT FOR APPROVAL
  console.log("\n--- PREVIEW ---");
  let newCatCount = 0;
  for (const [pk, categories] of userNewCategories.entries()) {
    console.log(`User ${pk} will get ${categories.size} new categories.`);
    for (const [id, cat] of categories.entries()) {
      console.log(`  - [${id}] ${cat.name}`);
      newCatCount++;
    }
  }
  console.log(`Total transactions to migrate: ${txs.length}`);
  console.log(`Total new categories to insert: ${newCatCount}`);
  
  if (process.env.EXECUTE !== "true") {
    console.log("\nDRY RUN COMPLETE. Run with EXECUTE=true to apply changes.");
    return;
  }
  
  console.log("\nEXECUTING MIGRATION...");
  
  // 3. Write new CAT# items
  for (const [pk, categories] of userNewCategories.entries()) {
    for (const [id, cat] of categories.entries()) {
      await db.send(new PutCommand({
        TableName: tableName,
        Item: cat
      }));
      console.log(`Created category ${id} for ${pk}`);
    }
  }
  
  // 4. Update TX# items
  let count = 0;
  for (const tx of txs) {
    const pk = tx.PK;
    const oldCatName = tx.categoryId;
    const newCatId = userCategoryMap.get(pk)?.get(oldCatName);
    
    if (newCatId) {
      // Reconstruct transaction with new schema
      const updatedTx = {
        ...tx,
        categoryId: newCatId,
        subcategoryId: tx.subCategory || "",
        description: tx.note || ""
      };
      
      delete updatedTx.subCategory;
      delete updatedTx.note;
      
      await db.send(new PutCommand({
        TableName: tableName,
        Item: updatedTx
      }));
      count++;
      if (count % 10 === 0) console.log(`Migrated ${count}/${txs.length} transactions...`);
    } else if (tx.note !== undefined || tx.subCategory !== undefined) {
      // If it already had a UUID category but still uses old schema fields
      const updatedTx = {
        ...tx,
        subcategoryId: tx.subCategory || tx.subcategoryId || "",
        description: tx.note || tx.description || ""
      };
      delete updatedTx.subCategory;
      delete updatedTx.note;
      
      await db.send(new PutCommand({
        TableName: tableName,
        Item: updatedTx
      }));
      count++;
    }
  }
  
  console.log(`\nMigration completed successfully! Updated ${count} transactions.`);
}

runMigration().catch(console.error);
