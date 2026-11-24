package com.streamcut.app;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.Window;

public class MainActivity extends Activity {
    private static final String BUNDLED_APP = "file:///android_asset/www/index.html";

    private WebView webView;
    private boolean fellBackToLocal = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                // Only recover when the *page itself* failed. A failed favicon or
                // sub-resource used to trigger this too, which reloaded the bundled
                // app over a working remote session.
                if (failingUrl == null || !failingUrl.startsWith("http")) return;
                if (fellBackToLocal) return;
                fellBackToLocal = true;
                view.loadUrl(BUNDLED_APP);
            }
        });

        setContentView(webView);

        String server = BuildConfig.STREAMCUT_SERVER_URL;
        if (server != null && server.startsWith("http")) {
            // Trim any trailing slash so "/api/health" concatenation stays valid.
            if (server.endsWith("/")) server = server.substring(0, server.length() - 1);
            webView.loadUrl(server);
        } else {
            // No backend baked in. The bundled UI still browses saved projects and
            // plays exported clips; importing links or rendering needs a server, so
            // set streamcutServerUrl at build time (see app/build.gradle).
            fellBackToLocal = true;
            webView.loadUrl(BUNDLED_APP);
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
