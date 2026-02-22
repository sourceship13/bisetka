fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## iOS

### ios staging

```sh
[bundle exec] fastlane ios staging
```

Build and deploy staging to TestFlight

### ios production

```sh
[bundle exec] fastlane ios production
```

Build production release

### ios sync_push_profiles

```sh
[bundle exec] fastlane ios sync_push_profiles
```

Regenerate provisioning profiles with Push Notifications enabled. Run this after enabling Push Notifications in Apple Developer Portal.

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
