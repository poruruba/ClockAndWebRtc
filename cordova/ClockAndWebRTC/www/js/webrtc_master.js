const DEFAULT_DATA_LABEL = "defaultDataLabel";

class WebrtcMaster {
    constructor(port){
        this.port = port;
        this.peerList = [];
        this.signalingClient = null;
        this.callback = null;

        this.signalingClient = new WebrtcSignalingServer(this.port);

        this.signalingClient.on('open', async () => {
            if (this.callback) this.callback('signaling', { type: 'opened' });
        });

        this.signalingClient.on('close', async () => {
            if (this.callback) this.callback('signaling', { type: 'closed' });
        });

        this.signalingClient.on('ready', async (remoteClientId) =>{
            if (this.callback) this.callback('signaling', { type: 'ready', remoteClientId: remoteClientId });
        });

        this.signalingClient.on('iceCandidate', async (remoteClientId, candidate) => {
            console.log("signalingClient.on 'iceCandidate'");
            if (candidate){
                var peer = this.peerList.find(item => item.clientId == remoteClientId);
                if( peer )
                    await peer.peerConnection.addIceCandidate(candidate);
            }
        });        
    }
    
    // params: localStream, clientId, requestOffer
    async start(params, callback) {
        this.callback = callback;
        let clientId = params.clientId;
        let requestOffer = params.requestOffer;
        let localStream = params.localStream;
        let pinCode = params.pinCode;

        this.signalingClient.on('sdpOffer1', async (remoteClientId, offer) => {
            var peer = this.peerList.find(item => item.clientId == remoteClientId );
            if( peer )
                peer.peerConnection.close();

            const iceServers = [];
//            iceServers.push({ urls: `stun:stun.l.google.com:19302` });
            const configuration = {
                iceServers,
                iceTransportPolicy: 'all',
            };
            var peerConnection = new RTCPeerConnection(configuration);
            if( peer ){
                peer.peerConnection = peerConnection;
                peer.tracks = [];
                peer.dataChannel = null;
            }else{
                peer = {
                    clientId: remoteClientId,
                    peerConnection: peerConnection,
                    tracks: [],
                    dataChannel: null
                };
                this.peerList.push(peer);
            }
            
            peer.dataChannel = peerConnection.createDataChannel(DEFAULT_DATA_LABEL);
            peerConnection.addEventListener("datachannel", event => {
                event.channel.addEventListener("message", async (e) => {
                    if (typeof e.data === "string") {
                        const data = JSON.parse(e.data);
                        if( data.type == "message"){
                            if (this.callback) this.callback("data", { type: 'message', remoteClientId: remoteClientId, message: data.message, label: e.target.label });
                        }else if( data.type == "binary" ){
                            if (!data.done) {
                                this.receivedBuffers = [];
                                this.receiveInfo = data.info;
                            }else{
                                var blob = new Blob(this.receivedBuffers);
                                this.receivedBuffers = [];
                                if (this.callback) this.callback("data", { type: "binary", remoteClientId: remoteClientId, blob: blob, info: this.receiveInfo });
                            }
                        }
                    } else {
                        this.receivedBuffers.push(e.data);
                    }
                });
            });

            peerConnection.addEventListener('track', event => {
                peer.tracks.push(event.track);
                if (this.callback) this.callback('peer', { type: 'track', remoteClientId: remoteClientId, kind: event.track.kind, streams: event.streams, track: event.track });
            });

            peerConnection.addEventListener('icecandidate', async ({ candidate }) => {
                this.signalingClient.sendIceCandidate(remoteClientId, candidate);
                console.log("sendIceCandidate 'iceCandidate'");
            });

            peerConnection.addEventListener('connectionstatechange', (event) => {
                if (this.callback) this.callback('peer', { type: 'connectionstatechange', remoteClientId: remoteClientId, connectionState: event.target.connectionState });
            });
            peerConnection.addEventListener('negotiationneeded', (event) => {
                if (this.callback) this.callback('peer', { type: 'negotiationneeded', remoteClientId: remoteClientId });
            });
            peerConnection.addEventListener('icegatheringstatechange', (event) => {
                if (this.callback) this.callback('peer', { type: 'icegatheringstatechange', remoteClientId: remoteClientId, iceGatheringState: event.target.iceGatheringState });
            });
            peerConnection.addEventListener('iceconnectionstatechange', (event) => {
                if (this.callback) this.callback('peer', { type: 'iceconnectionstatechange', remoteClientId: remoteClientId, iceConnectionState: event.target.iceConnectionState });
            });
            peerConnection.addEventListener('icecandidateerror', (event) => {
                if (this.callback) this.callback('peer', { type: 'icecandidateerror', remoteClientId: remoteClientId, errorCode: event.errorCode, errorText: event.errorText });
            });
            peerConnection.addEventListener('signalingstatechange', (event) => {
                if (this.callback) this.callback('peer', { type: 'signalingstatechange', remoteClientId: remoteClientId, signalingState: event.target.signalingState });
            });
            
            var streams = [];
            if( localStream )
                streams.push(localStream);
            await this.processOffer(peer, offer, streams);

            if( requestOffer ){
                this.signalingClient.on('sdpAnswer', async (remoteClientId2, answer) => {
                    if( remoteClientId != remoteClientId2 )
                        return;
                    await this.resolveAnswer(peer, answer);
                });
                await this.startOffering2(peer);
            }
        });

        await this.signalingClient.open(clientId, pinCode);
    }

