# TE CONNECT — Android APK Build Guide

> This guide will help you build and install the TE CONNECT Android app. You do NOT need Android Studio or advanced technical knowledge.

---

## Method 1 — EAS Build (Recommended for Beginners)

This method builds your APK in the cloud. You only need to run a few commands.

### Prerequisites

Before you start, make sure:
- You have **Node.js** installed (download from nodejs.org — choose LTS version)
- You have a **terminal/command prompt** open
- You are inside the `JAJPUR-360` folder in your terminal
- The `src/config/api.ts` file has your Google Apps Script URL

---

### Step 1 — Install Node.js

1. Go to **nodejs.org**
2. Download the **LTS** version for Windows
3. Run the installer and follow the steps
4. Restart your computer after installation

---

### Step 2 — Open Terminal in Your Project Folder

1. Open **File Explorer**
2. Go to `E:\JAJPUR\JAJPUR-360`
3. In the address bar at the top, type `cmd` and press Enter
4. A black terminal window opens in the correct folder

---

### Step 3 — Install Project Dependencies

In the terminal, type this and press Enter:

```
npm install
```

Wait for it to finish. It may take 2–5 minutes. You will see many lines of text — this is normal.

---

### Step 4 — Install EAS CLI

```
npm install -g eas-cli
```

---

### Step 5 — Login to Expo

```
eas login
```

If you don't have an Expo account:
1. Go to **expo.dev**
2. Click Sign Up
3. Create a free account
4. Come back and run `eas login` again

---

### Step 6 — Configure Your Project

```
eas build:configure
```

Press Enter to accept the defaults.

---

### Step 7 — Build the APK

```
npm run build:apk
```

This will:
1. Upload your code to Expo's build servers
2. Build the Android APK in the cloud
3. Provide a download link when complete

⚠️ This can take **5–15 minutes**. Do not close the terminal.

---

### Step 8 — Download and Install the APK

1. When the build is complete, you will see a URL in the terminal.
2. Copy the URL and open it in your browser.
3. Download the APK file.
4. Transfer the APK to your Android phone via USB or WhatsApp.
5. On your Android phone:
   - Go to **Settings → Security**
   - Enable **Install from unknown sources**
   - Tap the APK file
   - Tap **Install**
6. Open **TE CONNECT** from your home screen.

---

## Method 2 — Local Build (Advanced)

If you prefer to build locally:

### Prerequisites
- Android Studio installed
- Android SDK configured
- Java JDK installed

### Steps

```bash
npm install
npx expo prebuild --platform android
cd android
.\gradlew assembleRelease
```

The APK will be at:
`android/app/build/outputs/apk/release/app-release.apk`

---

## Updating the App

When you need to update:
1. Make your changes to the code
2. Run `npm run build:apk` again
3. Download and install the new APK

> ⚠️ Users need to uninstall the old version first, OR increase the `versionCode` in `app.json` before rebuilding.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `npm` not found | Reinstall Node.js from nodejs.org |
| Build fails with auth error | Run `eas login` again |
| App installs but shows error | Check the API URL in `src/config/api.ts` |
| "Parse error" on install | The APK file is corrupted. Re-download it |
