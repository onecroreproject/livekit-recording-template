import React, { useEffect, useRef } from 'react';
import {
  useTracks,
  RoomAudioRenderer,
  VideoTrack,
  useRoomContext,
} from '@livekit/components-react';
import { Track, RoomEvent } from 'livekit-client';
import EgressHelper from '@livekit/egress-sdk';

export default function RecordingRoom() {
  const room = useRoomContext();
  const recordingStarted = useRef(false);

  // --------------------------------------------------
  // Register room with Egress
  // --------------------------------------------------
  useEffect(() => {
    if (!room) return;

    try {
      EgressHelper.setRoom(room);
      console.log('[Recording Template] Egress room registered');
    } catch (error) {
      console.error(
        '[Recording Template] Failed to register Egress room:',
        error
      );
    }
  }, [room]);

  // --------------------------------------------------
  // Subscribe to all remote video tracks
  // --------------------------------------------------
  useEffect(() => {
    if (!room) return;

    const subscribeToVideo = async (participant) => {
      for (const publication of participant.trackPublications.values()) {
        const isVideo =
          publication.source === Track.Source.Camera ||
          publication.source === Track.Source.ScreenShare;

        if (!isVideo) continue;

        console.log(
          '[Recording Template] VIDEO PUBLICATION',
          {
            participant: participant.identity,
            source: publication.source,
            trackSid: publication.trackSid,
            subscribed: publication.isSubscribed,
            hasTrack: !!publication.track,
          }
        );

        try {
          if (!publication.isSubscribed) {
            await publication.setSubscribed(true);

            console.log(
              '[Recording Template] SUBSCRIBED',
              participant.identity,
              publication.source
            );
          }

          // Give LiveKit a moment to attach the track.
          await new Promise((resolve) => setTimeout(resolve, 200));

          console.log(
            '[Recording Template] AFTER SUBSCRIBE',
            {
              participant: participant.identity,
              source: publication.source,
              subscribed: publication.isSubscribed,
              hasTrack: !!publication.track,
            }
          );
        } catch (error) {
          console.error(
            '[Recording Template] VIDEO SUBSCRIBE ERROR',
            participant.identity,
            publication.source,
            error
          );
        }
      }
    };

    // Existing participants
    for (const participant of room.remoteParticipants.values()) {
      subscribeToVideo(participant);
    }

    // New participant
    const handleParticipantConnected = (participant) => {
      console.log(
        '[Recording Template] PARTICIPANT CONNECTED',
        participant.identity
      );

      subscribeToVideo(participant);
    };

    // New publication
    const handleTrackPublished = (publication, participant) => {
      const isVideo =
        publication.source === Track.Source.Camera ||
        publication.source === Track.Source.ScreenShare;

      if (!isVideo) return;

      console.log(
        '[Recording Template] TRACK PUBLISHED',
        {
          participant: participant.identity,
          source: publication.source,
          trackSid: publication.trackSid,
        }
      );

      subscribeToVideo(participant);
    };

    // Track subscribed
    const handleTrackSubscribed = (
      track,
      publication,
      participant
    ) => {
      if (
        publication.source !== Track.Source.Camera &&
        publication.source !== Track.Source.ScreenShare
      ) {
        return;
      }

      console.log(
        '[Recording Template] TRACK SUBSCRIBED',
        {
          participant: participant.identity,
          source: publication.source,
          trackSid: publication.trackSid,
          kind: track.kind,
        }
      );
    };

    room.on(
      RoomEvent.ParticipantConnected,
      handleParticipantConnected
    );

    room.on(
      RoomEvent.TrackPublished,
      handleTrackPublished
    );

    room.on(
      RoomEvent.TrackSubscribed,
      handleTrackSubscribed
    );

    // --------------------------------------------------
    // IMPORTANT
    // Keep Egress start independent from video.
    // --------------------------------------------------
    const startTimer = setTimeout(() => {
      if (recordingStarted.current) return;

      recordingStarted.current = true;

      console.log(
        '[Recording Template] START_RECORDING signal'
      );

      EgressHelper.startRecording();

      console.log(
        '[Recording Template] Egress recording started'
      );
    }, 3000);

    return () => {
      clearTimeout(startTimer);

      room.off(
        RoomEvent.ParticipantConnected,
        handleParticipantConnected
      );

      room.off(
        RoomEvent.TrackPublished,
        handleTrackPublished
      );

      room.off(
        RoomEvent.TrackSubscribed,
        handleTrackSubscribed
      );
    };
  }, [room]);

  // --------------------------------------------------
  // Camera tracks
  // --------------------------------------------------
  const cameraTracks = useTracks(
    [
      {
        source: Track.Source.Camera,
        withPlaceholder: false,
      },
    ],
    {
      onlySubscribed: true,
    }
  );

  // --------------------------------------------------
  // Screen-share tracks
  // --------------------------------------------------
  const screenShareTracks = useTracks(
    [
      {
        source: Track.Source.ScreenShare,
        withPlaceholder: false,
      },
    ],
    {
      onlySubscribed: true,
    }
  );

  // --------------------------------------------------
  // Debug
  // --------------------------------------------------
  console.log(
    '[Recording Template] CAMERA TRACKS',
    cameraTracks.map((t) => ({
      identity: t.participant?.identity,
      source: t.source,
      hasTrack: !!t.track,
      subscribed: t.publication?.isSubscribed,
      trackSid: t.publication?.trackSid,
    }))
  );

  console.log(
    '[Recording Template] SCREEN TRACKS',
    screenShareTracks.map((t) => ({
      identity: t.participant?.identity,
      source: t.source,
      hasTrack: !!t.track,
      subscribed: t.publication?.isSubscribed,
      trackSid: t.publication?.trackSid,
    }))
  );

  // --------------------------------------------------
  // Remove Egress recorder
  // --------------------------------------------------
  const validCameras = cameraTracks.filter((trackRef) => {
    const identity =
      trackRef.participant?.identity?.toLowerCase() || '';

    return (
      !identity.includes('egress') &&
      !identity.includes('recorder') &&
      !!trackRef.track
    );
  });

  const validScreens = screenShareTracks.filter((trackRef) => {
    const identity =
      trackRef.participant?.identity?.toLowerCase() || '';

    return (
      !identity.includes('egress') &&
      !identity.includes('recorder') &&
      !!trackRef.track
    );
  });

  // --------------------------------------------------
  // Screen share priority
  // --------------------------------------------------
  if (validScreens.length > 0) {
    console.log(
      '[Recording Template] RENDERING SCREEN SHARE',
      validScreens[0].participant?.identity
    );

    return (
      <div className="recording-container">
        <RoomAudioRenderer />

        <div className="teacher-screen">
          <VideoTrack
            trackRef={validScreens[0]}
            className="video-element"
          />
        </div>
      </div>
    );
  }

  // --------------------------------------------------
  // Camera grid
  // --------------------------------------------------
  if (validCameras.length > 0) {
    console.log(
      '[Recording Template] RENDERING CAMERAS',
      validCameras.length
    );

    return (
      <div className="recording-container">
        <RoomAudioRenderer />

        <div
          className="multi-camera-grid"
          data-count={Math.min(validCameras.length, 9)}
        >
          {validCameras.map((trackRef) => (
            <VideoTrack
              key={trackRef.publication.trackSid}
              trackRef={trackRef}
              className="video-element"
            />
          ))}
        </div>
      </div>
    );
  }

  // --------------------------------------------------
  // No video yet
  // --------------------------------------------------
  return (
    <div className="recording-container">
      <RoomAudioRenderer />

      <div className="waiting-video">
        Waiting for video tracks...
      </div>
    </div>
  );
}