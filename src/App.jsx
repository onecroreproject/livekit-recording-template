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

      if (!urlParam || !tokenParam) {
        setError('Missing LiveKit URL or token in query parameters');
        return;
      }

      setUrl(urlParam);
      setToken(tokenParam);
    } catch (err) {
      console.error('Template initialization error:', err);
      setError(err.message);
    }
  }, []);

  if (error) {
    return (
      <div style={{ color: 'white', padding: '20px' }}>
        Error: {error}
      </div>
    );
  }

  if (!url || !token) {
    return (
      <div style={{ color: 'white', padding: '20px' }}>
        Waiting for configuration...
      </div>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={url}
      token={token}
      connect={true}
      video={false}
      audio={false}
    >
      <RecordingRoom />
    </LiveKitRoom>
  );
}

export default App;
