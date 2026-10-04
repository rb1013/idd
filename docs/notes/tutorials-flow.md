# Tutorial Platform — End-to-End Flow

1. **Guardian** fills in the 3-section form → taps "Create Tutorial"
2. `create-tutorial` edge function validates quota, inserts tutorial (`status: generating`), queues a job → returns instantly
3. **DB Webhook** fires `process-tutorial-job` in the background
4. Function calls **Claude** for script → **DALL·E 3** per frame image → **OpenAI TTS** per frame audio → uploads to Storage
5. Tutorial flips to `status: preview`, guardian gets polled in the app
6. **Guardian** reviews frames, edits text/images if needed → submits for review
7. **Admin** sees it in the moderation queue → approves or rejects with notes
8. **Guardian** gets a push notification either way
9. If approved → tutorial is live in the shared library, guardian can link it to any user's learning page
10. **IDD user** sees it in their Learn screen with audio narration playing frame by frame
