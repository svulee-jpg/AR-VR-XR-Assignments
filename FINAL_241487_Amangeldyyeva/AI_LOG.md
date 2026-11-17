# AI assistance log

Course rule (as stated by the instructor): any AI tool may be used, and the student names the tool and
explains how it helped when presenting the project. This file is the written record for that
presentation. It is updated as the work goes on.

## AI inside the product (required by the specification)

| Feature | Service | Input | Output |
|---|---|---|---|
| Voice commands in English | Web Speech API (`SpeechRecognition`, `en-US`) in Chrome; audio is processed by Google's speech service | Microphone audio | Recognised text, turned into actions by `js/commands.js` |

## AI used as a development helper

| Tool | Used for | Date |
|---|---|---|
| Claude (Anthropic), Claude Sonnet 5.5 | First version of the project skeleton: room layout, the `canvas-text`, `surface`, `ui-button` and `configurator` components, the voice module, the command parser with its tests, and the generator of the fan model (`tools/make_fan.py`) | 13 Nov 2026 |
| Claude (Anthropic), Claude Sonnet 5.5 | Second version (developer-style configurator): the materials and colours catalogue, procedural textures, ready-made designs, price and mortgage estimate, variant code, English voice parser and its tests, English interface texts | 13 Nov 2026 |
| Claude (Anthropic), Claude Sonnet 5.5 | Interior door as a sixth surface; company layer (landing page with design packages, live price bar, printable quote, consultation booking); material-card drawer and before/after wipe | 13 Nov 2026 |
| Claude (Anthropic), Claude Sonnet 5.5 | Showroom living room: new wide stripe wallpaper, "Living room" design, procedural furniture and decor (`js/livingset.js`) modelled on a reference photo; README and test updates | 13 and 18 Nov 2026 |

## What I did myself

*(Fill in as you go: read and ran every file, tested the scene, changed colours/texts/layout, interviews, user tests, report. This is what you will describe on the defense.)*
