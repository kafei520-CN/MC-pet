package dev.mcpet.android;

import android.content.Context;
import android.content.SharedPreferences;
import android.webkit.JavascriptInterface;

final class PetBridge {
    static final String PREFS = "pet";
    static final String KEY = "json";

    private final Context context;

    PetBridge(Context context) {
        this.context = context.getApplicationContext();
    }

    @JavascriptInterface
    public String loadSettings() {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "");
    }

    @JavascriptInterface
    public void saveSettings(String json) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, json).apply();
    }

    @JavascriptInterface
    public void moveBy(int dx, int dy) {
        PetService.shift(dx, dy);
    }

    @JavascriptInterface
    public int screenX() {
        return PetService.screenX();
    }

    @JavascriptInterface
    public int screenWidth() {
        return PetService.screenWidth();
    }

    @JavascriptInterface
    public int windowWidth() {
        return PetService.windowWidth();
    }

    @JavascriptInterface
    public int bottomInset() {
        int nav = 0;
        int id = context.getResources().getIdentifier("navigation_bar_height", "dimen", "android");
        if (id > 0) {
            nav = context.getResources().getDimensionPixelSize(id);
        }
        int dock = Math.round(112 * context.getResources().getDisplayMetrics().density);
        return nav + dock;
    }

    static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
