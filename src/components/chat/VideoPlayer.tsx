"use client";

/**
 * Custom Video Player (TZ Section 10)
 *
 * Features:
 * - Start playback before full download (startup_buffer: 3s) — TZ 10.1
 * - Rebuffer threshold: 1s — TZ 10.1
 * - Seek restrictions based on network profile — TZ 10.2
 * - Loop toggle with local cache replay — TZ 10.3
 * - Playback metrics (TZ Section 11)
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Repeat, Play, Pause, Volume2, VolumeX, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPlaybackParams, getNetworkProfile } from "@/lib/network-profiler";
import {
  startPlaybackSession,
  recordRebuffer,
  endPlaybackSession,
  logPlaybackEvent,
} from "@/lib/video/metrics";

interface VideoPlayerProps {
  src: string;
  messageId?: number;
  chatId?: string;
  autoPlay?: boolean;
  initialMuted?: boolean;
  initialLoop?: boolean;
  className?: string;
}

export function VideoPlayer({
  src,
  messageId = 0,
  chatId = "",
  autoPlay = true,
  initialMuted = false,
  initialLoop = false,
  className = "",
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionKeyRef = useRef<string | null>(null);
  const lastSeekTimeRef = useRef(0);
  const startupTimeRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(initialMuted);
  const [isLooping, setIsLooping] = useState(initialLoop);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const playbackParams = getPlaybackParams();

  // Hide controls after inactivity
  useEffect(() => {
    if (!showControls) return;
    const timer = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, [showControls, isPlaying]);

  // Start playback session for metrics
  useEffect(() => {
    startupTimeRef.current = Date.now();
    return () => {
      if (sessionKeyRef.current) {
        endPlaybackSession(sessionKeyRef.current, false);
        sessionKeyRef.current = null;
      }
    };
  }, [src]);

  // Video event handlers
  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    if (!sessionKeyRef.current) {
      const startupMs = Date.now() - startupTimeRef.current;
      sessionKeyRef.current = startPlaybackSession(messageId, chatId, startupMs);
    }
  }, [messageId, chatId]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);

    // Update buffered range
    if (video.buffered.length > 0) {
      setBuffered(video.buffered.end(video.buffered.length - 1));
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
  }, []);

  const handleWaiting = useCallback(() => {
    setIsBuffering(true);
    if (sessionKeyRef.current) {
      recordRebuffer(sessionKeyRef.current);
    }
  }, []);

  const handlePlaying = useCallback(() => {
    setIsBuffering(false);
  }, []);

  const handleEnded = useCallback(() => {
    if (isLooping) {
      const video = videoRef.current;
      if (video) {
        video.currentTime = 0;
        video.play().catch(() => {});

        logPlaybackEvent({
          messageId,
          chatId,
          event: "loop_toggle",
          details: "loop_replay",
        });
      }
    } else {
      setIsPlaying(false);
      if (sessionKeyRef.current) {
        endPlaybackSession(sessionKeyRef.current, true);
        sessionKeyRef.current = null;
      }
    }
  }, [isLooping, messageId, chatId]);

  // Seek with rate limiting (TZ 10.2)
  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const video = videoRef.current;
      if (!video) return;

      const seekTarget = parseFloat(e.target.value);
      const now = Date.now();
      const profile = getNetworkProfile();

      // TZ 10.2: Profile A — only within buffered range
      if (profile === "A") {
        let maxBuffered = 0;
        for (let i = 0; i < video.buffered.length; i++) {
          maxBuffered = Math.max(maxBuffered, video.buffered.end(i));
        }
        if (seekTarget > maxBuffered) return; // Block seeking beyond buffered
      }

      // TZ 10.2: Profiles B/C — max 1 seek per 2 seconds
      if (profile !== "fast") {
        const cooldown = playbackParams.seekCooldownSeconds * 1000;
        if (now - lastSeekTimeRef.current < cooldown) return;
      }

      lastSeekTimeRef.current = now;
      video.currentTime = seekTarget;

      logPlaybackEvent({
        messageId,
        chatId,
        event: "seek",
        currentTime: seekTarget,
      });
    },
    [messageId, chatId, playbackParams.seekCooldownSeconds]
  );

  // Toggle controls
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  const toggleLoop = useCallback(() => {
    setIsLooping((prev) => {
      const newVal = !prev;
      logPlaybackEvent({
        messageId,
        chatId,
        event: "loop_toggle",
        details: newVal ? "enabled" : "disabled",
      });
      return newVal;
    });
  }, [messageId, chatId]);

  const toggleFullscreen = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      video.requestFullscreen().catch(() => {});
    }
  }, []);

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  };

  return (
    <div
      className={"relative group bg-black " + className}
      onMouseMove={() => setShowControls(true)}
      onClick={togglePlay}
    >
      <video
        ref={videoRef}
        src={src}
        autoPlay={autoPlay}
        muted={initialMuted}
        loop={initialLoop}
        playsInline
        className="w-full h-full object-contain"
        onPlay={handlePlay}
        onPause={handlePause}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={handleWaiting}
        onPlaying={handlePlaying}
        onEnded={handleEnded}
      />

      {/* Buffering indicator */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="h-12 w-12 rounded-full border-4 border-white/30 border-t-white animate-spin" />
        </div>
      )}

      {/* Controls overlay */}
      <div
        className={
          "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-8 transition-opacity " +
          (showControls ? "opacity-100" : "opacity-0")
        }
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div className="relative w-full h-1 mb-2 group/progress">
          {/* Buffered range */}
          <div
            className="absolute top-0 left-0 h-full bg-white/30 rounded"
            style={{ width: duration > 0 ? (buffered / duration) * 100 + "%" : "0%" }}
          />
          {/* Played range */}
          <div
            className="absolute top-0 left-0 h-full bg-blue-500 rounded"
            style={{ width: duration > 0 ? (currentTime / duration) * 100 + "%" : "0%" }}
          />
          {/* Seek input */}
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        {/* Control buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/20"
            onClick={togglePlay}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/20"
            onClick={toggleMute}
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>

          <span className="text-xs text-white/80 select-none">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex-1" />

          {/* Loop toggle (TZ 10.3) */}
          <Button
            variant="ghost"
            size="icon"
            className={
              "h-8 w-8 hover:bg-white/20 " +
              (isLooping ? "text-blue-400" : "text-white/60")
            }
            onClick={toggleLoop}
            title={isLooping ? "Repeat: On" : "Repeat: Off"}
          >
            <Repeat className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/20"
            onClick={toggleFullscreen}
          >
            <Maximize className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