    async startOffering2(peer){
        var offer = await peer.peerConnection.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
        });
        await peer.peerConnection.setLocalDescription(offer);

        this.signalingClient.sendSdpOffer2(peer.clientId, offer);
        if (this.callback) this.callback('peer', { type: 'sdpOffering2', remoteClientId: peer.clientId });
    }

    async resolveAnswer(peer, answer){
        await peer.peerConnection.setRemoteDescription(answer);
        if (this.callback) this.callback('peer', { type: 'sdpAnswered', remoteClientId: peer.clientId });
    }

    async processOffer(peer, offer, streams){
        await peer.peerConnection.setRemoteDescription(offer);
        if (this.callback) this.callback('peer', { type: 'sdpOffered', remoteClientId: peer.clientId });

        if( streams ){
          for( let stream of streams ){
            stream.getTracks().forEach(track => peer.peerConnection.addTrack(track, stream));
          }
        }

        var answer = await peer.peerConnection.createAnswer();
        await peer.peerConnection.setLocalDescription(answer);

        this.signalingClient.sendSdpAnswer(peer.clientId, answer);
        if (this.callback) this.callback('peer', { type: 'sdpAnswering', remoteClientId: peer.clientId });
    }

    getRemoteClientList(){
        return this.peerList;
    }

    getMediaStream(remoteClientId){
        var peer = this.peerList.find(item => item.clientId == remoteClientId);
        return new MediaStream(peer.tracks);
    }

    disconnect(remoteClientId) {
        var peerIndex = this.peerList.findIndex(item => item.clientId == remoteClientId);
        if (peerIndex >= 0) {
            this.peerList[peerIndex].peerConnection.close();
            this.peerList.splice(peerIndex, 1);
        }
    }

    stop() {
        if (this.signalingClient) {
            this.signalingClient.close();
            this.signalingClient = null;
        }

        for( let item of this.peerList){
            item.peerConnection.close();
        }
        this.peerList = [];
    }

    sendMessage(message, remoteClientId) {
        if (remoteClientId) {
            var peer = this.peerList.find(item => item.clientId == remoteClientId);
            if (!peer)
                throw new Error("client not found");

            if (!peer.dataChannel || peer.dataChannel.readyState != "open")
                throw new Error("client not ready");

            peer.dataChannel.send(message);
        } else {
            for( let item of this.peerList){
                try {
                    if (item && item.dataChannel && item.dataChannel.readyState == 'open')
                        item.dataChannel.send(message);
                } catch (e) {
                    console.log(e);
                }
            }
        }
    }
}
