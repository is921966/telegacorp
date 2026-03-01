import { create } from "zustand";
import { persist } from "zustand/middleware";

const MAX_AVATARS = 500;

interface AvatarsStore {
  /** entityId → base64 data URL (or "" for no-photo) */
  avatars: Record<string, string>;
  /** Ordered list of entity IDs for LRU eviction */
  order: string[];

  setAvatar: (id: string, url: string) => void;
  getAvatar: (id: string) => string | undefined;
}

export const useAvatarsStore = create<AvatarsStore>()(
  persist(
    (set, get) => ({
      avatars: {},
      order: [],

      setAvatar: (id, url) =>
        set((state) => {
          const newAvatars = { ...state.avatars, [id]: url };
          // Update LRU order: remove old position, add to end
          let newOrder = state.order.filter((x) => x !== id);
          newOrder.push(id);

          // Evict oldest if over limit
          while (newOrder.length > MAX_AVATARS) {
            const evicted = newOrder.shift()!;
            delete newAvatars[evicted];
          }

          return { avatars: newAvatars, order: newOrder };
        }),

      getAvatar: (id) => {
        const val = get().avatars[id];
        return val === undefined ? undefined : val;
      },
    }),
    {
      name: "tg-avatars",
      partialize: (state) => ({ avatars: state.avatars, order: state.order }),
    }
  )
);
