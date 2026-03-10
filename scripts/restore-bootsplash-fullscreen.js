#!/usr/bin/env node

/**
 * Restore Full-Screen Splash Image for iOS
 * 
 * Problem: `npx react-native-bootsplash generate` creates a centered-logo layout only.
 * This overwrites the iOS BootSplash.storyboard, removing the full-screen background image.
 * 
 * Solution: This script restores the full-screen background layer after bootsplash generation.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const STORYBOARD_PATH = path.join(__dirname, '../ios/bisetka/BootSplash.storyboard');
const IMAGESET_PATH = path.join(__dirname, '../ios/bisetka/Images.xcassets/BootSplashFullImage.imageset');
const SOURCE_IMAGE = path.join(__dirname, '../assets/bootsplash/splash_fullscreen.png');

console.log('🔧 Restoring full-screen splash image for iOS...');

// Step 1: Create the imageset directory if it doesn't exist
if (!fs.existsSync(IMAGESET_PATH)) {
  console.log('📁 Creating BootSplashFullImage.imageset...');
  fs.mkdirSync(IMAGESET_PATH, { recursive: true });
}

// Step 2: Copy the full-screen images from Android or source
const ANDROID_PATHS = {
  '1x': '../android/app/src/main/res/drawable-mdpi/bootsplash_bg.png',
  '2x': '../android/app/src/main/res/drawable-xxhdpi/bootsplash_bg.png',
  '3x': '../android/app/src/main/res/drawable-xxxhdpi/bootsplash_bg.png',
};

console.log('🖼️  Copying full-screen images...');
for (const [scale, androidPath] of Object.entries(ANDROID_PATHS)) {
  const src = path.join(__dirname, androidPath);
  const dest = path.join(IMAGESET_PATH, `splash${scale === '1x' ? '' : '@' + scale}.png`);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`   ✅ ${scale}: ${path.basename(dest)}`);
  } else {
    console.warn(`   ⚠️  ${scale}: Source not found: ${src}`);
  }
}

// Step 3: Create Contents.json for the imageset
const contentsJson = {
  images: [
    { filename: 'splash.png', idiom: 'universal', scale: '1x' },
    { filename: 'splash@2x.png', idiom: 'universal', scale: '2x' },
    { filename: 'splash@3x.png', idiom: 'universal', scale: '3x' },
  ],
  info: { author: 'xcode', version: 1 },
};

fs.writeFileSync(
  path.join(IMAGESET_PATH, 'Contents.json'),
  JSON.stringify(contentsJson, null, 2)
);
console.log('✅ Contents.json created');

// Step 4: Update the storyboard to replace small logo with full-screen image only
console.log('📝 Updating BootSplash.storyboard...');

let storyboard = fs.readFileSync(STORYBOARD_PATH, 'utf8');

// Check if full-screen image already exists (and is the only imageView)
if (storyboard.includes('BootSplashFullImage') && !storyboard.includes('BootSplashLogo-624c48')) {
  console.log('✅ Storyboard already has full-screen image only');
} else {
  // Replace the entire storyboard with full-screen only version
  const correctStoryboard = `<?xml version="1.0" encoding="UTF-8"?>
<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="21701" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" launchScreen="YES" useTraitCollections="YES" useSafeAreas="YES" colorMatched="YES" initialViewController="01J-lp-oVM">
    <device id="retina4_7" orientation="portrait" appearance="light"/>
    <dependencies>
        <deployment identifier="iOS"/>
        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="21678"/>
        <capability name="Named colors" minToolsVersion="9.0"/>
        <capability name="Safe area layout guides" minToolsVersion="9.0"/>
        <capability name="documents saved in the Xcode 8 format" minToolsVersion="8.0"/>
    </dependencies>
    <scenes>
        <!--View Controller-->
        <scene sceneID="EHf-IW-A2E">
            <objects>
                <viewController modalTransitionStyle="crossDissolve" id="01J-lp-oVM" sceneMemberID="viewController">
                    <view key="view" autoresizesSubviews="NO" contentMode="scaleToFill" id="Ze5-6b-2t3">
                        <rect key="frame" x="0.0" y="0.0" width="375" height="667"/>
                        <autoresizingMask key="autoresizingMask" widthSizable="YES" heightSizable="YES"/>
                        <subviews>
                            <imageView autoresizesSubviews="NO" clipsSubviews="YES" userInteractionEnabled="NO" contentMode="scaleAspectFill" image="BootSplashFullImage" translatesAutoresizingMaskIntoConstraints="NO" id="Fkg-Bx-1aQ">
                                <rect key="frame" x="0.0" y="0.0" width="375" height="667"/>
                                <accessibility key="accessibilityConfiguration">
                                    <accessibilityTraits key="traits" image="YES" notEnabled="YES"/>
                                </accessibility>
                            </imageView>
                        </subviews>
                        <viewLayoutGuide key="safeArea" id="Bcu-3y-fUS"/>
                        <color key="backgroundColor" name="BootSplashBackground-624c48"/>
                        <constraints>
                            <constraint firstItem="Fkg-Bx-1aQ" firstAttribute="top" secondItem="Ze5-6b-2t3" secondAttribute="top" id="bgT-aa-top"/>
                            <constraint firstItem="Fkg-Bx-1aQ" firstAttribute="leading" secondItem="Ze5-6b-2t3" secondAttribute="leading" id="bgL-aa-lea"/>
                            <constraint firstAttribute="trailing" secondItem="Fkg-Bx-1aQ" secondAttribute="trailing" id="bgR-aa-tra"/>
                            <constraint firstAttribute="bottom" secondItem="Fkg-Bx-1aQ" secondAttribute="bottom" id="bgB-aa-bot"/>
                        </constraints>
                    </view>
                </viewController>
                <placeholder placeholderIdentifier="IBFirstResponder" id="iYj-Kq-Ea1" userLabel="First Responder" sceneMemberID="firstResponder"/>
            </objects>
            <point key="canvasLocation" x="0.0" y="0.0"/>
        </scene>
    </scenes>
    <resources>
        <image name="BootSplashFullImage" width="360" height="640"/>
        <namedColor name="BootSplashBackground-624c48">
            <color red="0.0588235294117647" green="0.0470588235294118" blue="0.160784313725490" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>
        </namedColor>
    </resources>
</document>
`;
  
  fs.writeFileSync(STORYBOARD_PATH, correctStoryboard);
  console.log('✅ Storyboard replaced with full-screen only version');
}

console.log('');
console.log('🎉 Full-screen splash image restored!');
console.log('');
console.log('⚠️  IMPORTANT: Always use `npm run bootsplash:generate` instead of');
console.log('   running `npx react-native-bootsplash generate` directly.');
console.log('   This ensures the full-screen background is preserved.');
