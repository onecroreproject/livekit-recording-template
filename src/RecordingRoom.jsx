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

  // Register room with Egress
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

  /*
   * Wait specifically for a VIDEO track before starting Egress.
   */
  useEffect(() => {
    if (!room || recordingStarted.current) return;

    const startRecording = () => {
      if (recordingStarted.current) return;

      console.log(
        '[Recording Template] Video track available - starting Egress'
      );

      EgressHelper.startRecording();

      recordingStarted.current = true;

      console.log('[Recording Template] Egress recording started');
    };

    // Check already subscribed tracks
    for (const participant of room.remoteParticipants.values()) {
      for (const publication of participant.trackPublications.values()) {
        if (
          publication.track &&
          (
            publication.source === Track.Source.Camera ||
            publication.source === Track.Source.ScreenShare
          )
        ) {
          console.log(
            '[Recording Template] Existing video:',
            participant.identity,
            publication.source
          );

          startRecording();
          return;
        }
      }
    }

    const handleTrackSubscribed = (
      track,
      publication,
      participant
    ) => {
      console.log(
        '[Recording Template] Track subscribed:',
        participant?.identity,
        publication?.source
      );

      if (
        publication?.source === Track.Source.Camera ||
        publication?.source === Track.Source.ScreenShare
      ) {
        startRecording();
      }
    };

    room.on(
      RoomEvent.TrackSubscribed,
      handleTrackSubscribed
    );

    return () => {
      room.off(
        RoomEvent.TrackSubscribed,
        handleTrackSubscribed
      );
    };
  }, [room]);

  /*
   * ALL subscribed camera tracks.
   */
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

  /*
   * ALL subscribed screen-share tracks.
   */
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

  /*
   * Debug information.
   */
  console.log(
    '[Recording Template] CAMERA TRACKS:',
    cameraTracks.map((t) => ({
      identity: t.participant?.identity,
      source: t.source,
      hasTrack: !!t.track,
      subscribed: t.publication?.isSubscribed,
      sid: t.publication?.trackSid,
    }))
  );

  console.log(
    '[Recording Template] SCREEN TRACKS:',
    screenShareTracks.map((t) => ({
      identity: t.participant?.identity,
      source: t.source,
      hasTrack: !!t.track,
      subscribed: t.publication?.isSubscribed,
      sid: t.publication?.trackSid,
    }))
  );

  /*
   * Remove only the Egress recorder participant.
   */
  const validCameras = cameraTracks.filter((trackRef) => {
    const identity =
      trackRef.participant?.identity?.toLowerCase() || '';

    return !identity.includes('egress') &&
      !identity.includes('recorder') &&
      !!trackRef.track;
  });

  const validScreens = screenShareTracks.filter((trackRef) => {
    const identity =
      trackRef.participant?.identity?.toLowerCase() || '';

    return !identity.includes('egress') &&
      !identity.includes('recorder') &&
      !!trackRef.track;
  });

  /*
   * SCREEN SHARE HAS PRIORITY.
   */
  if (validScreens.length > 0) {
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

  /*
   * OTHERWISE SHOW ALL CAMERAS.
   */
  return (
    <div className="recording-container">
      <RoomAudioRenderer />

      {validCameras.length > 0 ? (
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
      ) : (
        <div className="waiting-video">
          Waiting for video tracks...
        </div>
      )}
    </div>
  );
}
