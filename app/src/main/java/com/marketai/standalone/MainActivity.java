package com.marketai.standalone;

import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.os.Bundle;
import android.os.Build;
import android.Manifest;
import android.content.pm.PackageManager;
import android.webkit.WebResourceRequest;
import android.webkit.JavascriptInterface;
import android.view.WindowInsets;
import android.graphics.Insets;
import android.widget.FrameLayout;
import android.widget.Toast;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.graphics.Color;
import android.content.Intent;
import android.net.Uri;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    private WebView web;
    private String pendingText;
    private String pendingMime;
    private static final int EXPORT_REQUEST = 4107;
    private static final int NOTIFICATION_PERMISSION_REQUEST = 4108;
    private static final String SIGNAL_CHANNEL = "market_ai_signals";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createSignalChannel();
        requestNotificationPermission();

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

        web.addJavascriptInterface(new ExportBridge(), "AndroidExport");
        web.addJavascriptInterface(new NotifyBridge(), "AndroidNotify");
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

    private void createSignalChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    SIGNAL_CHANNEL,
                    "Market AI Signals",
                    NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("BUY / SELL signal alerts from Market AI Scalp");
            channel.enableVibration(true);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_PERMISSION_REQUEST);
        }
    }

    private class NotifyBridge {
        @JavascriptInterface
        public void signal(String title, String body, String key) {
            runOnUiThread(() -> postSignalNotification(title, body, key));
        }
    }

    private void postSignalNotification(String title, String body, String key) {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(
                this,
                0,
                open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, SIGNAL_CHANNEL)
                : new Notification.Builder(this);
        builder.setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title == null ? "Market AI Signal" : title)
                .setContentText(body == null ? "" : body.replace("\n", " • "))
                .setStyle(new Notification.BigTextStyle().bigText(body == null ? "" : body))
                .setAutoCancel(true)
                .setContentIntent(pi)
                .setPriority(Notification.PRIORITY_HIGH)
                .setCategory(Notification.CATEGORY_RECOMMENDATION);

        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) {
            int id = (key == null ? (int)(System.currentTimeMillis() & 0x7fffffff) : Math.abs(key.hashCode()));
            nm.notify(id, builder.build());
        }
    }

    private class ExportBridge {
        @JavascriptInterface
        public void saveTextFile(String name, String text, String mime) {
            runOnUiThread(() -> {
                pendingText = text;
                pendingMime = (mime == null || mime.isEmpty()) ? "text/plain" : mime;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType(pendingMime);
                intent.putExtra(Intent.EXTRA_TITLE, name);
                startActivityForResult(intent, EXPORT_REQUEST);
            });
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != EXPORT_REQUEST) return;
        if (resultCode != RESULT_OK || data == null || data.getData() == null) {
            pendingText = null;
            pendingMime = null;
            return;
        }

        Uri uri = data.getData();
        try (OutputStream out = getContentResolver().openOutputStream(uri, "w")) {
            if (out == null) throw new IllegalStateException("No output stream");
            out.write((pendingText == null ? "" : pendingText).getBytes(StandardCharsets.UTF_8));
            out.flush();
            Toast.makeText(this, "تم حفظ الملف", Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            Toast.makeText(this, "تعذر حفظ الملف", Toast.LENGTH_SHORT).show();
        } finally {
            pendingText = null;
            pendingMime = null;
        }
    }

    @Override
    protected void onPause() {
        // Keep the WebView polling while the app remains alive in the background,
        // so signal notifications can still be produced.
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.resumeTimers();
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.removeJavascriptInterface("AndroidExport");
            web.removeJavascriptInterface("AndroidNotify");
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
