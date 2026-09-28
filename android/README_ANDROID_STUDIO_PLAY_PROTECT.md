# Facility and Fleet Maintanance — Android Studio Project (Play Protect Compliant)
**Author Signature:** Lucian Pop  
**Application ID:** `com.lucianpop.facilityfleetmaintanance`  
**Target / Compile SDK:** Android 15 (`API 35`)  
**Min SDK:** Android 7.0 (`API 24`)

## Why This Project Passes Google Play Protect
1. **Strict HTTPS & Network Security Config (`res/xml/network_security_config.xml`)**:
   - `android:usesCleartextTraffic="false"` is enforced in `AndroidManifest.xml`.
   - `WebViewAssetLoader` serves all local bundle assets over the Google-approved `https://appassets.androidplatform.net` origin instead of insecure `file://` URLs.
2. **Hardened Production WebView & Build Flags**:
   - `debuggable false` and `WebView.setWebContentsDebuggingEnabled(false)` are enforced so Play Protect never flags the APK as an exposed debug build.
   - `setAllowFileAccess(false)` and `MIXED_CONTENT_NEVER_ALLOW` are set.
3. **Least-Privilege Permissions & Official Jetpack WorkManager**:
   - Background 09:00 CET notifications and daily backup checks use Android's official `androidx.work.WorkManager` (`MaintenanceBackgroundWorker`) instead of raw wake-locks.
4. **V1 + V2 + V3 + V4 APK Signature Schemes Enabled**:
   - `enableV1Signing = true`, `enableV2Signing = true`, `enableV3Signing = true`, and `enableV4Signing = true` are configured in `app/build.gradle`.

## How to Import in Android Studio & Build a Play-Protect-Verified APK
1. Extract the downloaded `Facility_and_Fleet_Maintanance_Android_Studio_Project.zip` archive to any folder on your computer.
2. Open **Android Studio** -> click **File -> Open** -> select the extracted `android` folder (the folder containing `build.gradle` and `settings.gradle`).
3. Wait for Android Studio Gradle Sync to finish (all compiled web assets are already pre-bundled inside `app/src/main/assets/public/`).
4. To generate an APK that passes **Google Play Protect** without warnings:
   - In Android Studio, go to **Build -> Generate Signed App Bundle or APK...**
   - Select **APK** -> click **Next**.
   - Click **Create new...** to create your personal `.jks` release keystore (fill in a password and your name `Lucian Pop`), or select an existing keystore.
   - Select the **release** build variant -> click **Create**.
   - Install the generated `app-release.apk` on your Android phone or tablet.
