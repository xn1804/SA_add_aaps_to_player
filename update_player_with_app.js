// update_player_with_app.js
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// 1️⃣ Initialize DynamoDB client
const client = new DynamoDBClient({ region: "us-east-1" });
const ddb = DynamoDBDocumentClient.from(client);

// 2️⃣ Configuration
const PULSE_TABLE = "pulse.iofav.net"; // Source table for filtering devices
const PLAYER_TABLE = "player.iofav.net"; // Target table for updates
const RECORDS_TO_PROCESS = 999999; // Constant variable - change this to process more records
const DRY_RUN = true; // Set to false to actually update DynamoDB
const APP_CHOICE = 2; // Set to 1 for FRESH JUICE - DCX, or 2 for FRESH JUICE - Detect App

// OS Filtering Configuration
const FILTER_OS_ENABLED = true; // true = filter by OS, false = all devices
const OS_FILTER_VALUE = "microsoft"; // What to look for in os_name field (case-insensitive: Microsoft Windows)
const EXCLUDE_OS_VALUES = ["microsoft", "windows", "macos", "mac os", "tvos", "apple tvos"]; // OS types to exclude (case-insensitive) - only used when OS_FILTER_VALUE = "OTHER"

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

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logFile = path.join(logsDir, `update_log_${timestamp}.txt`);
const csvFile = path.join(logsDir, `devices_updated_${timestamp}.csv`);
const logs = [];
const csvData = [];

function log(message) {
  console.log(message);
  logs.push(message);
}

// Helper function to get mandator name (mandator_id is a NUMBER)
async function getMandatorName(mandatorId) {
  if (!mandatorId) return 'N/A';
  try {
    const result = await ddb.send(new GetCommand({
      TableName: "mandator.iofav.net",
      Key: { id: Number(mandatorId) }
    }));
    return result.Item?.name || 'N/A';
  } catch (err) {
    log(`  ⚠️  Could not fetch mandator: ${err.message}`);
    return 'N/A';
  }
}

// Helper function to get location name (location_id is a STRING)
async function getLocationName(locationId) {
  if (!locationId) return 'N/A';
  try {
    const result = await ddb.send(new GetCommand({
      TableName: "location.iofav.net",
      Key: { uuid: locationId }
    }));
    return result.Item?.name || 'N/A';
  } catch (err) {
    log(`  ⚠️  Could not fetch location: ${err.message}`);
    return 'N/A';
  }
}

