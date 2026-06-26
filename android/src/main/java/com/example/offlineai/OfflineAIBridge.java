package com.example.offlineai;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;

public class OfflineAIBridge {

    private final Context context;
    private final WebView webView;
    private final Activity activity;
    private File modelsDirectory;
    private DownloadManagerTask currentDownloadTask;

    public OfflineAIBridge(Activity activity, Context context, WebView webView) {
        this.activity = activity;
        this.context = context;
        this.webView = webView;
        
        // Default models directory in external files (scoped storage)
        this.modelsDirectory = new File(context.getExternalFilesDir(null), "ai_models");
        if (!this.modelsDirectory.exists()) {
            this.modelsDirectory.mkdirs();
        }
    }

    public void updateModelsDirectory(Uri uri) {
        // Here we'd map the DocumentFile or persist permissions and use standard files
        // For simplicity, we just notify JS that a custom directory was picked
        webView.post(() -> {
            webView.evaluateJavascript("if(window.onStorageDirectorySelected) { window.onStorageDirectorySelected('Custom Directory Selected'); }", null);
        });
    }

    @JavascriptInterface
    public void setStorageDirectory() {
        // Launches native folder picker UI via SAF (Storage Access Framework)
        // Note: The actual ActivityResult handling should be in the Activity
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        activity.startActivityForResult(intent, 9999);
    }

    @JavascriptInterface
    public String getAvailableModels() {
        JSONArray modelsArray = new JSONArray();
        if (modelsDirectory != null && modelsDirectory.exists()) {
            File[] files = modelsDirectory.listFiles();
            if (files != null) {
                for (File file : files) {
                    if (file.isFile() && (file.getName().endsWith(".bin") || file.getName().endsWith(".gguf"))) {
                        try {
                            JSONObject modelObj = new JSONObject();
                            modelObj.put("name", file.getName());
                            modelObj.put("path", file.getAbsolutePath());
                            modelObj.put("sizeBytes", file.length());
                            modelsArray.put(modelObj);
                        } catch (JSONException e) {
                            e.printStackTrace();
                        }
                    }
                }
            }
        }
        return modelsArray.toString();
    }

    @JavascriptInterface
    public void downloadModel(String customUrl, String modelName) {
        // Starts background network download
        Toast.makeText(context, "Starting download: " + modelName, Toast.LENGTH_SHORT).show();
        
        File targetFile = new File(modelsDirectory, modelName);
        
        // Using the DownloadManagerTask to handle download in background
        currentDownloadTask = new DownloadManagerTask(context, webView, targetFile.getAbsolutePath(), modelName);
        currentDownloadTask.execute(customUrl);
    }

    @JavascriptInterface
    public void cancelDownload(String modelName) {
        if (currentDownloadTask != null && !currentDownloadTask.isCancelled()) {
            currentDownloadTask.cancel(true);
            currentDownloadTask = null;
        }
    }

    @JavascriptInterface
    public void pauseDownload(String modelName) {
        if (currentDownloadTask != null) {
            currentDownloadTask.pause();
        }
    }

    @JavascriptInterface
    public void resumeDownload(String modelName) {
        if (currentDownloadTask != null) {
            currentDownloadTask.resume();
        }
    }

    @JavascriptInterface
    public String processOfflineInference(String prompt, String modelFilename) {
        File modelFile = new File(modelsDirectory, modelFilename);
        if (!modelFile.exists()) {
            return "Error: Model file not found in local storage.";
        }
        
        // Initialize inference engine and run synchronously (for simple bridge design)
        // In production, you might want to run this asynchronously and stream back to JS
        try {
            return LocalInferenceEngine.generateText(modelFile.getAbsolutePath(), prompt);
        } catch (Exception e) {
            e.printStackTrace();
            return "Error during local inference: " + e.getMessage();
        }
    }

    @JavascriptInterface
    public boolean deleteModel(String modelFilename) {
        File modelFile = new File(modelsDirectory, modelFilename);
        if (modelFile.exists()) {
            return modelFile.delete();
        }
        return false;
    }

    @JavascriptInterface
    public String extractTextNatively(String localFileUri) {
        // Offline OCR / PDF extraction
        try {
            if (localFileUri.startsWith("data:application/pdf")) {
                // Handle base64 PDF
                return OfflineOcrEngine.extractTextFromBase64Pdf(context, localFileUri);
            } else if (localFileUri.startsWith("data:image/")) {
                // Handle base64 image via ML Kit Text Recognition
                return OfflineOcrEngine.extractTextFromBase64Image(context, localFileUri);
            } else {
                // Handle actual content:// or file:// URI
                Uri uri = Uri.parse(localFileUri);
                String mimeType = context.getContentResolver().getType(uri);
                if (mimeType != null && mimeType.equals("application/pdf")) {
                    return OfflineOcrEngine.extractTextFromPdfUri(context, uri);
                } else {
                    return OfflineOcrEngine.extractTextFromImageUri(context, uri);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
            return "Error extracting text offline: " + e.getMessage();
        }
    }
}
