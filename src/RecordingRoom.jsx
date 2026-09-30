import React, { useEffect, useMemo, useRef } from 'react';
import {
  useTracks,
  RoomAudioRenderer,
  VideoTrack,
  useRoomContext,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import EgressHelper from '@livekit/egress-sdk';

// Determine whether participant is teacher or student
const getParticipantRole = (participant) => {
  if (participant.metadata) {
    try {
      const meta = JSON.parse(participant.metadata);

      if (meta?.role) {
        return meta.role.toLowerCase();
      }
    } catch (error) {
      console.warn('Unable to parse participant metadata:', error);
    }
  }

  // Development fallback only
  if (
    participant.identity &&
    participant.identity.toLowerCase().includes('teacher')
  ) {
    return 'teacher';
  }

  return 'student';
};

export default function RecordingRoom() {
  const room = useRoomContext();
  const recordingStarted = useRef(false);

  /*
   * Register the connected LiveKit Room with Egress.
   */
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
   * Start recording after the room is connected.
   *
   * We wait until React has rendered the layout before sending
   * the START_RECORDING signal.
   */
  useEffect(() => {
    if (!room) return;
    if (recordingStarted.current) return;

    const startRecording = () => {
      if (recordingStarted.current) return;

      console.log('[Recording Template] Remote track available');
      console.log('[Recording Template] Sending Egress START_RECORDING signal');

      EgressHelper.startRecording();

      recordingStarted.current = true;

      console.log('[Recording Template] Egress recording started');
    };

    // Check if a remote participant already has tracks
    for (const participant of room.remoteParticipants.values()) {
      for (const publication of participant.trackPublications.values()) {
        if (publication.track) {
          startRecording();
          return;
        }
      }
    }

    // Otherwise wait for the first subscribed track
    const handleTrackSubscribed = () => {
      startRecording();
    };

    room.on('trackSubscribed', handleTrackSubscribed);

    return () => {
      room.off('trackSubscribed', handleTrackSubscribed);
    };
  }, [room]);

  /*
   * Camera tracks
   */
  const cameraTracks = useTracks(
    [Track.Source.Camera],
    {
      onlySubscribed: true,
    }
  );

  /*
   * Screen-share tracks
   */
  const screenShareTracks = useTracks(
    [Track.Source.ScreenShare],
    {
      onlySubscribed: true,
    }
  );

  /*
   * Remove recorder/egress participants.
   */
  const filterValidTracks = (tracks) => {
    return tracks.filter((trackRef) => {
      const identity =
        trackRef.participant.identity?.toLowerCase() || '';

      const isEgress =
        identity.includes('egress') ||
        identity.includes('recorder');

      return (
        !isEgress &&
        trackRef.publication?.isSubscribed &&
        trackRef.track
      );
    });
  };

  const validCameras = useMemo(
    () => filterValidTracks(cameraTracks),
    [cameraTracks]
  );

  const validScreens = useMemo(
    () => filterValidTracks(screenShareTracks),
    [screenShareTracks]
  );

  /*
   * Identify teacher screen, teacher camera,
   * and student cameras.
   */
  const {
    teacherScreenShare,
    teacherCamera,
    studentCameras,
  } = useMemo(() => {
    let teacherScreen = null;
    let teacherCam = null;
    const students = [];

    /*
     * Teacher screen share
     */
    for (const trackRef of validScreens) {
      if (
        getParticipantRole(trackRef.participant) === 'teacher'
      ) {
        teacherScreen = trackRef;
        break;
      }
    }

    /*
     * Cameras
     */
    for (const trackRef of validCameras) {
      const role = getParticipantRole(
        trackRef.participant
      );

      if (role === 'teacher') {
        if (!teacherCam) {
          teacherCam = trackRef;
        }
      } else {
        students.push(trackRef);
      }
    }

    return {
      teacherScreenShare: teacherScreen,
      teacherCamera: teacherCam,
      studentCameras: students,
    };
  }, [validCameras, validScreens]);

  /*
   * When teacher screen sharing:
   *
   * ONLY teacher screen share is visible.
   *
   * When screen sharing is not active:
   *
   * teacher camera + student cameras.
   */
  const activeCameras = [];

  if (teacherCamera) {
    activeCameras.push(teacherCamera);
  }

  activeCameras.push(...studentCameras);

  return (
    <div className="recording-container">

      {/* Keep all room audio active continuously */}
      <RoomAudioRenderer />

      {teacherScreenShare ? (
        <div className="teacher-screen">
          <VideoTrack
            trackRef={teacherScreenShare}
            className="video-element"
          />
        </div>
      ) : activeCameras.length > 0 ? (
        <div
          className="multi-camera-grid"
          data-count={Math.min(
            activeCameras.length,
            9
          )}
        >
          {activeCameras.map((trackRef) => (
            <VideoTrack
              key={trackRef.publication.trackSid}
              trackRef={trackRef}
              className="video-element"
            />
          ))}
        </div>
      ) : null}

    </div>
  );
}
