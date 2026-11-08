# Rhythm Maker Ver. 3.0 / 3.5

## Ver. 3.0 Audio Studio
- MP3 / WAV / WAVE file selection
- HTMLAudioElement playback, pause and stop
- Web Audio API waveform decoding and Canvas drawing
- Waveform click-to-seek
- BPM-based measure and 16th-step synchronization
- Separate amber playback line and cyan placement cursor
- Configurable chart start offset (-5000 to +5000 ms)

## Ver. 3.5 Data Management
- Scratch-oriented TXT export/import, preserving the existing four-column note format
- AUDIO_OFFSET_MS metadata in TXT comments
- IndexedDB project save/load, including the source audio Blob
- Startup restoration of the last saved project
- Chart validation for BPM, measure, lane, step, duplicate positions, hold duration and 36-note measure limit

## Compatibility
- Existing D/F/J/K lane placement and arrow-key navigation are retained.
- Existing TXT rows remain `time_ms|lane|type|duration_ms`.
- Previous TXT files without AUDIO_OFFSET_MS load with an offset of 0 ms.
- Run with a local HTTP server (for example VS Code Live Server); do not open index.html via file://.

## Verification performed
- JavaScript syntax checks for every module.
- Static check that each hard-coded querySelector ID exists in index.html and is unique.
- TXT export/import round-trip test, including audio offset.
- Data validation tests for BPM, duplicate notes, hold duration and the 36-note cap.

A real-browser playback test with a user-provided MP3/WAV is still required on the target device/browser.
