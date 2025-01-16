const express = require("express");
const { Server } = require("socket.io");
const http = require("http");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3009;

// Serve static files (client-side code)
app.use(express.static("public"));

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Join a room
  socket.on("ready-to-connect", ({ room, username }) => {
    socket.join(room);
    console.log(`${username} (${socket.id}) joined room: ${room}`);

    // Notify others in the room that this user is ready
    socket.to(room).emit("user-ready", { userId: socket.id, username });
  });

  // Handle signaling data
  socket.on("signal", (data) => {
    socket.to(data.target).emit("signal", { sender: socket.id, ...data });
  });

  // Handle disconnection
  socket.on("user-disconnected", (username) => {
    console.log(`${username} disconnected`);
    socket.broadcast.emit("user-disconnected", username);
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
