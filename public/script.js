const socket = io();
let channel = '';
let localStream = null;
let peers = {};
let nickname = '';

const nicknameInput = document.getElementById('nickname');
const channelInput = document.getElementById('channel');
const joinBtn = document.getElementById('joinBtn');
const leaveBtn = document.getElementById('leaveBtn');
const talkBtn = document.getElementById('talkBtn');
const statusDiv = document.getElementById('status');

joinBtn.onclick = async () => {
  channel = channelInput.value.trim();
  nickname = nicknameInput.value.trim() || 'Anonymous';

  if (!channel) return alert('Enter a channel name');

  joinBtn.disabled = true;
  leaveBtn.disabled = false;
  talkBtn.disabled = false;

  socket.emit('joinChannel', channel);
  writeStatus(`🔗 Joined channel "${channel}" as ${nickname}`);

  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  socket.on('userJoined', (id) => writeStatus(`👤 ${id} joined`));
  socket.on('userLeft', (id) => writeStatus(`👋 ${id} left`));

  socket.on('offer', async ({ userId, offer }) => {
    const peer = createPeer(userId, false);
    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    socket.emit('answer', { targetUserId: userId, answer });
  });

  socket.on('answer', async ({ userId, answer }) => {
    const peer = peers[userId];
    await peer.setRemoteDescription(new RTCSessionDescription(answer));
  });

  socket.on('iceCandidate', ({ userId, candidate }) => {
    const peer = peers[userId];
    peer.addIceCandidate(new RTCIceCandidate(candidate));
  });
};

leaveBtn.onclick = () => {
  socket.emit('leaveChannel');
  writeStatus('❌ Left channel');
  for (let id in peers) peers[id].close();
  peers = {};
  joinBtn.disabled = false;
  leaveBtn.disabled = true;
  talkBtn.disabled = true;
};

talkBtn.onmousedown = () => {
  for (let id in peers) {
    const audioTrack = localStream.getAudioTracks()[0];
    const sender = peers[id].getSenders().find(s => s.track.kind === 'audio');
    if (sender) sender.replaceTrack(audioTrack);
  }
  writeStatus(`🎤 Talking...`);
};

talkBtn.onmouseup = () => {
  for (let id in peers) {
    const sender = peers[id].getSenders().find(s => s.track.kind === 'audio');
    if (sender) sender.replaceTrack(null);
  }
  writeStatus(`🛑 Not talking`);
};

function createPeer(id, initiator = true) {
  const peer = new RTCPeerConnection();
  peers[id] = peer;

  peer.onicecandidate = (e) => {
    if (e.candidate) {
      socket.emit('iceCandidate', { targetUserId: id, candidate: e.candidate });
    }
  };

  peer.ontrack = (e) => {
    const audio = new Audio();
    audio.srcObject = e.streams[0];
    audio.play();
  };

  if (localStream) {
    localStream.getTracks().forEach(track => peer.addTrack(track, localStream));
  }

  if (initiator) {
    peer.onnegotiationneeded = async () => {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit('offer', { targetUserId: id, offer });
    };
  }

  return peer;
}

function writeStatus(msg) {
  statusDiv.textContent = msg;
}
