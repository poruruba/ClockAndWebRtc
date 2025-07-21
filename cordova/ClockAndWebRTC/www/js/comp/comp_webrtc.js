'use strict';

const IMAGES_FILE_NAME_BASE = "background";
const IMAGES_DIR_NAME = "images";

const comp_webrtc = {
  props: ['value'],
  mixins: [mixins_bootstrap],
  store: vue_store,
  template: `
  <div>
    <video id="remotecamera_view" class="top-fullscreen" autoplay></video>
    <img v-bind:src="remote_image" class="top-fullscreen" v-if="remote_image">
  </div>
  `,
  data: function () {
    return {
      remote_image: null,
    }
  },
  methods: {
    onDeviceReady: async function(){
        this.libfile = await LibFile.newInstance("data");
        try{
            await this.libfile.createDirectory(IMAGES_DIR_NAME);
        }catch(error){
            console.log(error);
        }
    },
    start_master: async function (port, clientId, pinCode, localStream) {
      try{
        this.master = new WebrtcMaster(port);
          var params = {
            localStream: localStream,
            clientId: clientId,
            requestOffer: true,
            pinCode: pinCode
          };
          await this.master.start(params, async (type, result) => {
              console.log(type, result);
              if (type == "peer") {
                  if (result.type == "track") {
                      var mediaStream = this.master.getMediaStream(result.remoteClientId);
                      if( mediaStream ){
                          const video = document.querySelector('#remotecamera_view');
                          video.srcObject = mediaStream;
                      }
                  }else
                  if( result.type == "connectionstatechange") {
                      if( result.connectionState == "disconnected"){
                          this.toast_show("WebRTCが切断されました。");
                          this.$store.state.is_webrtc = false;
                      }
                  }
              }else if( type == "signaling" ){
                  if( result.type == "ready"){
                      this.$store.state.is_webrtc = true;
                      this.remote_image = null;
                      this.toast_show("WebRTCが接続されました。");
                  }else
                  if( result.type == "closed" ){
                      this.toast_show("Signalingが切断されました。");
                  }else if( result.type == "error"){
                      this.toast_show(result.message);
                  }
              }else if( type == "data" ){
                  if( result.type == "message" ){
                      this.dataMessageLog += `${this.toLocaleString(new Date().getTime())} [${result.remoteClientId}] ${result.message}\n`;
                  }else if( result.type == "binary" ){
                    if( result.info.image_type == "background"){
                        var file_ext = "";
                        if( result.info.ftype == "image/jpeg" )
                            file_ext = ".jpg";
                        if( result.info.ftype == "image/png" )
                            file_ext = ".jpg";
                        if( result.info.ftype == "image/bitmap" )
                            file_ext = ".bmp";
                      try{
                        if( file_ext ){
                              await this.libfile.createFile(IMAGES_DIR_NAME, IMAGES_FILE_NAME_BASE + file_ext, result.blob);
                              vue.background_file_update();
                              this.toast_show("背景画像を更新しました。");
                        }
                      }catch(error){
                          console.log(error);
                      }
                    }else{
                      if( result.info.fsize != 0 )
                          this.remote_image = URL.createObjectURL(result.blob);
                      else
                          this.remote_image = null;
                    }

                  }
              }
          });
      }catch(error){
          this.toast_show(error);
      }
    },
  },
  mounted: async function(){
  }
}
