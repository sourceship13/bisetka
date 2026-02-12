# Fastlane Match Setup Guide

This guide will help you set up Fastlane Match to manage iOS code signing certificates and provisioning profiles in a Git repository.

## Step 1: Create a Private Git Repository

1. **Create a new private repository on GitHub**:
   - Go to https://github.com/new
   - Name it `bisetka-certificates` (or similar)
   - Make it **PRIVATE** (certificates must be encrypted and private)
   - Don't initialize with README

2. **Update the Matchfile** at `ios/Matchfile`:
   ```ruby
   git_url("https://github.com/sourceship13/bisetka-certificates")
   storage_mode("git")
   type("appstore")
   
   app_identifier(["org.sera.dev.bisetka"])
   username("aj@sera.dev")  # Your Apple Developer account email
   
   readonly(ENV['CI'] == 'true')
   ```

## Step 2: Initialize Match (First Time Setup)

Run this locally on your Mac:

```bash
cd ios
bundle exec fastlane match appstore
```

This will:
- Ask for a passphrase to encrypt certificates (save this securely!)
- Generate certificates and provisioning profiles
- Push them to your Git repository (encrypted)

## Step 3: Configure GitHub Secrets

Add these secrets to your GitHub repository at:
`Settings → Secrets and variables → Actions → New repository secret`

### Required Secrets:

1. **MATCH_PASSWORD**
   - The passphrase you used in Step 2

2. **MATCH_GIT_BASIC_AUTHORIZATION**
   - Generate a GitHub Personal Access Token (PAT):
     - Go to https://github.com/settings/tokens
     - Click "Generate new token (classic)"
     - Select scopes: `repo` (full control of private repositories)
     - Copy the token
   - Create the authorization string:
     ```bash
     echo -n "YOUR_GITHUB_USERNAME:YOUR_GITHUB_PAT" | base64
     ```
   - Save the base64 output as the secret value

3. **APP_STORE_API_KEY_ID** (already set)
   - Your App Store Connect API Key ID

4. **APP_STORE_ISSUER_ID** (already set)
   - Your App Store Connect Issuer ID

5. **APP_STORE_API_KEY_CONTENT** (already set)
   - Your .p8 file content

## Step 4: Update Xcode Project Settings

1. Open `ios/bisetka.xcworkspace` in Xcode
2. Select the **bisetka** target
3. Go to **Signing & Capabilities** tab
4. **Uncheck** "Automatically manage signing"
5. Set:
   - **Provisioning Profile**: Select the profile match created
   - **Team**: Your Apple Developer Team

## Step 5: Verify Match Works Locally

Test that match can download certificates:

```bash
cd ios
bundle exec fastlane match appstore --readonly
```

This should download and install the certificates without prompting for anything.

## Step 6: Test GitHub Actions

Push your changes to the `staging` branch:

```bash
git add .
git commit -m "Setup fastlane match for code signing"
git push origin staging
```

The workflow should now:
1. Clone your certificates repository
2. Decrypt certificates using MATCH_PASSWORD
3. Install them to the CI keychain
4. Build and sign the app
5. Upload to TestFlight

## Troubleshooting

### "No profiles found"
- Make sure you ran `fastlane match appstore` locally first
- Check that the git repository has files in the `certs` and `profiles` folders

### "Authentication failed"
- Verify MATCH_GIT_BASIC_AUTHORIZATION is correctly base64 encoded
- Make sure the GitHub PAT has `repo` scope

### "Wrong passphrase"
- Double-check MATCH_PASSWORD matches what you used in `fastlane match appstore`

### "Team not found"
- Update Matchfile with correct team_id if you have multiple teams:
  ```ruby
  team_id("YOUR_TEAM_ID")
  ```

## Match Commands Reference

```bash
# Generate new certificates and profiles
fastlane match appstore

# Download existing certificates (read-only)
fastlane match appstore --readonly

# Nuke all certificates and start fresh (dangerous!)
fastlane match nuke appstore

# Add a new device and regenerate profiles
fastlane match appstore --force_for_new_devices
```

## Benefits of Match

- ✅ All team members share the same certificates
- ✅ CI/CD works without manual certificate management
- ✅ Certificates are backed up and encrypted
- ✅ Automatic certificate renewal
- ✅ Works with multiple apps and environments

## Next Steps

Once match is set up, you can add more app identifiers or certificate types (development, adhoc) to the Matchfile as needed.
