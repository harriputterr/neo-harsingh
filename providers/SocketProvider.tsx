"use client"
import React, { createContext, useMemo, useContext } from "react";
import { io, Socket } from "socket.io-client";

const SocketContext = createContext<Socket | null>(null);

type SocketProviderProps = {
  children: React.ReactNode;
};

export const useSocket = () => {
  const socket = useContext(SocketContext);
  return socket;
};

export const SocketProvider = ({ children }: SocketProviderProps) => {
  const socket = useMemo(() => io("localhost:8000"), []);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
};
