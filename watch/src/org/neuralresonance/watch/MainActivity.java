package org.neuralresonance.watch;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Bundle;
import android.os.SystemClock;
import android.util.Base64;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.UUID;

/** Local research collector: only the explicit foreground session reads sensors. */
public final class MainActivity extends Activity implements SensorEventListener {
    private final Object lock = new Object();
    private final String sessionId = UUID.randomUUID().toString();
    private String token;
    private String state = "stopped";
    private Float bpm;
    private int accuracy;
    private long sequence, eventNs;
    private volatile boolean resumed;
    private boolean requested, registered;
    private SensorManager manager;
    private Sensor heart;
    private TextView valueView, stateView, detailView;
    private Button startButton, stopButton;
    private ServerSocket server;

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        manager = (SensorManager)getSystemService(SENSOR_SERVICE);
        heart = manager == null ? null : manager.getDefaultSensor(Sensor.TYPE_HEART_RATE);
        byte[] random = new byte[32];
        new SecureRandom().nextBytes(random);
        token = Base64.encodeToString(random, Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
        try (OutputStream file = openFileOutput("session-token", MODE_PRIVATE)) {
            file.write(token.getBytes(StandardCharsets.US_ASCII));
        } catch (Exception error) {
            state = "storage-error";
        }
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(Color.rgb(18, 19, 21));
        LinearLayout column = new LinearLayout(this);
        column.setOrientation(LinearLayout.VERTICAL);
        column.setGravity(Gravity.CENTER_HORIZONTAL);
        int padding = (int)(24 * getResources().getDisplayMetrics().density);
        column.setPadding(padding, padding, padding, padding);
        scroll.addView(column);
        TextView title = text("实时心率", 18);
        valueView = text("—", 42);
        stateView = text("准备采集", 14);
        detailView = text("仅在当前页面采集", 12);
        startButton = new Button(this);
        startButton.setText("开始采集");
        startButton.setOnClickListener(view -> {
            requested = true;
            if (checkSelfPermission(Manifest.permission.BODY_SENSORS) != PackageManager.PERMISSION_GRANTED) {
                clear("waiting-permission");
                requestPermissions(new String[]{Manifest.permission.BODY_SENSORS}, 1);
            } else {
                begin();
            }
        });
        stopButton = new Button(this);
        stopButton.setText("停止采集");
        stopButton.setOnClickListener(view -> {
            requested = false;
            stopSensor("stopped");
        });
        for (android.view.View view : new android.view.View[]{title, valueView, stateView,
                detailView, startButton, stopButton}) column.addView(view);
        setContentView(scroll);
        render();
    }

