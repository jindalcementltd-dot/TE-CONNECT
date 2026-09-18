# TE CONNECT — Environment Setup Guide

This guide sets up your development environment on Windows so you can run the app and make changes.

---

## What You Need

1. **Node.js** (JavaScript runtime)
2. **Expo CLI** (App development tool)
3. **VS Code** (Code editor — optional but recommended)
4. **Expo Go App** (For testing on your phone)

---

## Step 1 — Install Node.js

1. Go to **nodejs.org**
2. Click **LTS** (Long Term Support) to download
3. Run the installer
4. Leave all settings as default
5. Click Finish

Verify:
```
node --version
npm --version
```
Both should show version numbers.

---

## Step 2 — Install Expo CLI

```
npm install -g expo-cli eas-cli
```

---

## Step 3 — Install Project Dependencies

Open terminal in `E:\JAJPUR\JAJPUR-360` and run:

```
npm install
```

---

## Step 4 — Add Your Apps Script URL

1. Open: `src/config/api.ts`
2. Find: `YOUR_APPS_SCRIPT_WEB_APP_URL_HERE`
3. Replace with your actual URL from STEP 12 of the Sheets guide

---

## Step 5 — Run the App for Testing

```
npm start
```

This opens Expo Dev Tools in your browser.

To test on phone:
1. Install **Expo Go** from the Play Store
2. Scan the QR code shown in your terminal

---

## Step 6 — Run on Android Emulator (Optional)

```
npm run android
```

Requires Android Studio with an emulator configured.
