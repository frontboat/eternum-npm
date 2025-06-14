import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
// import "./App.css";
import ChatClient from "./client/client";
import LoginForm from "./components/chat/LoginForm";
import MessageGroupComponent from "./components/chat/MessageGroup";
import MessageInput from "./components/chat/MessageInput";

import { useAccountStore } from "@/hooks/store/use-account-store";
import Button from "@/ui/elements/button";
import CircleButton from "@/ui/elements/circle-button";
import {
  chatLogger,
  useConnectionEvents,
  useDirectMessageEvents,
  useGlobalMessageEvents,
  useInitialDataEvents,
  useRoomEvents,
  useRoomMessageEvents,
  useUserEvents,
} from "./hooks/useSocketEvents";
import { Message, Room } from "./types";
import { useChatStore } from "./useChatStore";
import { filterMessages, filterRoomsBySearch, filterUsersBySearch, sortMessagesByTime } from "./utils/filterUtils";
import { groupMessagesBySender } from "./utils/messageUtils";
import { generateUserCredentials, initialToken, initialUserId } from "./utils/userCredentials";

function ChatModule() {
  // User state
  const [userId, setUserId] = useState<string>(initialUserId);
  const [userToken, setUserToken] = useState<string>(initialToken);
  const [username, setUsername] = useState<string>("");
  const [isUsernameSet, setIsUsernameSet] = useState<boolean>(false);
  const [isRoomsVisible, setIsRoomsVisible] = useState<boolean>(false);

  // Room creation state
  const [showRoomCreation, setShowRoomCreation] = useState<boolean>(false);

  // Chat client state
  const chatClientRef = useRef<ChatClient | null>(null);

  // Account store state
  const { connector } = useAccountStore((state) => state);

  // Zustand store integration
  const {
    isExpanded,
    isMinimized,
    activeView,
    activeRoomId,
    directMessageRecipientId,
    isLoadingMessages: isStoreLoadingMessages,
    actions: chatActions,
  } = useChatStore();

  const { onlineUsers, offlineUsers, isLoadingUsers } = useChatStore((state) => ({
    onlineUsers: state.onlineUsers,
    offlineUsers: state.offlineUsers,
    isLoadingUsers: state.isLoadingUsers,
  }));

  // Chat client instance
  const chatClient = useMemo(() => {
    if (!isUsernameSet) return null;

    // If we already have a client instance with the same credentials, reuse it
    if (chatClientRef.current) {
      // Check if credentials match, but safely access socket auth properties
      const socketAuth = chatClientRef.current.socket.auth as {
        token?: string;
        username?: string;
      };

      if (socketAuth.token === userToken && socketAuth.username === username) {
        chatLogger.log("Reusing existing chat client");
        return chatClientRef.current;
      }
    }

    // Cleanup any existing socket connection
    if (chatClientRef.current) {
      chatLogger.log("Disconnecting previous chat client");
      chatClientRef.current.socket.disconnect();
    }

    chatLogger.log("Initializing new chat client for", username);
    const newClient = new ChatClient(userToken, username);
    chatClientRef.current = newClient;
    return newClient;
  }, [userToken, username, isUsernameSet]);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [newRoomId, setNewRoomId] = useState("");

  // Online users state
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);

  const [sidebarVisible, setSidebarVisible] = useState(true);

  // Add mobile detection state
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);

  // Local loading state to be compatible with hooks expecting React.Dispatch
  const [_isLoadingMessagesLocal, _setIsLoadingMessagesLocal] = useState<boolean>(true);

  // Add loading states
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);

  // Unread messages state - track unread messages by user ID
  const [unreadMessages, setUnreadMessages] = useState<Record<string, number>>({});

  const hasUnreadMessages = useMemo(() => {
    return Object.values(unreadMessages).some((count) => count > 0);
  }, [unreadMessages]);

  // Auto-scroll to bottom of messages
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Add search state variables
  const [roomSearch, setRoomSearch] = useState<string>("");
  const [userSearch, setUserSearch] = useState<string>("");

  // Scroll helper function for consistency
  const scrollToBottom = useCallback(() => {
    // First attempt at immediate scroll
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }

    // Secondary attempt with a short delay
    setTimeout(() => {
      // Method 1: Using scrollIntoView with immediate behavior
      messagesEndRef.current?.scrollIntoView({
        behavior: "auto",
        block: "end",
      });

      // Method 2: Direct container manipulation as backup
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    }, 10);

    // Final attempt with a longer delay to catch any edge cases
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: "auto",
        block: "end",
      });
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    }, 300);
  }, []);

  // Auto-scroll when messages change
  useEffect(() => {
    console.log("Messages updated, triggering scroll");
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Synchronize local loading state with Zustand store
  useEffect(() => {
    chatActions.setIsLoadingMessages(_isLoadingMessagesLocal);
  }, [_isLoadingMessagesLocal, chatActions]);

  // Synchronize Zustand store changes back to local state if needed
  useEffect(() => {
    _setIsLoadingMessagesLocal(isStoreLoadingMessages);
  }, [isStoreLoadingMessages]);

  // Add a message to the state with optimistic update for better UX
  const addMessage = useCallback(
    (message: Message) => {
      // Force a new array reference to ensure React detects the change
      setMessages((prevMessages) => {
        // Check for duplicates based on content, sender, type and timestamp proximity
        const isDuplicate = prevMessages.some(
          (existing) =>
            existing.message === message.message &&
            existing.senderId === message.senderId &&
            existing.type === message.type &&
            (message.type === "direct" ? existing.recipientId === message.recipientId : true) &&
            (message.type === "room" ? existing.roomId === message.roomId : true) &&
            // Check if timestamps are within 2 seconds of each other
            Math.abs(new Date(existing.timestamp).getTime() - new Date(message.timestamp).getTime()) < 2000,
        );

        if (isDuplicate) {
          chatLogger.log("Duplicate message detected, not adding:", message);
          return prevMessages; // Return unchanged array
        }

        const newMessages = [...prevMessages, message];
        chatLogger.log("New message count:", newMessages.length);
        return newMessages;
      });

      // Force scroll after adding message
      scrollToBottom();
    },
    [scrollToBottom],
  );

  // Filter messages based on active tab
  const filteredMessages = useMemo(() => {
    return filterMessages(messages, userId, directMessageRecipientId || "", activeRoomId || "");
  }, [messages, userId, directMessageRecipientId, activeRoomId]);

  // Sort messages based on active tab
  const sortedMessages = useMemo(() => {
    return sortMessagesByTime(filteredMessages);
  }, [filteredMessages]);

  // Group messages by sender
  const messageGroups = useMemo(() => {
    return groupMessagesBySender(sortedMessages);
  }, [sortedMessages]);

  useEffect(() => {
    if (chatClient && directMessageRecipientId) {
      chatLogger.log(`Requesting direct message history with ${directMessageRecipientId}`);

      // Use requestAnimationFrame to ensure UI updates before sending socket request
      window.requestAnimationFrame(() => {
        chatClient.getDirectMessageHistory(directMessageRecipientId);
      });

      // Set a safety timeout to clear loading state if no response
      const safetyTimeout = setTimeout(() => {
        chatActions.setIsLoadingMessages(false);
      }, 5000);

      return () => clearTimeout(safetyTimeout);
    } else {
      // No chat client, clear loading state
      chatActions.setIsLoadingMessages(false);
    }
  }, [directMessageRecipientId]);

  // Set direct message recipient from online users list
  const selectRecipient = useCallback(
    (recipientId: string) => {
      // Show loading state immediately
      chatActions.selectDirectMessageRecipient(recipientId);

      // Clear unread messages for this user
      setUnreadMessages((prev) => ({
        ...prev,
        [recipientId]: 0,
      }));
    },
    [chatClient, setUnreadMessages, chatActions],
  );

  // Send a message based on active tab
  const handleSendMessage = useCallback(
    (message: string) => {
      if (!chatClient) return;

      if (directMessageRecipientId) {
        chatClient.sendDirectMessage(directMessageRecipientId, message);
        // Add to our local messages for immediate feedback
        addMessage({
          id: Date.now().toString(),
          senderId: userId,
          senderUsername: username,
          recipientId: directMessageRecipientId,
          message: message,
          timestamp: new Date(),
          type: "direct",
        });
      } else if (activeRoomId) {
        chatClient.sendRoomMessage(activeRoomId, message);
        // Add to our local messages for immediate feedback
        addMessage({
          id: Date.now().toString(),
          senderId: userId,
          senderUsername: username,
          message: message,
          timestamp: new Date(),
          type: "room",
          roomId: activeRoomId,
        });
      } else {
        chatClient.sendGlobalMessage(message);
        // Add to our local messages for immediate feedback
        addMessage({
          id: Date.now().toString(),
          senderId: userId,
          senderUsername: username,
          message: message,
          timestamp: new Date(),
          type: "global",
        });
      }
    },
    [chatClient, directMessageRecipientId, activeRoomId, userId, username, addMessage],
  );

  // Handle username submission
  const handleLogin = (newUsername: string) => {
    // Generate deterministic userID and token from username
    const { userId: generatedUserId, token: generatedToken } = generateUserCredentials(newUsername);

    // Set the user credentials
    setUserId(generatedUserId);
    setUserToken(generatedToken);
    setUsername(newUsername);
    setIsUsernameSet(true);
  };

  useEffect(() => {
    if (!connector || !connector!.controller) return;

    try {
      connector.controller.username()?.then((name) => handleLogin(name));
    } catch (error) {}
  }, [connector]);

  // Setup chat event handlers
  useInitialDataEvents(
    chatClient,
    setAvailableRooms,
    setMessages,
    setIsLoadingRooms,
    _setIsLoadingMessagesLocal, // Pass local setter to hooks
  );

  useDirectMessageEvents(
    chatClient,
    userId,
    directMessageRecipientId || "",
    addMessage,
    setUnreadMessages,
    _setIsLoadingMessagesLocal, // Pass local setter to hooks
    setMessages,
  );

  useRoomMessageEvents(
    chatClient,
    activeRoomId || "",
    addMessage,
    setUnreadMessages,
    _setIsLoadingMessagesLocal, // Pass local setter to hooks
    setMessages,
  );

  useGlobalMessageEvents(chatClient, addMessage, setMessages);

  useUserEvents(chatClient);

  useRoomEvents(chatClient, setAvailableRooms, setIsLoadingRooms);

  useConnectionEvents(chatClient);

  // Request initial data once (after a short delay to ensure connection is ready)
  useEffect(() => {
    const initTimer = setTimeout(() => {
      if (chatClient?.socket.connected) {
        chatLogger.log("Requesting initial data");
        // No need to request data separately - server will send everything on connection
      }
    }, 500);

    // Set up an interval to periodically request online users and rooms
    const updateInterval = setInterval(() => {
      if (chatClient?.socket.connected) {
        chatLogger.log("Refreshing user and room data");
        chatClient.getAllUsers();
        chatClient.getRooms();
      }
    }, 30000);

    return () => {
      chatLogger.log("Cleaning up chat client");
      // Clear timers first
      clearTimeout(initTimer);
      clearInterval(updateInterval);

      // Disconnect socket to prevent memory leaks
      if (chatClient) {
        chatClient.socket.disconnect();
      }
    };
  }, [chatClient]);

  const joinedRoomsRef = useRef(new Set<string>());

  // Automatically join all available rooms to receive notifications
  useEffect(() => {
    if (chatClient && chatClient.socket && chatClient.socket.connected && availableRooms.length > 0) {
      availableRooms.forEach((room) => {
        if (!joinedRoomsRef.current.has(room.id)) {
          chatLogger.log(`Auto-joining room for notifications: ${room.id}`);
          chatClient.joinRoom(room.id);
          joinedRoomsRef.current.add(room.id);
        }
      });
    }
    // If the socket disconnects, we might want to clear joinedRoomsRef
    // so it attempts to rejoin when connection is re-established.
    // However, the current ChatClient re-initialization on disconnect/reconnect might handle this implicitly
    // by creating a new client instance, which would also mean a new joinedRoomsRef effectively.
    // For now, let's keep the dependencies simple.
  }, [chatClient, availableRooms, chatClient?.socket?.connected]);

  // Join a room
  const joinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomId.trim() || !chatClient) return;

    chatLogger.log(`Joining room from form: ${newRoomId}`);
    chatActions.selectRoom(newRoomId);

    // Clear unread messages for this new room
    setUnreadMessages((prev) => ({
      ...prev,
      [newRoomId]: 0,
    }));

    // Then join the socket.io room
    chatClient.joinRoom(newRoomId);

    // Request room history after joining
    setTimeout(() => {
      chatLogger.log(`Requesting room history for ${newRoomId} after join`);
      chatClient.getRoomHistory(newRoomId);
    }, 100);

    setNewRoomId("");
  };

  // Join a room from the sidebar
  const joinRoomFromSidebar = (roomId: string) => {
    if (!chatClient) return;

    chatActions.selectRoom(roomId);

    // Clear unread messages for this room
    setUnreadMessages((prev) => ({
      ...prev,
      [roomId]: 0,
    }));

    // Then join the socket.io room
    chatClient.joinRoom(roomId);

    // Request room history after joining
    setTimeout(() => {
      chatLogger.log(`Requesting room history for ${roomId} after join`);
      chatClient.getRoomHistory(roomId);
    }, 100);
  };

  // Filter rooms based on search input
  const filteredRooms = useMemo(() => {
    return filterRoomsBySearch(availableRooms, roomSearch);
  }, [availableRooms, roomSearch]);

  // Filter users based on search input
  const filteredUsers = useMemo(() => {
    const users = filterUsersBySearch(onlineUsers, userSearch);
    return users.sort((a, b) => {
      const unreadA = (unreadMessages[a.id] || 0) > 0;
      const unreadB = (unreadMessages[b.id] || 0) > 0;

      if (unreadA && !unreadB) {
        return -1; // A comes first
      }
      if (!unreadA && unreadB) {
        return 1; // B comes first
      }
      // If both have or don't have unread, sort by username
      return (a.username || a.id).localeCompare(b.username || b.id);
    });
  }, [onlineUsers, userSearch, unreadMessages]);

  // Filter offline users based on search input
  const filteredOfflineUsers = useMemo(() => {
    const users = filterUsersBySearch(offlineUsers, userSearch);
    return users.sort((a, b) => {
      const unreadA = (unreadMessages[a.id] || 0) > 0;
      const unreadB = (unreadMessages[b.id] || 0) > 0;

      if (unreadA && !unreadB) {
        return -1; // A comes first
      }
      if (!unreadA && unreadB) {
        return 1; // B comes first
      }
      // If both have or don't have unread, sort by username
      return (a.username || a.id).localeCompare(b.username || b.id);
    });
  }, [offlineUsers, userSearch, unreadMessages]);

  // Add resize listener to detect mobile view
  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 768);
      // Auto-hide sidebar on small screens
      if (window.innerWidth < 768) {
        setSidebarVisible(false);
      } else {
        setSidebarVisible(true);
      }
    };

    window.addEventListener("resize", handleResize);
    // Initial check
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Chat Header - add content before return statement
  const switchToGlobalChat = useCallback(() => {
    chatActions.switchToGlobalChat();
    // Global messages should already be loaded, but we'll show the spinner briefly
    setTimeout(() => chatActions.setIsLoadingMessages(false), 200);
  }, [chatActions]);

  // If username is not set, show login form
  if (!isUsernameSet) {
    return <LoginForm onLogin={handleLogin} />;
  }

  if (isMinimized) {
    return (
      <div className="fixed bottom-2 left-2 pointer-events-auto z-50">
        <CircleButton
          onClick={() => chatActions.setMinimized(false)}
          size="lg"
          // className="fixed bottom-2 left-2 pointer-events-auto" // Moved to parent div
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </CircleButton>
        {hasUnreadMessages && (
          <span className="absolute -top-1 -right-1 block h-5 w-5 rounded-full bg-red-500 border border-white bg-green pointer-events-none animate-pulse">
            {" "}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col panel-wood md:flex-row overflow-hidden bg-brown z-100 pointer-events-auto panel-wood-corners ${
        isExpanded ? "h-[600px]" : "h-72"
      } border-gold/20 border-2 transition-all duration-300`}
    >
      {/* Online Users Sidebar - modified for responsive design */}
      {sidebarVisible && (
        <div
          className={`${
            isMobileView ? "absolute z-10" : "w-72"
          } md:w-72 md:relative from-black to-gray-950 text-gray-200 shadow-lg flex-shrink-0 flex flex-col border-r border-gold/30`}
        >
          <div className="px-1 py-1 border-b border-gold/30">
            <div className="flex items-center justify-between gap-2 border-b border-gold/30 pb-1">
              <div className="flex items-center gap-2 ">
                <button
                  onClick={() => setIsRoomsVisible(!isRoomsVisible)}
                  className="text-gold/70 hover:text-gold transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-4 w-4 transform transition-transform ${isRoomsVisible ? "rotate-0" : "-rotate-90"}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <h2 className="text-lg font-bold">Rooms</h2>
              </div>

              <div className="flex items-center gap-2 flex-1">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Search rooms..."
                    value={roomSearch}
                    onChange={(e) => setRoomSearch(e.target.value)}
                    className="w-full pl-2 py-0.5 bg-gold/20 focus:outline-none text-gold placeholder-gold/50 border border-gold/30 rounded text-sm"
                  />
                </div>
                <button
                  onClick={() => setShowRoomCreation(!showRoomCreation)}
                  className="text-gold/70 hover:text-gold transition-colors p-1"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                <span className="bg-orange-600/60 px-2 py-0.5 text-xs font-medium">{availableRooms.length}</span>
              </div>
            </div>

            {/* Room Creation Form */}
            {showRoomCreation && (
              <form onSubmit={joinRoom} className="flex space-x-1 mt-2">
                <input
                  type="text"
                  placeholder="Room name"
                  value={newRoomId}
                  onChange={(e) => setNewRoomId(e.target.value)}
                  className="w-full px-2 py-1 bg-gold/20 focus:outline-none text-gold placeholder-gold/50 border border-gold/30 rounded"
                />
                <Button type="submit">Create</Button>
              </form>
            )}

            <div className={`${isRoomsVisible ? "block" : "hidden"}`}>
              <div className="overflow-y-auto max-h-[200px] scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent">
                {isLoadingRooms ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin h-5 w-5 border-2 border-orange-500 rounded-full border-t-transparent"></div>
                    <span className="ml-2 text-sm text-gray-400">Loading rooms...</span>
                  </div>
                ) : filteredRooms.length === 0 ? (
                  roomSearch ? (
                    <p className="text-gray-400 text-center text-sm py-2">No rooms match your search</p>
                  ) : (
                    <p className="text-gray-400 text-center text-sm py-2">No active rooms</p>
                  )
                ) : (
                  <ul className="space-y-1">
                    {filteredRooms.map((room) => (
                      <li
                        key={room.id}
                        className={`flex items-center px-1 py-1 cursor-pointer transition-colors h6 ${
                          room.id === activeRoomId ? "bg-orange/20 border-l-2 border-orange" : "hover:bg-gray/50"
                        }`}
                        onClick={() => joinRoomFromSidebar(room.id)}
                      >
                        <div className="flex items-center justify-center w-6 h-6 bg-orange-600/20 mr-2">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3.5 w-3.5 text-orange-300"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
                            />
                          </svg>
                        </div>
                        <span className="text-sm truncate">{room.name || room.id}</span>
                        {room.userCount && (
                          <span className="ml-auto bg-gray-600/70 px-2 py-0.5 text-xs">{room.userCount}</span>
                        )}
                        {/* Unread message notification badge for rooms */}
                        {unreadMessages[room.id] > 0 && (
                          <span className="ml-1 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            {unreadMessages[room.id]}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Users Section */}
          <div className="px-1 py-1 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between">
              <input
                type="text"
                placeholder="Search users..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-3 bg-gold/20 focus:outline-none text-gold placeholder-gold/50 border border-gold/30 rounded"
              />
            </div>

            {/* User Search */}
            <div className="relative">
              {userSearch && (
                <button
                  className="absolute right-2 top-2.5 text-gray-400 hover:text-white"
                  onClick={() => setUserSearch("")}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              )}
            </div>

            <div className="overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent">
              {isLoadingUsers ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin h-5 w-5 border-2 border-orange-500 rounded-full border-t-transparent"></div>
                  <span className="ml-2 text-sm text-gray-400">Loading users...</span>
                </div>
              ) : filteredUsers.length === 0 && filteredOfflineUsers.length === 0 ? (
                userSearch ? (
                  <p className="text-gray-400 text-center text-sm py-2">No users match your search</p>
                ) : (
                  <p className="text-gray-400 text-center text-sm py-2">No users found</p>
                )
              ) : (
                <div className="">
                  {/* Online Users */}
                  {filteredUsers.length > 0 && (
                    <div>
                      <div className="px-2 py-1 text-xs font-medium text-gray-400 uppercase tracking-wider mb-1 justify-between ">
                        Online Lords{" "}
                        <span className="bg-green-600 px-2 py-0.5 text-xs font-medium">
                          <span className="text-green">{onlineUsers.length}</span>
                        </span>
                      </div>
                      <ul className="">
                        {filteredUsers
                          .filter((user) => user && user.id !== userId)
                          .map((user) => (
                            <li
                              key={user.id}
                              className={`flex items-center px-2 py-1 cursor-pointer transition-colors   ${
                                user.id === userId
                                  ? "bg-orange-600/20 border-l-2 border-orange "
                                  : user.id === directMessageRecipientId
                                    ? "bg-orange/10 border-l-2 border-orange"
                                    : "hover:bg-gray/50 hover:border-l-2 hover:border-gray-500 active:bg-orange/10 active:border-orange"
                              }`}
                            >
                              <button
                                className="flex items-center w-full focus:outline-none"
                                onClick={() => {
                                  if (user.id !== userId) {
                                    selectRecipient(user.id);
                                  }
                                }}
                                disabled={user.id === userId}
                              >
                                <div className="h-7 w-7 flex items-center justify-center text-sm bg-gradient-to-br from-orange-500/30 to-orange-600/30 mr-2">
                                  {((user.username || user.id || "?").charAt(0) || "?").toUpperCase()}
                                </div>
                                <span className="text-sm truncate font-medium rounded">
                                  {user.username || user.id} {user.id === userId && "(You)"}
                                </span>
                                {/* Status indicator */}
                                <div className="ml-auto w-2 h-2 bg-green-500"></div>
                                {/* Unread message notification badge */}
                                {user.id !== userId && unreadMessages[user.id] > 0 && (
                                  <span className="ml-1 animate-pulse bg-red-500 text-white text-xs font-bold px-2 py-0.5 bg-red/30 rounded-full">
                                    {unreadMessages[user.id]}
                                  </span>
                                )}
                              </button>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}

                  {/* Offline Users */}
                  {filteredOfflineUsers.length > 0 && (
                    <div>
                      <div className="px-2 py-1 text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                        Offline
                      </div>
                      <ul className="space-y-2">
                        {filteredOfflineUsers.map((user) => (
                          <li
                            key={user.id}
                            className={`flex items-center px-2 cursor-pointer transition-colors opacity-60 ${
                              user.id === directMessageRecipientId
                                ? "bg-gray-800/30 border-l-2 border-gray-500"
                                : "hover:bg-gray-800/30 hover:border-l-2 hover:border-gray-600 active:bg-gray-800/50 active:border-gray-500"
                            }`}
                          >
                            <button
                              className="flex items-center w-full focus:outline-none"
                              onClick={(e) => {
                                e.preventDefault();
                                selectRecipient(user.id);
                              }}
                            >
                              <div className="h-7 w-7 flex items-center justify-center text-sm bg-gradient-to-br from-gray-500/30 to-gray-600/30 mr-2">
                                {((user.username || user.id || "?").charAt(0) || "?").toUpperCase()}
                              </div>
                              <span className="text-sm truncate font-medium text-gray-400">
                                {user.username || user.id}
                              </span>
                              {/* Unread message notification badge */}
                              {unreadMessages[user.id] > 0 && (
                                <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 bg-red/30 rounded-full">
                                  {unreadMessages[user.id]}
                                </span>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div
        className={`flex flex-col ${isMobileView && sidebarVisible ? "hidden" : "flex"} md:flex overflow-hidden w-96`}
      >
        {/* Chat Header */}
        <div className="from-black px-2 flex justify-between items-center flex-shrink-0 border-b border-gold/30 shadow-sm">
          <div className="flex items-center">
            <div className="truncate h6">
              {directMessageRecipientId ? (
                `Chat with ${
                  [...onlineUsers, ...offlineUsers].find((user) => user.id === directMessageRecipientId)?.username ||
                  directMessageRecipientId
                }`
              ) : activeRoomId ? (
                `Room: ${availableRooms.find((room) => room.id === activeRoomId)?.name || activeRoomId}`
              ) : (
                <span className="cursor-pointer hover:text-orange-300" onClick={switchToGlobalChat}>
                  Game Chat
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => chatActions.toggleExpand()}
              className="text-gold/70 hover:text-gold transition-colors p-1"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {isExpanded ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 14h6m0 0v6m0-6l-7 7m17-11h-6m0 0V4m0 6l7-7"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 3h6v6M9 3H3v6m12 12h6v-6M3 15v6h6"
                  />
                )}
              </svg>
            </button>
            <button
              onClick={() => chatActions.setMinimized(true)}
              className="text-gold/70 hover:text-gold transition-colors p-1"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages display */}
        <div
          className={`flex-1 overflow-y-auto p-2 md:p-4 flex flex-col bg-gradient-to-b from-black to-gray-950`}
          ref={chatContainerRef}
        >
          {isStoreLoadingMessages ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="animate-spin h-8 w-8 border-3 border-orange-500 rounded-full border-t-transparent mb-4"></div>
              <p className="text-gray-400">Loading messages...</p>
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-10 w-10 md:h-12 md:w-12 mb-2 text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              {directMessageRecipientId ? (
                <p>No direct messages yet</p>
              ) : activeRoomId ? (
                <p>No messages yet in this room</p>
              ) : (
                <p>No messages yet in Global Chat</p>
              )}
            </div>
          ) : (
            <>
              {/* Spacer to push content to bottom when there are few messages */}
              <div className="flex-grow" />

              <div className="space-y-1">
                {messageGroups.map((group, groupIndex) => {
                  // Create a unique key based on the group's first message id and index
                  const groupKey = `${group.messages[0]?.id || "empty"}-${groupIndex}`;
                  return (
                    <MessageGroupComponent
                      key={groupKey}
                      group={group}
                      userId={userId}
                      selectRecipient={selectRecipient}
                    />
                  );
                })}
                {/* Always keep the scroll anchor at the end of the content */}
                <div ref={messagesEndRef} style={{ height: "", clear: "both" }} />
              </div>
            </>
          )}
        </div>

        {/* Message input */}
        <MessageInput onSendMessage={handleSendMessage} />
      </div>
    </div>
  );
}

export default ChatModule;
