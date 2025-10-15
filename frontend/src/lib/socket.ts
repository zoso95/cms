import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
    socket = io(backendUrl, {
      autoConnect: true,
    });

    socket.on('connect', () => {
      console.log('Connected to WebSocket server');
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
    });
  }

  return socket;
}

export function subscribeToPatientCase(patientCaseId: number) {
  const socket = getSocket();
  socket.emit('subscribe-patient-case', patientCaseId);
}

export function unsubscribeFromPatientCase(patientCaseId: number) {
  const socket = getSocket();
  socket.emit('unsubscribe-patient-case', patientCaseId);
}
