package com.example.offlineai;

import android.content.Context;
import android.os.AsyncTask;
import android.util.Log;
import android.webkit.WebView;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class DownloadManagerTask extends AsyncTask<String, Integer, String> {

    private final Context context;
    private final WebView webView;
    private final String targetFilePath;
    private final String modelName;
    private static final String TAG = "DownloadManagerTask";

    private volatile boolean isPaused = false;

    public DownloadManagerTask(Context context, WebView webView, String targetFilePath, String modelName) {
        this.context = context;
        this.webView = webView;
        this.targetFilePath = targetFilePath;
        this.modelName = modelName;
    }

    public void pause() {
        isPaused = true;
    }

    public void resume() {
        isPaused = false;
    }

    @Override
    protected String doInBackground(String... params) {
        String downloadUrl = params[0];
        HttpURLConnection connection = null;
        InputStream input = null;
        FileOutputStream output = null;

        try {
            URL url = new URL(downloadUrl);
            connection = (HttpURLConnection) url.openConnection();
            connection.connect();

            if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) {
                return "Server returned HTTP " + connection.getResponseCode() + " " + connection.getResponseMessage();
            }

            int fileLength = connection.getContentLength();

            input = connection.getInputStream();
            output = new FileOutputStream(targetFilePath);

            byte data[] = new byte[4096];
            long total = 0;
            int count;
            long lastPublishTime = 0;

            while ((count = input.read(data)) != -1) {
                while (isPaused && !isCancelled()) {
                    try { Thread.sleep(500); } catch (Exception ignored) {}
                }
                if (isCancelled()) {
                    input.close();
                    return "Cancelled";
                }
                total += count;
                
                // Throttle UI updates to roughly every 500ms
                long currentTime = System.currentTimeMillis();
                if (fileLength > 0 && currentTime - lastPublishTime > 500) {
                    publishProgress((int) (total * 100 / fileLength));
                    lastPublishTime = currentTime;
                }
                
                output.write(data, 0, count);
            }
        } catch (Exception e) {
            Log.e(TAG, "Download error", e);
            // Clean up partial file
            File file = new File(targetFilePath);
            if (file.exists()) file.delete();
            return e.toString();
        } finally {
            try {
                if (output != null) output.close();
                if (input != null) input.close();
            } catch (Exception ignored) {
            }
            if (connection != null) connection.disconnect();
        }
        return null;
    }

    @Override
    protected void onProgressUpdate(Integer... progress) {
        super.onProgressUpdate(progress);
        int percent = progress[0];
        Log.d(TAG, "Download progress: " + percent + "%");
        
        // Push progress to WebView via JS evaluation
        if (webView != null) {
            webView.post(() -> {
                String jsCode = String.format("if (window.onModelDownloadProgress) { window.onModelDownloadProgress('%s', %d); }", modelName, percent);
                webView.evaluateJavascript(jsCode, null);
            });
        }
    }

    @Override
    protected void onPostExecute(String result) {
        super.onPostExecute(result);
        if (webView != null) {
            webView.post(() -> {
                if (result == null) {
                    // Success (100%)
                    String jsCode = String.format("if (window.onModelDownloadProgress) { window.onModelDownloadProgress('%s', 100); }", modelName);
                    webView.evaluateJavascript(jsCode, null);
                } else {
                    // Error (-1 indicates error to the frontend)
                    Log.e(TAG, "Download failed: " + result);
                    String jsCode = String.format("if (window.onModelDownloadProgress) { window.onModelDownloadProgress('%s', -1); }", modelName);
                    webView.evaluateJavascript(jsCode, null);
                }
            });
        }
    }
}
