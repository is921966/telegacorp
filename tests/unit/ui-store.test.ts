import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore } from "@/store/ui";

describe("useUIStore", () => {
  beforeEach(() => {
    useUIStore.getState().reset();
    // reset() does not restore theme, so manually set it back to default
    useUIStore.getState().setTheme("dark");
  });

  describe("selectChat", () => {
    it("sets the selectedChatId", () => {
      useUIStore.getState().selectChat("chat-42");

      expect(useUIStore.getState().selectedChatId).toBe("chat-42");
    });

    it("closes group info when selecting a chat", () => {
      // Open group info first
      useUIStore.getState().toggleGroupInfo();
      expect(useUIStore.getState().isGroupInfoOpen).toBe(true);

      useUIStore.getState().selectChat("chat-99");

      expect(useUIStore.getState().isGroupInfoOpen).toBe(false);
    });

    it("sets selectedChatId to null", () => {
      useUIStore.getState().selectChat("chat-1");
      useUIStore.getState().selectChat(null);

      expect(useUIStore.getState().selectedChatId).toBeNull();
    });
  });

  describe("toggleSearch", () => {
    it("opens search when closed", () => {
      expect(useUIStore.getState().isSearchOpen).toBe(false);

      useUIStore.getState().toggleSearch();

      expect(useUIStore.getState().isSearchOpen).toBe(true);
    });

    it("closes search and clears query when open", () => {
      useUIStore.getState().toggleSearch(); // open
      useUIStore.getState().setSearchQuery("hello");

      useUIStore.getState().toggleSearch(); // close

      expect(useUIStore.getState().isSearchOpen).toBe(false);
      expect(useUIStore.getState().searchQuery).toBe("");
    });

    it("preserves search query when opening", () => {
      // Set query while closed (edge case)
      useUIStore.getState().setSearchQuery("pre-existing");

      useUIStore.getState().toggleSearch(); // open

      expect(useUIStore.getState().isSearchOpen).toBe(true);
      expect(useUIStore.getState().searchQuery).toBe("pre-existing");
    });
  });

  describe("openMediaViewer / closeMediaViewer", () => {
    it("openMediaViewer sets url and opens viewer", () => {
      useUIStore.getState().openMediaViewer("https://example.com/photo.jpg");

      const state = useUIStore.getState();
      expect(state.isMediaViewerOpen).toBe(true);
      expect(state.mediaViewerUrl).toBe("https://example.com/photo.jpg");
    });

    it("closeMediaViewer clears url and closes viewer", () => {
      useUIStore.getState().openMediaViewer("https://example.com/photo.jpg");
      useUIStore.getState().closeMediaViewer();

      const state = useUIStore.getState();
      expect(state.isMediaViewerOpen).toBe(false);
      expect(state.mediaViewerUrl).toBeNull();
    });
  });

  describe("theme", () => {
    it("changes theme to light", () => {
      expect(useUIStore.getState().theme).toBe("dark"); // default

      useUIStore.getState().setTheme("light");

      expect(useUIStore.getState().theme).toBe("light");
    });

    it("changes theme back to dark", () => {
      useUIStore.getState().setTheme("light");
      useUIStore.getState().setTheme("dark");

      expect(useUIStore.getState().theme).toBe("dark");
    });
  });

  describe("reset", () => {
    it("resets all state to defaults (except theme)", () => {
      // Modify everything
      useUIStore.getState().selectChat("chat-1");
      useUIStore.getState().toggleSearch();
      useUIStore.getState().setSearchQuery("test");
      useUIStore.getState().setSidebarOpen(false);
      useUIStore.getState().toggleGroupInfo();
      useUIStore.getState().openMediaViewer("http://img.jpg");
      useUIStore.getState().setReplyTo(42);
      useUIStore.getState().setEditing(7);

      useUIStore.getState().reset();

      const state = useUIStore.getState();
      expect(state.selectedChatId).toBeNull();
      expect(state.isSearchOpen).toBe(false);
      expect(state.searchQuery).toBe("");
      expect(state.isSidebarOpen).toBe(true);
      expect(state.isGroupInfoOpen).toBe(false);
      expect(state.isMediaViewerOpen).toBe(false);
      expect(state.mediaViewerUrl).toBeNull();
      expect(state.replyToMessageId).toBeNull();
      expect(state.editingMessageId).toBeNull();
    });

    it("does not reset the theme (not included in reset implementation)", () => {
      useUIStore.getState().setTheme("light");

      useUIStore.getState().reset();

      // Theme is intentionally not reset per the store implementation
      expect(useUIStore.getState().theme).toBe("light");
    });
  });
});
