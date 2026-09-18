# TE CONNECT — Google Sheets Setup Guide

> This guide is written for beginners. Follow every step exactly. You do NOT need any technical knowledge.

---

## What you will need
- A Google account (Gmail)
- A computer or laptop (not a phone) for the setup
- The `Code.gs` file from the `backend/` folder of your TE CONNECT project
- About 15 minutes

---

## STEP 1 — Open Google Sheets

1. Open your web browser (Chrome, Firefox, or Edge).
2. Go to **sheets.google.com**
3. Make sure you are signed into the correct Google account.

---

## STEP 2 — Create a New Blank Spreadsheet

1. Click the large **+** (Blank) button to create a new spreadsheet.
2. Click on "Untitled spreadsheet" at the top.
3. Type the name: **TE CONNECT DATABASE**
4. Press Enter.

---

## STEP 3 — Open Apps Script

1. In your Google Sheet, click the menu bar at the top.
2. Click **Extensions**.
3. Click **Apps Script**.
4. A new browser tab will open with the Apps Script editor.

---

## STEP 4 — Paste the Backend Code

1. In the Apps Script editor, you will see a file called `Code.gs` on the left side.
2. Click on it to open it.
3. **Select ALL the existing text** in the editor (press Ctrl+A on Windows, or Cmd+A on Mac).
4. **Delete it** (press the Delete or Backspace key).
5. Open the `backend/Code.gs` file from your TE CONNECT project folder on your computer.
6. **Copy all the text** from that file.
7. **Paste it** into the Apps Script editor.
8. Click the **Save** button (or press Ctrl+S).

---

## STEP 5 — Run the Setup Function

1. At the top of the Apps Script editor, find the dropdown that says "Select function".
2. Click it and choose **setupSpreadsheet**.
3. Click the **Run** button (the triangle/play icon ▶).
4. A pop-up will appear asking you to review permissions. **Continue to Step 6.**

---

## STEP 6 — Allow Permissions

1. A dialog box will appear saying "Authorization required".
2. Click **Review permissions**.
3. Choose your Google account.
4. You may see a warning that says "Google hasn't verified this app". This is normal for your own scripts.
5. Click **Advanced**, then click **Go to TE CONNECT Database (unsafe)**.
6. Click **Allow**.
7. The script will run. Wait a few seconds.
8. A success message will appear inside your Google Sheet: **"TE CONNECT Setup Complete! ✅"**

---

## STEP 7 — Verify All Tabs Were Created

Go back to your Google Sheet. You should now see these 10 tabs at the bottom:

| Tab Name | Purpose |
|---|---|
| USERS | All app users (Manager, TE, etc.) |
| DEALERS | All dealers with QR codes |
| CONTRACTORS | Contractor list |
| SLABS | All slab records |
| SALES | All sales entries |
| ACTIVE_TRACKER | Punching and contractor activity |
| MEETINGS | All meeting records |
| TARGETS | Monthly meeting targets per TE |
| SETTINGS | App-wide settings |
| ACTIVITY_LOG | Automatic audit trail |

If any tab is missing, run `setupSpreadsheet` again.

---

## STEP 8 — Add Your Team's User Accounts

1. Click the **USERS** tab.
2. You will see a default admin account already created (login: `admin`, password: `Admin@123`).
3. To add more users, add new rows. Fill in each column:

| Column | What to enter |
|---|---|
| user_id | USR_002, USR_003, etc. |
| login_id | e.g. rehan, manager1 |
| password_hash | (see note below) |
| name | Full name of the person |
| role | ADMIN, MANAGER, TE, or SALES_OPERATOR |
| team | Team Jajpur |
| district | Jajpur |
| territory | Jajpur |
| phone | Mobile number |
| active | TRUE |
| photo_url | Leave blank |
| created_at | Today's date |

> **⚠️ IMPORTANT — Password Hash:**
> Passwords are stored as SHA-256 hashes for security.
> To generate a hash for a password, use this free tool:
> **emn178.github.io/online-tools/sha256.html**
> Type the password, copy the result, paste it in the `password_hash` column.

---

## STEP 9 — Add Your Dealers

1. Click the **DEALERS** tab.
2. Add each dealer as a new row:

| Column | What to enter |
|---|---|
| dealer_id | D001, D002, D003, etc. |
| dealer_name | Full dealer/shop name |
| owner_name | Owner's name |
| phone | Mobile number |
| address | Shop address |
| area | Area/village name |
| assigned_te | TE's name (must match USERS name exactly) |
| active | TRUE |
| qr_id | Leave blank (auto-generated) |
| qr_token | Leave blank (auto-generated from app) |
| public_slab_link | Leave blank (auto-generated) |
| created_at | Today's date |

---

## STEP 10 — Add Monthly Targets

1. Click the **TARGETS** tab.
2. For each TE, add a row for each month:

| Column | Example |
|---|---|
| target_id | TGT_001 |
| month | 2026-09 |
| year | 2026 |
| te | Rehan (must match name in USERS exactly) |
| active_target | 80 (meaning 80%) |
| customer_meeting_target | 50 |
| contractor_meeting_target | 100 |

---

## STEP 11 — Deploy Apps Script as Web App

This step makes your script accessible from the mobile app.

1. In the Apps Script editor, click the **Deploy** button (top right).
2. Click **New deployment**.
3. Click the gear icon next to "Type" and select **Web app**.
4. Fill in:
   - **Description**: TE CONNECT API v1.0
   - **Execute as**: Me
   - **Who has access**: Anyone
5. Click **Deploy**.
6. Click **Authorize access** if asked (repeat the permission steps from Step 6).
7. After deployment, you will see a **Web app URL**. It looks like:
   `https://script.google.com/macros/s/ABCDEFG.../exec`

---

## STEP 12 — Copy the Web App URL

1. Copy the entire Web App URL (the long URL from Step 11).
2. Keep it safe. You will need it in the next step.

> Also paste this URL into the **SETTINGS** tab in your Google Sheet:
> - Find the row where `setting` = `public_url`
> - Paste the URL in the `value` column

---

## STEP 13 — Add the URL to the Mobile App

1. Open the file: `src/config/api.ts` in your TE CONNECT project.
2. Find this line:
   ```
   export const APPS_SCRIPT_URL = 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';
   ```
3. Replace `YOUR_APPS_SCRIPT_WEB_APP_URL_HERE` with the URL you copied.
4. Save the file.

Example:
```typescript
export const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby.../exec';
```

---

## STEP 14 — Test the Connection

1. Open a web browser.
2. Paste your Web App URL and add `?action=getSettings` at the end:
   ```
   https://script.google.com/macros/s/YOUR_ID/exec?action=getSettings
   ```
3. Press Enter.
4. You should see a JSON response like:
   ```json
   {"success":true,"message":"OK","data":[...]}
   ```
5. If you see `success: true` — **everything is working!** 🎉
6. If you see an error, re-check Steps 11 and 12.

---

## ✅ Setup Complete!

Your Google Sheet is now the database for TE CONNECT.

**Next step:** Follow the `ANDROID_BUILD_GUIDE.md` to install and build the app.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| "Script error" when running setup | Make sure you pasted the complete Code.gs file |
| Tabs not created | Run `setupSpreadsheet` again |
| App says "Network error" | Check that the URL in api.ts is correct |
| Login fails | Check the password hash in the USERS sheet |
| "Invalid login" | Make sure `active` column is TRUE |
