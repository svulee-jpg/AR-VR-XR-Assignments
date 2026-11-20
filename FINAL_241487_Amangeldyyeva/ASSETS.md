# Third-party assets

Everything in this project is own work (code, furniture, textures, the fan model), except the four
panoramas below. They are used to make the apartment look like a real flat (js/realism.js and
js/windowview.js).

| File in this repository | Made from | Source and licence | How it is used |
|---|---|---|---|
| `img/env/apartment-512.hdr` | "Lebombo", an HDR panorama of an empty apartment | [polyhaven.com/a/lebombo](https://polyhaven.com/a/lebombo), CC0 (public domain) | Image-based lighting: lights every material and appears in reflections. Reduced to 512 x 256 and made almost colourless, so it does not tint the finishes |
| `img/views/city-day.jpg`, `img/views/city-evening.jpg` | "Potsdamer Platz" | [polyhaven.com/a/potsdamer_platz](https://polyhaven.com/a/potsdamer_platz), CC0 | City view in the windows |
| `img/views/sea-day.jpg`, `img/views/sea-evening.jpg` | "Venice Sunset" | [polyhaven.com/a/venice_sunset](https://polyhaven.com/a/venice_sunset), CC0 | Sea view in the windows |
| `img/views/garden-day.jpg`, `img/views/garden-evening.jpg` | "Rooitou Park" | [polyhaven.com/a/rooitou_park](https://polyhaven.com/a/rooitou_park), CC0 | Garden view in the windows |

The 1k versions of the panoramas were taken from the copies in the `pmndrs/drei-assets` repository on
GitHub (`hdri/*.hdr`), which mirrors these Poly Haven files. The window pictures are rectilinear
"photographs" cut out of each panorama, and the evening versions are darkened and colour-graded copies.
All of this is done by `tools/make_realism_assets.py`, so the files can be rebuilt:

```
python3 tools/make_realism_assets.py <folder with the four .hdr files> img
```

CC0 needs no attribution; the sources are listed so that anyone can check them.
