# Add Apps to Device - Scripts Guide

## Project Overview

This project contains Node.js scripts for managing applications in the DynamoDB table `player.dev.bvcloud.link`. All scripts are designed to scan, update, and verify device records with various applications.

---

## Project Structure

```
add_apps_to_device/
├── devices_withno_apps.js          # Scan devices without applications field
├── scan_device_with_bgm.js         # Scan devices with BGM app
├── update_player_with_app.js       # Add DCX or Detect App to devices
├── update_player_with_bgm.js       # Add BGM app to devices
├── package.json                    # Project dependencies
├── package-lock.json               # Locked dependency versions
├── node_modules/                   # Installed dependencies
├── logs/                           # Log files folder (auto-created)
├── noApps.txt                      # Output: devices without apps
├── devicesWithBGM.txt              # Output: devices with BGM app
└── SCRIPTS_GUIDE.md                # This file
```

---

## Scripts Description

### 1. **devices_withno_apps.js**

**Purpose**: Scan the database and find all devices that do NOT have the `applications` field.

**What it does**:
- Scans all records in `player.dev.bvcloud.link` table
- Identifies devices without the `applications` field
- Displays results in console
- Writes results to `noApps.txt`

**Configuration**:
- No configuration needed - scans all records automatically

**How to Run**:
```bash
node devices_withno_apps.js
```

**Output**:
- Console: List of devices without applications field
- File: `noApps.txt` (JSON format)

**Example Output**:
```
✅ Total records scanned: 35
✅ Found 0 devices without applications field:
✅ Results written to noApps.txt
```

---

### 2. **scan_device_with_bgm.js**

**Purpose**: Find all devices that have the FRESH JUICE - BGM app installed.

**What it does**:
- Scans all records in `player.dev.bvcloud.link` table
- Searches for BGM app (appId: `ee167b23-8b61-451a-9561-4b9521b26855`)
- Displays matching devices with their login IDs
- Writes results to `devicesWithBGM.txt`

**Configuration**:
- No configuration needed - scans all records automatically
- BGM appId is hardcoded: `ee167b23-8b61-451a-9561-4b9521b26855`

**How to Run**:
```bash
node scan_device_with_bgm.js
```

**Output**:
- Console: Table of devices with BGM app
- File: `devicesWithBGM.txt` (JSON format)

**Example Output**:
```
✅ Total records scanned: 35
✅ Found 5 devices with BGM app:
┌─────────┬────────────────────────────────────────┐
│ (index) │ login                                  │
├─────────┼────────────────────────────────────────┤
│ 0       │ 'W5FXY4J2P6'                           │
│ 1       │ '2492EE21-33FD-497E-AED5-4ACD53F836A0' │
...
```

---

### 3. **update_player_with_app.js**

**Purpose**: Add applications to devices with smart skip logic and app choice.

**What it does**:
- Scans devices in `player.dev.bvcloud.link` table
- Checks if skip condition is met (device already has one of the skip appIds)
- If skip condition NOT met: Adds the selected app
- If applications field doesn't exist: Creates new list with the app
- Logs all actions to `logs/` folder
- Supports DRY-RUN mode to preview changes

**Available Apps to Add**:

**Option 1 - FRESH JUICE - DCX**
```javascript
appId: "b7167b23-8b61-451a-9561-4b9521b268c8"
appName: "FRESH JUICE - DCX"
bundleId: "com.eti.MediaBrowser"
version: "5.0.8"
product_code: "DTA-05-03"
size: 34432
```

**Option 2 - FRESH JUICE - Detect App**
```javascript
appId: "d8167b23-8b61-451a-9561-4b9521b26821"
appName: "FRESH JUICE - Detect App"
bundleId: "com.eti.Heartbeat"
version: "1.0.1"
product_code: "DTA-05-03"
size: 34432
```

**Configuration** (Edit these lines at top of script):

```javascript
const RECORDS_TO_PROCESS = 10;    // Change to number of records to process
const DRY_RUN = true;             // Change to false to apply updates
const APP_CHOICE = 1;             // Change to 1 for DCX or 2 for Detect App
```

**Configuration Options**:

| Variable | Options | Description |
|----------|---------|-------------|
| `RECORDS_TO_PROCESS` | Any number, 999999 for all | How many records to process in one run |
| `DRY_RUN` | true / false | true = preview only, false = apply updates |
| `APP_CHOICE` | 1 or 2 | 1 = DCX app, 2 = Detect App |

