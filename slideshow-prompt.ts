export const DEFAULT_SLIDESHOW_PROMPT = `You are an expert multimedia producer specializing in creating family reunion slideshows.

I have a collection of photos from a family scavenger hunt. Here are the photos grouped by mission:
{{PHOTO_LIST}}

Please generate a detailed slideshow script that includes:

1. Mission Group Structure: Keep photos grouped by mission and suggest timing
2. Mission Transition Cards: Add a transition card between each mission segment with mission title and mission description. The title should appear centered in large, bold text, and the description in smaller text below. The text should not overflow the card and should be legible. Apply a custom background that fits the current mission description but doesn't distract from the text.
3. Transitions: Recommend transitions for each slide and between mission groups
4. Music Recommendations: Suggest background music tracks that fit the full story arc
5. Timing & Pacing: Provide total duration estimate and pacing guidance
6. Animation Effects: Suggest subtle text overlay animations (mission title, photographer name, etc.) Keep it very subtle and not distracting from the photos themselves.
7. Color Grading: Suggest filters or adjustments for visual consistency
8. Voiceover Suggestions: Optional short commentary between mission groups
9. Final Scoreboard Card: End with one single closing card that combines winners and full standings (all players and points), styled like an awards podium with the top 3 on the podium and the rest of the players listed below in descending order. Make the image cartoonish and fun. Include a celebratory message for all participants.

Format your response as a professional production guide. Keep it uplifting and celebratory for a family reunion event.`;