import http, { Server } from 'http';
import WebSocket, { Data } from 'ws';

interface Data {
  type:
    | 'ECHO'
    | 'ECHO_TIMES_3'
    | 'ECHO_TO_ALL'
    | 'CREATE_GROUP'
    | 'JOIN_GROUP'
    | 'MESSAGE_GROUP';
  value: any;
}

const groupNames: string[] = [];

/**
 * Creates a WebSocket server from a Node http server. The server must
 * be started externally.
 * @param server The http server from which to create the WebSocket server
 */
export const createWebSocketServer = (server: Server): void => {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', function (webSocket: any) {
    webSocket.on('message', function (message) {
      const data: Data = JSON.parse(message as string);

      switch (data.type) {
        case 'ECHO': {
          webSocket.send(data.value);
          break;
        }
        case 'ECHO_TIMES_3': {
          for (let i = 1; i <= 3; i++) {
            webSocket.send(data.value);
          }
          break;
        }
        case 'ECHO_TO_ALL': {
          wss.clients.forEach((ws) => ws.send(data.value));
          break;
        }
        case 'CREATE_GROUP': {
          const groupName = data.value;

          if (!groupNames.find((gn) => gn === groupName)) {
            groupNames.push(groupName);
            webSocket.groupName = groupName;
            webSocket.send(groupName);
          } else {
            webSocket.send('GROUP_UNAVAILABLE');
          }

          break;
        }
        case 'JOIN_GROUP': {
          const groupName = data.value;

          if (!groupNames.find((gn) => gn === groupName)) {
            webSocket.send('GROUP_UNAVAILABLE');
          } else {
            webSocket.groupName = groupName;
            webSocket.send(groupName);
          }

          break;
        }
        case 'MESSAGE_GROUP': {
          const { groupName, groupMessage } = data.value;
          if (webSocket.groupName !== groupName) {
            break;
          }
          wss.clients.forEach((ws: any) => {
            if (ws.groupName === groupName) {
              ws.send(groupMessage);
            }
          });
          break;
        }
      }
    });
  });
};

/**
 * Creates and starts a WebSocket server from a simple http server for testing purposes.
 * @param port Port for the server to listen on
 * @returns The created server
 */
export const startServer = (port: number): Promise<Server> => {
  const server = http.createServer();
  createWebSocketServer(server);

  return new Promise((resolve) => {
    server.listen(port, () => resolve(server));
  });
};

/**
 * Forces a process to wait until the socket's `readyState` becomes the specified value.
 * @param socket The socket whose `readyState` is being watched
 * @param state The desired `readyState` for the socket
 */
export const waitForSocketState = (
  socket: WebSocket,
  state: number,
): Promise<void> => {
  return new Promise(function (resolve) {
    setTimeout(function () {
      if (socket.readyState === state) {
        resolve();
      } else {
        waitForSocketState(socket, state).then(resolve);
      }
    });
  });
};

export const createSocketClient = async (
  port: number,
  closeAfter?: number,
): Promise<[WebSocket, Data[]]> => {
  const client = new WebSocket(`ws://localhost:${port}`);
  await waitForSocketState(client, client.OPEN);
  const messages: WebSocket.Data[] = [];

  client.on('message', (data) => {
    messages.push(data);

    if (messages.length === closeAfter) {
      client.close();
    }
  });

  return [client, messages];
};
