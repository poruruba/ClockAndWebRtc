package jp.or.sample.plugin.SimpleSensor;

import android.app.Activity;
import android.content.Intent;
import android.content.Context;
import android.util.Log;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.apache.cordova.CordovaInterface;
import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaWebView;
import org.apache.cordova.PluginResult;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;

public class Main extends CordovaPlugin implements SensorEventListener {
	public static String TAG = "SimpleSensor.Main";
	private Activity activity;

	class SensorInfo {
		public Sensor sensor;
		public int delayType;
		public int accuracy;
		public float[] values;

		public SensorInfo(Sensor sensor, int delayType) {
			this.sensor = sensor;
			this.delayType = delayType;
		}
	};

	private SensorManager sensorManager;
	private Map<String, SensorInfo> targetSensors;
	private Map<String, Integer> supportedSensors;
	private CallbackContext callback = null;

	@Override
	public void initialize(CordovaInterface cordova, CordovaWebView webView) {
		Log.d(TAG, "[Plugin] initialize called");
		super.initialize(cordova, webView);

		activity = cordova.getActivity();

		targetSensors = new HashMap<>();
		supportedSensors = new HashMap<>();
		sensorManager = (SensorManager) activity.getSystemService(Context.SENSOR_SERVICE);
		List<Sensor> deviceSensors = sensorManager.getSensorList(Sensor.TYPE_ALL);
		for (Sensor sensor : deviceSensors) {
			supportedSensors.put(sensor.getStringType(), sensor.getType());
		}
	}

	@Override
	public void onResume(boolean multitasking) {
		Log.d(TAG, "[Plugin] onResume called");
		super.onResume(multitasking);
		for (String key : targetSensors.keySet()) {
			SensorInfo sensor = targetSensors.get(key);
			sensorManager.registerListener(this, sensor.sensor, sensor.delayType);
		}
	}

	@Override
	public void onPause(boolean multitasking) {
		Log.d(TAG, "[Plugin] onPause called");
		super.onPause(multitasking);
		sensorManager.unregisterListener(this);
	}

/*
	@Override
	public void onNewIntent(Intent intent) {
		Log.d(TAG, "[Plugin] onNewIntent called");
		super.onNewIntent(intent);
	}
*/

	void sendMessageToJs(JSONObject message) {
		if (callback != null) {
			final PluginResult result = new PluginResult(PluginResult.Status.OK, message);
			result.setKeepCallback(true);
			callback.sendPluginResult(result);
		}
	}

	@Override
	public boolean execute(String action, JSONArray args, final CallbackContext callbackContext) throws JSONException {
		Log.d(TAG, "[Plugin] execute called");
		if (action.equals("addSensor")) {
			try {
				String sensorName = args.getString(0);
				int delayType = args.getInt(1);
				int sensorType = supportedSensors.get(sensorName);
				SensorInfo sensor = targetSensors.get(sensorName);
				if (sensor == null) {
					Sensor defaultSensor = sensorManager.getDefaultSensor(sensorType);
					if (defaultSensor != null) {
						targetSensors.put(sensorName, new SensorInfo(defaultSensor, delayType));
						sensorManager.registerListener(this, defaultSensor, delayType);
					}
				}
				callbackContext.success();
			} catch (Exception ex) {
				callbackContext.error(ex.getMessage());
			}
		} else

		if (action.equals("removeSensor")) {
			try {
				String sensorName = args.getString(0);
				SensorInfo sensor = targetSensors.get(sensorName);
				if (sensor != null) {
					sensorManager.unregisterListener(this, sensor.sensor);
					targetSensors.remove(sensorName);
				}
				callbackContext.success();
			} catch (Exception ex) {
				callbackContext.error(ex.getMessage());
			}
		} else

		if (action.equals("getSupportedSensors")) {
			try {
				JSONObject result = new JSONObject();
				JSONArray array = new JSONArray();
				for (String key : supportedSensors.keySet()) {
					array.put(key);
				}
				result.put("list", array);

				callbackContext.success(result);
			} catch (Exception ex) {
				callbackContext.error(ex.getMessage());
			}
		} else

		if (action.equals("getValue")) {
			try {
				String sensorName = args.getString(0);
				SensorInfo sensor = targetSensors.get(sensorName);
				if (sensor == null)
					throw new Error("sensor not ready");
				if( sensor.values == null )
					throw new Error("value not ready");

				JSONObject result = new JSONObject();
				result.put("sensorType", sensorName);
				result.put("accuracy", sensor.accuracy);
				JSONArray array = new JSONArray();
				for (int i = 0; i < sensor.values.length; i++)
					array.put(sensor.values[i]);
				result.put("value", array);

				callbackContext.success(result);
			} catch (Exception ex) {
				callbackContext.error(ex.getMessage());
			}
		} else

		if (action.equals("setCallback")) {
			try {
				boolean arg0 = args.getBoolean(0);
				if (arg0) {
					callback = callbackContext;
				} else {
					callback = null;
					callbackContext.success("OK");
				}
			} catch (Exception ex) {
				callbackContext.error(ex.getMessage());
			}
		} else

		{
			String message = "Unknown action : (" + action + ") " + args.getString(0);
			Log.d(TAG, message);
			callbackContext.error(message);
			return false;
		}

		return true;
	}

	@Override
	public void onSensorChanged(SensorEvent sensorEvent) {
		SensorInfo sensor = targetSensors.get(sensorEvent.sensor.getStringType());
		if (sensor == null)
			return;
		sensor.values = sensorEvent.values;
		sensor.accuracy = sensorEvent.accuracy;

		try {
			JSONObject result = new JSONObject();
			result.put("sensorType", sensorEvent.sensor.getStringType());
			result.put("accuracy", sensorEvent.accuracy);
			JSONArray array = new JSONArray();
			float[] list = sensorEvent.values;
			for (int i = 0; i < list.length; i++)
				array.put(list[i]);
			result.put("value", array);
			sendMessageToJs(result);
		} catch (Exception ex) {
			Log.e(TAG, ex.getMessage());
		}
	}

	@Override
	public void onAccuracyChanged(Sensor sensor, int i) {
		// Do something here if sensor accuracy changes.
	}
}