    private TextView text(String text, int size) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextSize(size);
        view.setTextColor(Color.rgb(233, 232, 226));
        view.setGravity(Gravity.CENTER);
        view.setPadding(0, 6, 0, 6);
        return view;
    }

    @Override public void onResume() {
        super.onResume();
        resumed = true;
        startServer();
        if (requested && checkSelfPermission(Manifest.permission.BODY_SENSORS) == PackageManager.PERMISSION_GRANTED) begin();
    }

    @Override public void onPause() {
        resumed = false;
        stopSensor("paused");
        synchronized (lock) {
            if (server != null) {
                try { server.close(); } catch (Exception ignored) { }
                server = null;
            }
        }
        super.onPause();
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == 1) {
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) begin();
            else {
                requested = false;
                clear("permission-denied");
            }
        }
    }

    private void begin() {
        if (!resumed || !requested || registered) return;
        if (heart == null) { clear("sensor-unavailable"); return; }
        if (checkSelfPermission(Manifest.permission.BODY_SENSORS) != PackageManager.PERMISSION_GRANTED) {
            clear("permission-denied");
            return;
        }
        try {
            registered = manager.registerListener(this, heart, SensorManager.SENSOR_DELAY_NORMAL);
            clear(registered ? "waiting-measurement" : "sensor-unavailable");
            if (registered) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        } catch (SecurityException error) { clear("permission-denied"); }
    }

    private void stopSensor(String reason) {
        if (manager != null) manager.unregisterListener(this);
        registered = false;
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        clear(reason);
    }

    private void clear(String reason) {
        synchronized (lock) { bpm = null; state = reason; }
        render();
    }

    @Override public void onSensorChanged(SensorEvent event) {
        if (!resumed || !requested || !registered || event.sensor.getType() != Sensor.TYPE_HEART_RATE) return;
        synchronized (lock) {
            accuracy = event.accuracy;
            if (event.values.length == 0 || !Float.isFinite(event.values[0]) || event.values[0] <= 0
                    || event.accuracy <= SensorManager.SENSOR_STATUS_UNRELIABLE) {
                bpm = null;
                state = "unreliable";
            } else if (event.timestamp > eventNs) {
                bpm = event.values[0];
                eventNs = event.timestamp;
                sequence++;
                state = "receiving";
            }
        }
        render();
    }

    @Override public void onAccuracyChanged(Sensor sensor, int value) {
        synchronized (lock) { accuracy = value; }
        if (value <= SensorManager.SENSOR_STATUS_UNRELIABLE) clear("unreliable");
    }

    private void render() {
        if (valueView == null) return;
        runOnUiThread(() -> {
            synchronized (lock) {
                boolean fresh = bpm != null && SystemClock.elapsedRealtimeNanos() - eventNs <= 15000000000L;
                valueView.setText(fresh ? Float.toString(bpm) + " bpm" : "—");
                String label;
                switch (state) {
                    case "receiving": label = fresh ? "正在采集" : "等待新的测量"; break;
                    case "waiting-permission": label = "请确认身体传感器权限"; break;
                    case "permission-denied": label = "尚未授权身体传感器"; break;
                    case "waiting-measurement": label = "请佩戴手表，等待测量"; break;
                    case "sensor-unavailable": label = "心率传感器不可用"; break;
                    case "unreliable": label = "接触质量待确认"; break;
                    case "paused": label = "采集已暂停"; break;
                    case "server-error": label = "本机接收端口不可用"; break;
                    case "storage-error": label = "采集会话无法建立"; break;
                    default: label = "采集已停止";
                }
                stateView.setText(label);
                detailView.setText("有效样本 " + sequence + "\n仅在当前页面采集");
                startButton.setEnabled(!registered);
                stopButton.setEnabled(requested || registered);
            }
        });
    }

    private byte[] snapshot() throws Exception {
        synchronized (lock) {
            JSONObject data = new JSONObject();
            data.put("schemaVersion", "neural-watch-heart-v1");
            data.put("sessionId", sessionId);
            data.put("state", state);
            data.put("sequence", sequence);
            data.put("bpm", bpm == null ? JSONObject.NULL : bpm);
            data.put("accuracy", accuracy);
            data.put("eventElapsedNs", eventNs);
            data.put("nowElapsedNs", SystemClock.elapsedRealtimeNanos());
            render();
            return data.toString().getBytes(StandardCharsets.UTF_8);
        }
    }

    private void startServer() {
        synchronized (lock) {
            if (server != null) return;
            try {
                server = new ServerSocket(18768, 2, InetAddress.getByName("127.0.0.1"));
            } catch (Exception error) { clear("server-error"); return; }
            final ServerSocket listener = server;
            Thread worker = new Thread(() -> {
                while (!listener.isClosed()) {
                    try (Socket client = listener.accept()) {
                        client.setSoTimeout(1500);
                        ByteArrayOutputStream header = new ByteArrayOutputStream();
                        int next;
                        while (header.size() < 4096 && (next = client.getInputStream().read()) != -1) {
                            header.write(next);
                            byte[] b = header.toByteArray();
                            int n = b.length;
                            if (n >= 4 && b[n-4] == 13 && b[n-3] == 10 && b[n-2] == 13 && b[n-1] == 10) break;
                        }
                        String request = header.toString("US-ASCII");
                        String[] lines = request.split("\r\n");
                        boolean authorized = false;
                        for (String line : lines) {
                            if (line.regionMatches(true, 0, "Authorization: ", 0, 15)) {
                                authorized = MessageDigest.isEqual(line.substring(15).getBytes(StandardCharsets.US_ASCII),
                                        ("Bearer " + token).getBytes(StandardCharsets.US_ASCII));
                            }
                        }
                        boolean validPath = lines.length > 0 &&
                                (lines[0].equals("GET /current HTTP/1.1") || lines[0].equals("GET /current HTTP/1.0"));
                        String status = authorized && validPath ? "200 OK" : "403 Forbidden";
                        byte[] body = authorized && validPath ? snapshot() : "{}".getBytes(StandardCharsets.UTF_8);
                        String response = "HTTP/1.1 " + status + "\r\nContent-Type: application/json; charset=utf-8\r\n"
                                + "Cache-Control: no-store\r\nConnection: close\r\nContent-Length: " + body.length + "\r\n\r\n";
                        client.getOutputStream().write(response.getBytes(StandardCharsets.US_ASCII));
                        client.getOutputStream().write(body);
                    } catch (Exception ignored) { }
                }
            }, "watch-local-reader");
            worker.setDaemon(true);
            worker.start();
        }
    }
}
