import { router } from 'expo-router';
import React from 'react';
import { Text, TextProps } from 'react-native';

// RichText Component - parses hashtags and mentions
const RichText = ({ children, style, ...props }: TextProps & { children: string }) => {
    const combinedRegex = /(#+\w+)|(@\w+)/g;
    const parts = children?.split(combinedRegex)?.filter(Boolean);

    return (
        <Text style={style} {...props}>
            {parts?.map((part, index) => {
                if (part?.startsWith('#')) {
                    return (
                        <Text
                            key={index}
                            style={{ color: '#007AFF' }}
                            onPress={() => router.push(`/user/${part.slice(1)}`)}
                        >
                            {part}
                        </Text>
                    );
                }
                if (part?.startsWith('@')) {
                    return (
                        <Text
                            key={index}
                            style={{ color: '#5856D6' }}
                            onPress={() => router.push(`/user/${part.slice(1)}`)}
                        >
                            {part}
                        </Text>
                    );
                }
                return part;
            })}
        </Text>
    );
};

export default RichText;