// 5️⃣ Function to scan all records and process them
async function processRecords() {
  let recordsProcessed = 0;
  let recordsToUpdate = [];
  let recordsNotFoundInPlayer = 0;
  let lastKey;

  try {
    log("🔍 Starting DRY-RUN: " + (DRY_RUN ? "YES (no updates will be made)" : "NO (updates WILL be made)"));

    if (FILTER_OS_ENABLED) {
      if (OS_FILTER_VALUE === "OTHER") {
        log(`📋 Step 1: Scanning ${PULSE_TABLE} for devices EXCLUDING os_name: ${EXCLUDE_OS_VALUES.join(", ")}`);
      } else {
        log(`📋 Step 1: Scanning ${PULSE_TABLE} for devices where os_name contains "${OS_FILTER_VALUE}"`);
      }
    } else {
      log(`📋 Step 1: Scanning ${PULSE_TABLE} for ALL devices (OS filter disabled)`);
    }

    log(`📋 Step 2: Looking up corresponding records in ${PLAYER_TABLE}`);
    log(`📋 Step 3: Checking applications field and updating if needed`);
    log(`📋 Processing up to ${RECORDS_TO_PROCESS} records\n`);

    // Scan PULSE table - no DynamoDB filter, apply in code for case-insensitive matching
    const params = {
      TableName: PULSE_TABLE
    };

    do {
      const data = await ddb.send(new ScanCommand({ ...params, ExclusiveStartKey: lastKey }));

      if (data.Items) {
        for (const pulseItem of data.Items) {
          if (recordsProcessed >= RECORDS_TO_PROCESS) {
            break;
          }

          // Apply OS filter in code (case-insensitive)
          if (FILTER_OS_ENABLED) {
            const osName = (pulseItem.os_name || "").toLowerCase();

            if (OS_FILTER_VALUE === "OTHER") {
              // Exclude mode: skip if os_name contains any excluded value
              const shouldExclude = EXCLUDE_OS_VALUES.some(excludeValue =>
                osName.includes(excludeValue.toLowerCase())
              );
              if (shouldExclude) {
                continue; // Skip this device
              }
            } else {
              // Include mode: skip if os_name does NOT contain the filter value (case-insensitive)
              if (!osName.includes(OS_FILTER_VALUE.toLowerCase())) {
                continue; // Skip this device
              }
            }
          }

          recordsProcessed++;
          log(`\n--- Record ${recordsProcessed} ---`);
          log(`Login: ${pulseItem.login}`);
          log(`Device (from pulse): ${pulseItem.device_name || 'N/A'}`);
          log(`OS Name (from pulse): ${pulseItem.os_name || 'N/A'}`);

          // Fetch the corresponding record from PLAYER table
          let playerItem;
          try {
            const playerResult = await ddb.send(new GetCommand({
              TableName: PLAYER_TABLE,
              Key: { login: pulseItem.login }
            }));
            playerItem = playerResult.Item;
          } catch (err) {
            log(`❌ Error fetching from player table: ${err.message}`);
            continue;
          }

          if (!playerItem) {
            log(`⚠️  Login not found in ${PLAYER_TABLE} - SKIPPING`);
            recordsNotFoundInPlayer++;
            continue;
          }

          log(`✓ Found in player table`);

          let updateNeeded = false;
          let updateExpression = "";
          let updateAction = "";
          let expressionAttributeValues = {};

          // Check if applications field exists in PLAYER table
          if (playerItem.applications && Array.isArray(playerItem.applications)) {
            log(`✓ Applications field exists (${playerItem.applications.length} app(s))`);

            // Check if ANY of the skip appIds already exist
            const skipAppExists = playerItem.applications.some(app => APP_IDS_TO_SKIP.includes(app.appId));

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
            // Fetch mandator and location names from PLAYER table
            const mandatorName = await getMandatorName(playerItem.mandator_id);
            const locationName = await getLocationName(playerItem.location_id);

            log(`  Mandator: ${mandatorName}`);
            log(`  Location: ${locationName}`);

            recordsToUpdate.push({
              login: playerItem.login,
              device_name: playerItem.device_name || pulseItem.device_name || 'N/A',
              os_name: pulseItem.os_name || playerItem.os_name || 'N/A',
              os: pulseItem.os || playerItem.os || 'N/A',
              mandator_id: playerItem.mandator_id,
              location_id: playerItem.location_id,
              mandator_name: mandatorName,
              location_name: locationName,
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

    if (FILTER_OS_ENABLED) {
      if (OS_FILTER_VALUE === "OTHER") {
        log(`Total devices found in ${PULSE_TABLE} (excluding ${EXCLUDE_OS_VALUES.join(", ")}): ${recordsProcessed}`);
      } else {
        log(`Total devices found in ${PULSE_TABLE} (os_name contains "${OS_FILTER_VALUE}"): ${recordsProcessed}`);
      }
    } else {
      log(`Total devices found in ${PULSE_TABLE} (all devices): ${recordsProcessed}`);
    }

    log(`Records not found in ${PLAYER_TABLE}: ${recordsNotFoundInPlayer}`);
    log(`Records requiring updates in ${PLAYER_TABLE}: ${recordsToUpdate.length}`);

    if (recordsToUpdate.length > 0) {
      log(`\n📝 Updates to be applied:`);
      recordsToUpdate.forEach((update, index) => {
        log(`\n${index + 1}. Login: ${update.login}`);
        log(`   Device: ${update.device_name}`);
        log(`   Mandator: ${update.mandator_name}`);
        log(`   Location: ${update.location_name}`);
        log(`   Action: ${update.action}`);
      });

      // Sort by mandator name, then location name
      recordsToUpdate.sort((a, b) => {
        const mandatorCompare = a.mandator_name.localeCompare(b.mandator_name);
        if (mandatorCompare !== 0) return mandatorCompare;
        return a.location_name.localeCompare(b.location_name);
      });

      // Create CSV with mandator, location, and OS information (semicolon-delimited)
      const csvHeader = 'Login;Device_Name;OS_Name;OS;Mandator_Name;Location_Name;Action\n';
      const csvContent = recordsToUpdate.map(u =>
        `${u.login};${u.device_name};${u.os_name};${u.os};${u.mandator_name};${u.location_name};${u.action}`
      ).join('\n');
      fs.writeFileSync(csvFile, csvHeader + csvContent);
      log(`\n📄 CSV file created (semicolon-delimited): ${csvFile}`);

      // If not dry-run, actually apply updates
      if (!DRY_RUN) {
        log(`\n⚙️  Applying updates...`);

        for (const update of recordsToUpdate) {
          try {
            await ddb.send(new UpdateCommand({
              TableName: PLAYER_TABLE,
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
