import React, { useEffect, useMemo } from 'react';
import { useTracks, RoomAudioRenderer, VideoTrack } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { EgressHelper } from '@livekit/egress-sdk';

// Helper to determine role from participant metadata or identity
const getParticipantRole = (participant) => {
  if (participant.metadata) {
    try {
      const meta = JSON.parse(participant.metadata);
      if (meta && meta.role) {
        return meta.role.toLowerCase();
      }
    } catch (e) {
      // Not JSON, check if it's a plain string
      if (typeof participant.metadata === 'string') {
        const lowerMeta = participant.metadata.toLowerCase();
        if (lowerMeta.includes('teacher') || lowerMeta.includes('instructor') || lowerMeta.includes('host')) {
          return 'teacher';
        }
      }
    }
  }
  
  // DEVELOPMENT FALLBACK ONLY - Do not rely on this in production
  if (participant.identity && participant.identity.toLowerCase().includes('teacher')) {
    return 'teacher';
  }
  
  return 'student'; // Default fallback
};

export default function RecordingRoom() {
  useEffect(() => {
    // Notify Egress SDK that the React layout is ready for recording
    EgressHelper.setLayoutReady();
  }, []);

  // useTracks automatically subscribes to and returns matching tracks.
  // We only care about Video tracks for rendering layout.
  // RoomAudioRenderer handles ALL audio tracks independently.
  const cameraTracks = useTracks([Track.Source.Camera], { onlySubscribed: true });
  const screenShareTracks = useTracks([Track.Source.ScreenShare], { onlySubscribed: true });

  // Exclude the egress recorder itself from video layout if it somehow publishes
  const filterValidTracks = (tracks) => {
    return tracks.filter((t) => {
      const identity = t.participant.identity?.toLowerCase() || '';
      const isEgress = identity.includes('egress') || identity.includes('recorder');
      return !isEgress && t.publication?.isSubscribed && t.track;
    });
  };

  const validCameras = useMemo(() => filterValidTracks(cameraTracks), [cameraTracks]);
  const validScreens = useMemo(() => filterValidTracks(screenShareTracks), [screenShareTracks]);

  // Identify teacher vs student tracks
  const { teacherScreenShare, teacherCamera, studentCameras } = useMemo(() => {
    let tScreen = null;
    let tCam = null;
    const sCams = [];

    // Check screens first
    for (const trackRef of validScreens) {
      if (getParticipantRole(trackRef.participant) === 'teacher') {
        tScreen = trackRef;
        break; // Only care about the first teacher screen share
      }
    }

    // Check cameras
    for (const trackRef of validCameras) {
      const role = getParticipantRole(trackRef.participant);
      if (role === 'teacher') {
        if (!tCam) tCam = trackRef;
      } else {
        sCams.push(trackRef);
      }
    }

    return { teacherScreenShare: tScreen, teacherCamera: tCam, studentCameras: sCams };
  }, [validCameras, validScreens]);

  // Logic 4: If teacher ScreenShare does NOT exist
  const activeCameras = [];
  if (teacherCamera) {
    activeCameras.push(teacherCamera);
  }
  activeCameras.push(...studentCameras);

  return (
    <div className="recording-container">
      {/* Render all room audio independently */}
      <RoomAudioRenderer />
      
      {teacherScreenShare ? (
        <div className="teacher-screen">
          <VideoTrack trackRef={teacherScreenShare} className="video-element" />
        </div>
      ) : activeCameras.length > 0 ? (
        <div className="multi-camera-grid" data-count={Math.min(activeCameras.length, 9)}>
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
