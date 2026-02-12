// scan_device_with_bgm.js
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import fs from "fs";

// 1️⃣ Initialize DynamoDB client
const client = new DynamoDBClient({ region: "us-east-1" });
const ddb = DynamoDBDocumentClient.from(client);

// 2️⃣ Table name and BGM app ID to search for
const TABLE_NAME = "player.dev.bvcloud.link";
const BGM_APP_ID = "ee167b23-8b61-451a-9561-4b9521b26855";

// 3️⃣ Define scan parameters
const params = {
  TableName: TABLE_NAME,
  ProjectionExpression: "login, applications"
};

// 4️⃣ Function to scan all pages and filter records with BGM app
async function scanAll() {
  let devicesWithBGM = [];
  let lastKey;
  let totalScanned = 0;

  try {
    do {
      const data = await ddb.send(new ScanCommand({ ...params, ExclusiveStartKey: lastKey }));

      if (data.Items) {
        totalScanned += data.Items.length;

        // Filter items that have applications field and contain the BGM app
        const filtered = data.Items.filter(item => {
          if (!item.applications || !Array.isArray(item.applications)) {
            return false;
          }
          // Check if any app in the applications list has the BGM app ID
          return item.applications.some(app => app.appId === BGM_APP_ID);
        });

        devicesWithBGM = devicesWithBGM.concat(filtered);
      }

      lastKey = data.LastEvaluatedKey;
    } while (lastKey);

    // Display results in console
    console.log(`✅ Total records scanned: ${totalScanned}`);
    console.log(`✅ Found ${devicesWithBGM.length} devices with BGM app (${BGM_APP_ID}):\n`);
    console.table(devicesWithBGM, ["login"]);

    // Write to file
    const output = devicesWithBGM.map(item => ({
      login: item.login
    }));

    fs.writeFileSync("devicesWithBGM.txt", JSON.stringify(output, null, 2));
    console.log(`\n✅ Results written to devicesWithBGM.txt`);

  } catch (err) {
    console.error("❌ Error scanning table:", err);
  }
}

// 5️⃣ Run it
scanAll();
