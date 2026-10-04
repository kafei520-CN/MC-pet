package dev.mcpet.android;

import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.os.Build;
import android.os.Process;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

final class HomeWatch {
    private HomeWatch() {
    }

    static boolean hasUsageAccess(Context context) {
        AppOpsManager ops = (AppOpsManager) context.getSystemService(Context.APP_OPS_SERVICE);
        int mode = Build.VERSION.SDK_INT >= 29
                ? ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.getPackageName())
                : ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.getPackageName());
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    static boolean onHome(Context context) {
        if (!hasUsageAccess(context)) {
            return true;
        }
        String foreground = foregroundPackage(context);
        if (foreground == null || foreground.equals(context.getPackageName())) {
            return foreground == null;
        }
        return homePackages(context).contains(foreground);
    }

    private static String foregroundPackage(Context context) {
        UsageStatsManager manager = (UsageStatsManager) context.getSystemService(Context.USAGE_STATS_SERVICE);
        long now = System.currentTimeMillis();
        UsageEvents events = manager.queryEvents(now - 60_000, now);
        if (events == null) {
            return null;
        }
        UsageEvents.Event event = new UsageEvents.Event();
        String last = null;
        while (events.hasNextEvent()) {
            events.getNextEvent(event);
            if (event.getEventType() == UsageEvents.Event.MOVE_TO_FOREGROUND) {
                last = event.getPackageName();
            }
        }
        return last;
    }

    private static Set<String> homePackages(Context context) {
        Intent intent = new Intent(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_HOME);
        List<ResolveInfo> homes = context.getPackageManager().queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY);
        Set<String> names = new HashSet<>();
        for (ResolveInfo info : homes) {
            if (info.activityInfo != null) {
                names.add(info.activityInfo.packageName);
            }
        }
        return names;
    }
}
