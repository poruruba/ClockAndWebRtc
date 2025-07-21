const DEFAULT_DATA_LABEL = "defaultDataLabel";

class WebrtcSlave {
    constructor() {
        this.peerConnection = null;
        this.dataChannel = null;
        this.callback = null;
        this.remoteClientId = null;
        this.receivedBuffers = [];

        this.signalingClient = new WebrtcSignalingClient();

        this.signalingClient.on('open', async () => {
            if (this.callback) this.callback('signaling', { type: 'opened' });
        });

        this.signalingClient.on('close', async () => {
            if (this.callback) this.callback('signaling', { type: 'closed' });
        });

        this.signalingClient.on('error', async (message) => {
            if (this.callback) this.callback('signaling', { type: 'error', message: message });
        });

        this.signalingClient.on('ready', async (remoteClientId) => {
            if (this.callback) this.callback('signaling', { type: 'ready', remoteClientId: remoteClientId });
        });

        this.signalingClient.on('sdpAnswer', async (remoteClientId, answer) => {
            await this.resolveAnswer(remoteClientId, answer);
        });

        this.signalingClient.on('iceCandidate', async (remoteClientId, candidate) => {
            console.log("signalingClient.on 'iceCandidate'");
            if( this.remoteClientId != remoteClientId )
                return;

            if (candidate) {
                await this.peerConnection.addIceCandidate(candidate);
            }
        });

        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 240;
        const videoCtx = canvas.getContext('2d', {alpha: false});
        function drawLoop(){
          videoCtx.fillStyle = 'black';
          videoCtx.fillRect(0, 0, canvas.width, canvas.height);
          videoCtx.fillStyle = 'white';
          videoCtx.fillText("WebRTC接続中", 100, 100);
        }
        setInterval(() =>{
          drawLoop();
        }, 1000);
        this.defaultVideoStream = canvas.captureStream();

        const audioCtx = new AudioContext();
        const dst = audioCtx.createMediaStreamDestination();
        this.defaultAudioStream = dst.stream;
    }

    createPeerConnection(remoteClientId, dataLabel){
        this.remoteClientId = remoteClientId;

        const iceServers = [];
//        iceServers.push({ urls: `stun:stun.l.google.com:19302` });
        const configuration = {
            iceServers,
            iceTransportPolicy: 'all',
        };
        this.peerConnection = new RTCPeerConnection(configuration);

        this.dataChannel = this.peerConnection.createDataChannel(dataLabel);
        this.peerConnection.addEventListener("datachannel", event => {
            event.channel.addEventListener("message", (e) => {
              if (this.callback) this.callback("data", { type: "message", remoteClientId: remoteClientId, data: e.data, label: e.target.label });
            });
        });

        this.peerConnection.addEventListener('icecandidate', async ({ candidate }) => {
            console.log("sendIceCandidate 'iceCandidate'");
            this.signalingClient.sendIceCandidate(remoteClientId, candidate);
        });

        this.peerConnection.addEventListener('track', event => {
            if (this.callback) this.callback('peer', { type: 'track', kind: event.track.kind, streams: event.streams, track: event.track });
        });

        this.peerConnection.addEventListener('connectionstatechange', (event) => {
            if (this.callback) this.callback('peer', { type: 'connectionstatechange', connectionState: event.target.connectionState });
        });
        this.peerConnection.addEventListener('negotiationneeded', (event) => {
            if (this.callback) this.callback('peer', { type: 'negotiationneeded' });
        });
        this.peerConnection.addEventListener('icegatheringstatechange', (event) => {
            if (this.callback) this.callback('peer', { type: 'icegatheringstatechange', iceGatheringState: event.target.iceGatheringState });
        });
        this.peerConnection.addEventListener('iceconnectionstatechange', (event) => {
            if (this.callback) this.callback('peer', { type: 'iceconnectionstatechange', iceConnectionState: event.target.iceConnectionState });
        });
        this.peerConnection.addEventListener('icecandidateerror', (event) => {
            if (this.callback) this.callback('peer', { type: 'icecandidateerror', errorCode: event.errorCode, errorText: event.errorText });
        });
        this.peerConnection.addEventListener('signalingstatechange', (event) => {
            if (this.callback) this.callback('peer', { type: 'signalingstatechange', signalingState: event.target.signalingState });
        });
    }

