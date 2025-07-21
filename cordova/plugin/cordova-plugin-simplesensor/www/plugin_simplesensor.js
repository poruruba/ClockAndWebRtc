class SimpleSensor{
	constructor(){
		this.SENSOR_DELAY_FASTEST = 0;
		this.SENSOR_DELAY_GAME = 1;
		this.SENSOR_DELAY_UI = 2;
		this.SENSOR_DELAY_NORMAL = 3;
	}

	addSensor(sensorName, delayType){
		return new Promise(function(resolve, reject){
			cordova.exec(
				function(result){
					resolve(result);
				},
				function(err){
					reject(err);
				},
				"SimpleSensor", "addSensor",
				[sensorName, delayType]);
		});
	}

	removeSensor(sensorName){
		return new Promise(function(resolve, reject){
			cordova.exec(
				function(result){
					resolve(result);
				},
				function(err){
					reject(err);
				},
				"SimpleSensor", "removeSensor",
				[sensorName]);
		});
	}

	getSupportedSensors(){
		return new Promise(function(resolve, reject){
			cordova.exec(
				function(result){
					resolve(result.list);
				},
				function(err){
					reject(err);
				},
				"SimpleSensor", "getSupportedSensors",
				[]);
		});
	}
	
	getValue(sensorName){
		return new Promise(function(resolve, reject){
			cordova.exec(
				function(result){
					resolve(result);
				},
				function(err){
					reject(err);
				},
				"SimpleSensor", "getValue",
				[sensorName]);
		});
	}

	setCallback(enable, callback){
		cordova.exec(
			function(result){
				callback(result);
			},
			function(err){
				console.error("setCallback call failed");
			},
			"SimpleSensor", "setCallback",
			[enable]);
	}
}

module.exports = new SimpleSensor();
