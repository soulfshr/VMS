# DevWidget - RippleVMS Health Monitor

An iOS app with a Home Screen widget for monitoring RippleVMS health status.

## Features

- **Home Screen Widget**: Glanceable status display (small and medium sizes)
- **Push Notifications**: Real-time alerts for system issues
- **Secure API Key Storage**: Credentials stored in iOS Keychain

## Setup

### 1. Open in Xcode

```bash
open DevWidget.xcodeproj
```

### 2. Configure Signing

1. Select the project in the navigator
2. Select each target (DevWidget and StatusWidgetExtension)
3. Under "Signing & Capabilities", select your Team
4. Update the Bundle Identifier if needed (must be unique)

### 3. Enable App Groups (Required for Widget)

Both targets must use the same App Group for Keychain sharing:

1. Select DevWidget target > Signing & Capabilities
2. Ensure "App Groups" capability is enabled with `group.com.ripple.DevWidget`
3. Repeat for StatusWidgetExtension target

### 4. Enable Push Notifications

1. Select DevWidget target > Signing & Capabilities
2. Add "Push Notifications" capability
3. Ensure "Background Modes" > "Remote notifications" is checked

### 5. Run the App

1. Select your device or simulator
2. Build and run (Cmd+R)
3. Configure API key in the app's settings

## Getting an API Key

1. Log in to your RippleVMS as a Developer
2. Go to **Developer > Widget Keys**
3. Click "Create New Key"
4. Copy the key immediately (only shown once!)
5. Enter the key and your server URL in the app

## Server Configuration

The backend requires these environment variables for push notifications:

```bash
# Apple Push Notification Service
APNS_KEY_ID=ABC123DEFG          # 10-character Key ID from Apple
APNS_TEAM_ID=TEAM123456         # 10-character Team ID
APNS_PRIVATE_KEY=base64encoded  # .p8 file contents, base64 encoded
APNS_BUNDLE_ID=com.ripple.DevWidget
```

To encode your .p8 file:
```bash
base64 -i AuthKey_ABC123DEFG.p8 | tr -d '\n'
```

## Widget Sizes

- **Small**: Overall status, user count, error count
- **Medium**: Full status with service health details

## Architecture

```
DevWidget/
├── DevWidget/          # Main iOS app
│   ├── DevWidgetApp.swift
│   ├── ContentView.swift
│   └── SettingsView.swift
├── StatusWidgetExtension/  # Widget extension
│   └── StatusWidget.swift
└── Shared/             # Shared code (both targets)
    ├── APIClient.swift
    ├── StatusModel.swift
    └── KeychainHelper.swift
```

## API Endpoints

The widget communicates with these endpoints:

- `GET /api/widget/status` - Fetch current health status
- `POST /api/widget/register-device` - Register APNs device token
