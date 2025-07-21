'use strict';

//const vConsole = new VConsole();
//const remoteConsole = new RemoteConsole("http://[remote server]/logio-post");
//window.datgui = new dat.GUI();

const WebRTC_PORT = 3000;

const LOCAL_CAMERA_ENABLE = true;
const CLOCK_UPDATE_INTERVAL = 20000;
const BRIGHTNESS_UPDATE_INTERVAL = 10000; // 照度の取得頻度(msec)
const BRIGHTNESS_THRESHOLD = 2.0; // ダーク表示にする照度の閾値

var vue_options = {
    el: "#top",
    mixins: [mixins_bootstrap],
    store: vue_store,
    router: vue_router,
    data: {
        clientId: "TestServer",
        pinCode: null,
        datetime_now: new Date().getTime(),
        background_url: null,
        is_dark_prev: false,
        is_dark: true,
        webrtc_data: {}
    },
    computed: {
    },
    methods: {
        toDateString: function(tim){
            const d = new Date(tim);
            const weekStr = ["日", "月", "火", "水", "木", "金", "土"];
            return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${weekStr[d.getDay()]})`; 
        },
        toTimeString: function(tim){
            const to2d = (d) => {
                return ("00" + d).slice(-2);
            };
            const d = new Date(tim);
            return `${to2d(d.getHours())}:${to2d(d.getMinutes())}`; 
        },
        reload: async function(){
            location.reload();
        },

        background_update: function(){
            if( !this.is_dark ){
                document.body.style.backgroundImage = 'url(' + this.background_url + ')';
            }else{
                document.body.style.backgroundImage = "none";
            }
        },
        background_change_dark: function(is_dark_now){
            if( (this.is_dart == is_dark_now) || (is_dark_now && !this.is_dark_prev)){
                this.is_dark_prev = is_dark_now;
                return;
            }
            
            this.is_dark = is_dark_now;
            this.is_dark_perv = this.is_dark;
            this.background_update();
        },
        background_file_update: async function(){
            try{
                var fname = IMAGES_FILE_NAME_BASE + ".jpg";
                var file = await this.libfile.isFile(IMAGES_DIR_NAME, fname);
                if( !file ){
                    fname = IMAGES_FILE_NAME_BASE + ".png";
                    file = await this.libfile.isFile(IMAGES_DIR_NAME, fname);
                }
                if( !file ){
                    fname = IMAGES_FILE_NAME_BASE + ".bmp";
                    file = await this.libfile.isFile(IMAGES_DIR_NAME, fname);
                }
                if( file ){
                    this.background_url = this.libfile.toUrl(IMAGES_DIR_NAME, fname);
                    this.background_update();
                }
            }catch(error){
                console.error(error);
            }
        },

        onDeviceReady: async function(){
            console.log("onDeviceReady");

            this.libfile = await LibFile.newInstance("data");
            this.background_file_update();

            window.powermanagement.acquire();
            
            if( LOCAL_CAMERA_ENABLE ){
                var result = await check_permission();
                if (!result){
                    await request_permission();
                    result = await check_permission();
                }
                if( !result ){
                    alert("実行には権限の付与が必要です。アプリを終了します。");
                    cordova.plugins.diagnostic.switchToSettings();
                    navigator.app.exitApp();
                    return;
                }

                try{
                    this.localStream = await navigator.mediaDevices.getUserMedia({
                        video: true,
                        audio: true
                    });
                }catch(error){
                    this.localStream = await navigator.mediaDevices.getUserMedia({
                        video: true,
                        audio: false
                    });
                }
            }

            var ipaddress;
            try{
                var ipInformation = await new Promise((resolve, reject) =>{
                    networkinterface.getWiFiIPAddress( resolve, reject );
                });
                console.log( "IP: " + ipInformation.ip + " subnet:" + ipInformation.subnet );
                ipaddress = ipInformation.ip;
            }catch(error){
                console.error(error);
            }

            this.webrtc_data = {
                ipaddress: ipaddress,
                port: WebRTC_PORT,
                pinCode: this.pinCode
            };

            const light_type = "android.sensor.light";
            samplesensor.addDevice(light_type);

            setInterval(async () =>{
                const values = await samplesensor.getValue(light_type);
//                console.log(JSON.stringify(values));
                this.background_change_dark(values[0] < BRIGHTNESS_THRESHOLD);
            }, BRIGHTNESS_UPDATE_INTERVAL);

            await this.$refs.comp_webrtc.onDeviceReady();
            await this.$refs.comp_webrtc.start_master(WebRTC_PORT, this.clientId, this.pinCode, this.localStream);            
        },
    },
    created: function(){
    },
    mounted: function(){
        proc_load();

        this.pinCode = localStorage.getItem("pinCode");
        if( !this.pinCode ){
            var pincode = this.make_random(999999);
            this.pinCode = String(pincode).padStart(6, "0");
            localStorage.setItem("pinCode", this.pinCode);
        }

        setInterval(() =>{
            this.datetime_now = new Date().getTime();
        }, CLOCK_UPDATE_INTERVAL);
    }
};
vue_add_data(vue_options, { progress_title: '' }); // for progress-dialog
vue_add_global_components(components_bootstrap);
vue_add_global_components(components_utils);

/* add additional components */
vue_add_global_component("comp_webrtc", comp_webrtc);

window.vue = new Vue( vue_options );

async function check_permission() {
    var result_camera = await new Promise((resolve, reject) => {
        cordova.plugins.diagnostic.getCameraAuthorizationStatus(function (status) {
            console.log(status);
            resolve(status);
        }, function (error) {
            console.error(error);
            reject(error);
        }, false);
    });

    var result_mic = await new Promise((resolve, reject) =>{
        cordova.plugins.diagnostic.getMicrophoneAuthorizationStatus(function(status){
            console.log(status);
            resolve(status);
        }, function(error){
            console.error(error);
            reject(error);
        });
    });
        
    if ( (result_camera != cordova.plugins.diagnostic.permissionStatus.GRANTED)||
        (result_mic != cordova.plugins.diagnostic.permissionStatus.GRANTED)
    ) {
        return false;
    } else {
        return true;
    }
}

async function request_permission() {
    var result_camera = await new Promise((resolve, reject) => {
        cordova.plugins.diagnostic.requestCameraAuthorization(function (status) {
            console.log(status);
            resolve(status);
        }, function (error) {
            console.error(error);
            reject(error);
        }, false);
    });
    console.log(result_camera);

    var result_mic = await new Promise((resolve, reject) =>{
        cordova.plugins.diagnostic.requestMicrophoneAuthorization(function(status){
            console.log(status);
            resolve(status);
        }, function (error) {
            console.error(error);
            reject(error);
        });
    });
    console.log(result_mic);
}
