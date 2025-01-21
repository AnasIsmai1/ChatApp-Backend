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

wss.on("connection", (ws, req) => {
    const queryObject = url.parse(req.url, true).query;
    const clientID = queryObject.userID;
    const username = queryObject.username;

    if (!clientID || !username) {
        ws.close();
        return;
    }

    const avatar = `https://api.dicebear.com/6.x/adventurer/svg?seed=${username}`;

    const existingUser = users.find(user => user.clientID === clientID);

    if (existingUser) {
        existingUser.socket = ws;
        console.log(`User ${clientID} reconnected`);
    } else {
        users.push({ clientID, username, avatar, socket: ws });
        console.log(`New user ${clientID} connected`);

        wss.clients.forEach(client => {
            if (client.readyState === ws.OPEN && client !== ws) {
                client.send(JSON.stringify({
                    text: `${username} joined the chat`,
                    type: "info",
                    clientID,
                }));
            }
        });

        ws.send(JSON.stringify({
            text: `Welcome to the chat, ${username}!`,
            type: "info",
            clientID,
        }));
    }

    ws.on("message", (data) => {
        const parsed = JSON.parse(data.toString());
        parsed.username = username;
        parsed.avatar = avatar;

        if (messages.length > MAX_SIZE)
            messages.shift()

        messages.push(parsed);



        wss.clients.forEach(client => {
            if (client.readyState === ws.OPEN) {
                client.send(JSON.stringify(parsed));
            }
        });
    });

    ws.on("close", () => {
        console.log(`Client ${clientID} disconnected`);
        setTimeout(() => {
            const isReconnected = users.find(user => user.clientID === clientID && user.socket !== ws);
            if (!isReconnected) {
                const index = users.findIndex(user => user.clientID === clientID);
                if (index !== -1) users.splice(index, 1);

                wss.clients.forEach(client => {
                    if (client.readyState === ws.OPEN) {
                        client.send(JSON.stringify({
                            text: `${username} left the chat`,
                            type: "info",
                            clientID,
                        }));
                    }
                });
            }
        }, 3000);
    });
});

app.get("/api/users", (_, res) => {
    res.status(200).json({
        status: 200,
        users: users.map(({ clientID, username, avatar }) => ({ clientID, username, avatar }))
    });
});

app.get("/api/messages", (_, res) => {
    res.status(200).json({ status: 200, messages })
})
