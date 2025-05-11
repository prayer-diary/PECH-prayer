# Push Notification Permission Flow Diagram

## Overall Flow Diagram

```mermaid
flowchart TD
    A[User Login] --> B{Check Profile Set}
    B -->|Profile Not Set| C[Show Profile View]
    B -->|Profile Set| D[Show App View]
    
    E[Login-State-Changed Event] --> F[Initialize Push Notifications]
    A --> E
    
    F --> G{Check Device Type}
    
    G -->|iOS| H[Check iOS Version]
    G -->|Android| I[Check Notification Preferences]
    G -->|Other| I
    
    H --> J{iOS 16.4+?}
    J -->|No| K[Show Version Not Supported]
    J -->|Yes| L{PWA Installed?}
    
    L -->|No| M[Show Install Instructions]
    L -->|Yes| N[Check User Preferences]
    
    N --> O{Notification Method = Push?}
    O -->|Yes| P[Request Permission]
    O -->|No| Q[Skip Push Setup]
    
    I --> O
    
    P --> R{Permission Granted?}
    R -->|Yes| S[Subscribe to Push]
    R -->|No| T[Handle Denial]
    
    T -->|iOS| U[Show Settings Reset Guide]
    T -->|Android| V[Show Browser Settings Guide]
    
    S --> W[Save Subscription to DB]
    W --> X[Push Notifications Active]
```

## iOS Specific Flow

```mermaid
flowchart TD
    A[iOS Device Detected] --> B{Check iOS Version}
    B --> C{Version >= 16.4?}
    C -->|No| D[Show "iOS 16.4+ Required"]
    C -->|Yes| E{PWA Installed?}
    
    E -->|No| F[Show PWA Install Guide]
    F --> G[User Must Install Manually]
    G --> H[Safari Share Menu]
    H --> I[Add to Home Screen]
    I --> J[Launch from Home Screen]
    J --> K[Retry Notification Setup]
    
    E -->|Yes| L{Check Permission}
    L --> M{Previously Denied?}
    M -->|Yes| N[Show Safari Settings Reset]
    M -->|No| O[Request Permission]
    O --> P{Granted?}
    P -->|Yes| Q[Subscribe to Push]
    P -->|No| R[Ask Later or Denied]
    
    style F fill:#f9f,stroke:#333,stroke-width:2px
    style N fill:#f99,stroke:#333,stroke-width:2px
```

## Android Specific Flow

```mermaid
flowchart TD
    A[Android Device Detected] --> B{PWA Install Available?}
    B -->|Yes| C[Show Install Button]
    B -->|No| D[Skip Install Prompt]
    
    C --> E[beforeinstallprompt Event]
    E --> F[User Clicks Install]
    F --> G[Show Browser Install Dialog]
    G --> H{Install Confirmed?}
    H -->|Yes| I[Launch PWA]
    H -->|No| J[Continue in Browser]
    
    D --> K[Check Notification Preferences]
    I --> K
    J --> K
    
    K --> L{User Wants Push?}
    L -->|Yes| M[Request Permission]
    L -->|No| N[Skip Push Setup]
    
    M --> O{Permission Granted?}
    O -->|Yes| P[Ensure Service Worker]
    O -->|No| Q[Show Browser Settings]
    
    P --> R[Subscribe to Push]
    R --> S[Save to Database]
    
    style C fill:#9f9,stroke:#333,stroke-width:2px
    style P fill:#99f,stroke:#333,stroke-width:2px
```

## User Profile Integration Flow

```mermaid
flowchart TD
    A[User Visits Profile Page] --> B[Load Profile Settings]
    B --> C[Show Notification Options]
    C --> D{User Selects "Yes" for Notifications}
    
    D -->|No| E[Hide Notification Options]
    D -->|Yes| F{Platform Check}
    
    F -->|iOS Non-PWA| G[Revert Selection]
    G --> H[Show PWA Install Guide]
    
    F -->|iOS PWA or Android| I[Request Permission Immediately]
    I --> J{Permission Granted?}
    
    J -->|Yes| K[Show Test Panel]
    K --> L[Enable Test Button]
    
    J -->|No| M[Revert Selection]
    M --> N[Show Permission Help]
    
    style G fill:#f99,stroke:#333,stroke-width:2px
    style K fill:#9f9,stroke:#333,stroke-width:2px
```

## Service Worker Registration Flow

