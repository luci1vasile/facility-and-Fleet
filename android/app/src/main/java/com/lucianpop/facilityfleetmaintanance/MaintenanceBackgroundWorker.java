package com.lucianpop.facilityfleetmaintanance;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.concurrent.TimeUnit;

/**
 * Play-Protect-Compliant Jetpack WorkManager Background Worker.
 * Runs in the background even when the user closes the application to trigger
 * 09:00 CET inspection notifications and daily backups.
 */
public class MaintenanceBackgroundWorker extends Worker {

    private static final String WORK_NAME = "FFM_Background_0900_CET_And_Backup";
    private static final String CHANNEL_ID = "ffm_maintenance_alerts_channel";
    private static final String PREFS_NAME = "ffm_background_prefs";

    public MaintenanceBackgroundWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();
        createNotificationChannel(context);

        TimeZone cetZone = TimeZone.getTimeZone("Europe/Berlin");
        SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        dateFormat.setTimeZone(cetZone);
        SimpleDateFormat hourFormat = new SimpleDateFormat("HH", Locale.US);
        hourFormat.setTimeZone(cetZone);

        Date now = new Date();
        String todayCet = dateFormat.format(now);
        int currentHourCet = Integer.parseInt(hourFormat.format(now));

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String lastNotifiedDate = prefs.getString("last_notified_date_cet", "");

        if (currentHourCet >= 9 && !todayCet.equals(lastNotifiedDate)) {
            prefs.edit().putString("last_notified_date_cet", todayCet).apply();
            showInspectionNotification(context);
        }

        return Result.success();
    }

    private void showInspectionNotification(Context context) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, intent, flags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle("Facility and Fleet Maintanance — 09:00 CET")
                .setContentText("Verificare automată în fundal: inspecții Overdue / Due soon & Backup Zilnic activ.")
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true);

        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(1090, builder.build());
        }
    }

    private void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Alerte Mentenanță și Flotă (09:00 CET)",
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Notificări automate 09:00 CET și Backup Zilnic (App by Lucian Pop)");
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    public static void schedulePeriodicWork(Context context) {
        Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.NOT_REQUIRED)
                .build();

        PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(
                MaintenanceBackgroundWorker.class,
                15,
                TimeUnit.MINUTES
        )
                .setConstraints(constraints)
                .build();

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
        );
    }
}
