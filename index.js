import express from "express";
import { WebSocketServer } from "ws";
import url from "url";
import cors from "cors";

const app = express();
const PORT = 4200;

const server = app.listen(PORT, () => {
    console.log(`Server is live at port ${PORT}`);
});

app.use(cors());

const wss = new WebSocketServer({ server });
const users = [];

console.log(`WebSocket Server running on ws://localhost:${PORT}`);

wss.on("connection", (ws, req) => {
    console.log("A new client connected");
    const queryObject = url.parse(req.url, true).query;

    const clientID = queryObject.userID;
    const username = queryObject.username;

    if (!clientID || !username) {
        console.log("Invalid connection: Missing userID or username");
        ws.close();
        return;
    }

    if (!users.find((user) => user.clientID === clientID)) {
        const avatar = `https://api.dicebear.com/6.x/adventurer/svg?seed=${username}`;
        users.push({ clientID, username, avatar, socket: ws });

        broadcastUsers();

        messages.push(parsed);

        wss.clients.forEach((client) => {
            if (client.readyState === ws.OPEN) {
                client.send(JSON.stringify(parsed));
            }
        });

        ws.send(
            JSON.stringify({
                text: `Welcome to the chat, ${username}!`,
                type: "info",
                isSent: "false",
                clientID,
            })
        );

        wss.clients.forEach((client) => {
            if (client.readyState === ws.OPEN && client !== ws) {
                client.send(
                    JSON.stringify({
                        text: `${username} joined the chat`,
                        type: "info",
                        isSent: "false",
                        clientID,
                    })
                );
            }
        });
    } else {
        console.log(`Client ID ${clientID} is already connected`);
    }

    ws.on("close", () => {
        console.log(`Client ${clientID} disconnected`);
        const index = users.findIndex((user) => user.clientID === clientID);
        if (index !== -1) users.splice(index, 1);

        broadcastUsers();

        wss.clients.forEach((client) => {
            if (client.readyState === ws.OPEN) {
                client.send(
                    JSON.stringify({
                        text: `${username} left the chat`,
                        type: "info",
                        isSent: "false",
                        clientID,
                    })
                );
            }
        });
    });
});

app.get("/api/users", (_, res) => {
    res.status(200).json({ status: 200, users })
})

app.get("/api/messages", (_, res) => {
    res.status(200).json({ status: 200, messages })
})

function broadcastUsers() {
    const userList = users.map((user) => ({
        clientID: user.clientID,
        username: user.username,
        avatar: user.avatar,
    }));

    wss.clients.forEach((client) => {
        if (client.readyState === ws.OPEN) {
            client.send(
                JSON.stringify({
                    type: "userList",
                    users: userList,
                })
            );
        }
    });
}
