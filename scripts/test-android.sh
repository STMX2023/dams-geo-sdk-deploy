#!/bin/bash

# Script to run Android unit tests for the dams-geo-sdk module

echo "Running Android Unit Tests for Native Geofencing Implementation"
echo "================================================================"

# Navigate to android directory
cd android

# Check if gradle wrapper exists in parent Android project
if [ -f "../../android/gradlew" ]; then
    echo "Using parent project gradle wrapper..."
    ../../android/gradlew test
elif [ -f "../../../android/gradlew" ]; then
    echo "Using grandparent project gradle wrapper..."
    ../../../android/gradlew :dams-geo-sdk:test
else
    echo "No gradle wrapper found. Attempting to run tests via expo-module..."
    cd ..
    
    # Try to run tests through expo-module scripts
    if [ -f "node_modules/.bin/expo-module" ]; then
        echo "Running Android tests through expo-module..."
        npx expo-module android:test
    else
        echo "ERROR: Cannot find a way to run Android tests."
        echo "Please ensure you have either:"
        echo "1. A gradle wrapper in the parent Android project"
        echo "2. expo-module scripts properly installed"
        exit 1
    fi
fi

echo "================================================================"
echo "Test execution complete"