```mermaid
flowchart TD
    A[Service Worker Registration] --> B{Existing SW?}
    B -->|Yes| C[Check if Active]
    B -->|No| D[Register New SW]
    
    C --> E{Is Active?}
    E -->|Yes| F[Use Existing Registration]
    E -->|No| G[Force Activation]
    
    D --> H{Platform?}
    H -->|Android| I[Add Cache-Busting Query]
    H -->|Other| J[Standard Registration]
    
    I --> K[Register with Timestamp]
    J --> K
    K --> L{SW Installing?}
    L -->|Yes| M[Send skipWaiting Message]
    M --> N[Wait for Activation]
    N --> O[SW Ready for Push]
    L -->|No| O
    
    style I fill:#99f,stroke:#333,stroke-width:2px
    style O fill:#9f9,stroke:#333,stroke-width:2px
```

## Permission Request Flow

```mermaid
flowchart TD
    A[requestNotificationPermission] --> B{Browser Support?}
    B -->|No| C[Show Not Supported]
    B -->|Yes| D{Current Permission?}
    
    D -->|granted| E[Already Granted - Subscribe]
    D -->|denied| F{Platform Check}
    D -->|default| G[Show Custom Prompt]
    
    F -->|iOS| H[Show Safari Reset Guide]
    F -->|Android| I[Show Browser Settings]
    F -->|Other| J[Show Generic Help]
    
    G --> K[User Decides]
    K -->|Allow| L[Request Browser Permission]
    K -->|Later| M[Dismiss Prompt]
    
    L --> N{Browser Response?}
    N -->|granted| O[Subscribe to Push]
    N -->|denied| P[Handle Platform-Specific Denial]
    
    O --> Q[Save Subscription]
    Q --> R[Update User Profile]
    
    style E fill:#9f9,stroke:#333,stroke-width:2px
    style H fill:#f99,stroke:#333,stroke-width:2px
    style O fill:#9f9,stroke:#333,stroke-width:2px
```

## Testing Flow

```mermaid
flowchart TD
    A[Test Notification Button Clicked] --> B{Platform Detection}
    B --> C[Log Device Debug Info]
    C --> D[Prepare Test Notification]
    
    D --> E{Content Type}
    E -->|prayer_update| F[Set Update View]
    E -->|urgent_prayer| G[Set Urgent View]
    
    F --> H[Create Test Payload]
    G --> H
    
    H --> I{Platform Options?}
    I -->|Android| J[Add High Priority]
    I -->|iOS| K[Add iOS-Specific Options]
    I -->|Other| L[Add Standard Options]
    
    J --> M[Send via Edge Function]
    K --> M
    L --> M
    
    M --> N{Success?}
    N -->|Yes| O[Show Success Toast]
    N -->|No| P[Show Error Toast]
    
    O --> Q[Wait for Notification]
    Q --> R[Click Notification]
    R --> S[Navigate to Correct View]
    
    style C fill:#99f,stroke:#333,stroke-width:2px
    style S fill:#9f9,stroke:#333,stroke-width:2px
```

## Key Platform Differences Summary

| Feature | iOS | Android | Other Browsers |
|---------|-----|---------|----------------|
| **Minimum Version** | iOS 16.4+ | Most modern versions | Modern browsers |
| **PWA Requirement** | Must be installed | Optional (recommended) | Optional |
| **Installation Method** | Manual via Safari | Automatic prompt | Browser-dependent |
| **Permission Reset** | Safari → Settings → Advanced → Website Data | Browser/System Settings | Browser Settings |
| **Service Worker** | Standard registration | Cache-busting registration | Standard registration |
| **Notification Options** | Basic options | Full options with priority | Standard options |
| **Error Handling** | iOS-specific guides | Android-specific guides | Generic guides |

## Error States and Recovery

```mermaid
flowchart TD
    A[Error Detected] --> B{Error Type}
    
    B -->|Version Not Supported| C[Show Version Requirements]
    B -->|Permission Denied| D{Platform?}
    B -->|Service Worker Failed| E[Retry Registration]
    B -->|Subscription Failed| F[Check Permission Again]
    
    D -->|iOS| G[Show Safari Settings Guide]
    D -->|Android| H[Show Browser Settings Guide]
    D -->|Other| I[Show Generic Recovery]
    
    E --> J[Clear Cache]
    J --> K[Re-register SW]
    K --> L{Success?}
    L -->|Yes| M[Continue Setup]
    L -->|No| N[Show Manual Refresh Option]
    
    F --> O[Re-request Permission]
    O --> P[Try Subscription Again]
    
    style G fill:#f99,stroke:#333,stroke-width:2px
    style K fill:#9f9,stroke:#333,stroke-width:2px
```

This comprehensive flow diagram shows how the notification permission system handles different devices, platforms, and error states while maintaining a smooth user experience across iOS and Android devices.
