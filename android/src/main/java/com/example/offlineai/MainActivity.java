package com.example.offlineai;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private OfflineAIBridge offlineAIBridge;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        webView = new WebView(this);
        setContentView(webView);

        // Configure WebView settings for modern React/Vite app
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);

        // Bind the native Android interface
        offlineAIBridge = new OfflineAIBridge(this, this, webView);
        webView.addJavascriptInterface(offlineAIBridge, "Android");

        // Prevent opening links in external browser
        webView.setWebViewClient(new WebViewClient());

        // Load the local HTML file or hosted web app
        // In development, this could be your local network IP (e.g., http://192.168.1.X:3000)
        // In production, this would be file:///android_asset/index.html
        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == 9999 && resultCode == RESULT_OK && data != null) {
            Uri treeUri = data.getData();
            if (treeUri != null) {
                // Persist permissions
                getContentResolver().takePersistableUriPermission(treeUri,
                        Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                
                if (offlineAIBridge != null) {
                    offlineAIBridge.updateModelsDirectory(treeUri);
                }
            }
        }
    }
}
