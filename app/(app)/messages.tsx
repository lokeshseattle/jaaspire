// src/screens/ChatScreen.js
import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import pusher, { initializePusher } from '../../src/lib/pusher';

const ChatScreen = () => {
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const setupPusher = async () => {
      try {
        // Initialize and connect
        await initializePusher();
        setIsConnected(true);

        // Subscribe to channel
        await pusher.subscribe({
          channelName: 'user-notification-231',
          onEvent: (event) => {
            console.log('Message received:', event.data);

            // Parse the data and update state
            const data = JSON.parse(event.data);
            // setMessages((prev) => [...prev, data]);
          },
        });


        // console.log('Subscribed to notifications channel');
      } catch (error) {
        console.error('Pusher setup error:', error);
      }
    };

    setupPusher();

    // Cleanup on unmount
    return () => {
      pusher.unsubscribe({ channelName: 'notifications' });
      pusher.disconnect();
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.status}>
        {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </Text>

      <FlatList
        data={messages}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <View style={styles.messageBox}>
            {/* <Text style={styles.messageText}>{item.message}</Text> */}
          </View>
        )}
        ListEmptyComponent={<Text>No messages yet...</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  status: {
    fontSize: 16,
    marginBottom: 20,
  },
  messageBox: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  messageText: {
    fontSize: 14,
  },
});

export default ChatScreen;