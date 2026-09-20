package com.marketai.standalone;

import android.app.Activity;
import android.content.Intent;
import android.webkit.JavascriptInterface;
import java.io.OutputStream;
import java.io.File;
import java.nio.file.Files;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;
import android.os.Bundle;
import android.os.Build;
import android.webkit.WebResourceRequest;
import android.view.WindowInsets;
import android.graphics.Insets;
import android.widget.FrameLayout;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.graphics.Color;

public class MainActivity extends Activity {
    private WebView web;
    private static final int EXPORT_REQUEST = 210;
    private byte[] pendingExport;
    private File pendingFile() { return new File(getFilesDir(), "pending-signal-export"); }
    private void clearPending() {
        pendingExport = null;
        try { Files.deleteIfExists(pendingFile().toPath()); } catch (Exception ignored) { }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        outState.putBoolean("signalExportPending", pendingExport != null);
        super.onSaveInstanceState(outState);
    }

    private void exportStatus(String message) {
        runOnUiThread(() -> {
            if (web != null) web.evaluateJavascript(
                    "window.onSignalExportResult && window.onSignalExportResult(" + JSONObject.quote(message) + ")", null);
        });
    }

    private final class ExportBridge {
        @JavascriptInterface
        public void exportReport(String format, String contents) {
            if ((!"csv".equals(format) && !"json".equals(format)) || contents == null) return;
            byte[] bytes = contents.getBytes(StandardCharsets.UTF_8);
            if (bytes.length > 10 * 1024 * 1024) {
                exportStatus("حجم التصدير يتجاوز 10 MB."); return;
            }
            runOnUiThread(() -> {
                if (pendingExport != null) { exportStatus("أكمل نافذة الحفظ الحالية أولاً."); return; }
                pendingExport = bytes;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("csv".equals(format) ? "text/csv" : "application/json");
                intent.putExtra(Intent.EXTRA_TITLE, "Market_AI_signals_V2_1_" + System.currentTimeMillis() + "." + format);
                try { Files.write(pendingFile().toPath(), bytes); startActivityForResult(intent, EXPORT_REQUEST); }
                catch (Exception e) { clearPending(); exportStatus("تعذر فتح نافذة حفظ الملف."); }
            });
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != EXPORT_REQUEST) return;
        final byte[] bytes = pendingExport;
        clearPending();
        if (resultCode != RESULT_OK || data == null || data.getData() == null || bytes == null) {
            exportStatus("تم إلغاء التصدير؛ السجل محفوظ داخل التطبيق."); return;
        }
        final android.net.Uri destination = data.getData();
        new Thread(() -> {
            try (OutputStream out = getContentResolver().openOutputStream(destination, "wt")) {
                if (out == null) throw new java.io.IOException("No output stream");
                out.write(bytes);
                out.flush();
                exportStatus("تم حفظ ملف التصدير بنجاح.");
            } catch (Exception e) { exportStatus("تعذر حفظ ملف التصدير. اختر مكاناً آخر."); }
        }).start();
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (savedInstanceState != null && savedInstanceState.getBoolean("signalExportPending")) {
            try { if (pendingFile().length() <= 10 * 1024 * 1024) pendingExport = Files.readAllBytes(pendingFile().toPath()); }
            catch (Exception ignored) { clearPending(); }
        } else { clearPending(); }

        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(8, 12, 17));

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setLoadsImagesAutomatically(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(false);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);

        web.addJavascriptInterface(new ExportBridge(), "AndroidExports");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !request.getUrl().toString().startsWith("file:///android_asset/");
            }
        });
        FrameLayout container = new FrameLayout(this);
        container.addView(web, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        // Android 15+ enforces edge-to-edge for target 35: keep controls out of system bars.
        if (Build.VERSION.SDK_INT >= 35) {
            container.setOnApplyWindowInsetsListener((view, windowInsets) -> {
                Insets insets = windowInsets.getInsets(WindowInsets.Type.systemBars()
                        | WindowInsets.Type.displayCutout());
                view.setPadding(insets.left, insets.top, insets.right, insets.bottom);
                return windowInsets;
            });
        }
        web.loadUrl("file:///android_asset/index.html");

        setContentView(container);
    }

    @Override
    protected void onPause() {
        if (web != null) { web.evaluateJavascript("window.flushSignalHistory && window.flushSignalHistory()", null); web.onPause(); web.pauseTimers(); }
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) { web.onResume(); web.resumeTimers(); }
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
