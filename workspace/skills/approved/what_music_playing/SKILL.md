--- 
name: what_music_playing 
description: Identifies the currently playing music. 
version: 1.0.0 
origin: local 
confidence: low 
tags: music, playback, current_track 
--- 

# What Music Playing 

* **Immediate Response**: Utilize the **respond** tool for instant feedback when the query is about an ongoing, real-time activity.
* **Contextual Awareness**: Ensure the system has access to the user's current playback devices or services to accurately identify the music.
* **Specificity**: If multiple devices or services are connected, prompt the user to specify (if not already predefined) to avoid ambiguity. 
* **Privacy Reminder**: Inform users about the need for permissions to access their playback history or current tracks, ensuring transparency. 

**Tip from Execution**: Since this task used **respond** with **0s** duration, prioritize speed in your response toolchain for similar queries, assuming the necessary contextual data is preemptively available.