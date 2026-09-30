import React, { useEffect, useState } from 'react';
import { LiveKitRoom } from '@livekit/components-react';
import RecordingRoom from './RecordingRoom';

function App() {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlParam = params.get('url');
      const tokenParam = params.get('token');
      
      if (urlParam && tokenParam) {
        setUrl(urlParam);
        setToken(tokenParam);
      } else {
        setError('Missing LiveKit URL or token in query parameters');
      }
    } catch (err) {
      setError(err.message);
    }
  }, []);

  if (error) {
    return <div style={{ color: 'white' }}>Error: {error}</div>;
  }

  if (!url || !token) {
    return <div style={{ color: 'white' }}>Waiting for configuration...</div>;
  }

  return (
    <LiveKitRoom
      serverUrl={url}
      token={token}
      connect={true}
      video={false} // don't publish local video
      audio={false} // don't publish local audio
    >
      <RecordingRoom />
    </LiveKitRoom>
  );
}

export default App;
