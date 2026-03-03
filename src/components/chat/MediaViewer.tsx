"use client";

import { useUIStore } from "@/store/ui";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { X, Download } from "lucide-react";
import { VideoPlayer } from "./VideoPlayer";

export function MediaViewer() {
  const {
    isMediaViewerOpen,
    mediaViewerUrl,
    mediaViewerType,
    mediaViewerMessageId,
    mediaViewerChatId,
    closeMediaViewer,
  } = useUIStore();

  if (!mediaViewerUrl) return null;

  return (
    <Dialog open={isMediaViewerOpen} onOpenChange={() => closeMediaViewer()}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 border-none bg-black/90" aria-describedby={undefined}>
        <VisuallyHidden><DialogTitle>Media Viewer</DialogTitle></VisuallyHidden>
        <div className="relative flex items-center justify-center min-h-[50vh]">
          <div className="absolute top-4 right-4 z-10 flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => {
                const a = document.createElement("a");
                a.href = mediaViewerUrl;
                a.download = mediaViewerType === "video" ? "video" : "media";
                a.click();
              }}
            >
              <Download className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={closeMediaViewer}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          {mediaViewerType === "video" ? (
            <VideoPlayer
              src={mediaViewerUrl}
              messageId={mediaViewerMessageId ?? 0}
              chatId={mediaViewerChatId ?? ""}
              autoPlay
              className="max-w-full max-h-[85vh]"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaViewerUrl}
              alt="Media"
              className="max-w-full max-h-[85vh] object-contain"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
