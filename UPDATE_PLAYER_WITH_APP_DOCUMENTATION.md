# update_player_with_app.js - Script Documentation

## Overview

This script adds applications (DCX or Detect App) to device records in the Fresh Juice platform's DynamoDB player table. It uses a two-table cross-lookup strategy: scanning devices from the **pulse** table (telemetry data) and updating corresponding records in the **player** table (main device records).

## Purpose

**Primary Goal**: Automatically add FRESH JUICE applications (DCX or Detect App) to devices that:
1. Match specific OS criteria (e.g., Microsoft Windows, or other OS types)
2. Exist in the player table
3. Don't already have DCX or Detect App installed

**Use Case**: Bulk application deployment tracking for devices that need the Detect App or DCX application added to their records.

## How It Works

### Three-Phase Process

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: Scan pulse table                                   │
│ - Filter devices by OS type (optional)                      │
│ - Apply case-insensitive OS name matching                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: Cross-lookup in player table                       │
│ - Fetch corresponding device from player table by login     │
│ - Check if applications field exists                        │
│ - Verify if DCX or Detect App already installed             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 3: Update or skip                                     │
│ - If no skip condition: Add selected app to applications    │
│ - Enrich with mandator & location names                     │
│ - Generate CSV report (sorted by mandator → location)       │
│ - Apply updates (only if DRY_RUN = false)                   │
└─────────────────────────────────────────────────────────────┘
```

## Configuration Options

### Table Configuration (Lines 13-14)
```javascript
const PULSE_TABLE = "pulse.iofav.net";   // Source table for filtering
const PLAYER_TABLE = "player.iofav.net"; // Target table for updates
```

**Purpose**: Two-table strategy
- **pulse** table: Source of truth for device OS information and active devices
- **player** table: Main device registry where applications are tracked

### Processing Limits (Lines 15-17)
```javascript
const RECORDS_TO_PROCESS = 999999; // Max records to process
const DRY_RUN = true;              // Preview mode (no actual updates)
const APP_CHOICE = 2;              // 1 = DCX, 2 = Detect App
```

**Safety Features**:
- `RECORDS_TO_PROCESS`: Limit scope for testing (set to 10-50 for testing, 999999 for full run)
- `DRY_RUN = true`: **ALWAYS test in dry-run first** - generates reports without updating database
- `APP_CHOICE`: Select which application to add (1 = DCX, 2 = Detect App)

### OS Filtering Configuration (Lines 19-22)
```javascript
const FILTER_OS_ENABLED = true;        // Toggle filtering on/off
const OS_FILTER_VALUE = "microsoft";   // OS to filter (case-insensitive)
const EXCLUDE_OS_VALUES = [            // OS types to exclude (when using "OTHER")
  "microsoft", "windows", "macos", "mac os", "tvos", "apple tvos"
];
```

**Filtering Modes**:

1. **Specific OS Mode** (OS_FILTER_VALUE = "microsoft")
   - Processes ONLY devices where `os_name` contains "microsoft" (case-insensitive)
   - Example: Targets Microsoft Windows devices

2. **"OTHER" Mode** (OS_FILTER_VALUE = "OTHER")
   - Processes devices EXCLUDING all OS types in `EXCLUDE_OS_VALUES`
   - Example: Targets Linux, Android, or other non-standard OS types

3. **All Devices Mode** (FILTER_OS_ENABLED = false)
   - Processes ALL devices regardless of OS type

### Application Definitions (Lines 24-56)

Two predefined applications available:

**Option 1: FRESH JUICE - DCX**
```javascript
{
  appId: "b7167b23-8b61-451a-9561-4b9521b268c8",
  appName: "FRESH JUICE - DCX",
  bundleId: "com.eti.MediaBrowser",
  product_code: "DTA-05-03",
  version: "5.0.8",
  // ... other metadata
}
```

**Option 2: FRESH JUICE - Detect App**
```javascript
{
  appId: "d8167b23-8b61-451a-9561-4b9521b26821",
  appName: "FRESH JUICE - Detect App",
  bundleId: "com.eti.Heartbeat",
  product_code: "DTA-05-03",
  version: "1.0.1",
  // ... other metadata
}
```

## Processing Logic

### Skip Conditions (Lines 214-226)

The script will **NOT update** a device if:

1. The device already has **DCX** installed, OR
2. The device already has **Detect App** installed

**Rationale**: Prevents duplicate applications and respects existing installations

```javascript
const APP_IDS_TO_SKIP = [
  "b7167b23-8b61-451a-9561-4b9521b268c8",  // DCX
  "d8167b23-8b61-451a-9561-4b9521b26821"   // Detect App
];
```

### Update Scenarios (Lines 209-235)

**Scenario A: Applications field exists**
```javascript
// Device has: { applications: [{...existing apps...}] }
// Action: Append new app to existing list
UpdateExpression: "SET applications = list_append(applications, :newApp)"
```

**Scenario B: Applications field missing**
```javascript
// Device has: { login: "...", device_name: "...", /* no applications */ }
// Action: Create new applications array with the app
UpdateExpression: "SET applications = :newAppList"
```

### Data Enrichment (Lines 89-117, 238-243)

For each device requiring update, the script fetches:

1. **Mandator Name** from `mandator.iofav.net` table
   - Uses `mandator_id` (NUMBER type) from player record
   - Helper: `getMandatorName(mandatorId)`

2. **Location Name** from `location.iofav.net` table
   - Uses `location_id` (STRING/UUID type) from player record
   - Helper: `getLocationName(locationId)`

**Purpose**: Provides organizational context for reporting and review

## Output & Reporting

### Console Log Output

Real-time progress for each device processed:
```
--- Record 1 ---
Login: user@example.com
Device (from pulse): DESKTOP-ABC123
OS Name (from pulse): Microsoft Windows
✓ Found in player table
✓ Applications field exists (2 app(s))
✓ Skip condition met (one of the appIds exists) - NO UPDATE NEEDED
```

### Log File (Lines 78-79, 338-339)

**Location**: `logs/update_log_YYYY-MM-DDTHH-MM-SS-XXXZ.txt`

**Contents**:
- DRY-RUN status
- Filtering criteria
- Per-device processing details
- Summary statistics
- Errors and warnings

### CSV Report (Lines 80, 304-310)

**Location**: `logs/devices_updated_YYYY-MM-DDTHH-MM-SS-XXXZ.csv`

**Format**: Semicolon-delimited (European Excel compatibility)

**Columns**:
```
Login;Device_Name;OS_Name;OS;Mandator_Name;Location_Name;Action
```

**Sorting**: By Mandator Name → Location Name (lines 298-302)

**Example**:
```csv
Login;Device_Name;OS_Name;OS;Mandator_Name;Location_Name;Action
user1@example.com;PC-001;Microsoft Windows;Microsoft Windows 10 Pro 19045;Acme Corp;New York Office;ADD_TO_EXISTING_LIST
user2@example.com;PC-002;Microsoft Windows;Microsoft Windows 11 Pro 22631;Acme Corp;Boston Office;CREATE_NEW_APPLICATIONS
```

### Summary Statistics (Lines 270-285)

```
=============================================================
📊 SUMMARY
=============================================================
Total devices found in pulse.iofav.net (os_name contains "microsoft"): 150
Records not found in player.iofav.net: 5
Records requiring updates in player.iofav.net: 45
```

## DynamoDB Operations

### Read Operations

1. **Scan pulse table** (Line 149)
   ```javascript
   ScanCommand({
     TableName: "pulse.iofav.net",
     ExclusiveStartKey: lastKey  // Pagination support
   })
   ```

2. **Get player record** (Lines 186-189)
   ```javascript
   GetCommand({
     TableName: "player.iofav.net",
     Key: { login: pulseItem.login }
   })
   ```

3. **Get mandator name** (Lines 93-96)
   ```javascript
   GetCommand({
     TableName: "mandator.iofav.net",
     Key: { id: Number(mandatorId) }  // CRITICAL: Convert to NUMBER
   })
   ```

4. **Get location name** (Lines 108-111)
   ```javascript
   GetCommand({
     TableName: "location.iofav.net",
     Key: { uuid: locationId }  // STRING/UUID type
   })
   ```

### Write Operations (Lines 318-323)

**Only executed when DRY_RUN = false**

```javascript
UpdateCommand({
  TableName: "player.iofav.net",
  Key: { login: update.login },
  UpdateExpression: "SET applications = list_append(applications, :newApp)",
  ExpressionAttributeValues: { ":newApp": [NEW_APP] }
})
```

## Safety Features

### 1. DRY-RUN Mode (Default: ON)
- **Line 16**: `const DRY_RUN = true`
- Generates all reports WITHOUT modifying database
- **Best Practice**: Always run with DRY_RUN = true first, review CSV, then set to false

### 2. Record Limit
- **Line 15**: `const RECORDS_TO_PROCESS = 999999`
- Test with small numbers (10, 50) before full production run

### 3. Error Handling (Lines 185-194, 316-329)
- Catches and logs DynamoDB errors
- Skips devices not found in player table (doesn't crash)
- Stops on update errors (line 327: `throw err`)

### 4. Skip Logic (Lines 214-218)
- Prevents duplicate app installations
- Respects existing DCX or Detect App installations

### 5. Case-Insensitive OS Filtering (Lines 158-175)
- Prevents false negatives due to case variations
- Example: "Microsoft", "microsoft", "MICROSOFT" all match

## Workflow Example

### Typical Execution Flow

**Step 1: Configure for Testing**
```javascript
const RECORDS_TO_PROCESS = 50;     // Test on 50 records
const DRY_RUN = true;              // Preview only
const APP_CHOICE = 2;              // Detect App
const FILTER_OS_ENABLED = true;    // Filter by OS
const OS_FILTER_VALUE = "microsoft"; // Windows devices only
```

**Step 2: Run Script**
```bash
AWS_PROFILE=default node update_player_with_app.js
```

**Step 3: Review Output**
- Check console output for processing details
- Review `logs/devices_updated_*.csv` for devices to be updated
- Check `logs/update_log_*.txt` for full details

**Step 4: Apply Updates (if satisfied)**
```javascript
const DRY_RUN = false;  // Enable updates
const RECORDS_TO_PROCESS = 999999; // Process all matching devices
```

**Step 5: Run Again**
```bash
AWS_PROFILE=default node update_player_with_app.js
```

## Common Use Cases

### Use Case 1: Add Detect App to All Windows Devices
```javascript
const PULSE_TABLE = "pulse.iofav.net";
const PLAYER_TABLE = "player.iofav.net";
const RECORDS_TO_PROCESS = 999999;
const DRY_RUN = true;  // Test first!
const APP_CHOICE = 2;  // Detect App
const FILTER_OS_ENABLED = true;
const OS_FILTER_VALUE = "microsoft";
```

### Use Case 2: Add DCX to Linux/Android Devices (Non-standard OS)
```javascript
const APP_CHOICE = 1;  // DCX
const FILTER_OS_ENABLED = true;
const OS_FILTER_VALUE = "OTHER";
const EXCLUDE_OS_VALUES = ["microsoft", "windows", "macos", "mac os", "tvos", "apple tvos"];
```

### Use Case 3: Add Detect App to Specific Count of Devices
```javascript
const RECORDS_TO_PROCESS = 2000;  // Process exactly 2000 devices
const DRY_RUN = false;  // Apply updates
const APP_CHOICE = 2;
```

## Important Technical Notes

### DynamoDB Key Types
- **mandator_id**: NUMBER type - Must use `Number(mandatorId)` in GetCommand (Line 95)
- **location_id**: STRING/UUID type - Use as-is (Line 110)
- **login**: STRING type - Primary key for pulse and player tables

### Pagination Handling (Lines 148-267)
Script automatically handles DynamoDB pagination:
```javascript
do {
  const data = await ddb.send(new ScanCommand({ ...params, ExclusiveStartKey: lastKey }));
  // Process items...
  lastKey = data.LastEvaluatedKey;
} while (lastKey && recordsProcessed < RECORDS_TO_PROCESS);
```

### OS Filter Performance
- Filtering applied **in code**, not at DynamoDB level (Lines 158-175)
- **Reason**: DynamoDB FilterExpression is case-sensitive
- **Trade-off**: Scans more records but ensures accurate case-insensitive matching

## Limitations & Considerations

1. **Cross-Table Dependency**: Requires devices to exist in BOTH pulse and player tables
2. **Rate Limits**: Large scans may hit DynamoDB rate limits (use RECORDS_TO_PROCESS to batch)
3. **No Rollback**: Once DRY_RUN = false and executed, updates are permanent (CSV serves as audit trail)
4. **Application Metadata**: Uses static application definitions (version, installation date are generic)
5. **Single App at a Time**: APP_CHOICE allows only one app per run (run twice for both DCX and Detect App)

## Error Scenarios

### Scenario 1: Device in Pulse but Not in Player
```
⚠️  Login not found in player.iofav.net - SKIPPING
```
**Result**: Counted in summary, not updated, continues processing

### Scenario 2: Mandator/Location Lookup Fails
```
⚠️  Could not fetch mandator: ResourceNotFoundException
```
**Result**: Uses 'N/A' in CSV, continues processing

### Scenario 3: DynamoDB Update Fails
```
❌ Failed to update login@example.com: ConditionalCheckFailedException
```
**Result**: Script stops (line 327: `throw err`)

## Files Generated

### Log Directory Structure
```
logs/
├── update_log_2026-07-27T14-30-00-000Z.txt
├── devices_updated_2026-07-27T14-30-00-000Z.csv
├── update_log_2026-07-27T15-45-00-000Z.txt
└── devices_updated_2026-07-27T15-45-00-000Z.csv
```

### Retention
- Logs accumulate with timestamps (no automatic cleanup)
- CSV files serve as audit trail for compliance

## Best Practices

1. ✅ **Always test with DRY_RUN = true first**
2. ✅ **Start with small RECORDS_TO_PROCESS (10-50)**
3. ✅ **Review CSV output before applying updates**
4. ✅ **Verify table names point to correct environment**
5. ✅ **Keep CSV files as audit trail**
6. ✅ **Use AWS_PROFILE=default for proper credentials**
7. ❌ **Never skip dry-run for production environments**
8. ❌ **Don't set RECORDS_TO_PROCESS = 999999 on first run**

## Troubleshooting

### No Devices Found
- Check FILTER_OS_ENABLED and OS_FILTER_VALUE settings
- Verify PULSE_TABLE has data
- Check case-sensitivity of OS filter

### High "Not Found in Player" Count
- Pulse table may have stale/decommissioned devices
- Consider running sync_device_info_from_pulse.js first

### Updates Not Applied
- Verify DRY_RUN = false
- Check AWS credentials and permissions
- Review error messages in log file

### CSV Empty Despite Console Output
- Check if all devices had skip condition met (already have apps)
- Verify recordsToUpdate.length in summary

## Related Scripts

- **check_devices_no_apps.js**: Find devices missing applications field
- **sync_device_info_from_pulse.js**: Sync device info from pulse to player
- **enrich_device_list.js**: Enrich CSV with mandator/location names
- **update_player_with_bgm.js**: Add BGM app to devices

## Version History

**Current Version**: Two-table cross-lookup with enhanced OS filtering
- Two-table architecture (pulse → player)
- Flexible OS filtering with case-insensitive matching
- Mandator/location enrichment
- CSV report generation with sorting
- Comprehensive logging

**Previous Version**: Single-table scanner (player.sb.bvcloud.link)
- Simple scan with hard-coded Microsoft filter
- Limited reporting
- Staging environment only
