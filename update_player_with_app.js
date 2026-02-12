// update_player_with_app.js
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// 1️⃣ Initialize DynamoDB client
const client = new DynamoDBClient({ region: "us-east-1" });
const ddb = DynamoDBDocumentClient.from(client);

// 2️⃣ Configuration
const TABLE_NAME = "player.dev.bvcloud.link";
const RECORDS_TO_PROCESS = 10; // Constant variable - change this to process more records
const DRY_RUN = false; // Set to false to actually update DynamoDB
const APP_CHOICE = 2; // Set to 1 for FRESH JUICE - DCX, or 2 for FRESH JUICE - Detect App

// 3️⃣ Available apps to add
const APP_CHOICES = {
  1: {
    appId: "b7167b23-8b61-451a-9561-4b9521b268c8",
    appName: "FRESH JUICE - DCX",
    app_status: "running",
    bundleId: "com.eti.MediaBrowser",
    installation_date: "Wed May 14 2025 23:32:46 GMT+0000 (Coordinated Universal Time)",
    installation_status: "installed",
    isLatestVersion: true,
    license_status: "licensed",
    size: 34432,
    subscription_status: "active",
    uptime: 0,
    product_code: "DTA-05-03",
    version: "5.0.8"
  },
  2: {
    appId: "d8167b23-8b61-451a-9561-4b9521b26821",
    appName: "FRESH JUICE - Detect App",
    app_status: "running",
    bundleId: "com.eti.Heartbeat",
    installation_date: "Wed May 14 2025 23:32:46 GMT+0000 (Coordinated Universal Time)",
    installation_status: "installed",
    isLatestVersion: true,
    license_status: "licensed",
    size: 34432,
    subscription_status: "active",
    uptime: 0,
    product_code: "DTA-05-03",
    version: "1.0.1"
  }
};

// Select the app to add based on APP_CHOICE
if (!APP_CHOICES[APP_CHOICE]) {
  console.error(`❌ Invalid APP_CHOICE: ${APP_CHOICE}. Must be 1 or 2`);
  process.exit(1);
}

const NEW_APP = APP_CHOICES[APP_CHOICE];
const APP_ID_TO_FIND = NEW_APP.appId;
const APP_IDS_TO_SKIP = ["b7167b23-8b61-451a-9561-4b9521b268c8", "d8167b23-8b61-451a-9561-4b9521b26821"];

// 4️⃣ Logging
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logsDir = path.join(__dirname, "logs");

// Create logs folder if it doesn't exist
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFile = path.join(logsDir, `update_log_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`);
const logs = [];

function log(message) {
  console.log(message);
  logs.push(message);
}

// 5️⃣ Function to scan all records and process them
async function processRecords() {
  let recordsProcessed = 0;
  let recordsToUpdate = [];
  let lastKey;

  try {
    log("🔍 Starting DRY-RUN: " + (DRY_RUN ? "YES (no updates will be made)" : "NO (updates WILL be made)"));
    log(`📋 Processing up to ${RECORDS_TO_PROCESS} records from ${TABLE_NAME}\n`);

    // Scan records
    const params = {
      TableName: TABLE_NAME
    };

    do {
      const data = await ddb.send(new ScanCommand({ ...params, ExclusiveStartKey: lastKey }));

      if (data.Items) {
        for (const item of data.Items) {
          if (recordsProcessed >= RECORDS_TO_PROCESS) {
            break;
          }

          recordsProcessed++;
          log(`\n--- Record ${recordsProcessed} ---`);
          log(`Login: ${item.login}`);
          log(`Device: ${item.device_name || 'N/A'}`);

          let updateNeeded = false;
          let updateExpression = "";
          let updateAction = "";
          let expressionAttributeValues = {};

          // Check if applications field exists
          if (item.applications && Array.isArray(item.applications)) {
            log(`✓ Applications field exists (${item.applications.length} app(s))`);

            // Check if ANY of the skip appIds already exist
            const skipAppExists = item.applications.some(app => APP_IDS_TO_SKIP.includes(app.appId));

            if (skipAppExists) {
              log(`✓ Skip condition met (one of the appIds exists) - NO UPDATE NEEDED`);
            } else {
              log(`✗ Skip condition NOT met - WILL ADD NEW APP`);
              updateNeeded = true;
              updateAction = "ADD_TO_EXISTING_LIST";
              updateExpression = "SET applications = list_append(applications, :newApp)";
              expressionAttributeValues = {
                ":newApp": [NEW_APP]
              };
            }
          } else {
            log(`✗ Applications field DOES NOT EXIST - WILL CREATE NEW LIST WITH APP`);
            updateNeeded = true;
            updateAction = "CREATE_NEW_APPLICATIONS";
            updateExpression = "SET applications = :newAppList";
            expressionAttributeValues = {
              ":newAppList": [NEW_APP]
            };
          }

          if (updateNeeded) {
            recordsToUpdate.push({
              login: item.login,
              device_name: item.device_name,
              action: updateAction,
              updateExpression: updateExpression,
              expressionAttributeValues: expressionAttributeValues
            });
          }
        }
      }

      lastKey = data.LastEvaluatedKey;

      if (recordsProcessed >= RECORDS_TO_PROCESS) {
        break;
      }
    } while (lastKey);

    // Summary
    log(`\n${"=".repeat(60)}`);
    log(`📊 SUMMARY`);
    log(`${"=".repeat(60)}`);
    log(`Total records processed: ${recordsProcessed}`);
    log(`Records requiring updates: ${recordsToUpdate.length}`);

    if (recordsToUpdate.length > 0) {
      log(`\n📝 Updates to be applied:`);
      recordsToUpdate.forEach((update, index) => {
        log(`\n${index + 1}. Login: ${update.login}`);
        log(`   Device: ${update.device_name}`);
        log(`   Action: ${update.action}`);
      });

      // If not dry-run, actually apply updates
      if (!DRY_RUN) {
        log(`\n⚙️  Applying updates...`);

        for (const update of recordsToUpdate) {
          try {
            await ddb.send(new UpdateCommand({
              TableName: TABLE_NAME,
              Key: { login: update.login },
              UpdateExpression: update.updateExpression,
              ExpressionAttributeValues: update.expressionAttributeValues
            }));
            log(`✅ Updated: ${update.login}`);
          } catch (err) {
            log(`❌ Failed to update ${update.login}: ${err.message}`);
            throw err; // Stop on error as per requirement
          }
        }
      }
    } else {
      log(`\nℹ️  No updates needed for any of the ${recordsProcessed} processed record(s)`);
    }

    log(`\n🔒 DRY-RUN MODE: ${DRY_RUN ? "✓ No actual updates were made" : "✗ Updates WERE applied"}`);

    // Write log to file
    fs.writeFileSync(logFile, logs.join("\n"));
    log(`\n✅ Log written to ${logFile}`);

  } catch (err) {
    log(`\n❌ ERROR: ${err.message}`);
    log(`Stack: ${err.stack}`);
    fs.writeFileSync(logFile, logs.join("\n"));
    process.exit(1);
  }
}

// 6️⃣ Run it
processRecords();
