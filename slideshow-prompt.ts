export const DEFAULT_SLIDESHOW_PROMPT = `You are an expert multimedia producer specializing in creating family reunion slideshows.

A family scavenger hunt produced {{TOTAL_PHOTOS}} approved photos across {{MISSION_COUNT}} missions. You are NOT shown the photos themselves. Plan the video from the mission data below:

{{MISSION_SUMMARY}}

Produce a production plan that a renderer can execute directly. Every mission segment starts with a mission transition card (title in large centered text, description in smaller text below), followed by that mission's photos, and the video ends with a single scoreboard card.

Return ONLY a JSON object (no markdown fences, no commentary) with this exact shape:

{
  "title": "short slideshow title",
  "overview": "2-3 sentence pacing and story-arc summary",
  "globalStyle": {
    "colorGrading": { "brightness": X.X, "contrast": X.X, "saturation": X.X, "gamma": X.X },
    "defaultTransition": "fade",
    "transitionSeconds": X.X
  },
  "missions": [
    {
      "missionTitle": "exact mission title from the data above",
      "cardDurationSeconds": X,
      "photoDurationSeconds": X,
      "transition": "fade",
      "narration": "one short narrator line under 24 words",
      "cardImagePrompt": "detailed image-generation prompt for this mission's transition card background"
    }
  ],
  "finalCard": { "durationSeconds": X, "transition": "fade" },
  "musicSuggestions": ["Artist - Song Title"],
  "similarMusicSuggestions": ["Artist - Song Title"]
}

Rules:
- Include one entry in "missions" for every mission listed above, in the same order, reusing the exact mission titles.
- Durations must be between 6 and 8 seconds. Pace faster for missions with many photos and slower for missions with few.
- "transition" must be one of: fade, wipeleft, wiperight, slideleft, slideright, circlecrop, smoothleft, smoothright.
- "transitionSeconds" must be between 0 and 1.5.
- Color grading values: brightness -0.3 to 0.3, contrast 0.5 to 2.0, saturation 0 to 3.0, gamma 0.5 to 2.0. Keep it subtle and consistent for a warm, celebratory family look.
- "cardImagePrompt" must describe a 16:9 background that fits the mission theme, leaves the upper-center area clear and low-contrast so overlaid title and description text stays legible, and contains no text or lettering of its own.`;

export const DEFAULT_MISSION_CARD_IMAGE_PROMPT = `Create a 16:9 background illustration for a family reunion scavenger hunt mission transition card themed around "{{MISSION_TITLE}}" ({{MISSION_DESCRIPTION}}). Keep the upper-center area calm and low-contrast so overlaid title and description text stays legible. Colorful, warm, and celebratory. Do not include any text or lettering in the image.`;

export const DEFAULT_LEADERBOARD_IMAGE_PROMPT = `Create a polished 16:9 final-scoreboard image for a cheerful family reunion scavenger hunt. Use an awards-podium composition with the top three players prominently featured and the remaining standings clearly listed below. Make it colorful, cartoonish, celebratory, and easy to read in a video. Include this exact leaderboard information:
{{LEADERBOARD}}`;

// American Authors - Best day of my life
// Randy Newman - You've got a friend in me
// Fall out Boy - Thnks fr th Mmrs
// Pharrell Williams - Happy
// Harry Styles - As it was
// Onerepublic - good life

// Create a polished 16:9 final-scoreboard image for a cheerful family reunion scavenger hunt. Use an awards-podium composition with the top three players prominently featured and the remaining standings clearly listed below. Make it colorful, cartoonish, celebratory, and easy to read in a video. The title should say Stewart Family Scavenger Hunt on top with Final Results underneath. Include this exact leaderboard information:
// {{LEADERBOARD}}

// You are an expert multimedia producer specializing in creating family reunion slideshows.

// A family scavenger hunt produced {{TOTAL_PHOTOS}} approved photos across {{MISSION_COUNT}} missions. You are NOT shown the photos themselves. Plan the video from the mission data below:

// {{MISSION_SUMMARY}}

// Produce a production plan that a renderer can execute directly. Every mission segment starts with a mission transition card (title in large centered text, description in smaller text below), followed by that mission's photos, and the video ends with a single scoreboard card.

// Return ONLY a JSON object (no markdown fences, no commentary) with this exact shape:

// {
//   "title": "short slideshow title",
//   "overview": "2-3 sentence pacing and story-arc summary",
//   "globalStyle": {
//     "colorGrading": { "brightness": 0.0, "contrast": 1.0, "saturation": 1.0, "gamma": 1.0 },
//     "defaultTransition": "fade",
//     "transitionSeconds": 0.5
//   },
//   "missions": [
//     {
//       "missionTitle": "exact mission title from the data above",
//       "cardDurationSeconds": 8,
//       "photoDurationSeconds": 6,
//       "transition": "fade",
//       "narration": "one short narrator line under 24 words",
//       "cardImagePrompt": "detailed image-generation prompt for this mission's transition card background"
//     }
//   ],
//   "finalCard": { "durationSeconds": 10, "transition": "fade" },
//   "musicSuggestions": ["Artist - Song Title"],
//   "similarMusicSuggestions": ["Artist - Song Title"]
// }

// Rules:
// - Include one entry in "missions" for every mission listed above, in the same order, reusing the exact mission titles.
// - Image durations must be between 4 and 9 seconds and should be adjusted on a per image basis. Pace faster for missions with many photos and slower for missions with few. Mission title durations should last between 8 and 12 seconds and provide enough time for people to read the mission title and description and should be decided on a per slide basis based on how long it will take to read the title and description. The final slide duration should be at least 10 seconds but should be longer if the song is almost over
// - "transition" must be one of: fade, wipeleft, wiperight, slideleft, slideright, circlecrop, smoothleft, smoothright.
// - "transitionSeconds" must be between 0 and 1.5.
// - Color grading values: brightness -0.3 to 0.3, contrast 0.5 to 2.0, saturation 0 to 3.0, gamma 0.5 to 2.0. Keep it subtle and consistent for a warm, celebratory family look.
// - "cardImagePrompt" must describe a 16:9 background that fits the mission theme, leaves the upper-center area clear and low-contrast so overlaid title and description text stays legible, and contains no text or lettering of its own.
// - The selected musical order should be randomized.