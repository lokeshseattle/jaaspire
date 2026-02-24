import { useGetStoryViewers } from "@/src/features/story/story.hooks";
import { TViewer } from "@/src/services/api/api.types";
import { Ionicons } from "@expo/vector-icons";
import BottomSheet, {
    BottomSheetBackdrop,
    BottomSheetFlatList,
} from "@gorhom/bottom-sheet";
import { Image } from "expo-image";
import React, { useCallback, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface TProps {
  id: number;
  setIsPaused: React.Dispatch<React.SetStateAction<boolean>>;
}

const ViewerItem = ({ item }: { item: TViewer }) => {
  return (
    <Pressable style={styles.viewerItem}>
      <Image source={{ uri: item.avatar }} style={styles.avatar} />

      <View style={styles.userInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{item.name}</Text>

          {item.verified_user === 1 && <VerifiedBadge />}
        </View>

        <Text style={styles.username}>@{item.username}</Text>
      </View>

      <Text style={styles.time}>{item.viewed_at}</Text>
    </Pressable>
  );
};

const VerifiedBadge = () => (
  <View
    style={{
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: "#3897F0",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <Text style={{ color: "white", fontSize: 10 }}>✓</Text>
  </View>
);

const Viewers = ({ id, setIsPaused }: TProps) => {
  const { data: storyView } = useGetStoryViewers(id);

  const bottomSheetRef = useRef<BottomSheet>(null);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        pressBehavior="close"
      />
    ),
    [],
  );

  const snapPoints = useMemo(() => ["50%"], []);
  return (
    <>
      <Pressable
        style={styles.viewsButton}
        onPress={() => {
          setIsPaused(true);
          bottomSheetRef.current?.expand();
        }}
      >
        <Ionicons name="eye-outline" size={16} color="white" />
        <Text style={styles.viewsText}>{storyView?.total ?? 0}</Text>
      </Pressable>
      <BottomSheet
        ref={bottomSheetRef}
        index={-1} // closed initially
        snapPoints={snapPoints}
        backgroundStyle={{ backgroundColor: "#111" }}
        handleIndicatorStyle={{ backgroundColor: "#666" }}
        backdropComponent={renderBackdrop}
        enablePanDownToClose
        onChange={(index) => {
          setIsPaused(index > -1 ? true : false);
        }}
      >
        <BottomSheetFlatList
          data={storyView?.viewers}
          keyExtractor={(item: TViewer) => item.id.toString()}
          contentContainerStyle={{ paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No viewers yet</Text>
            </View>
          )}
          renderItem={({ item }: { item: TViewer }) => (
            <ViewerItem item={item} />
          )}
        />
      </BottomSheet>
    </>
  );
};

export default Viewers;
const styles = StyleSheet.create({
  viewsButton: {
    position: "absolute",
    bottom: 40,
    left: 20,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(128,128,128,0.3)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  viewsText: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
  },
  //   viewerItem: {
  //     padding: 16,
  //     borderBottomWidth: 0.5,
  //     borderBottomColor: "#333",
  //   },

  viewerName: {
    color: "white",
    fontSize: 16,
  },
  viewerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },

  userInfo: {
    flex: 1,
  },

  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  name: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ddd",
  },

  username: {
    fontSize: 13,
    color: "#8E8E8E",
    marginTop: 2,
  },

  time: {
    fontSize: 12,
    color: "#8E8E8E",
  },

  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#EAEAEA",
    marginLeft: 72,
  },

  emptyContainer: {
    padding: 32,
    alignItems: "center",
  },

  emptyText: {
    color: "#8E8E8E",
  },
});
