# Android Offline AI Native Integration Guide

This guide will walk you through implementing **real offline LLM inference** in your Android app using the popular **llama.cpp** library. 

Since you are running the UI in a `WebView`, the web code calls your `MainActivity.java` via `Android.processOfflineInference()`. Currently, this method just returns a dummy string. To make it work for real, we need to add a C++ library to execute the `.gguf` AI model files.

Follow these steps carefully:

## 1. Add `llama.cpp` Android Dependency

Instead of compiling C++ yourself (which is very difficult), we can use a pre-built Java wrapper for Android called **`llama.cpp-android`** or use **MediaPipe LLM Inference API**.

For this guide, we will use **Google's MediaPipe Tasks GenAI**, which is the easiest and most modern way to run `.gguf` and `.bin` models natively on Android.

### Add dependencies in your `app/build.gradle`:

Open your Android project and go to `app/build.gradle` (the module-level one). Add this in the `dependencies` block:

```gradle
dependencies {
    // Other dependencies...
    implementation 'com.google.mediapipe:tasks-genai:0.10.14'
}
```

Make sure your `minSdkVersion` is at least **24**.

## 2. Update your `MainActivity.java`

You need to replace your `processOfflineInference` dummy function with the real MediaPipe LlmInference code. 

Here is how you modify the `WebAppInterface` in your `MainActivity.java`:

```java
import com.google.mediapipe.tasks.genai.llminference.LlmInference;
import java.io.File;

// ... Inside your MainActivity class ...

    // Store the LlmInference instance so we don't reload it every time
    private LlmInference llmInference;
    private String currentLoadedModel = "";

    public class WebAppInterface {
        
        // ... your other methods (saveFile, downloadModel, etc.) ...
        
        @JavascriptInterface
        public String processOfflineInference(final String prompt, final String modelFilename) {
            try {
                // 1. Get the path to the downloaded model
                File modelsDir = new File(getExternalFilesDir(null), "ai_models");
                File modelFile = new File(modelsDir, modelFilename);
                
                if (!modelFile.exists()) {
                    return "Error: Model file not found. Please download it first.";
                }

                String modelPath = modelFile.getAbsolutePath();

                // 2. Initialize the model if it's not loaded or if the user changed the model
                if (llmInference == null || !currentLoadedModel.equals(modelPath)) {
                    // Clean up old model if it exists
                    if (llmInference != null) {
                        llmInference.close();
                    }
                    
                    LlmInference.LlmInferenceOptions options = LlmInference.LlmInferenceOptions.builder()
                        .setModelPath(modelPath)
                        .setMaxTokens(1024)
                        .setTopK(40)
                        .setTemperature(0.8f)
                        .setRandomSeed(101)
                        .build();
                        
                    llmInference = LlmInference.createFromOptions(MainActivity.this, options);
                    currentLoadedModel = modelPath;
                }

                // 3. Generate the response
                // Note: The UI may freeze for a few seconds since this runs synchronously.
                // In a production app, you might want to run this in a background thread and use a callback!
                String response = llmInference.generateResponse(prompt);
                
                return response;
                
            } catch (Exception e) {
                e.printStackTrace();
                return "Error during native inference: " + e.getMessage();
            }
        }
    }
```

### Important Notes on the Above Code:
1. **Sync vs Async**: The `JavascriptInterface` runs on a background binder thread. However, loading a large model can take 5-10 seconds. `processOfflineInference` will block the JavaScript promise until it finishes. This is perfectly fine for your WebView architecture!
2. **Model Compatibility**: MediaPipe tasks support standard LLM models. For best compatibility, use `.bin` (Task formats) or specific `Gemma` and `Phi` models that you download from the UI.

## 3. Handling ProGuard

Since you are using ProGuard (as you mentioned earlier), you **must** ensure ProGuard doesn't break the Java Interface binding to the WebView, and doesn't break MediaPipe.

Add these rules to your `proguard-rules.pro` file:

```proguard
# Keep the Javascript Interface methods so the WebView can find them
-keepclassmembers class com.mycompany.examaipro.MainActivity$WebAppInterface {
   public *;
}

# Keep MediaPipe GenAI Tasks
-keep class com.google.mediapipe.** { *; }
-keepclassmembers class com.google.mediapipe.** { *; }
-dontwarn com.google.mediapipe.**

# Keep GSON/JSON classes if you use them
-keep class org.json.** { *; }
```

## Summary of Fixes

The error you saw earlier (`index-brka77mr.js`) was caused by the React app trying to call `window.AndroidBridge.saveFile()` while your new Java code exports it as `window.Android.saveFile()`. 

I have **fixed this in the web code**, and compiled a brand new `dist/` folder!

**Next Steps for you:**
1. Download the new `dist/` folder from this web app and put it into your Android's `android_asset/www/` folder.
2. Add the MediaPipe dependency to `build.gradle`.
3. Add the `LlmInference` code above to `MainActivity.java`.
4. Build the APK and test! You'll now have a fully functioning Offline AI on Android!
