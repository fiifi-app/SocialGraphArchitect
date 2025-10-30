import RecordingIndicator from '../RecordingIndicator';
import { useState } from 'react';

export default function RecordingIndicatorExample() {
  const [isPaused, setIsPaused] = useState(false);

  return (
    <RecordingIndicator
      isRecording={true}
      isPaused={isPaused}
      duration="12:34"
      onPause={() => setIsPaused(!isPaused)}
      onStop={() => console.log('Stop recording')}
    />
  );
}
