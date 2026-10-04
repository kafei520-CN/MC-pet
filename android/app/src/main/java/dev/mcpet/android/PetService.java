package dev.mcpet.android;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.app.NotificationCompat;
import androidx.webkit.WebViewAssetLoader;

import org.json.JSONObject;

public class PetService extends Service {
    private static final String CHANNEL = "pet";
    private static PetService instance;
    private static WebView webView;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private WindowManager windows;
    private WindowManager.LayoutParams params;
    private boolean added;
    private float dragX;
    private float dragY;
    private int dragLeft;
    private int dragTop;
    private float velocityX;
    private float velocityY;
    private float lastRawX;
    private float lastRawY;
    private long lastMoveTime;
    private final Runnable watchHome = new Runnable() {
        @Override
        public void run() {
            applyVisibility();
            handler.postDelayed(this, 700);
        }
    };

    static void runJs(String script) {
        WebView view = webView;
        if (view == null) {
            return;
        }
        view.post(() -> view.evaluateJavascript(script, null));
    }

    static void reload() {
        runJs("window.petReload&&window.petReload()");
    }

    static void menu(String action) {
        runJs("window.petMenu&&window.petMenu(" + action + ")");
    }

    static void shift(int cssDx, int cssDy) {
        PetService service = instance;
        if (service == null) {
            return;
        }
        service.handler.post(() -> service.shiftOnMain(cssDx, cssDy));
    }

    static int screenX() {
        PetService service = instance;
        if (service == null || service.params == null) {
            return 0;
        }
        return Math.round(service.params.x / service.density());
    }

    static int screenWidth() {
        PetService service = instance;
        if (service == null) {
            return 0;
        }
        return Math.round(service.screenBounds().width() / service.density());
    }

    static int windowWidth() {
        PetService service = instance;
        if (service == null || service.params == null) {
            return 0;
        }
        return Math.round(service.params.width / service.density());
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        instance = this;
        startInForeground();
        ensureOverlay();
        handler.removeCallbacks(watchHome);
        handler.post(watchHome);
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        if (instance == this) {
            instance = null;
        }
        handler.removeCallbacks(watchHome);
        if (added && webView != null) {
            windows.removeView(webView);
            added = false;
        }
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    private void startInForeground() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        NotificationChannel channel = new NotificationChannel(CHANNEL, "桌宠", NotificationManager.IMPORTANCE_LOW);
        manager.createNotificationChannel(channel);
        Intent open = new Intent(this, MenuActivity.class);
        PendingIntent pending = PendingIntent.getActivity(
                this,
                0,
                open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification notification = new NotificationCompat.Builder(this, CHANNEL)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(getString(R.string.app_name))
                .setContentText(getString(R.string.notice))
                .setContentIntent(pending)
                .setOngoing(true)
                .build();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(1, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(1, notification);
        }
    }

    private void ensureOverlay() {
        if (added) {
            return;
        }
        windows = getSystemService(WindowManager.class);
        WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();
        webView = new WebView(this);
        webView.setBackgroundColor(Color.TRANSPARENT);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        webView.addJavascriptInterface(new PetBridge(this), "PetBridge");
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assets.shouldInterceptRequest(request.getUrl());
            }
        });
        webView.loadUrl("https://appassets.androidplatform.net/assets/www/index.html");
        webView.setOnTouchListener(this::onPetTouch);

        DisplayMetrics metrics = getResources().getDisplayMetrics();
        int width = Math.round(240 * metrics.density);
        int height = Math.round(360 * metrics.density);
        Rect screen = screenBounds();
        int inset = new PetBridge(this).bottomInset();
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;
        params = new WindowManager.LayoutParams(
                width,
                height,
                type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                        | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                        | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
                        | WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
                PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.TOP | Gravity.START;
        params.x = Math.max(0, (screen.width() - width) / 2);
        params.y = Math.max(0, screen.height() - inset - height);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            params.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        windows.addView(webView, params);
        added = true;
    }

    private boolean onPetTouch(View view, MotionEvent event) {
        if (params == null || webView == null) {
            return false;
        }
        switch (event.getActionMasked()) {
            case MotionEvent.ACTION_DOWN:
                dragX = event.getRawX();
                dragY = event.getRawY();
                dragLeft = params.x;
                dragTop = params.y;
                lastRawX = dragX;
                lastRawY = dragY;
                lastMoveTime = event.getEventTime();
                velocityX = 0;
                velocityY = 0;
                runJs("window.petGrab&&window.petGrab()");
                return true;
            case MotionEvent.ACTION_MOVE:
                long now = event.getEventTime();
                float dt = Math.max(8f, now - lastMoveTime);
                velocityX = (event.getRawX() - lastRawX) / dt * 1000f;
                velocityY = (event.getRawY() - lastRawY) / dt * 1000f;
                lastRawX = event.getRawX();
                lastRawY = event.getRawY();
                lastMoveTime = now;
                params.x = dragLeft + Math.round(event.getRawX() - dragX);
                params.y = dragTop + Math.round(event.getRawY() - dragY);
                clampToScreen();
                windows.updateViewLayout(webView, params);
                return true;
            case MotionEvent.ACTION_UP:
            case MotionEvent.ACTION_CANCEL:
                float density = density();
                int cssVx = Math.round(Math.max(-700f, Math.min(700f, velocityX / density)));
                int cssVy = Math.round(Math.max(-700f, Math.min(700f, velocityY / density)));
                runJs("window.petDrop&&window.petDrop(" + cssVx + "," + cssVy + ")");
                return true;
            default:
                return true;
        }
    }

    private void shiftOnMain(int cssDx, int cssDy) {
        if (!added || params == null || webView == null) {
            return;
        }
        float density = density();
        params.x += Math.round(cssDx * density);
        params.y += Math.round(cssDy * density);
        clampToScreen();
        windows.updateViewLayout(webView, params);
    }

    private float density() {
        return Math.max(1f, getResources().getDisplayMetrics().density);
    }

    private void clampToScreen() {
        Rect screen = screenBounds();
        int maxX = Math.max(0, screen.width() - params.width);
        int maxY = Math.max(0, screen.height() - params.height);
        params.x = Math.max(0, Math.min(maxX, params.x));
        params.y = Math.max(0, Math.min(maxY, params.y));
    }

    private Rect screenBounds() {
        DisplayMetrics metrics = new DisplayMetrics();
        windows.getDefaultDisplay().getRealMetrics(metrics);
        return new Rect(0, 0, metrics.widthPixels, metrics.heightPixels);
    }

    private void applyVisibility() {
        if (webView == null) {
            return;
        }
        boolean hidden = false;
        try {
            String raw = PetBridge.prefs(this).getString(PetBridge.KEY, "");
            if (raw != null && !raw.isEmpty()) {
                hidden = new JSONObject(raw).optBoolean("hidden");
            }
        } catch (Exception ignored) {
            hidden = false;
        }
        boolean show = !hidden && HomeWatch.onHome(this);
        webView.setVisibility(show ? View.VISIBLE : View.GONE);
    }
}