**Skip Condition**:
- Script will NOT add the app if the device already contains:
  - `b7167b23-8b61-451a-9561-4b9521b268c8` (DCX) OR
  - `d8167b23-8b61-451a-9561-4b9521b26821` (Detect App)

**How to Run**:

**Step 1: Test with DRY-RUN (preview)**
```javascript
const RECORDS_TO_PROCESS = 10;
const DRY_RUN = true;
const APP_CHOICE = 1;  // or 2
```
```bash
node update_player_with_app.js
```

**Step 2: Apply live updates**
```javascript
const RECORDS_TO_PROCESS = 10;
const DRY_RUN = false;      // Change to false
const APP_CHOICE = 1;       // or 2
```
```bash
node update_player_with_app.js
```

**Output**:
- Console: Real-time progress and results
- File: `logs/update_log_TIMESTAMP.txt`

**Example Usage Scenarios**:

**Scenario 1: Add DCX app to first 5 records (preview)**
```javascript
const RECORDS_TO_PROCESS = 5;
const DRY_RUN = true;
const APP_CHOICE = 1;
```

**Scenario 2: Add Detect App to all remaining records (apply)**
```javascript
const RECORDS_TO_PROCESS = 999999;
const DRY_RUN = false;
const APP_CHOICE = 2;
```

**Scenario 3: Test with 10 records before full run**
```javascript
const RECORDS_TO_PROCESS = 10;
const DRY_RUN = true;
const APP_CHOICE = 2;
```

---

### 4. **update_player_with_bgm.js**

**Purpose**: Add FRESH JUICE - BGM app to devices.

**What it does**:
- Scans devices in `player.dev.bvcloud.link` table
- Checks if BGM app already exists
- If BGM app missing: Adds the BGM app
- If applications field doesn't exist: Creates new list with BGM app
- Logs all actions to `logs/` folder
- Supports DRY-RUN mode

**BGM App Details**:
```javascript
appId: "ee167b23-8b61-451a-9561-4b9521b26855"
appName: "FRESH JUICE - BGM"
bundleId: "com.eti.FreshJuiceMusic"
version: "1.0.0"
product_code: "DTA-05-02"
size: 28672
```

**Configuration** (Edit these lines at top of script):

```javascript
const RECORDS_TO_PROCESS = 10;    // Change to number of records to process
const DRY_RUN = true;             // Change to false to apply updates
```

**Configuration Options**:

| Variable | Options | Description |
|----------|---------|-------------|
| `RECORDS_TO_PROCESS` | Any number, 999999 for all | How many records to process in one run |
| `DRY_RUN` | true / false | true = preview only, false = apply updates |

**How to Run**:

**Step 1: Test with DRY-RUN (preview)**
```javascript
const RECORDS_TO_PROCESS = 10;
const DRY_RUN = true;
```
```bash
node update_player_with_bgm.js
```

**Step 2: Apply live updates**
```javascript
const RECORDS_TO_PROCESS = 10;
const DRY_RUN = false;      // Change to false
```
```bash
node update_player_with_bgm.js
```

**Output**:
- Console: Real-time progress and results
- File: `logs/update_bgm_log_TIMESTAMP.txt`

**Example Usage Scenarios**:

**Scenario 1: Add BGM to first 5 records (preview)**
```javascript
const RECORDS_TO_PROCESS = 5;
const DRY_RUN = true;
```

**Scenario 2: Add BGM to all records (apply)**
```javascript
const RECORDS_TO_PROCESS = 999999;
const DRY_RUN = false;
```

---

## Quick Start Guide

### Installation

```bash
# Navigate to the project folder
cd add_apps_to_device

# Install dependencies (already done)
npm install
```

### Basic Workflow

**1. Scan for devices without apps**
```bash
node devices_withno_apps.js
```

**2. Scan for devices with BGM app**
```bash
node scan_device_with_bgm.js
```

**3. Add DCX app (test first)**
```bash
# Edit update_player_with_app.js and set:
# const DRY_RUN = true;
# const APP_CHOICE = 1;
# const RECORDS_TO_PROCESS = 10;

node update_player_with_app.js
```

**4. Add DCX app (apply)**
```bash
# Edit update_player_with_app.js and set:
# const DRY_RUN = false;

node update_player_with_app.js
```

**5. Add BGM app (test first)**
```bash
# Edit update_player_with_bgm.js and set:
# const DRY_RUN = true;
# const RECORDS_TO_PROCESS = 10;

node update_player_with_bgm.js
```

**6. Add BGM app (apply)**
```bash
# Edit update_player_with_bgm.js and set:
# const DRY_RUN = false;

node update_player_with_bgm.js
```

