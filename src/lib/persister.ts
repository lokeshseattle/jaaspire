import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "MY_APP_QUERY_CACHE_V1", // for versioning - always change if publishing a new version
});
