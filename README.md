# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## OTA updates (EAS Update)

This app uses [EAS Update](https://docs.expo.dev/eas-update/introduction/) for over-the-air JavaScript updates.

### Prerequisites

1. Log in: `npx eas-cli@latest login`
2. Confirm channel mapping: `npm run channel:list` (`preview` and `production` channels should point to matching branches)
3. Test OTA with an EAS-built binary (preview or production profile), not a local dev client

### Publish an update

```bash
# Staging / preview builds
npm run update:preview

# Production builds
npm run update:production
```

Updates are downloaded in the background and applied on the next cold launch. Runtime version follows `app.json` `expo.version` (`runtimeVersion.policy: appVersion`), so bump `expo.version` and ship a new native build when native dependencies change.

### Inspect updates

```bash
npm run update:list
npm run channel:list
```

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