---

## Log Files

All log files are automatically created and stored in the `logs/` folder.

**Log File Naming**:
- `update_log_YYYY-MM-DDTHH-MM-SS-XXXZ.txt` - For update_player_with_app.js
- `update_bgm_log_YYYY-MM-DDTHH-MM-SS-XXXZ.txt` - For update_player_with_bgm.js

**Log Contents**:
- DRY-RUN status
- Number of records processed
- List of all records checked
- Detailed results for each record
- Summary with update count
- Timestamp of execution

**Example Log Entry**:
```
🔍 Starting DRY-RUN: YES (no updates will be made)
📋 Processing up to 10 records from player.dev.bvcloud.link

--- Record 1 ---
Login: W5FXY4J2P6
Device: StudioM2Ultra
✓ Applications field exists (2 app(s))
✓ Skip condition met (one of the appIds exists) - NO UPDATE NEEDED

============================================================
📊 SUMMARY
============================================================
Total records processed: 10
Records requiring updates: 1

✅ Log written to logs/update_log_2026-02-12T00-00-00-000Z.txt
```

---

## Important Notes

### AWS Credentials
- All scripts use AWS region: `us-east-1`
- Make sure AWS credentials are configured locally
- Use AWS CLI or environment variables for authentication

### DynamoDB Table Structure
- Table Name: `player.dev.bvcloud.link`
- Primary Key: `login`
- Applications field type: List of Maps

### Skip Logic (update_player_with_app.js)
- The script will skip updating a device if it already has:
  - `b7167b23-8b61-451a-9561-4b9521b268c8` (DCX) OR
  - `d8167b23-8b61-451a-9561-4b9521b26821` (Detect App)
- This prevents duplicate app installations

### Best Practices

1. **Always test first**:
   - Run with `DRY_RUN = true` and small `RECORDS_TO_PROCESS` first
   - Review the output
   - Check the log file

2. **Start small**:
   - Use `RECORDS_TO_PROCESS = 5` or `10` for initial tests
   - Increase gradually: 50 → 100 → 999999

3. **Monitor logs**:
   - Check the `logs/` folder for all operations
   - Review errors if any records fail

4. **Backup important data**:
   - Export device data before running updates
   - Keep log files for audit trail

---

## Troubleshooting

### Script fails with "Invalid APP_CHOICE"
**Solution**: Make sure `APP_CHOICE` is set to `1` or `2`

### No records updated but DRY_RUN shows records to update
**Solution**: Check that `DRY_RUN = false` is set correctly

### AWS credentials error
**Solution**: Configure AWS credentials using:
```bash
aws configure
```

### Database locked/timeout errors
**Solution**:
- Reduce `RECORDS_TO_PROCESS` to smaller number
- Try again after a few seconds
- Check AWS DynamoDB status

---

## Monitoring Progress

To check progress of devices with apps:

```bash
# Check devices WITHOUT apps
node devices_withno_apps.js

# Check devices WITH BGM app
node scan_device_with_bgm.js

# Check devices with DCX app - modify scan_device_with_bgm.js
# to search for different appId if needed
```

---

## Summary Table

| Script | Purpose | Configurable | DRY-RUN | Output |
|--------|---------|--------------|---------|--------|
| devices_withno_apps.js | Find devices without apps field | No | N/A | noApps.txt |
| scan_device_with_bgm.js | Find devices with BGM app | No | N/A | devicesWithBGM.txt |
| update_player_with_app.js | Add DCX or Detect App | Yes | Yes | logs/update_log_*.txt |
| update_player_with_bgm.js | Add BGM app | Yes | Yes | logs/update_bgm_log_*.txt |

---

## Example Commands

```bash
# View all devices without apps
node devices_withno_apps.js

# View devices with BGM
node scan_device_with_bgm.js

# Test adding DCX to 10 devices
# (edit: DRY_RUN=true, APP_CHOICE=1, RECORDS_TO_PROCESS=10)
node update_player_with_app.js

# Add BGM to all remaining devices
# (edit: DRY_RUN=false, RECORDS_TO_PROCESS=999999)
node update_player_with_bgm.js

# Check logs
ls -la logs/
cat logs/update_log_*.txt
```

---

## Support & Documentation

For more information about each script:
- Check the comments inside each .js file
- Review log files in `logs/` folder
- Check console output for detailed error messages

---

**Last Updated**: February 12, 2026
**Project**: add_apps_to_device
**AWS Table**: player.dev.bvcloud.link
