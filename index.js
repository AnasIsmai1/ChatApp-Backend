import express from "express";
import { WebSocketServer } from "ws";
import url from "url";
import cors from "cors";

const app = express();
const PORT = 4200;
const MAX_SIZE = 50;

const server = app.listen(PORT, () => {
  console.log(`Server is live at port ${PORT}`);
});

app.use(cors());

const wss = new WebSocketServer({ server });
const users = [];
const messages = [];
console.log(`WebSocket Server running on ws://localhost:${PORT}`);

const rooms = {}; 

wss.on("connection", (ws, req) => {
  const queryObject = url.parse(req.url, true).query;
  const clientID = queryObject.userID;
  const username = queryObject.username;
  const roomID = queryObject.roomID || "default"; 

  if (!clientID || !username) {
    ws.close();
    return;
  }

  const avatar = `https://api.dicebear.com/6.x/adventurer/svg?seed=${username}`;

  const existingUser = users.find((user) => user.clientID === clientID);

  if (existingUser) {
    existingUser.socket = ws;
    console.log(`User ${clientID} reconnected`);
  } else {
    users.push({ clientID, username, avatar, socket: ws });
    console.log(`New user ${clientID} connected`);
  }

  if (!rooms[roomID]) {
    rooms[roomID] = [];
  }
  rooms[roomID].push({ clientID, socket: ws });

  wss.clients.forEach((client) => {
    if (
      client.readyState === ws.OPEN &&
      client !== ws &&
      rooms[roomID].some((u) => u.socket === client)
    ) {
      client.send(
        JSON.stringify({
          text: `${username} joined the room`,
          type: "info",
          clientID,
          roomID,
        })
      );
    }
  });

  // Send welcome message
  ws.send(
    JSON.stringify({
      text: `Welcome to the chat, ${username}!`,
      type: "info",
      clientID,
      roomID,
    })
  );

  // Handle messages
  ws.on("message", (data) => {
    const parsed = JSON.parse(data.toString());
    parsed.username = username;
    parsed.avatar = avatar;
    parsed.roomID = parsed.roomID || roomID; 

    if (parsed.targetID) {
      const targetUser = users.find(
        (user) => user.clientID === parsed.targetID
      );
      if (targetUser && targetUser.socket.readyState === ws.OPEN) {
        targetUser.socket.send(JSON.stringify(parsed));
      }
    } else {
      if (rooms[parsed.roomID]) {
        rooms[parsed.roomID].forEach((user) => {
          if (user.socket.readyState === ws.OPEN) {
            user.socket.send(JSON.stringify(parsed));
          }
        });
      }
    }
  });

  ws.on("close", () => {
    console.log(`Client ${clientID} disconnected`);

    rooms[roomID] = rooms[roomID].filter((user) => user.clientID !== clientID);

    wss.clients.forEach((client) => {
      if (
        client.readyState === ws.OPEN &&
        rooms[roomID].some((u) => u.socket === client)
      ) {
        client.send(
          JSON.stringify({
            text: `${username} left the room`,
            type: "info",
            clientID,
            roomID,
          })
        );
      }
    });
  });
});

app.get("/api/users", (_, res) => {
  res.status(200).json({
    status: 200,
    users: users.map(({ clientID, username, avatar }) => ({
      clientID,
      username,
      avatar,
    })),
  });
});

app.get("/api/messages", (_, res) => {
  res.status(200).json({ status: 200, messages });
});
