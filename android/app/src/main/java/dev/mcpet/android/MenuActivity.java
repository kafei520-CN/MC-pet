package dev.mcpet.android;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Base64;
import android.widget.Button;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.SwitchCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

public class MenuActivity extends AppCompatActivity {
    private final ActivityResultLauncher<String> pickSkin = registerForActivityResult(
            new ActivityResultContracts.GetContent(),
            this::onSkin);
    private final ActivityResultLauncher<String> askNotification = registerForActivityResult(
            new ActivityResultContracts.RequestPermission(),
            granted -> startPet());

    private SwitchCompat chibi;
    private SwitchCompat hide;
    private Button build;
    private boolean ready;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_menu);
        chibi = findViewById(R.id.chibi);
        hide = findViewById(R.id.hide);
        build = findViewById(R.id.build);
        findViewById(R.id.touch).setOnClickListener(v -> PetService.menu("{\"action\":\"touch\"}"));
        findViewById(R.id.dance).setOnClickListener(v -> PetService.menu("{\"action\":\"dance\"}"));
        findViewById(R.id.happy).setOnClickListener(v -> PetService.menu("{\"action\":\"happy\"}"));
        build.setOnClickListener(v -> toggleBuild());
        chibi.setOnCheckedChangeListener((button, checked) -> {
            if (ready) {
                update(data -> data.put("chibi", checked));
            }
        });
        hide.setOnCheckedChangeListener((button, checked) -> {
            if (ready) {
                update(data -> data.put("hidden", checked));
            }
        });
        findViewById(R.id.skin).setOnClickListener(v -> pickSkin.launch("image/png"));
        findViewById(R.id.overlay).setOnClickListener(v -> startActivity(
                new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName()))));
        findViewById(R.id.usage).setOnClickListener(v -> startActivity(new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)));
        findViewById(R.id.battery).setOnClickListener(v -> {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + getPackageName()));
            startActivity(intent);
        });
        showSettings();
        ready = true;
        if (!Settings.canDrawOverlays(this)) {
            startActivity(new Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getPackageName())));
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (Build.VERSION.SDK_INT >= 33
                && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            askNotification.launch(Manifest.permission.POST_NOTIFICATIONS);
            return;
        }
        startPet();
    }

    private void startPet() {
        if (!Settings.canDrawOverlays(this)) {
            return;
        }
        Intent service = new Intent(this, PetService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(service);
        } else {
            startService(service);
        }
    }

    private void showSettings() {
        JSONObject data = settings();
        chibi.setChecked(data.optBoolean("chibi"));
        hide.setChecked(data.optBoolean("hidden"));
        build.setText("slim".equals(data.optString("build")) ? R.string.build_slim : R.string.build_wide);
    }

    private void toggleBuild() {
        boolean slim = !"slim".equals(settings().optString("build"));
        update(json -> json.put("build", slim ? "slim" : "wide"));
        build.setText(slim ? R.string.build_slim : R.string.build_wide);
    }

    private void onSkin(Uri uri) {
        if (uri == null) {
            return;
        }
        try (InputStream input = getContentResolver().openInputStream(uri)) {
            if (input == null) {
                return;
            }
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) >= 0) {
                output.write(buffer, 0, count);
            }
            String url = "data:image/png;base64," + Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP);
            update(json -> {
                json.put("skin", url);
                json.put("skinName", "皮肤");
            });
            Toast.makeText(this, "皮肤已换上", Toast.LENGTH_SHORT).show();
        } catch (Exception error) {
            Toast.makeText(this, "皮肤读取失败", Toast.LENGTH_SHORT).show();
        }
    }

    private JSONObject settings() {
        try {
            String raw = PetBridge.prefs(this).getString(PetBridge.KEY, "");
            if (raw == null || raw.isEmpty()) {
                return new JSONObject();
            }
            return new JSONObject(raw);
        } catch (Exception error) {
            return new JSONObject();
        }
    }

    private void update(Editor editor) {
        JSONObject data = settings();
        try {
            editor.edit(data);
        } catch (Exception error) {
            Toast.makeText(this, "没能保存", Toast.LENGTH_SHORT).show();
            return;
        }
        PetBridge.prefs(this).edit().putString(PetBridge.KEY, data.toString()).apply();
        PetService.reload();
    }

    private interface Editor {
        void edit(JSONObject data) throws Exception;
    }
}
