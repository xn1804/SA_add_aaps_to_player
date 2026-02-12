// devices_withno_apps.js
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import fs from "fs";

// 1️⃣ Initialize DynamoDB client
const client = new DynamoDBClient({ region: "us-east-1" });
const ddb = DynamoDBDocumentClient.from(client);

// 2️⃣ Table name
const TABLE_NAME = "player.dev.bvcloud.link";

// 3️⃣ Define scan parameters
const params = {
  TableName: TABLE_NAME,
  ProjectionExpression: "login, device_name, #apps",
  ExpressionAttributeNames: {
    "#apps": "applications"
  }
};

// 4️⃣ Function to scan all pages and filter records without applications
async function scanAll() {
  let devicesWithoutApps = [];
  let lastKey;
  let totalScanned = 0;

  try {
    do {
      const data = await ddb.send(new ScanCommand({ ...params, ExclusiveStartKey: lastKey }));

      if (data.Items) {
        totalScanned += data.Items.length;

        // Filter items where applications field does not exist
        const filtered = data.Items.filter(item => !item.applications);
        devicesWithoutApps = devicesWithoutApps.concat(filtered);
      }

      lastKey = data.LastEvaluatedKey;
    } while (lastKey);

    // Display results in console
    console.log(`✅ Total records scanned: ${totalScanned}`);
    console.log(`✅ Found ${devicesWithoutApps.length} devices without applications field:`);
    console.table(devicesWithoutApps, ["login", "device_name"]);

    // Write to file
    const output = devicesWithoutApps.map(item => ({
      login: item.login,
      device_name: item.device_name
    }));

    fs.writeFileSync("noApps.txt", JSON.stringify(output, null, 2));
    console.log(`\n✅ Results written to noApps.txt`);

  } catch (err) {
    console.error("❌ Error scanning table:", err);
  }
}

// 5️⃣ Run it
scanAll();
