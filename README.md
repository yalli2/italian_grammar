# Italian Grammar Made Easy — interactive study site

Interactive class website based on the workbook *Italian Grammar Made Easy* (Mike Zollo & Alan Wesson, Hodder Education).

- **Main page** (`index.html`): every unit of the book with progress, search by topic.
- **Unit pages** (`unit.html?u=1.2`): grammar notes (English / 한국어), conjugation tables, examples, and **every exercise** from the book with instant checking, scores and answers.
- **Native Italian audio**: pre-recorded with an Italian neural voice (Kokoro *if_sara*); falls back to the device's Italian voice. Speed control in the 🎧 menu.
- **Interface languages** (top-right 🌐): English, 한국어, Italiano, Español, Français, Deutsch, Português, 日本語, 中文.
- Progress and answers are saved in the browser (localStorage).

Structure: `data/` unit content (generated), `audio/` MP3s + `audio/index.js` manifest, `assets/` app code.
