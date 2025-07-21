'use strict';

//const vConsole = new VConsole();
//const remoteConsole = new RemoteConsole("http://[remote server]/logio-post");
//window.datgui = new dat.GUI();

var tracks = [];
let videoSender = null;

var vue_options = {
    el: "#top",
    mixins: [mixins_bootstrap],
    store: vue_store,
    router: vue_router,
    data: {
        localStream: null,
        pinCode: "002434",
        ipaddress: "192.168.1.231",
        port: 3000,
        facing_mode: "environment",
        clientId: "TestClient",
    },
    computed: {
    },
    methods: {
        start: async function(){
            await this.start_slave(this.clientId, this.pinCode);
        },
        stop: async function(){
            await this.slave.stop();
        },

        start_slave: async function (clientId, pinCode) {
            try {
                var params = {
                    signalingUrl: "ws://" + this.ipaddress + ":" + this.port,
                    clientId: clientId,
                    pinCode: pinCode,
                };
                await this.slave.start(params, (module, result) => {
                    console.log(module, result);
                    if (module == "peer") {
                        if (result.type == "sdpOffering1") {
                            tracks = [];
                        } else
                        if (result.type == "track") {
                            if (result.kind == "audio" || result.kind == "video") {
                                var remoteView = document.querySelector('#remotecamera_view');
                                if( result.track ){
                                    tracks.push(result.track);
                                    remoteView.srcObject = new MediaStream(tracks);
                                }else if( result.streams ){
                                    tracks.push(result.streams);
                                    remoteView.srcObject = result.streams[0];
                                }
                            }
                        }else
                        if( result.type == "connectionstatechange") {
                            if( result.connectionState == "disconnected"){
                                this.toast_show("WebRTCが切断されました。");
                            }
                        }
                    } else if (module == "signaling") {
                        if (result.type == "ready") {
                            this.slave.connect(result.remoteClientId);
                        }else if( result.type == "closed" ){
                            this.toast_show("Signalingが切断されました。");
                        }else if( result.type == "error"){
                            this.toast_show(result.message);
                        }
                    }else if( module == "data" ){
                        if( result.type == "message"){
                            this.dataMessageLog += `${this.toLocaleString(new Date().getTime())} [${result.remoteClientId}] ${result.data}\n`;
                        }
                    }
                });
                var conf = {
                    clientId: this.clientId,
                    ipaddress: this.ipaddress,
                    port: this.port,
                    pinCode: this.pinCode
                };
                localStorage.setItem("config", JSON.stringify(conf));
            } catch (error) {
                console.error(error);
                this.toast_show(error);
            }
        },

        attach_camera: async function(){
            const constraints = {
                video: { facingMode: this.facing_mode },
                audio: { echoCancellation: true, noiseSuppression: true },
            };
            var stream;
            if( navigator.mediaDevices && navigator.mediaDevices.getUserMedia )
                stream = await navigator.mediaDevices.getUserMedia(constraints);
            else
                throw new Error("not media stream");

            const video = document.querySelector('#localcamera_view');
            video.src = null;
            video.srcObject = stream;

            this.slave.replaceTrack(stream);
        },

        change_video: async function(files){
            if( files.length == 0 )
                return;

            var file = files[0];
            const video = document.querySelector('#localcamera_view');
            const url = URL.createObjectURL(file);
            video.srcObject = null;
            video.src = url;
            this.video_ended = true;
            await video.play();
        },

        video_playing: async function(){
            if( this.video_ended ){
                this.video_ended = false;
                const video = document.querySelector('#localcamera_view');
                const stream = video.captureStream();
                this.slave.replaceTrack(stream);
            }
        },

        video_ended: async function(){
            this.video_ended = true;
        },

        send_background: async function(files){
            if( files.length == 0 )
                return;

            var file = files[0];
            const reader = new FileReader();
            reader.onload = async () => {
                var info = {
                    fsize: reader.result.byteLength,
                    fname: file.name,
                    ftype: file.type,
                    image_type: "background"
                };
                this.slave.sendBinary(reader.result, info);
            };

            reader.readAsArrayBuffer(file);
        },
        send_image: async function(files){
            if( files.length == 0 )
                return;

            var file = files[0];
            const reader = new FileReader();
            reader.onload = async () => {
                var info = {
                    fsize: reader.result.byteLength,
                    fname: file.name,
                    type: file.type
                };
                this.slave.sendBinary(reader.result, info);
            };

            reader.readAsArrayBuffer(file);
        },
        image_clear: async function(){
                var info = {
                    fsize: 0,
                };
                this.slave.sendBinary(new Uint8Array([]), info);
        },
    },
    created: function(){
    },
    mounted: async function(){
        proc_load();

        this.slave = new WebrtcSlave();
        var conf = localStorage.getItem("config");
        if( conf ){
            conf = JSON.parse(conf);
            this.clientId = conf.clientId;
            this.ipaddress = conf.ipaddress;
            this.port = conf.port;
            this.pinCode = conf.pinCode;
        }
    }
};
vue_add_data(vue_options, { progress_title: '' }); // for progress-dialog
vue_add_global_components(components_bootstrap);
vue_add_global_components(components_utils);

/* add additional components */
  
window.vue = new Vue( vue_options );
