// src/services/pusher.js
import { Pusher } from '@pusher/pusher-websocket-react-native';

const pusherInstance = Pusher.getInstance();

export const initializePusher = async () => {
    try {
        await pusherInstance.init({
            apiKey: 'd79a5a8f9ee122c046fe',
            cluster: 'ap2',

        });

        await pusherInstance.connect();
        console.log('Pusher connected!');
    } catch (error) {
        console.error('Pusher connection error:', error);
    }
};

export default pusherInstance;