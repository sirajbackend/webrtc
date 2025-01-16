const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const connectButton = document.getElementById("connectButton");
const disconnectButton = document.getElementById("disconnectButton");
const muteButton = document.getElementById("muteButton");
const usernameInput = document.getElementById("username");
const usernameSection = document.getElementById("username-section");
const displayUsername = document.getElementById("display-username");
const videoContainer = document.getElementById("video-container");

const socket = io();

let localStream;
let peerConnection;
let isConnected = false;
let username = null;
let isMuted = false;

const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

// Enable the "Connect" button when a username is entered
usernameInput.addEventListener("input", () => {
  username = usernameInput.value.trim();
  connectButton.disabled = !username;
});

// Get local media (camera and microphone)
navigator.mediaDevices
  .getUserMedia({ video: true, audio: true })
  .then((stream) => {
    localStream = stream;
  })
  .catch((error) => console.error("Error accessing media devices:", error));

// Add event listener to the "Connect" button
connectButton.addEventListener("click", () => {
  if (!isConnected && username) {
    isConnected = true;

    // Show video container and hide username input
    videoContainer.style.display = "flex";
    usernameSection.style.display = "none";
    displayUsername.textContent = `Connected as: ${username}`;
    displayUsername.style.display = "block";

    connectButton.disabled = true;
    disconnectButton.disabled = false;
    muteButton.disabled = false;

    localVideo.srcObject = localStream;

    // Notify the server that this user is ready to connect
    socket.emit("ready-to-connect", { room: "default-room", username });
  }
});

// Add event listener to the "Disconnect" button
disconnectButton.addEventListener("click", () => {
  if (isConnected) {
    isConnected = false;

    // Hide video container and show username input
    videoContainer.style.display = "none";
    usernameSection.style.display = "block";
    displayUsername.style.display = "none";

    connectButton.disabled = false;
    disconnectButton.disabled = true;
    muteButton.disabled = true;

    // Close the peer connection and stop local stream
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }

    // Notify the server about disconnection
    socket.emit("user-disconnected", username);
    remoteVideo.srcObject = null;
  }
});

// Add event listener to the "Mute/Unmute" button
muteButton.addEventListener("click", () => {
  if (localStream) {
    isMuted = !isMuted;
    localStream.getAudioTracks()[0].enabled = !isMuted;
    muteButton.textContent = isMuted ? "Unmute" : "Mute";
  }
});

// Handle server events
socket.on("user-ready", ({ userId, username: remoteUsername }) => {
  console.log(`${remoteUsername} is ready to connect`);
  createOffer(userId, remoteUsername);
});

socket.on("signal", async (data) => {
  if (!peerConnection) createPeerConnection();

  if (data.type === "offer") {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit("signal", { target: data.sender, type: "answer", answer });
  } else if (data.type === "answer") {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
  } else if (data.type === "candidate") {
    await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
  }
});

socket.on("user-disconnected", (remoteUsername) => {
  console.log(`${remoteUsername} has disconnected`);
  remoteVideo.srcObject = null;
});

// Peer connection setup
function createPeerConnection() {
  peerConnection = new RTCPeerConnection(config);
  localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("signal", { target: "default-room", type: "candidate", candidate: event.candidate });
    }
  };
}

async function createOffer(target, remoteUsername) {
  if (!peerConnection) createPeerConnection();

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  socket.emit("signal", { target, type: "offer", offer, remoteUsername });
}