    async startOffering(){
        var offer = await this.peerConnection.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
        });
        await this.peerConnection.setLocalDescription(offer);

        this.signalingClient.sendSdpOffer1(this.remoteClientId, offer);
        if (this.callback) this.callback('peer', { type: 'sdpOffering1', remoteClientId: this.remoteClientId });
    }

    async resolveAnswer(remoteClientId, answer){
        if( this.remoteClientId != remoteClientId )
            return;

        await this.peerConnection.setRemoteDescription(answer);
        if (this.callback) this.callback('peer', { type: 'sdpAnswered', remoteClientId: this.remoteClientId });
    }

    async replaceTrack(stream){
      console.log(this.peerConnection.getSenders());
      console.log(stream.getTracks());

      const videoTrack = stream.getVideoTracks()[0];
      let videoSender = this.peerConnection.getSenders().find(s => s.track?.kind === "video");
      if( videoTrack ){
        await videoSender.replaceTrack(videoTrack);
      }else{
        await videoSender.replaceTrack(this.defaultVideoStream.getVideoTracks()[0]);
      }

      const audioTrack = stream.getAudioTracks()[0];
      let audioSender = this.peerConnection.getSenders().find(s => s.track?.kind === "audio");
      if( audioTrack ){
        await audioSender.replaceTrack(audioTrack);
      }else{
        await audioSender.replaceTrack(this.defaultAudioStream.getAudioTracks()[0]);
      }
    }

    async processOffer(remoteClientId, offer, streams){
        if( this.remoteClientId != remoteClientId )
            return;

        await this.peerConnection.setRemoteDescription(offer);
        if (this.callback) this.callback('peer', { type: 'sdpOffered', remoteClientId: remoteClientId });

        console.log(this.peerConnection.getSenders());
        if( streams ){
          for( let stream of streams ){
            console.log(stream.getTracks());
            stream.getTracks().forEach(track => this.peerConnection.addTrack(track, stream));
          }
        }

        var answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        this.signalingClient.sendSdpAnswer(remoteClientId, answer);
        if (this.callback) this.callback('peer', { type: 'sdpAnswering', remoteClientId: remoteClientId });
    }

    // params: signalingUrl, clientId, pinCode
    async start(params, callback) {
        this.callback = callback;

        await this.signalingClient.open(params.signalingUrl, params.clientId, params.pinCode);
        if (this.callback) this.callback('signaling', { type: 'opening' });
    }
    
    // params: localStream, dataLabel
    async connect(remoteClientId){
      this.disconnect();

      this.signalingClient.on('sdpOffer2', async (remoteClientId, offer) => {
        if( this.remoteClientId != remoteClientId )
          return;
        let streams = [
          this.defaultVideoStream,
          this.defaultAudioStream
        ];
        this.processOffer(remoteClientId, offer, streams);
      });
      this.createPeerConnection(remoteClientId, DEFAULT_DATA_LABEL);

      await this.startOffering();
    }

    disconnect(){
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
            this.remoteClientId = null;
        }
    }
    
    stop() {
        this.disconnect();
    }

    sendData(data) {
        if (!this.dataChannel || this.dataChannel.readyState != "open")
            throw new Error("client not ready");

        this.dataChannel.send(data);
    }

    sendMessage(message) {
        var data = {
          type: "message",
          message: message
        };
        this.sendData(JSON.stringify(data));
    }

    sendBinary(arrayBuffer, info){
      const chunkSize = 16 * 1024; // 16KB
      let offset = 0;

      var data = {
        type: "binary",
        done: false,
        info: info
      };
      this.sendData(JSON.stringify(data));

      while (offset < arrayBuffer.byteLength) {
          const chunk = arrayBuffer.slice(offset, offset + chunkSize);
          this.sendData(chunk);
          offset += chunkSize;
      }

      this.sendData(JSON.stringify({ type: "binary", done: true }));
    }
}